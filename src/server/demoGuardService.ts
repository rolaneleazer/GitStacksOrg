import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  DemoGuardAdminParityCheck,
  DemoGuardAlertItem,
  DemoGuardBaselineSnapshot,
  DemoGuardDashboardResponse,
  DemoGuardDriftItem,
  DemoGuardIsolationCheck,
  WorkspaceModuleId
} from '../shared/types.ts';
import { DEFAULT_MODULE_LABELS } from '../shared/workspaceLayout.ts';
import { resolveLarkAlertTarget } from './notifications.ts';
import { recordLoopOutcome, shouldRunLoopTick } from './quotaShield.ts';
import { broadcastToAdmins } from './realtime.ts';
import { addInboxEmailLog, getAdSenseSettings, getAllPageContents, listCrmLeads, listPosts } from './repository.ts';
import { sendLarkSmtpMail } from './vault.ts';

const IS_VERCEL = Boolean(process.env.VERCEL);
const GUARD_FILE = IS_VERCEL
  ? path.join(os.tmpdir(), 'gitstack-data', 'gitstack-demo-guard.json')
  : path.resolve(process.cwd(), 'data', 'gitstack-demo-guard.json');

const WATCHED_DEMO_FILES = [
  'src/pages/DemoPage.tsx',
  'src/components/demo/DemoBackOfficeShowcase.tsx',
  'src/components/demo/InventorySyncDemo.tsx',
  'src/components/demo/EInvoicePortalDemo.tsx',
  'src/components/demo/AiConciergeDemo.tsx',
  'src/components/demo/FlowCrmChaserDemo.tsx',
  'src/shared/demoSandboxData.ts'
];

interface DemoGuardPersistedState {
  autoWatchEnabled: boolean;
  autoEmailEnabled: boolean;
  recipientEmail: string;
  lastScanAt: string | null;
  baseline: DemoGuardBaselineSnapshot | null;
  driftItems: DemoGuardDriftItem[];
  isolationChecks: DemoGuardIsolationCheck[];
  adminParityChecks: DemoGuardAdminParityCheck[];
  alerts: DemoGuardAlertItem[];
  blockedMutationCount: number;
}

let cachedState: DemoGuardPersistedState | null = null;
let writeChain: Promise<void> = Promise.resolve();
let guardLoopStarted = false;
let scanInProgress = false;
const recentEmailSignatures = new Map<string, number>();

async function computeWatchedDemoHashes(): Promise<{
  fileHashes: Record<string, string>;
  overallHash: string;
  readableContents: Record<string, string>;
}> {
  const fileHashes: Record<string, string> = {};
  const readableContents: Record<string, string> = {};
  const combined = crypto.createHash('sha256');

  for (const rel of WATCHED_DEMO_FILES) {
    const abs = path.resolve(process.cwd(), rel);
    try {
      const text = await fs.readFile(abs, 'utf8');
      const h = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
      fileHashes[rel] = h;
      readableContents[rel] = text;
      combined.update(`${rel}:${h}|`);
    } catch {
      fileHashes[rel] = 'bundled-runtime';
      combined.update(`${rel}:bundled-runtime|`);
    }
  }

  return {
    fileHashes,
    overallHash: combined.digest('hex').slice(0, 24),
    readableContents
  };
}

function evaluateIsolationChecks(
  readableContents: Record<string, string>,
  blockedCount: number
): DemoGuardIsolationCheck[] {
  const showcaseCode = readableContents['src/components/demo/DemoBackOfficeShowcase.tsx'] || '';
  const demoPageCode = readableContents['src/pages/DemoPage.tsx'] || '';
  const sandboxDataCode = readableContents['src/shared/demoSandboxData.ts'] || '';
  const combinedDemoUi = `${showcaseCode}\n${demoPageCode}\n${sandboxDataCode}`;

  const hasAdminEndpointRef =
    /\/api\/admin\/|\/api\/lark\/|\/api\/growth\/|\/api\/crm\//i.test(showcaseCode) ||
    /\/api\/admin\/|\/api\/lark\/|\/api\/growth\//i.test(demoPageCode);

  const hasAuthTokenAccess =
    /getStoredToken\s*\(|sessionStorage\.getItem\(['"]gitstack_studio_token/i.test(combinedDemoUi);

  const mutatesDocumentStyles =
    /document\.documentElement\.style\.setProperty/i.test(combinedDemoUi);

  const hasDirectDbOrSmtp =
    /createClient\(|sendLarkSmtpMail|upsertPost|savePageContent|service_role/i.test(combinedDemoUi);

  const hasReadOnlyFraming =
    /Demo Back Office|Simulation|Simulated|Read-Only|Client-Side/i.test(showcaseCode || demoPageCode);

  return [
    {
      id: 'iso-no-admin-api',
      label: 'Zero Production Admin / Write API Calls in Demo UI',
      status: hasAdminEndpointRef ? 'fail' : 'pass',
      metric: hasAdminEndpointRef ? 'LEAK DETECTED' : '0 Admin Refs',
      detail: hasAdminEndpointRef
        ? 'Live Demo files reference restricted /api/admin, /api/lark, or /api/growth routes.'
        : 'Static bundle audit confirmed zero /api/admin/*, /api/lark/*, or /api/growth/* calls inside Demo components.'
    },
    {
      id: 'iso-no-token-storage',
      label: 'Zero Admin Session Token or Vault Secret Access',
      status: hasAuthTokenAccess || hasDirectDbOrSmtp ? 'fail' : 'pass',
      metric: hasAuthTokenAccess || hasDirectDbOrSmtp ? 'SECRET EXPOSURE' : 'Isolated Memory',
      detail:
        hasAuthTokenAccess || hasDirectDbOrSmtp
          ? 'Detected unauthorized token or DB client usage in Demo code.'
          : 'Demo Showcase cannot read studio Admin Bearer tokens, Supabase service keys, or SMTP credentials.'
    },
    {
      id: 'iso-dom-theme',
      label: 'Production Theme & DOM Global Style Isolation',
      status: mutatesDocumentStyles ? 'fail' : 'pass',
      metric: mutatesDocumentStyles ? 'DOM MUTATION' : 'Scoped State',
      detail: mutatesDocumentStyles
        ? 'Demo branding preview must scope styles locally instead of editing document.documentElement.'
        : 'Branding color switches in Live Demo are scoped purely to the sandbox preview container.'
    },
    {
      id: 'iso-runtime-firewall',
      label: 'Runtime Express Demo-Origin Mutation Trap',
      status: blockedCount > 0 ? 'warning' : 'pass',
      metric: blockedCount > 0 ? `${blockedCount} Blocked` : 'Armed (0 Breaches)',
      detail:
        blockedCount > 0
          ? `${blockedCount} unauthorized mutation attempt(s) originating from /demo were blocked with HTTP 403 and reported.`
          : 'Express middleware actively inspects demo-origin traffic and blocks any unauthorized write or admin route access.'
    },
    {
      id: 'iso-readonly-framing',
      label: 'Explicit Read-Only Simulation Boundary UI',
      status: !readableContents['src/pages/DemoPage.tsx'] || hasReadOnlyFraming ? 'pass' : 'warning',
      metric: hasReadOnlyFraming ? 'Verified' : 'Check UI Label',
      detail: 'Live Demo displays explicit simulation notices so prospects know edits stay strictly client-side.'
    }
  ];
}

async function readState(): Promise<DemoGuardPersistedState> {
  if (cachedState) return cachedState;
  try {
    const raw = await fs.readFile(GUARD_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DemoGuardPersistedState>;
    cachedState = {
      autoWatchEnabled: parsed.autoWatchEnabled !== false,
      autoEmailEnabled: parsed.autoEmailEnabled !== false,
      recipientEmail: (parsed.recipientEmail || '').trim().toLowerCase(),
      lastScanAt: parsed.lastScanAt || null,
      baseline: parsed.baseline || null,
      driftItems: Array.isArray(parsed.driftItems) ? parsed.driftItems : [],
      isolationChecks: Array.isArray(parsed.isolationChecks) ? parsed.isolationChecks : [],
      adminParityChecks: Array.isArray(parsed.adminParityChecks) ? parsed.adminParityChecks : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts.slice(0, 80) : [],
      blockedMutationCount: Number(parsed.blockedMutationCount || 0)
    };
  } catch {
    cachedState = {
      autoWatchEnabled: true,
      autoEmailEnabled: true,
      recipientEmail: '',
      lastScanAt: null,
      baseline: null,
      driftItems: [],
      isolationChecks: [],
      adminParityChecks: [],
      alerts: [],
      blockedMutationCount: 0
    };
  }
  return cachedState;
}

async function saveState(next: DemoGuardPersistedState): Promise<void> {
  cachedState = {
    ...next,
    alerts: next.alerts.slice(0, 80)
  };
  const payload = JSON.stringify(cachedState, null, 2);
  writeChain = writeChain
    .then(async () => {
      await fs.mkdir(path.dirname(GUARD_FILE), { recursive: true });
      await fs.writeFile(GUARD_FILE, payload, 'utf8');
    })
    .catch(() => {
      // ignore if read-only filesystem
    });
  await writeChain;
}

async function dispatchRealTimeGuardEmail(params: {
  signature: string;
  subject: string;
  bodyText: string;
  relatedId: string;
  recipientOverride?: string;
  forceBypassCooldown?: boolean;
  userToken?: string;
}): Promise<{ delivered: boolean; recipient: string; statusNote: string }> {
  const target = await resolveLarkAlertTarget().catch(() => ({
    recipientEmail: 'gitstackitsolution@gmail.com',
    larkConnected: false,
    larkSenderEmail: '',
    settings: null
  }));
  const recipient = (
    params.recipientOverride ||
    target.recipientEmail ||
    process.env.STUDIO_ADMIN_EMAIL ||
    'gitstackitsolution@gmail.com'
  )
    .trim()
    .toLowerCase();

  const lastSent = recentEmailSignatures.get(params.signature) || 0;
  if (!params.forceBypassCooldown && Date.now() - lastSent < 10 * 60 * 1000) {
    return {
      delivered: false,
      recipient,
      statusNote: 'Deduplicated (already alerted within 10-minute cooldown window)'
    };
  }

  recentEmailSignatures.set(params.signature, Date.now());
  const fullBody = [
    params.bodyText.trim(),
    '',
    '------------------------------------------------------------',
    'Inspect Demo Guard & Alerts immediately in GitStack Back Office:',
    'https://git-stack.org/obama'
  ].join('\n');

  let status: 'sent' | 'failed' = 'sent';
  let providerMessageId = '';
  let errorDetail = '';

  try {
    const res = await sendLarkSmtpMail(
      {
        toEmail: recipient,
        toName: 'GitStack Admin',
        subject: params.subject,
        bodyText: fullBody
      },
      params.userToken
    );
    providerMessageId = res.messageId;
  } catch (err) {
    status = 'failed';
    errorDetail = err instanceof Error ? err.message : 'Lark Mail SMTP not connected yet';
  }

  await addInboxEmailLog(
    {
      id: `eml-${crypto.randomUUID().slice(0, 10)}`,
      recipient_email: recipient,
      subject: params.subject,
      body: fullBody,
      channel: 'lark_smtp',
      category: 'demo_guard_alert',
      related_id: params.relatedId,
      provider_message_id: providerMessageId,
      status,
      error_detail: errorDetail,
      sent_by: 'sentry-demo-guard',
      sent_at: new Date().toISOString()
    },
    params.userToken
  ).catch(() => null);

  return {
    delivered: status === 'sent',
    recipient,
    statusNote: status === 'sent' ? `Sent via Lark Mail SMTP (${providerMessageId})` : `Queued in Back Office (${errorDetail})`
  };
}

async function runAdminModuleParityProbes(
  adminToken?: string
): Promise<DemoGuardAdminParityCheck[]> {
  const port = Number(process.env.PORT || 3000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const results: DemoGuardAdminParityCheck[] = [];

  if (adminToken) {
    const probes: Array<{ moduleId: WorkspaceModuleId; endpoint: string }> = [
      { moduleId: 'agents', endpoint: '/api/admin/bootstrap' },
      { moduleId: 'crm', endpoint: '/api/admin/crm/leads' },
      { moduleId: 'chat_auto_response', endpoint: '/api/admin/chat/auto-responses' },
      { moduleId: 'contact_registry', endpoint: '/api/admin/contact-registry' },
      { moduleId: 'search_console', endpoint: '/api/admin/search-console' },
      { moduleId: 'marketing', endpoint: '/api/admin/marketing' },
      { moduleId: 'google_trends', endpoint: '/api/admin/google-trends' },
      { moduleId: 'ai_visibility', endpoint: '/api/admin/ai-visibility' },
      { moduleId: 'qa', endpoint: '/api/admin/qa/dashboard' },
      { moduleId: 'cybersecurity', endpoint: '/api/admin/cybersecurity' },
      { moduleId: 'users', endpoint: '/api/admin/users' }
    ];

    for (const probe of probes) {
      const start = Date.now();
      try {
        const res = await fetch(`${baseUrl}${probe.endpoint}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const durationMs = Date.now() - start;
        const ok = res.ok;
        results.push({
          moduleId: probe.moduleId,
          moduleLabel: DEFAULT_MODULE_LABELS[probe.moduleId] || probe.moduleId,
          endpoint: probe.endpoint,
          status: ok ? 'pass' : res.status >= 500 ? 'fail' : 'warning',
          httpStatus: res.status,
          durationMs,
          detail: ok
            ? `Admin Bearer verified HTTP ${res.status} JSON response in ${durationMs}ms.`
            : `Admin endpoint returned HTTP ${res.status}.`
        });
      } catch (err) {
        results.push({
          moduleId: probe.moduleId,
          moduleLabel: DEFAULT_MODULE_LABELS[probe.moduleId] || probe.moduleId,
          endpoint: probe.endpoint,
          status: 'fail',
          httpStatus: 0,
          durationMs: Date.now() - start,
          detail: err instanceof Error ? err.message : 'Admin endpoint probe unreachable'
        });
      }
    }
    return results;
  }

  // Service-level parity verification when running without interactive user token (background loop)
  const serviceProbes: Array<{
    moduleId: WorkspaceModuleId;
    endpoint: string;
    run: () => Promise<unknown>;
  }> = [
    { moduleId: 'articles', endpoint: 'listPosts(true)', run: () => listPosts(true) },
    { moduleId: 'pages', endpoint: 'getAllPageContents()', run: () => getAllPageContents() },
    { moduleId: 'crm', endpoint: 'listCrmLeads()', run: () => listCrmLeads() },
    { moduleId: 'adsense', endpoint: 'getAdSenseSettings()', run: () => getAdSenseSettings() }
  ];

  for (const probe of serviceProbes) {
    const start = Date.now();
    try {
      await probe.run();
      const durationMs = Date.now() - start;
      results.push({
        moduleId: probe.moduleId,
        moduleLabel: DEFAULT_MODULE_LABELS[probe.moduleId] || probe.moduleId,
        endpoint: probe.endpoint,
        status: 'pass',
        httpStatus: 200,
        durationMs,
        detail: `Backend module data layer verified in ${durationMs}ms.`
      });
    } catch (err) {
      results.push({
        moduleId: probe.moduleId,
        moduleLabel: DEFAULT_MODULE_LABELS[probe.moduleId] || probe.moduleId,
        endpoint: probe.endpoint,
        status: 'fail',
        httpStatus: 500,
        durationMs: Date.now() - start,
        detail: err instanceof Error ? err.message : 'Service parity failure'
      });
    }
  }

  return results;
}

export async function runDemoGuardAndAdminParityScan(options?: {
  reason?: 'manual' | 'scheduled' | 'boot' | 'admin_login';
  adminToken?: string;
  forceEmailTest?: boolean;
}): Promise<DemoGuardDashboardResponse> {
  if (scanInProgress) {
    return getDemoGuardDashboard();
  }
  scanInProgress = true;
  try {
    const state = await readState();
    const nowIso = new Date().toISOString();
    const { fileHashes, overallHash, readableContents } = await computeWatchedDemoHashes();

    // Auto-seal initial baseline on first boot
    let baseline = state.baseline;
    if (!baseline) {
      baseline = {
        sealedAt: nowIso,
        sealedBy: 'system-initial-seal',
        overallHash,
        fileHashes,
        isolationSignature: 'strict-readonly-v1'
      };
    }

    // On background scheduled ticks, if local watched file hashes match sealed baseline and parity was verified within 60 minutes, skip Supabase queries/writes
    const lastScanMs = state.lastScanAt ? Date.parse(state.lastScanAt) || 0 : 0;
    if (
      options?.reason === 'scheduled' &&
      !options?.adminToken &&
      state.baseline &&
      overallHash === state.baseline.overallHash &&
      state.adminParityChecks.length > 0 &&
      Date.now() - lastScanMs < 60 * 60_000
    ) {
      recordLoopOutcome('demo_guard', 'skipped_idle');
      return buildDashboardPayload(state);
    }

    // Compare current watched files against sealed baseline
    const driftItems: DemoGuardDriftItem[] = WATCHED_DEMO_FILES.map((file) => {
      const expected = baseline!.fileHashes[file] || '';
      const actual = fileHashes[file] || 'missing';
      if (!expected) {
        return { file, expectedHash: '(new)', actualHash: actual, status: 'modified' };
      }
      if (actual !== expected) {
        return { file, expectedHash: expected, actualHash: actual, status: 'modified' };
      }
      return { file, expectedHash: expected, actualHash: actual, status: 'matched' };
    });

    const isolationChecks = evaluateIsolationChecks(readableContents, state.blockedMutationCount);
    const adminParityChecks = await runAdminModuleParityProbes(options?.adminToken);

    const modifiedFiles = driftItems.filter((d) => d.status !== 'matched');
    const failedIsolation = isolationChecks.filter((c) => c.status === 'fail');
    const failedAdminParity = adminParityChecks.filter((p) => p.status === 'fail');

    const newAlerts: DemoGuardAlertItem[] = [];
    const targetEmail =
      state.recipientEmail ||
      (await resolveLarkAlertTarget().then((r) => r.recipientEmail).catch(() => 'gitstackitsolution@gmail.com'));

    if (modifiedFiles.length > 0) {
      const fileList = modifiedFiles.map((f) => f.file).join(', ');
      const alertId = `dga-${crypto.randomUUID().slice(0, 10)}`;
      const emailRes = state.autoEmailEnabled
        ? await dispatchRealTimeGuardEmail({
            signature: `drift:${overallHash}`,
            subject: `[GitStack Demo Guard ALERT] Live Demo Code/Behavior Drift Detected (${modifiedFiles.length} file)`,
            bodyText: [
              'REAL-TIME DEMO GUARD ALERT — CODE OR BEHAVIOR CHANGE DETECTED',
              `Time (UTC): ${nowIso}`,
              `Sealed Baseline Hash: ${baseline.overallHash}`,
              `Current Live Hash: ${overallHash}`,
              '',
              `Changed Files (${modifiedFiles.length}):`,
              ...modifiedFiles.map(
                (f) => `- ${f.file} (expected ${f.expectedHash}, current ${f.actualHash})`
              ),
              '',
              'Review the diff and either re-seal the approved baseline or investigate in Back Office -> Demo Guard & Alerts.'
            ].join('\n'),
            relatedId: alertId,
            recipientOverride: state.recipientEmail || undefined,
            forceBypassCooldown: options?.forceEmailTest,
            userToken: options?.adminToken
          })
        : { delivered: false, recipient: targetEmail, statusNote: 'Auto-email paused in settings' };

      newAlerts.push({
        id: alertId,
        severity: 'warning',
        kind: 'code_drift',
        title: `Live Demo Code/Behavior Drift Detected (${modifiedFiles.length} file${modifiedFiles.length === 1 ? '' : 's'})`,
        detail: `Changed files relative to sealed baseline (${baseline.overallHash}): ${fileList}`,
        affectedTarget: fileList,
        emailSent: emailRes.delivered,
        emailRecipient: emailRes.recipient,
        emailStatus: emailRes.statusNote,
        createdAt: nowIso,
        acknowledged: false
      });
    }

    if (failedIsolation.length > 0) {
      const alertId = `dga-${crypto.randomUUID().slice(0, 10)}`;
      const summaryLabels = failedIsolation.map((c) => c.label).join('; ');
      const emailRes = state.autoEmailEnabled
        ? await dispatchRealTimeGuardEmail({
            signature: `isolation:${summaryLabels}`,
            subject: `[CRITICAL · GitStack Demo Guard] Live Demo Isolation Breach Prevented`,
            bodyText: [
              'CRITICAL SECURITY ALERT — LIVE DEMO ISOLATION CHECK FAILED',
              `Time (UTC): ${nowIso}`,
              '',
              ...failedIsolation.map((c) => `- ${c.label}: ${c.detail}`),
              '',
              'Immediate inspection recommended inside Back Office -> Demo Guard & Alerts.'
            ].join('\n'),
            relatedId: alertId,
            recipientOverride: state.recipientEmail || undefined,
            forceBypassCooldown: true,
            userToken: options?.adminToken
          })
        : { delivered: false, recipient: targetEmail, statusNote: 'Auto-email paused in settings' };

      newAlerts.push({
        id: alertId,
        severity: 'critical',
        kind: 'isolation_leak',
        title: `Demo Isolation Firewall Violation (${failedIsolation.length} check failed)`,
        detail: summaryLabels,
        affectedTarget: '/demo',
        emailSent: emailRes.delivered,
        emailRecipient: emailRes.recipient,
        emailStatus: emailRes.statusNote,
        createdAt: nowIso,
        acknowledged: false
      });
    }

    if (failedAdminParity.length > 0) {
      const alertId = `dga-${crypto.randomUUID().slice(0, 10)}`;
      const modNames = failedAdminParity.map((m) => `${m.moduleLabel} (${m.httpStatus})`).join(', ');
      const emailRes = state.autoEmailEnabled
        ? await dispatchRealTimeGuardEmail({
            signature: `admin_parity:${modNames}`,
            subject: `[GitStack Demo Guard ALERT] Admin Back Office Parity Failure Detected`,
            bodyText: [
              'ADMIN PARITY ALERT — REAL ADMIN MODULE CHECK FAILED',
              `Time (UTC): ${nowIso}`,
              '',
              ...failedAdminParity.map(
                (m) => `- ${m.moduleLabel} (${m.endpoint}): HTTP ${m.httpStatus} — ${m.detail}`
              )
            ].join('\n'),
            relatedId: alertId,
            recipientOverride: state.recipientEmail || undefined,
            forceBypassCooldown: options?.forceEmailTest,
            userToken: options?.adminToken
          })
        : { delivered: false, recipient: targetEmail, statusNote: 'Auto-email paused in settings' };

      newAlerts.push({
        id: alertId,
        severity: 'critical',
        kind: 'admin_parity_fail',
        title: `Admin Module Parity Failure (${failedAdminParity.length} module${failedAdminParity.length === 1 ? '' : 's'})`,
        detail: `Failed modules: ${modNames}`,
        affectedTarget: modNames,
        emailSent: emailRes.delivered,
        emailRecipient: emailRes.recipient,
        emailStatus: emailRes.statusNote,
        createdAt: nowIso,
        acknowledged: false
      });
    }

    if (newAlerts.length > 0) {
      broadcastToAdmins('demo_guard_alert', {
        alerts: newAlerts,
        scannedAt: nowIso
      });
    }

    const updatedAlerts = [...newAlerts, ...state.alerts].slice(0, 80);
    await saveState({
      ...state,
      lastScanAt: nowIso,
      baseline,
      driftItems,
      isolationChecks,
      adminParityChecks,
      alerts: updatedAlerts
    });

    return buildDashboardPayload(await readState());
  } finally {
    scanInProgress = false;
  }
}

export async function sealDemoGuardBaseline(adminEmail: string): Promise<DemoGuardDashboardResponse> {
  const state = await readState();
  const nowIso = new Date().toISOString();
  const { fileHashes, overallHash, readableContents } = await computeWatchedDemoHashes();

  const baseline: DemoGuardBaselineSnapshot = {
    sealedAt: nowIso,
    sealedBy: adminEmail || 'super_admin',
    overallHash,
    fileHashes,
    isolationSignature: 'strict-readonly-v1'
  };

  const driftItems: DemoGuardDriftItem[] = WATCHED_DEMO_FILES.map((file) => ({
    file,
    expectedHash: fileHashes[file] || 'bundled-runtime',
    actualHash: fileHashes[file] || 'bundled-runtime',
    status: 'matched'
  }));

  const isolationChecks = evaluateIsolationChecks(readableContents, state.blockedMutationCount);
  const sealAlert: DemoGuardAlertItem = {
    id: `dga-${crypto.randomUUID().slice(0, 10)}`,
    severity: 'info',
    kind: 'baseline_sealed',
    title: 'Demo Guard Baseline Approved & Sealed',
    detail: `New cryptographic baseline (${overallHash}) sealed by ${baseline.sealedBy} across ${WATCHED_DEMO_FILES.length} watched Live Demo files.`,
    affectedTarget: 'All Live Demo Modules',
    emailSent: false,
    emailRecipient: state.recipientEmail || 'gitstackitsolution@gmail.com',
    emailStatus: 'Sealed by operator',
    createdAt: nowIso,
    acknowledged: true
  };

  await saveState({
    ...state,
    lastScanAt: nowIso,
    baseline,
    driftItems,
    isolationChecks,
    alerts: [sealAlert, ...state.alerts].slice(0, 80)
  });

  return buildDashboardPayload(await readState());
}

export async function updateDemoGuardSettings(patch: {
  autoWatchEnabled?: boolean;
  autoEmailEnabled?: boolean;
  recipientEmail?: string;
}): Promise<DemoGuardDashboardResponse> {
  const state = await readState();
  await saveState({
    ...state,
    autoWatchEnabled:
      typeof patch.autoWatchEnabled === 'boolean' ? patch.autoWatchEnabled : state.autoWatchEnabled,
    autoEmailEnabled:
      typeof patch.autoEmailEnabled === 'boolean' ? patch.autoEmailEnabled : state.autoEmailEnabled,
    recipientEmail:
      typeof patch.recipientEmail === 'string'
        ? patch.recipientEmail.trim().toLowerCase()
        : state.recipientEmail
  });
  return getDemoGuardDashboard();
}

export async function acknowledgeDemoGuardAlert(alertId: string): Promise<DemoGuardDashboardResponse> {
  const state = await readState();
  await saveState({
    ...state,
    alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
  });
  return getDemoGuardDashboard();
}

export async function sendDemoGuardTestEmailAlert(
  adminToken?: string
): Promise<{ dashboard: DemoGuardDashboardResponse; emailResult: { delivered: boolean; recipient: string; statusNote: string } }> {
  const dash = await runDemoGuardAndAdminParityScan({
    reason: 'manual',
    adminToken
  });
  const state = await readState();
  const nowIso = new Date().toISOString();
  const alertId = `dga-${crypto.randomUUID().slice(0, 10)}`;

  const emailResult = await dispatchRealTimeGuardEmail({
    signature: `manual-test:${Date.now()}`,
    subject: `[GitStack Demo Guard] Real-Time Monitor Status Report (${dash.demoScore}% Isolated · ${dash.adminParityScore}% Admin Parity)`,
    bodyText: [
      'GITSTACK DEMO GUARD & ADMIN PARITY TEST NOTIFICATION',
      `Scanned At (UTC): ${nowIso}`,
      `Live Demo Isolation Score: ${dash.demoScore}%`,
      `Admin Module Parity Score: ${dash.adminParityScore}%`,
      `Sealed Baseline Hash: ${dash.baseline.overallHash}`,
      `Drifted Files: ${dash.driftItems.filter((d) => d.status !== 'matched').length}`,
      `Admin Modules Checked: ${dash.adminParityChecks.length}`,
      '',
      'All real-time Demo tamper alerts and Admin module failure alerts route to this address automatically.'
    ].join('\n'),
    relatedId: alertId,
    recipientOverride: state.recipientEmail || undefined,
    forceBypassCooldown: true,
    userToken: adminToken
  });

  const logAlert: DemoGuardAlertItem = {
    id: alertId,
    severity: 'info',
    kind: 'audit_passed',
    title: 'Real-Time Email Alert Verification Dispatched',
    detail: `Sent live Demo Guard & Admin Parity status snapshot to ${emailResult.recipient}.`,
    affectedTarget: 'Email Alert Pipeline',
    emailSent: emailResult.delivered,
    emailRecipient: emailResult.recipient,
    emailStatus: emailResult.statusNote,
    createdAt: nowIso,
    acknowledged: true
  };

  await saveState({
    ...state,
    alerts: [logAlert, ...state.alerts].slice(0, 80)
  });

  return {
    dashboard: await getDemoGuardDashboard(),
    emailResult
  };
}

function buildDashboardPayload(state: DemoGuardPersistedState): DemoGuardDashboardResponse {
  const driftCount = state.driftItems.filter((d) => d.status !== 'matched').length;
  const isoFails = state.isolationChecks.filter((c) => c.status === 'fail').length;
  const isoTotal = state.isolationChecks.length || 1;
  const isoPassed = state.isolationChecks.filter((c) => c.status === 'pass').length;
  const demoScore = Math.max(
    0,
    Math.round(((isoPassed * 100 + (isoTotal - isoPassed - isoFails) * 60) / (isoTotal * 100)) * 100) -
      driftCount * 12
  );

  const parityTotal = state.adminParityChecks.length || 1;
  const parityPassed = state.adminParityChecks.filter((p) => p.status === 'pass').length;
  const parityFails = state.adminParityChecks.filter((p) => p.status === 'fail').length;
  const adminParityScore = state.adminParityChecks.length
    ? Math.round((parityPassed / parityTotal) * 100)
    : 100;

  const unacknowledgedCount = state.alerts.filter((a) => !a.acknowledged).length;

  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (isoFails > 0 || parityFails > 0) overallStatus = 'critical';
  else if (driftCount > 0 || unacknowledgedCount > 0) overallStatus = 'warning';

  return {
    overallStatus,
    demoScore,
    adminParityScore,
    lastScanAt: state.lastScanAt,
    baseline: state.baseline || {
      sealedAt: new Date().toISOString(),
      sealedBy: 'pending-initial-scan',
      overallHash: 'unsealed',
      fileHashes: {},
      isolationSignature: 'strict-readonly-v1'
    },
    driftItems: state.driftItems,
    isolationChecks: state.isolationChecks,
    adminParityChecks: state.adminParityChecks,
    alerts: state.alerts,
    unacknowledgedCount,
    recipientEmail: state.recipientEmail || 'gitstackitsolution@gmail.com',
    autoWatchEnabled: state.autoWatchEnabled,
    autoEmailEnabled: state.autoEmailEnabled
  };
}

export async function getDemoGuardDashboard(): Promise<DemoGuardDashboardResponse> {
  const state = await readState();
  if (!state.baseline || state.isolationChecks.length === 0) {
    return runDemoGuardAndAdminParityScan({ reason: 'boot' });
  }
  return buildDashboardPayload(state);
}

export async function getDemoGuardAgentSnapshot(): Promise<{
  overallStatus: 'healthy' | 'warning' | 'critical';
  demoScore: number;
  adminParityScore: number;
  driftCount: number;
  openAlertCount: number;
  lastScanAt: string | null;
}> {
  const dash = await getDemoGuardDashboard();
  return {
    overallStatus: dash.overallStatus,
    demoScore: dash.demoScore,
    adminParityScore: dash.adminParityScore,
    driftCount: dash.driftItems.filter((d) => d.status !== 'matched').length,
    openAlertCount: dash.unacknowledgedCount,
    lastScanAt: dash.lastScanAt
  };
}

/**
 * Runtime Express firewall middleware:
 * Any request explicitly originating from the /demo browser context (x-gitstack-demo-origin or Referer /demo)
 * that attempts to hit /api/admin/*, /api/lark/*, /api/growth/*, or content mutation endpoints is immediately blocked
 * with HTTP 403 and triggers a real-time alert + email notification.
 */
export function createDemoIsolationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqPath = req.path || '';
    const isRestrictedTarget =
      reqPath.startsWith('/api/admin/') ||
      reqPath.startsWith('/api/lark/') ||
      reqPath.startsWith('/api/growth/') ||
      reqPath.startsWith('/api/crm/') ||
      (reqPath.startsWith('/api/posts') && req.method !== 'GET') ||
      (reqPath.startsWith('/api/pages') && req.method !== 'GET');

    if (!isRestrictedTarget) {
      next();
      return;
    }

    const demoHeader = String(req.headers['x-gitstack-demo-origin'] || '') === '1';
    const referer = typeof req.headers.referer === 'string' ? req.headers.referer : '';
    let refererIsDemo = false;
    try {
      if (referer) {
        const refPath = new URL(referer).pathname || '';
        refererIsDemo = refPath === '/demo' || refPath.startsWith('/demo/');
      }
    } catch {
      refererIsDemo = false;
    }

    if (!demoHeader && !refererIsDemo) {
      next();
      return;
    }

    const nowIso = new Date().toISOString();
    void (async () => {
      const state = await readState();
      const alertId = `dga-${crypto.randomUUID().slice(0, 10)}`;
      const emailRes = state.autoEmailEnabled
        ? await dispatchRealTimeGuardEmail({
            signature: `blocked:${req.method}:${reqPath}`,
            subject: `[CRITICAL · GitStack Demo Guard] Blocked Demo Attempt on ${req.method} ${reqPath}`,
            bodyText: [
              'REAL-TIME DEMO FIREWALL BLOCK EVENT',
              `Time (UTC): ${nowIso}`,
              `Blocked Request: ${req.method} ${reqPath}`,
              `Referer: ${referer || 'header:x-gitstack-demo-origin'}`,
              '',
              'No production records were touched (HTTP 403 enforced).'
            ].join('\n'),
            relatedId: alertId,
            recipientOverride: state.recipientEmail || undefined
          })
        : {
            delivered: false,
            recipient: state.recipientEmail || 'gitstackitsolution@gmail.com',
            statusNote: 'Auto-email paused in settings'
          };

      const alertItem: DemoGuardAlertItem = {
        id: alertId,
        severity: 'critical',
        kind: 'isolation_leak',
        title: `Blocked Demo Request to ${req.method} ${reqPath}`,
        detail: `Firewall prevented Live Demo session (${referer || 'demo-origin'}) from calling production endpoint ${reqPath}.`,
        affectedTarget: reqPath,
        emailSent: emailRes.delivered,
        emailRecipient: emailRes.recipient,
        emailStatus: emailRes.statusNote,
        createdAt: nowIso,
        acknowledged: false
      };

      await saveState({
        ...state,
        blockedMutationCount: state.blockedMutationCount + 1,
        alerts: [alertItem, ...state.alerts].slice(0, 80)
      });

      broadcastToAdmins('demo_guard_alert', {
        alerts: [alertItem],
        scannedAt: nowIso
      });
    })().catch(() => null);

    res.status(403).json({
      error: 'Blocked by Demo Guard Isolation Firewall: Live Demo sessions cannot access or mutate production Admin systems.'
    });
  };
}

export function startDemoGuardLoop(): void {
  if (guardLoopStarted) return;
  guardLoopStarted = true;

  setTimeout(() => {
    void (async () => {
      const state = await readState();
      if (!state.baseline) {
        await runDemoGuardAndAdminParityScan({ reason: 'boot' });
      }
    })().catch(() => null);
  }, 6000);

  setInterval(() => {
    void (async () => {
      const allowed = await shouldRunLoopTick('demo_guard');
      if (!allowed) return;
      const state = await readState();
      if (!state.autoWatchEnabled) {
        recordLoopOutcome('demo_guard', 'skipped_idle');
        return;
      }
      await runDemoGuardAndAdminParityScan({ reason: 'scheduled' });
      recordLoopOutcome('demo_guard', 'executed');
    })().catch(() => {
      recordLoopOutcome('demo_guard', 'error');
    });
  }, 60 * 1000);
}
