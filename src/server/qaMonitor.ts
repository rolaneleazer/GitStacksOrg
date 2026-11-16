import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import type {
  ProductQaDashboardResponse,
  ProductQaLog,
  ProductQaReport,
  ProductQaSettings,
  QaCodeHotspotItem,
  QaLogLevel,
  QaLogSource,
  QaModuleBreakdownItem,
  QaPageBreakdownItem
} from '../shared/types.ts';
import { resolveLarkAlertTarget } from './notifications.ts';
import { renderQaEodPdfBuffer } from './qaPdf.ts';
import { broadcastToAdmins } from './realtime.ts';
import {
  addInboxEmailLog,
  addProductQaLog,
  addProductQaReport,
  findProductQaLogById,
  getProductQaSettings,
  listProductQaLogs,
  listProductQaReports,
  saveProductQaSettings,
  updateProductQaLog
} from './repository.ts';
import { resolveIntegrationSecret, sendLarkSmtpMail } from './vault.ts';

let qaLoopStarted = false;
let lastScanRunning = false;
const lastCriticalAlertMs = new Map<string, number>();

export function inferModuleFromContext(
  pagePath: string,
  requestPath: string,
  codeLocation: string,
  message: string
): string {
  const combined = `${pagePath} ${requestPath} ${codeLocation} ${message}`.toLowerCase();
  if (combined.includes('/demo') || combined.includes('demopage') || combined.includes('demousers')) {
    return 'Live Demo Sandbox';
  }
  if (combined.includes('cloudflare')) {
    return 'Cloudflare Edge & Analytics';
  }
  if (combined.includes('floatinglivechat') || combined.includes('/chat') || combined.includes('chatwatcher')) {
    return 'Floating Live Chat & Inbox';
  }
  if (combined.includes('notification') || combined.includes('lark_smtp') || combined.includes('lark')) {
    return 'Lark Mail Notifications';
  }
  if (combined.includes('contact') || combined.includes('/inquiries')) {
    return 'Contact & Inquiries';
  }
  if (combined.includes('/crm') || combined.includes('apollo') || combined.includes('prospect')) {
    return 'CRM & Prospecting';
  }
  if (combined.includes('virtualoffice') || combined.includes('agentsworkspace') || combined.includes('/agents')) {
    return 'Virtual Office HQ & Agents';
  }
  if (combined.includes('/insights') || combined.includes('/posts') || combined.includes('articlepage')) {
    return 'Articles & Insights';
  }
  if (combined.includes('/profile') || combined.includes('/auth') || combined.includes('/users')) {
    return 'Auth & Team Profiles';
  }
  if (combined.includes('branding') || combined.includes('favicon') || combined.includes('/pages')) {
    return 'Branding & Page Editor';
  }
  if (combined.includes('/integrations') || combined.includes('vault')) {
    return 'Integrations Vault';
  }
  if (combined.includes('/obama') || combined.includes('studiopage')) {
    return 'Back Office Studio';
  }
  if (combined.includes('/api/')) {
    return 'Backend API Server';
  }
  if (pagePath === '/' || pagePath === '') {
    return 'Public Home Page';
  }
  return 'Core Application';
}

export function parseStackLocation(stackTrace: string, explicitLocation?: string): string {
  if (explicitLocation && explicitLocation.trim()) {
    return explicitLocation.trim().slice(0, 180);
  }
  if (!stackTrace) return '';
  const lines = stackTrace
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Prefer frames inside /src/
    const srcMatch = line.match(/(?:at\s+([^\s(]+)\s+\()?[^\s)]*?(\/src\/[^\s):]+:\d+(?::\d+)?)/);
    if (srcMatch) {
      const fn = srcMatch[1] ? ` (${srcMatch[1]})` : '';
      return `${srcMatch[2].replace(/^\//, '')}${fn}`.slice(0, 180);
    }
  }

  for (const line of lines) {
    const fileMatch = line.match(/at\s+([^\s(]+)\s+\(?([^()\s]+:\d+:\d+)\)?/);
    if (fileMatch && !fileMatch[2].includes('node_modules')) {
      return `${fileMatch[2]} (${fileMatch[1]})`.slice(0, 180);
    }
  }
  return '';
}

export function computeLogFingerprint(params: {
  module_name: string;
  page_path: string;
  code_location: string;
  error_name: string;
  message: string;
}): string {
  const normalizedMsg = params.message
    .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
    .replace(/\d{4,}/g, '<num>')
    .trim()
    .toLowerCase();
  const raw = `${params.module_name}|${params.page_path}|${params.code_location}|${params.error_name}|${normalizedMsg}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

function deterministicDiagnosis(log: {
  level: QaLogLevel;
  source: QaLogSource;
  module_name: string;
  page_path: string;
  code_location: string;
  error_name: string;
  message: string;
  http_status: number | null;
}): { rootCause: string; fixSuggestion: string } {
  const msg = log.message.toLowerCase();
  const loc = log.code_location || `${log.module_name} (${log.page_path})`;

  if (msg.includes('smtp') || msg.includes('lark') || msg.includes('eauth') || msg.includes('auth')) {
    return {
      rootCause: `Lark Mail SMTP authentication or connection failure in ${loc}. Credentials or authorization code may be expired or missing.`,
      fixSuggestion:
        'Open Back Office -> Settings & Integrations -> Lark Mail SMTP Vault and re-verify your Lark email and SMTP Authorization Code.'
    };
  }
  if (msg.includes('cloudflare') || msg.includes('graphql') || log.module_name.includes('Cloudflare')) {
    return {
      rootCause: `Cloudflare API / GraphQL query error at ${loc}. Token permissions or zone rate-limit response triggered failure.`,
      fixSuggestion:
        'Verify Zone Analytics Read permission on your Cloudflare API Token in Integrations Vault and inspect upstream status codes.'
    };
  }
  if (log.http_status && log.http_status >= 500) {
    return {
      rootCause: `Unhandled HTTP ${log.http_status} server error inside ${loc} while serving ${log.page_path}.`,
      fixSuggestion: `Inspect server route handler at ${loc}, validate incoming request payload fields, and check Supabase/database error handling.`
    };
  }
  if (msg.includes('cannot read properties') || msg.includes('undefined') || log.error_name === 'TypeError') {
    return {
      rootCause: `Runtime TypeError accessing a null or undefined property inside ${loc} on page ${log.page_path}.`,
      fixSuggestion: `Add null/optional-chaining guards and fallback defaults before reading nested state in ${loc}.`
    };
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) {
    return {
      rootCause: `Client network or request timeout communicating with backend API from ${log.page_path} (${loc}).`,
      fixSuggestion:
        'Verify server availability, increase request timeout or add retry backoff in the frontend fetch wrapper.'
    };
  }
  if (log.http_status && log.http_status >= 400) {
    return {
      rootCause: `Client or validation rejection (HTTP ${log.http_status}) triggered in ${log.module_name} on ${log.page_path}.`,
      fixSuggestion: `Review input validation schema and error feedback banner in ${loc} so users receive clear guidance.`
    };
  }

  return {
    rootCause: `${log.level.toUpperCase()} detected in ${log.module_name} on ${log.page_path} at ${loc}: ${log.message.slice(0, 140)}.`,
    fixSuggestion: `Inspect ${loc} and verify error handling, input guards, and dependent service health.`
  };
}

async function resolveGeminiKey(userToken?: string): Promise<string> {
  const vaultKey = await resolveIntegrationSecret('gemini', userToken).catch(() => '');
  if (vaultKey) return vaultKey;
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey !== 'MY_GEMINI_API_KEY') return envKey.trim();
  return '';
}

export async function analyzeQaLogWithAgent(
  log: ProductQaLog,
  useGemini = true,
  userToken?: string
): Promise<{ ai_root_cause: string; ai_fix_suggestion: string }> {
  const fallback = deterministicDiagnosis(log);
  if (!useGemini || log.level === 'info') {
    return {
      ai_root_cause: fallback.rootCause,
      ai_fix_suggestion: fallback.fixSuggestion
    };
  }

  const apiKey = await resolveGeminiKey(userToken);
  if (!apiKey) {
    return {
      ai_root_cause: fallback.rootCause,
      ai_fix_suggestion: fallback.fixSuggestion
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this production software error log and pinpoint the exact root cause and code fix:\n${JSON.stringify({
        level: log.level,
        source: log.source,
        module_name: log.module_name,
        page_path: log.page_path,
        code_location: log.code_location,
        error_name: log.error_name,
        message: log.message,
        http_status: log.http_status,
        request_method: log.request_method,
        request_path: log.request_path,
        stack_trace: log.stack_trace.slice(0, 1200)
      })}`,
      config: {
        systemInstruction:
          'You are a Senior QA & Production SRE Agent. Identify which module, page, and exact code component/function caused this error, plus a concrete 1-2 sentence code fix.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rootCause: { type: Type.STRING },
            fixSuggestion: { type: Type.STRING }
          }
        }
      }
    });
    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      rootCause?: string;
      fixSuggestion?: string;
    };
    return {
      ai_root_cause: parsed.rootCause?.trim() || fallback.rootCause,
      ai_fix_suggestion: parsed.fixSuggestion?.trim() || fallback.fixSuggestion
    };
  } catch {
    return {
      ai_root_cause: fallback.rootCause,
      ai_fix_suggestion: fallback.fixSuggestion
    };
  }
}

export async function recordAndAnalyzeQaLog(input: {
  level?: QaLogLevel;
  source?: QaLogSource;
  module_name?: string;
  page_path?: string;
  code_location?: string;
  error_name?: string;
  message: string;
  stack_trace?: string;
  http_status?: number | null;
  request_method?: string;
  request_path?: string;
  session_id?: string;
  user_agent?: string;
  skipAi?: boolean;
}): Promise<ProductQaLog> {
  const cleanMsg = (input.message || '').trim().slice(0, 1500);
  if (!cleanMsg) {
    throw new Error('Log message cannot be empty.');
  }

  const level: QaLogLevel =
    input.level === 'warn' || input.level === 'info' ? input.level : 'error';
  const source: QaLogSource =
    input.source === 'backend' ||
    input.source === 'api' ||
    input.source === 'database' ||
    input.source === 'integration'
      ? input.source
      : 'frontend';
  const pagePath = (input.page_path || '/').trim().slice(0, 180) || '/';
  const requestPath = (input.request_path || '').trim().slice(0, 180);
  const stackTrace = (input.stack_trace || '').trim().slice(0, 4000);
  const codeLocation = parseStackLocation(stackTrace, input.code_location);
  const moduleName =
    (input.module_name || '').trim() ||
    inferModuleFromContext(pagePath, requestPath, codeLocation, cleanMsg);
  const errorName = (input.error_name || (level === 'error' ? 'Error' : 'Warning')).trim().slice(0, 80);

  const fingerprint = computeLogFingerprint({
    module_name: moduleName,
    page_path: pagePath,
    code_location: codeLocation,
    error_name: errorName,
    message: cleanMsg
  });

  const baseLog: ProductQaLog = {
    id: `qa-${crypto.randomUUID().slice(0, 10)}`,
    level,
    source,
    module_name: moduleName,
    page_path: pagePath,
    code_location: codeLocation,
    error_name: errorName,
    message: cleanMsg,
    stack_trace: stackTrace,
    http_status: input.http_status ?? null,
    request_method: (input.request_method || '').trim().slice(0, 16),
    request_path: requestPath,
    session_id: (input.session_id || '').trim().slice(0, 80),
    user_agent: (input.user_agent || '').trim().slice(0, 240),
    fingerprint,
    ai_root_cause: '',
    ai_fix_suggestion: '',
    status: 'open',
    created_at: new Date().toISOString()
  };

  const settings = await getProductQaSettings().catch(() => null);
  const useLiveAi = Boolean(settings?.agent_enabled !== false && !input.skipAi && level === 'error');
  const diag = await analyzeQaLogWithAgent(baseLog, useLiveAi);
  baseLog.ai_root_cause = diag.ai_root_cause;
  baseLog.ai_fix_suggestion = diag.ai_fix_suggestion;

  const saved = await addProductQaLog(baseLog);
  broadcastToAdmins('qa:log_created', { log: saved });

  // Optional real-time critical Lark email alert (with 10-minute cooldown per fingerprint)
  if (
    settings?.agent_enabled &&
    settings?.realtime_alert_on_critical &&
    saved.level === 'error'
  ) {
    const lastSent = lastCriticalAlertMs.get(saved.fingerprint) || 0;
    if (Date.now() - lastSent >= 10 * 60 * 1000) {
      lastCriticalAlertMs.set(saved.fingerprint, Date.now());
      void dispatchCriticalQaLarkAlert(saved, settings.recipient_email).catch(() => null);
    }
  }

  return saved;
}

async function dispatchCriticalQaLarkAlert(
  log: ProductQaLog,
  overrideRecipient?: string
): Promise<void> {
  const target = await resolveLarkAlertTarget();
  const recipient = overrideRecipient?.includes('@')
    ? overrideRecipient.trim().toLowerCase()
    : target.recipientEmail;
  if (!recipient) return;

  const subject = `[GitStack QA Alert] Error in ${log.module_name} (${log.page_path})`;
  const bodyText = [
    'GitStack Live QA Agent detected a critical product error:',
    '',
    `Module: ${log.module_name}`,
    `Page / Route: ${log.page_path}`,
    `Code Location: ${log.code_location || 'See stack trace'}`,
    `Error: ${log.error_name} — ${log.message}`,
    '',
    `Root Cause Diagnosis: ${log.ai_root_cause}`,
    `Suggested Fix: ${log.ai_fix_suggestion}`,
    '',
    `Inspect in Back Office: ${target.settings.admin_login_url || 'https://git-stack.org/obama'}`
  ].join('\n');

  let status: 'sent' | 'failed' = 'sent';
  let providerId = '';
  let errDetail = '';
  try {
    const sent = await sendLarkSmtpMail({
      toEmail: recipient,
      toName: 'GitStack QA Team',
      subject,
      bodyText
    });
    providerId = sent.messageId;
  } catch (err) {
    status = 'failed';
    errDetail = err instanceof Error ? err.message : 'SMTP error';
  }

  await addInboxEmailLog({
    id: `eml-${crypto.randomUUID().slice(0, 10)}`,
    recipient_email: recipient,
    subject,
    body: bodyText,
    channel: 'lark_smtp',
    category: 'qa_critical_alert',
    related_id: log.id,
    provider_message_id: providerId,
    status,
    error_detail: errDetail,
    sent_by: 'qa-live-agent',
    sent_at: new Date().toISOString()
  }).catch(() => null);
}

export function computeBreakdowns(logs: ProductQaLog[]): {
  moduleBreakdown: QaModuleBreakdownItem[];
  pageBreakdown: QaPageBreakdownItem[];
  codeHotspots: QaCodeHotspotItem[];
  healthScore: number;
  openErrorsCount: number;
  openWarnsCount: number;
  resolvedCount: number;
  totalLogs24h: number;
} {
  const nowMs = Date.now();
  const logs24h = logs.filter((l) => nowMs - new Date(l.created_at).getTime() <= 24 * 60 * 60 * 1000);
  const openErrors = logs.filter((l) => l.status === 'open' && l.level === 'error');
  const openWarns = logs.filter((l) => l.status === 'open' && l.level === 'warn');
  const resolvedCount = logs.filter((l) => l.status === 'resolved').length;

  const open24Errors = logs24h.filter((l) => l.status === 'open' && l.level === 'error').length;
  const open24Warns = logs24h.filter((l) => l.status === 'open' && l.level === 'warn').length;
  const healthScore = Math.max(15, Math.min(100, 100 - open24Errors * 8 - open24Warns * 2));

  // Group by Module
  const modMap = new Map<
    string,
    {
      total: number;
      err: number;
      warn: number;
      topErr: string;
      topLoc: string;
    }
  >();
  for (const l of logs) {
    if (l.status === 'ignored') continue;
    const key = l.module_name || 'General Application';
    const cur = modMap.get(key) || {
      total: 0,
      err: 0,
      warn: 0,
      topErr: l.message,
      topLoc: l.code_location
    };
    cur.total += 1;
    if (l.level === 'error') cur.err += 1;
    if (l.level === 'warn') cur.warn += 1;
    if (!cur.topLoc && l.code_location) cur.topLoc = l.code_location;
    modMap.set(key, cur);
  }
  const moduleBreakdown: QaModuleBreakdownItem[] = Array.from(modMap.entries())
    .map(([module_name, v]) => ({
      module_name,
      total_count: v.total,
      error_count: v.err,
      warn_count: v.warn,
      top_error: v.topErr,
      top_code_location: v.topLoc || 'No stack frame captured'
    }))
    .sort((a, b) => b.error_count - a.error_count || b.total_count - a.total_count);

  // Group by Page
  const pageMap = new Map<
    string,
    { total: number; err: number; topModule: string; topError: string }
  >();
  for (const l of logs) {
    if (l.status === 'ignored') continue;
    const key = l.page_path || '/';
    const cur = pageMap.get(key) || {
      total: 0,
      err: 0,
      topModule: l.module_name,
      topError: l.message
    };
    cur.total += 1;
    if (l.level === 'error') cur.err += 1;
    pageMap.set(key, cur);
  }
  const pageBreakdown: QaPageBreakdownItem[] = Array.from(pageMap.entries())
    .map(([page_path, v]) => ({
      page_path,
      total_count: v.total,
      error_count: v.err,
      top_module: v.topModule,
      top_error: v.topError
    }))
    .sort((a, b) => b.error_count - a.error_count || b.total_count - a.total_count);

  // Group by Code Location
  const codeMap = new Map<
    string,
    { module_name: string; count: number; latest_message: string; latest_at: string }
  >();
  for (const l of logs) {
    if (l.status === 'ignored' || !l.code_location) continue;
    const cur = codeMap.get(l.code_location) || {
      module_name: l.module_name,
      count: 0,
      latest_message: l.message,
      latest_at: l.created_at
    };
    cur.count += 1;
    codeMap.set(l.code_location, cur);
  }
  const codeHotspots: QaCodeHotspotItem[] = Array.from(codeMap.entries())
    .map(([code_location, v]) => ({
      code_location,
      module_name: v.module_name,
      count: v.count,
      latest_message: v.latest_message,
      latest_at: v.latest_at
    }))
    .sort((a, b) => b.count - a.count);

  return {
    moduleBreakdown,
    pageBreakdown,
    codeHotspots,
    healthScore,
    openErrorsCount: openErrors.length,
    openWarnsCount: openWarns.length,
    resolvedCount,
    totalLogs24h: logs24h.length
  };
}

export async function getQaDashboardData(userToken?: string): Promise<ProductQaDashboardResponse> {
  const [logs, reports, settings, larkTarget] = await Promise.all([
    listProductQaLogs(250, userToken),
    listProductQaReports(30, userToken),
    getProductQaSettings(userToken),
    resolveLarkAlertTarget()
  ]);

  const resolvedRecipientEmail =
    settings.recipient_email && settings.recipient_email.includes('@')
      ? settings.recipient_email.trim().toLowerCase()
      : larkTarget.recipientEmail;

  const stats = computeBreakdowns(logs);

  return {
    settings,
    resolvedRecipientEmail,
    larkConnected: larkTarget.larkConnected,
    summary: {
      healthScore: stats.healthScore,
      totalLogs24h: stats.totalLogs24h,
      openErrorsCount: stats.openErrorsCount,
      openWarnsCount: stats.openWarnsCount,
      resolvedCount: stats.resolvedCount,
      topFailingModule: stats.moduleBreakdown[0]?.module_name || 'None (Clean)',
      topFailingPage: stats.pageBreakdown[0]?.page_path || '/',
      topCodeHotspot: stats.codeHotspots[0]?.code_location || 'None detected'
    },
    moduleBreakdown: stats.moduleBreakdown,
    pageBreakdown: stats.pageBreakdown,
    codeHotspots: stats.codeHotspots,
    logs,
    reports
  };
}

export async function runLiveQaAgentScan(
  _triggeredBy = 'live-qa-agent',
  userToken?: string
): Promise<{ analyzedCount: number; dashboard: ProductQaDashboardResponse }> {
  if (lastScanRunning) {
    return { analyzedCount: 0, dashboard: await getQaDashboardData(userToken) };
  }
  lastScanRunning = true;
  try {
    const logs = await listProductQaLogs(200, userToken);
    let analyzedCount = 0;
    for (const log of logs) {
      if (log.status === 'open' && !log.ai_root_cause) {
        const diag = await analyzeQaLogWithAgent(log, log.level === 'error', userToken);
        await updateProductQaLog(log.id, diag, userToken).catch(() => null);
        analyzedCount += 1;
      }
    }
    await saveProductQaSettings({ last_scan_at: new Date().toISOString() }, userToken).catch(() => null);
    const dashboard = await getQaDashboardData(userToken);
    return { analyzedCount, dashboard };
  } finally {
    lastScanRunning = false;
  }
}

export async function reanalyzeSingleQaLog(
  logId: string,
  userToken?: string
): Promise<ProductQaLog | null> {
  const log = await findProductQaLogById(logId, userToken);
  if (!log) return null;
  const diag = await analyzeQaLogWithAgent(log, true, userToken);
  return updateProductQaLog(log.id, diag, userToken);
}

async function synthesizeEodExecutiveNarrative(params: {
  reportDate: string;
  healthScore: number;
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  moduleBreakdown: QaModuleBreakdownItem[];
  pageBreakdown: QaPageBreakdownItem[];
  codeHotspots: QaCodeHotspotItem[];
  userToken?: string;
}): Promise<{ executiveSummary: string; recommendedActions: string[] }> {
  const fallbackSummary =
    params.totalLogs === 0
      ? `Product QA monitoring recorded 0 errors or warnings on ${params.reportDate}. All modules, routes, and backend APIs maintained a ${params.healthScore}% stability score.`
      : `On ${params.reportDate}, the Live QA Agent audited ${params.totalLogs} product telemetry events (${params.errorCount} errors, ${params.warnCount} warnings) with an overall Product Health Score of ${params.healthScore}%. Primary instability concentrated in ${params.moduleBreakdown[0]?.module_name || 'Core Application'} on route ${params.pageBreakdown[0]?.page_path || '/'}.`;

  const fallbackActions: string[] = [];
  if (params.codeHotspots[0]) {
    fallbackActions.push(
      `Inspect code hotspot ${params.codeHotspots[0].code_location} (${params.codeHotspots[0].count} occurrences in ${params.codeHotspots[0].module_name}).`
    );
  }
  if (params.moduleBreakdown[0] && params.moduleBreakdown[0].error_count > 0) {
    fallbackActions.push(
      `Prioritize error remediation in ${params.moduleBreakdown[0].module_name} (${params.moduleBreakdown[0].error_count} failures).`
    );
  }
  if (params.pageBreakdown[0]) {
    fallbackActions.push(
      `Verify end-to-end UX and API validation on ${params.pageBreakdown[0].page_path}.`
    );
  }
  if (fallbackActions.length === 0) {
    fallbackActions.push('Continue automated real-time QA monitoring and nightly EOD digest delivery.');
  }

  const apiKey = await resolveGeminiKey(params.userToken);
  if (!apiKey) {
    return { executiveSummary: fallbackSummary, recommendedActions: fallbackActions };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const res = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Write an executive End-of-Day QA Engineering Summary & concrete action checklist based on this product telemetry:\n${JSON.stringify({
        reportDate: params.reportDate,
        healthScore: params.healthScore,
        totalLogs: params.totalLogs,
        errorCount: params.errorCount,
        warnCount: params.warnCount,
        moduleBreakdown: params.moduleBreakdown.slice(0, 6),
        pageBreakdown: params.pageBreakdown.slice(0, 6),
        codeHotspots: params.codeHotspots.slice(0, 5)
      })}`,
      config: {
        systemInstruction:
          'You are the Lead QA & SRE Engineer writing an End-of-Day summary for the engineering founder. Be clear, non-alarmist, pinpoint exact modules, pages, and code files, and output valid JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            recommendedActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });
    const parsed = JSON.parse((res.text ?? '{}').trim()) as {
      executiveSummary?: string;
      recommendedActions?: string[];
    };
    return {
      executiveSummary: parsed.executiveSummary?.trim() || fallbackSummary,
      recommendedActions:
        parsed.recommendedActions && parsed.recommendedActions.length > 0
          ? parsed.recommendedActions.slice(0, 5)
          : fallbackActions
    };
  } catch {
    return { executiveSummary: fallbackSummary, recommendedActions: fallbackActions };
  }
}

export async function generateAndSendQaEodReport(options: {
  triggerType: 'manual' | 'eod_cron';
  overrideRecipientEmail?: string;
  triggeredBy?: string;
  userToken?: string;
}): Promise<{ report: ProductQaReport; delivered: boolean; message: string }> {
  const now = new Date();
  const reportDate = now.toISOString().slice(0, 10);
  const [logs, settings, larkTarget] = await Promise.all([
    listProductQaLogs(250, options.userToken),
    getProductQaSettings(options.userToken),
    resolveLarkAlertTarget()
  ]);

  // Focus on last 24h logs (or all recent if none in 24h)
  const cutoffMs = now.getTime() - 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter((l) => new Date(l.created_at).getTime() >= cutoffMs);
  const scopeLogs = recentLogs.length > 0 ? recentLogs : logs.slice(0, 80);

  const stats = computeBreakdowns(scopeLogs);
  const errorCount = scopeLogs.filter((l) => l.level === 'error').length;
  const warnCount = scopeLogs.filter((l) => l.level === 'warn').length;

  const synthesis = await synthesizeEodExecutiveNarrative({
    reportDate,
    healthScore: stats.healthScore,
    totalLogs: scopeLogs.length,
    errorCount,
    warnCount,
    moduleBreakdown: stats.moduleBreakdown,
    pageBreakdown: stats.pageBreakdown,
    codeHotspots: stats.codeHotspots,
    userToken: options.userToken
  });

  const recipientEmail =
    options.overrideRecipientEmail && options.overrideRecipientEmail.includes('@')
      ? options.overrideRecipientEmail.trim().toLowerCase()
      : settings.recipient_email && settings.recipient_email.includes('@')
        ? settings.recipient_email.trim().toLowerCase()
        : larkTarget.recipientEmail;

  const reportId = `qar-${crypto.randomUUID().slice(0, 10)}`;
  const pdfFilename = `GitStack-QA-EOD-Report-${reportDate}.pdf`;
  const subject = `[GitStack QA Report] ${reportDate} — Health ${stats.healthScore}% (${errorCount} Errors, ${warnCount} Warnings)`;

  const draftReport: ProductQaReport = {
    id: reportId,
    report_date: reportDate,
    trigger_type: options.triggerType,
    recipient_email: recipientEmail,
    subject,
    health_score: stats.healthScore,
    total_logs: scopeLogs.length,
    error_count: errorCount,
    warn_count: warnCount,
    top_module: stats.moduleBreakdown[0]?.module_name || 'None',
    top_page: stats.pageBreakdown[0]?.page_path || '/',
    executive_summary: synthesis.executiveSummary,
    module_breakdown: stats.moduleBreakdown.slice(0, 10),
    page_breakdown: stats.pageBreakdown.slice(0, 10),
    recommended_actions: synthesis.recommendedActions,
    pdf_filename: pdfFilename,
    status: 'generated',
    provider_message_id: '',
    error_detail: '',
    created_at: now.toISOString()
  };

  const pdfBuffer = await renderQaEodPdfBuffer(draftReport, scopeLogs, stats.codeHotspots);

  const loginUrl = larkTarget.settings.admin_login_url || 'https://git-stack.org/obama';
  const bodyText = [
    `GITSTACK END-OF-DAY PRODUCT QA REPORT (${reportDate})`,
    `Health Score: ${stats.healthScore}% | Errors: ${errorCount} | Warnings: ${warnCount} | Total Logs: ${scopeLogs.length}`,
    '',
    'EXECUTIVE SUMMARY:',
    synthesis.executiveSummary,
    '',
    'TOP FAILING MODULES:',
    ...(stats.moduleBreakdown.length > 0
      ? stats.moduleBreakdown
          .slice(0, 5)
          .map(
            (m) =>
              `- ${m.module_name}: ${m.error_count} errors, ${m.warn_count} warnings (Code: ${m.top_code_location})`
          )
      : ['- None (Clean)']),
    '',
    'RECOMMENDED ACTIONS:',
    ...synthesis.recommendedActions.map((a, i) => `${i + 1}. ${a}`),
    '',
    `Full styled PDF report attached (${pdfFilename}).`,
    `Sign in to Backend Admin: ${loginUrl}`
  ].join('\n');

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden;">
      <div style="background: #0F172A; color: #FFFFFF; padding: 20px 24px; border-bottom: 4px solid #2563EB;">
        <div style="font-size: 11px; letter-spacing: 0.08em; color: #93C5FD; font-weight: 700;">GITSTACK LIVE QA AGENT · END-OF-DAY REPORT</div>
        <h2 style="margin: 6px 0 2px; font-size: 20px;">Product Health &amp; Error Summary (${reportDate})</h2>
        <div style="font-size: 12px; color: #CBD5E1;">Attached: <strong>${pdfFilename}</strong></div>
      </div>
      <div style="padding: 20px 24px; background: #FFFFFF;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 18px; border-collapse: separate; border-spacing: 8px 0;">
          <tr>
            <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; width: 25%;">
              <div style="font-size: 10px; color: #64748B; font-weight: 700;">HEALTH</div>
              <div style="font-size: 20px; font-weight: 700; color: ${stats.healthScore >= 90 ? '#16A34A' : stats.healthScore >= 70 ? '#D97706' : '#DC2626'};">${stats.healthScore}%</div>
            </td>
            <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; width: 25%;">
              <div style="font-size: 10px; color: #64748B; font-weight: 700;">ERRORS</div>
              <div style="font-size: 20px; font-weight: 700; color: ${errorCount > 0 ? '#DC2626' : '#16A34A'};">${errorCount}</div>
            </td>
            <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; width: 25%;">
              <div style="font-size: 10px; color: #64748B; font-weight: 700;">WARNINGS</div>
              <div style="font-size: 20px; font-weight: 700; color: #D97706;">${warnCount}</div>
            </td>
            <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; width: 25%;">
              <div style="font-size: 10px; color: #64748B; font-weight: 700;">TOP MODULE</div>
              <div style="font-size: 13px; font-weight: 700; color: #1D4ED8;">${draftReport.top_module}</div>
            </td>
          </tr>
        </table>
        <h3 style="font-size: 14px; margin: 0 0 8px;">Executive Summary</h3>
        <p style="font-size: 13px; line-height: 1.55; color: #334155; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px;">${synthesis.executiveSummary}</p>
        ${
          stats.moduleBreakdown.length > 0
            ? `<h3 style="font-size: 14px; margin: 16px 0 8px;">Errors by Module &amp; Code Location</h3>
               <ul style="font-size: 12px; color: #1E293B; padding-left: 18px; line-height: 1.6;">
                 ${stats.moduleBreakdown
                   .slice(0, 5)
                   .map(
                     (m) =>
                       `<li><strong>${m.module_name}</strong>: ${m.error_count} errors, ${m.warn_count} warnings · <code>${m.top_code_location}</code></li>`
                   )
                   .join('')}
               </ul>`
            : ''
        }
        <h3 style="font-size: 14px; margin: 16px 0 8px;">Recommended Engineering Actions</h3>
        <ol style="font-size: 12.5px; color: #1E293B; padding-left: 18px; line-height: 1.6;">
          ${synthesis.recommendedActions.map((a) => `<li>${a}</li>`).join('')}
        </ol>
        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #E2E8F0;">
          <a href="${loginUrl}" style="display: inline-block; background: #1D4ED8; color: #FFFFFF; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-size: 12px; font-weight: 700;">Open Back Office QA Console</a>
        </div>
      </div>
    </div>
  `;

  let delivered = false;
  try {
    const sent = await sendLarkSmtpMail(
      {
        toEmail: recipientEmail,
        toName: 'GitStack Engineering Admin',
        subject,
        bodyText,
        bodyHtml,
        attachments: [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      },
      options.userToken
    );
    draftReport.status = 'sent';
    draftReport.provider_message_id = sent.messageId;
    delivered = true;
  } catch (err) {
    draftReport.status = 'failed';
    draftReport.error_detail =
      err instanceof Error ? err.message : 'Lark Mail SMTP failed sending QA PDF report';
  }

  const savedReport = await addProductQaReport(draftReport, options.userToken);

  await addInboxEmailLog(
    {
      id: `eml-${crypto.randomUUID().slice(0, 10)}`,
      recipient_email: recipientEmail,
      subject,
      body: bodyText,
      channel: 'lark_smtp',
      category: 'qa_eod_report',
      related_id: savedReport.id,
      provider_message_id: savedReport.provider_message_id,
      status: delivered ? 'sent' : 'failed',
      error_detail: savedReport.error_detail,
      sent_by: options.triggeredBy || 'qa-live-agent',
      sent_at: now.toISOString()
    },
    options.userToken
  ).catch(() => null);

  if (delivered || options.triggerType === 'eod_cron') {
    await saveProductQaSettings(
      {
        last_eod_sent_date: reportDate,
        last_scan_at: now.toISOString()
      },
      options.userToken
    ).catch(() => null);
  }

  broadcastToAdmins('qa:report_sent', { report: savedReport });

  return {
    report: savedReport,
    delivered,
    message: delivered
      ? `EOD QA PDF report (${pdfFilename}) emailed to ${recipientEmail} via Lark Mail.`
      : `PDF report generated (download available below), but Lark Mail delivery failed: ${savedReport.error_detail}`
  };
}

export async function renderExistingReportPdfBuffer(
  report: ProductQaReport,
  userToken?: string
): Promise<Buffer> {
  const logs = await listProductQaLogs(250, userToken);
  const stats = computeBreakdowns(logs);
  return renderQaEodPdfBuffer(report, logs, stats.codeHotspots);
}

export function startQaMonitorLoop(): void {
  if (qaLoopStarted) return;
  qaLoopStarted = true;
  setInterval(async () => {
    try {
      const settings = await getProductQaSettings();
      if (!settings.agent_enabled) return;

      // Re-analyze any un-analyzed open logs in background
      await runLiveQaAgentScan('qa-background-loop').catch(() => null);

      // End-of-Day scheduler check
      if (settings.eod_enabled) {
        const now = new Date();
        const todayUtc = now.toISOString().slice(0, 10);
        const currentHourUtc = now.getUTCHours();
        if (currentHourUtc >= settings.eod_hour_utc && settings.last_eod_sent_date !== todayUtc) {
          await generateAndSendQaEodReport({
            triggerType: 'eod_cron',
            triggeredBy: 'qa-eod-scheduler'
          }).catch(() => null);
        }
      }
    } catch {
      // keep background loop resilient
    }
  }, 60_000);
}
