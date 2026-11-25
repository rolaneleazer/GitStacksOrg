import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Response } from 'express';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
  type Schema
} from '@google/genai';
import { buildAllAgentReports } from '../shared/agentEngine.ts';
import { evaluateArticleQuality, slugify } from '../shared/qualityGate.ts';
import type {
  AdSenseSettings,
  Article,
  ChatAutoResponseTemplate,
  CrmLead,
  InquiryStatus,
  McpAuditLogEntry,
  McpChatHistoryTurn,
  McpChatResponse,
  McpCodeProposal,
  McpCreateTokenResponse,
  McpDashboardResponse,
  McpToolDescriptor,
  McpToolTrace,
  McpTokenSummary,
  PageContentConfig,
  PageKey,
  QuotaShieldUpdatePayload,
  ServiceCategory,
  UserWorkflowItem,
  WebsiteChatMessage
} from '../shared/types.ts';
import { getAiSearchVisibilityDashboard, runDailyAiSearchVisibilityTest } from './aiSeoVisibility.ts';
import { scanAllContactsAndIdentities } from './contactRegistryService.ts';
import { evaluateCyberDomainsAndPosture, getCyberSecurityDashboard } from './cyberSecurity.ts';
import { getDataExplorerOverview, getDataTableRows } from './dataExplorer.ts';
import {
  getDemoGuardAgentSnapshot,
  getDemoGuardDashboard,
  runDemoGuardAndAdminParityScan
} from './demoGuardService.ts';
import { getAgentGrowthSnapshot } from './growthStore.ts';
import { getSocialConnectionsStatus } from './marketingService.ts';
import { getQaDashboardData, runLiveQaAgentScan } from './qaMonitor.ts';
import { flushQuotaShieldCache, getQuotaShieldStatus, updateQuotaShieldConfig } from './quotaShield.ts';
import {
  appendWebsiteChatMessage,
  checkSupabaseTablesReady,
  createWorkflowItem,
  deleteChatAutoResponse,
  getAdSenseSettings,
  getAnalyticsSummary,
  getChatAutoResponseSettings,
  listAgentOfficeProfiles,
  listAgentTasks,
  listChatAutoResponses,
  listChatThreads,
  listComments,
  listCrmLeads,
  listInquiries,
  listPageContents,
  listPosts,
  listSubscribers,
  listWebsiteChatSessions,
  listWorkflowItems,
  purgeEmptyWebsiteChatSessions,
  saveAdSenseSettings,
  saveChatAutoResponseSettings,
  updateInquiryStatus,
  updateWorkflowItem,
  upsertChatAutoResponse,
  upsertCrmLead,
  upsertPageContent,
  upsertPost
} from './repository.ts';
import { getSearchConsoleDashboard } from './searchConsoleService.ts';

// --- Persistent Store Setup ---

const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const STORE_FILE = IS_VERCEL
  ? path.join(os.tmpdir(), 'gitstack-data', 'gitstack-mcp.json')
  : path.resolve(process.cwd(), 'data', 'gitstack-mcp.json');

const ROOT_DIR = fsSync.realpathSync(path.resolve(process.cwd()));
const ROOT_PREFIX = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : `${ROOT_DIR}${path.sep}`;

interface StoredMcpToken extends McpTokenSummary {
  tokenHash: string;
}

interface McpPersistedState {
  tokens: StoredMcpToken[];
  proposals: McpCodeProposal[];
  auditLogs: McpAuditLogEntry[];
}

const DEFAULT_STATE: McpPersistedState = {
  tokens: [],
  proposals: [],
  auditLogs: []
};

let writeChain: Promise<void> = Promise.resolve();

async function readState(): Promise<McpPersistedState> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<McpPersistedState>;
    return {
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : []
    };
  } catch {
    return {
      tokens: [...DEFAULT_STATE.tokens],
      proposals: [...DEFAULT_STATE.proposals],
      auditLogs: [...DEFAULT_STATE.auditLogs]
    };
  }
}

async function mutateState<T>(fn: (state: McpPersistedState) => Promise<T> | T): Promise<T> {
  let result!: T;
  const run = writeChain.then(async () => {
    const state = await readState();
    result = await fn(state);
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
    const trimmed: McpPersistedState = {
      tokens: state.tokens.slice(0, 60),
      proposals: state.proposals.slice(0, 100),
      auditLogs: state.auditLogs.slice(0, 250)
    };
    await fs.writeFile(STORE_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  });
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  await run;
  return result;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function toTokenSummary(t: StoredMcpToken): McpTokenSummary {
  return {
    id: t.id,
    label: t.label,
    tokenPrefix: t.tokenPrefix,
    scopes: t.scopes,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
    revokedAt: t.revokedAt
  };
}

// --- Rotating MCP Token Vault ---

export async function listMcpTokens(): Promise<McpTokenSummary[]> {
  const state = await readState();
  return state.tokens.map(toTokenSummary);
}

export async function createMcpToken(
  label: string,
  createdBy: string
): Promise<McpCreateTokenResponse> {
  const cleanLabel = String(label || 'Gemini Custom Connect').trim().slice(0, 80) || 'Gemini Custom Connect';
  const rawSecret = `gsmcp_${crypto.randomBytes(24).toString('hex')}`;
  const tokenPrefix = `${rawSecret.slice(0, 12)}...${rawSecret.slice(-4)}`;
  const now = new Date().toISOString();

  const record: StoredMcpToken = {
    id: `mcpt_${crypto.randomUUID().slice(0, 12)}`,
    label: cleanLabel,
    tokenPrefix,
    tokenHash: sha256Hex(rawSecret),
    scopes: ['super_admin:full', 'mcp:tools', 'code:read', 'code:propose_edit'],
    createdBy,
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null
  };

  await mutateState((state) => {
    state.tokens.unshift(record);
    state.auditLogs.unshift({
      id: `mcpa_${crypto.randomUUID().slice(0, 10)}`,
      timestamp: now,
      actor: createdBy,
      transport: 'admin_ui',
      toolName: 'token.create',
      status: 'ok',
      durationMs: 1,
      summary: `Generated rotating MCP token "${cleanLabel}" (${tokenPrefix})`,
      argsPreview: JSON.stringify({ label: cleanLabel })
    });
  });

  return { token: toTokenSummary(record), rawToken: rawSecret };
}

export async function rotateMcpToken(
  tokenId: string,
  actor: string
): Promise<McpCreateTokenResponse | null> {
  const state = await readState();
  const target = state.tokens.find((t) => t.id === tokenId);
  if (!target) return null;

  const rawSecret = `gsmcp_${crypto.randomBytes(24).toString('hex')}`;
  const tokenPrefix = `${rawSecret.slice(0, 12)}...${rawSecret.slice(-4)}`;
  const now = new Date().toISOString();

  const replacement: StoredMcpToken = {
    id: `mcpt_${crypto.randomUUID().slice(0, 12)}`,
    label: target.label,
    tokenPrefix,
    tokenHash: sha256Hex(rawSecret),
    scopes: [...target.scopes],
    createdBy: actor,
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null
  };

  await mutateState((st) => {
    const existing = st.tokens.find((t) => t.id === tokenId);
    if (existing && !existing.revokedAt) {
      existing.revokedAt = now;
    }
    st.tokens.unshift(replacement);
    st.auditLogs.unshift({
      id: `mcpa_${crypto.randomUUID().slice(0, 10)}`,
      timestamp: now,
      actor,
      transport: 'admin_ui',
      toolName: 'token.rotate',
      status: 'ok',
      durationMs: 1,
      summary: `Rotated MCP token "${target.label}" -> ${tokenPrefix}`,
      argsPreview: JSON.stringify({ previousId: tokenId })
    });
  });

  return { token: toTokenSummary(replacement), rawToken: rawSecret };
}

export async function revokeMcpToken(tokenId: string, actor: string): Promise<McpTokenSummary | null> {
  const now = new Date().toISOString();
  return mutateState((state) => {
    const existing = state.tokens.find((t) => t.id === tokenId);
    if (!existing) return null;
    if (!existing.revokedAt) {
      existing.revokedAt = now;
    }
    state.auditLogs.unshift({
      id: `mcpa_${crypto.randomUUID().slice(0, 10)}`,
      timestamp: now,
      actor,
      transport: 'admin_ui',
      toolName: 'token.revoke',
      status: 'ok',
      durationMs: 1,
      summary: `Revoked MCP token "${existing.label}" (${existing.tokenPrefix})`,
      argsPreview: JSON.stringify({ tokenId })
    });
    return toTokenSummary(existing);
  });
}

export async function verifyMcpBearerToken(rawToken?: string): Promise<McpTokenSummary | null> {
  if (!rawToken || !rawToken.startsWith('gsmcp_')) return null;
  const candidateHash = sha256Hex(rawToken.trim());
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const state = await readState();

  const matched = state.tokens.find((t) => {
    if (t.revokedAt) return false;
    const targetBuf = Buffer.from(t.tokenHash, 'hex');
    if (targetBuf.length !== candidateBuf.length) return false;
    return crypto.timingSafeEqual(candidateBuf, targetBuf);
  });

  if (!matched) return null;

  const now = new Date().toISOString();
  void mutateState((st) => {
    const found = st.tokens.find((t) => t.id === matched.id);
    if (found) found.lastUsedAt = now;
  }).catch(() => undefined);

  return { ...toTokenSummary(matched), lastUsedAt: now };
}

// --- Confined Source Code Guard ---

const BLOCKED_SEGMENT_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.vercel',
  '.next',
  'data'
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mp3',
  '.wav',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.sqlite',
  '.db',
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.crt'
]);

function isBlockedRelativePath(relPath: string): string | null {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized === '.') return null;

  const segments = normalized.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '..') return 'Parent directory traversal is blocked.';
    if (BLOCKED_SEGMENT_NAMES.has(seg)) {
      return `Directory "${seg}" is excluded from MCP source inspection.`;
    }
    if (seg.startsWith('.env') && seg !== '.env.example') {
      return 'Environment and secret files (.env*) are strictly blocked.';
    }
    const lower = seg.toLowerCase();
    if (
      lower.includes('service-account') ||
      lower.includes('credentials') ||
      lower.includes('private-key') ||
      lower === 'id_rsa' ||
      lower === 'id_ed25519'
    ) {
      return `Credential or key path "${seg}" is blocked.`;
    }
  }

  const ext = path.extname(normalized).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return `Binary or key extension "${ext}" cannot be inspected as source code.`;
  }

  return null;
}

async function resolveConfinedPath(inputPath: string, allowNonExistentLeaf = false): Promise<{
  absPath: string;
  relPath: string;
}> {
  const raw = String(inputPath || '.').trim() || '.';
  const stripped = raw.replace(/^\/+/, '') || '.';
  const resolved = path.resolve(ROOT_DIR, stripped);

  if (resolved !== ROOT_DIR && !resolved.startsWith(ROOT_PREFIX)) {
    throw new Error('Access denied: path escapes project workspace root.');
  }

  const relPath = path.relative(ROOT_DIR, resolved).replace(/\\/g, '/') || '.';
  const blockedReason = isBlockedRelativePath(relPath);
  if (blockedReason) {
    throw new Error(`Security policy blocked access: ${blockedReason}`);
  }

  try {
    const real = await fs.realpath(resolved);
    if (real !== ROOT_DIR && !real.startsWith(ROOT_PREFIX)) {
      throw new Error('Access denied: symlink target escapes project workspace root.');
    }
    const realRel = path.relative(ROOT_DIR, real).replace(/\\/g, '/') || '.';
    const realBlocked = isBlockedRelativePath(realRel);
    if (realBlocked) {
      throw new Error(`Security policy blocked access: ${realBlocked}`);
    }
    return { absPath: real, relPath: realRel };
  } catch (err) {
    if (!allowNonExistentLeaf) throw err;
    const parent = path.dirname(resolved);
    const parentReal = await fs.realpath(parent);
    if (parentReal !== ROOT_DIR && !parentReal.startsWith(ROOT_PREFIX)) {
      throw new Error('Access denied: target parent directory escapes workspace root.');
    }
    return { absPath: resolved, relPath };
  }
}

export async function listSourceFiles(
  subDir = '.',
  maxDepth = 3,
  limit = 180
): Promise<{ root: string; entries: Array<{ path: string; type: 'dir' | 'file'; sizeBytes?: number }>; truncated: boolean }> {
  const safeDepth = Math.max(1, Math.min(6, Number(maxDepth) || 3));
  const safeLimit = Math.max(10, Math.min(400, Number(limit) || 180));
  const { absPath, relPath } = await resolveConfinedPath(subDir);
  const stat = await fs.stat(absPath);
  if (!stat.isDirectory()) {
    throw new Error(`"${relPath}" is not a directory.`);
  }

  const entries: Array<{ path: string; type: 'dir' | 'file'; sizeBytes?: number }> = [];
  let truncated = false;

  async function walk(currentAbs: string, currentRel: string, depth: number) {
    if (entries.length >= safeLimit) {
      truncated = true;
      return;
    }
    const items = await fs.readdir(currentAbs, { withFileTypes: true });
    items.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      if (entries.length >= safeLimit) {
        truncated = true;
        return;
      }
      const nextRel = currentRel === '.' ? item.name : `${currentRel}/${item.name}`;
      if (isBlockedRelativePath(nextRel)) continue;

      const nextAbs = path.join(currentAbs, item.name);
      if (item.isDirectory()) {
        entries.push({ path: nextRel, type: 'dir' });
        if (depth < safeDepth) {
          await walk(nextAbs, nextRel, depth + 1);
        }
      } else if (item.isFile()) {
        const s = await fs.stat(nextAbs).catch(() => null);
        entries.push({ path: nextRel, type: 'file', sizeBytes: s?.size });
      }
    }
  }

  await walk(absPath, relPath, 1);
  return { root: relPath, entries, truncated };
}

export async function readSourceFile(
  filePath: string,
  startLine = 1,
  endLine?: number
): Promise<{
  filePath: string;
  sha256: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  truncated: boolean;
  content: string;
}> {
  if (!filePath || !String(filePath).trim()) {
    throw new Error('filePath is required.');
  }
  const { absPath, relPath } = await resolveConfinedPath(filePath);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) {
    throw new Error(`"${relPath}" is not a file.`);
  }
  if (stat.size > 1_024_000) {
    throw new Error(`"${relPath}" exceeds 1 MB read limit.`);
  }

  const raw = await fs.readFile(absPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const totalLines = lines.length;
  const s = Math.max(1, Math.min(totalLines, Number(startLine) || 1));
  const requestedEnd = typeof endLine === 'number' && endLine > 0 ? endLine : s + 349;
  const e = Math.max(s, Math.min(totalLines, Math.min(requestedEnd, s + 599)));
  const numbered = lines
    .slice(s - 1, e)
    .map((line, idx) => `${s + idx}: ${line}`)
    .join('\n');

  return {
    filePath: relPath,
    sha256: sha256Hex(raw),
    totalLines,
    startLine: s,
    endLine: e,
    truncated: e < totalLines,
    content: numbered
  };
}

export async function searchSourceCode(
  query: string,
  subDir = '.',
  isRegex = false,
  limit = 40
): Promise<{
  query: string;
  subDir: string;
  matches: Array<{ filePath: string; line: number; text: string }>;
  truncated: boolean;
}> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    throw new Error('Search query cannot be empty.');
  }
  const safeLimit = Math.max(1, Math.min(80, Number(limit) || 40));
  const { absPath, relPath } = await resolveConfinedPath(subDir);
  const matcher = isRegex ? new RegExp(cleanQuery, 'i') : null;
  const needleLower = cleanQuery.toLowerCase();

  const matches: Array<{ filePath: string; line: number; text: string }> = [];
  let truncated = false;

  async function walk(currentAbs: string, currentRel: string) {
    if (matches.length >= safeLimit) {
      truncated = true;
      return;
    }
    const items = await fs.readdir(currentAbs, { withFileTypes: true });
    for (const item of items) {
      if (matches.length >= safeLimit) {
        truncated = true;
        return;
      }
      const nextRel = currentRel === '.' ? item.name : `${currentRel}/${item.name}`;
      if (isBlockedRelativePath(nextRel)) continue;
      const nextAbs = path.join(currentAbs, item.name);

      if (item.isDirectory()) {
        await walk(nextAbs, nextRel);
      } else if (item.isFile()) {
        const stat = await fs.stat(nextAbs).catch(() => null);
        if (!stat || stat.size > 512_000) continue;
        const text = await fs.readFile(nextAbs, 'utf8').catch(() => null);
        if (!text || text.includes('\u0000')) continue;
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const lineText = lines[i];
          const hit = matcher
            ? matcher.test(lineText)
            : lineText.toLowerCase().includes(needleLower);
          if (hit) {
            matches.push({
              filePath: nextRel,
              line: i + 1,
              text: lineText.trim().slice(0, 220)
            });
            if (matches.length >= safeLimit) {
              truncated = true;
              return;
            }
          }
        }
      }
    }
  }

  const stat = await fs.stat(absPath);
  if (stat.isFile()) {
    const text = await fs.readFile(absPath, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length && matches.length < safeLimit; i += 1) {
      const hit = matcher ? matcher.test(lines[i]) : lines[i].toLowerCase().includes(needleLower);
      if (hit) {
        matches.push({ filePath: relPath, line: i + 1, text: lines[i].trim().slice(0, 220) });
      }
    }
  } else {
    await walk(absPath, relPath);
  }

  return { query: cleanQuery, subDir: relPath, matches, truncated };
}

function buildLineDiffPreview(original: string, proposed: string): string {
  const origLines = original.split(/\r?\n/);
  const propLines = proposed.split(/\r?\n/);

  let start = 0;
  while (start < origLines.length && start < propLines.length && origLines[start] === propLines[start]) {
    start += 1;
  }

  let origEnd = origLines.length - 1;
  let propEnd = propLines.length - 1;
  while (origEnd >= start && propEnd >= start && origLines[origEnd] === propLines[propEnd]) {
    origEnd -= 1;
    propEnd -= 1;
  }

  if (origEnd < start && propEnd < start) {
    return 'No content differences detected.';
  }

  const contextBefore = origLines.slice(Math.max(0, start - 2), start).map((l) => `  ${l}`);
  const removed = origLines.slice(start, origEnd + 1).slice(0, 45).map((l) => `- ${l}`);
  const added = propLines.slice(start, propEnd + 1).slice(0, 45).map((l) => `+ ${l}`);
  const contextAfter = origLines.slice(origEnd + 1, origEnd + 3).map((l) => `  ${l}`);

  return [
    `@@ line ${start + 1} @@`,
    ...contextBefore,
    ...removed,
    ...added,
    ...contextAfter
  ].join('\n');
}

export async function proposeCodeEdit(input: {
  filePath: string;
  summary: string;
  rationale?: string;
  targetContent?: string;
  replacementContent?: string;
  proposedContent?: string;
  requestedBy: string;
  source: 'gemini_chat' | 'external_mcp';
}): Promise<McpCodeProposal> {
  const { absPath, relPath } = await resolveConfinedPath(input.filePath, false);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) {
    throw new Error(`"${relPath}" is not an existing source file.`);
  }
  const originalContent = await fs.readFile(absPath, 'utf8');
  const originalSha256 = sha256Hex(originalContent);

  let nextContent: string;
  if (typeof input.targetContent === 'string' && typeof input.replacementContent === 'string') {
    const firstIdx = originalContent.indexOf(input.targetContent);
    if (firstIdx === -1) {
      throw new Error(`targetContent was not found verbatim inside "${relPath}". Read the exact lines first.`);
    }
    const secondIdx = originalContent.indexOf(input.targetContent, firstIdx + input.targetContent.length);
    if (secondIdx !== -1) {
      throw new Error(`targetContent matched multiple locations in "${relPath}". Provide more surrounding context lines.`);
    }
    nextContent =
      originalContent.slice(0, firstIdx) +
      input.replacementContent +
      originalContent.slice(firstIdx + input.targetContent.length);
  } else if (typeof input.proposedContent === 'string') {
    nextContent = input.proposedContent;
  } else {
    throw new Error('Provide either (targetContent + replacementContent) or proposedContent.');
  }

  if (nextContent === originalContent) {
    throw new Error('Proposed edit produces zero file changes.');
  }

  const proposal: McpCodeProposal = {
    id: `mcpp_${crypto.randomUUID().slice(0, 12)}`,
    filePath: relPath,
    summary: String(input.summary || `Update ${relPath}`).trim().slice(0, 140),
    rationale: String(input.rationale || 'Requested via MCP/Gemini assistant').trim().slice(0, 500),
    originalSha256,
    originalContent,
    proposedContent: nextContent,
    diffPreview: buildLineDiffPreview(originalContent, nextContent),
    requestedBy: input.requestedBy,
    source: input.source,
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null
  };

  await mutateState((state) => {
    state.proposals.unshift(proposal);
  });

  return proposal;
}

export async function applyCodeProposal(
  proposalId: string,
  resolvedBy: string
): Promise<McpCodeProposal> {
  const now = new Date().toISOString();
  return mutateState(async (state) => {
    const proposal = state.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new Error(`Proposal "${proposalId}" was not found.`);
    }
    if (proposal.status !== 'pending') {
      throw new Error(`Proposal "${proposalId}" is already ${proposal.status}.`);
    }

    const { absPath, relPath } = await resolveConfinedPath(proposal.filePath, false);
    const liveDisk = await fs.readFile(absPath, 'utf8');
    if (sha256Hex(liveDisk) !== proposal.originalSha256) {
      proposal.error = 'File changed on disk since proposal creation. Reject and regenerate from current code.';
      throw new Error(proposal.error);
    }

    await fs.writeFile(absPath, proposal.proposedContent, 'utf8');
    proposal.status = 'applied';
    proposal.resolvedAt = now;
    proposal.resolvedBy = resolvedBy;
    delete proposal.error;

    state.auditLogs.unshift({
      id: `mcpa_${crypto.randomUUID().slice(0, 10)}`,
      timestamp: now,
      actor: resolvedBy,
      transport: 'admin_ui',
      toolName: 'proposal.approve_apply',
      status: 'ok',
      durationMs: 2,
      summary: `Approved & wrote staged edit to ${relPath}`,
      argsPreview: JSON.stringify({ proposalId, filePath: relPath })
    });

    return proposal;
  });
}

export async function rejectCodeProposal(
  proposalId: string,
  resolvedBy: string
): Promise<McpCodeProposal> {
  const now = new Date().toISOString();
  return mutateState((state) => {
    const proposal = state.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new Error(`Proposal "${proposalId}" was not found.`);
    }
    if (proposal.status !== 'pending') {
      throw new Error(`Proposal "${proposalId}" is already ${proposal.status}.`);
    }

    proposal.status = 'rejected';
    proposal.resolvedAt = now;
    proposal.resolvedBy = resolvedBy;

    state.auditLogs.unshift({
      id: `mcpa_${crypto.randomUUID().slice(0, 10)}`,
      timestamp: now,
      actor: resolvedBy,
      transport: 'admin_ui',
      toolName: 'proposal.reject',
      status: 'ok',
      durationMs: 1,
      summary: `Rejected staged edit for ${proposal.filePath}`,
      argsPreview: JSON.stringify({ proposalId, filePath: proposal.filePath })
    });

    return proposal;
  });
}

// --- Unified 25-Tool Registry ---

export const MCP_TOOL_DESCRIPTORS: McpToolDescriptor[] = [
  // Source Code (4)
  {
    name: 'code_list_files',
    category: 'Source Code',
    description:
      'List project source files and directories inside the confined repository workspace (excludes secrets, .env, node_modules, .git, and build outputs).',
    accessLevel: 'read',
    parameters: {
      directory: { type: 'string', description: 'Relative directory path (default ".")' },
      maxDepth: { type: 'number', description: 'Traversal depth 1-6 (default 3)' },
      limit: { type: 'number', description: 'Maximum entries to return (default 180)' }
    }
  },
  {
    name: 'code_read_file',
    category: 'Source Code',
    description:
      'Read numbered source code lines and SHA-256 hash of a repository file (blocks .env, credential files, and binaries).',
    accessLevel: 'read',
    parameters: {
      filePath: { type: 'string', description: 'Relative path from repo root (e.g. "src/server/app.ts")', required: true },
      startLine: { type: 'number', description: '1-based start line (default 1)' },
      endLine: { type: 'number', description: '1-based end line (max 600 lines per call)' }
    }
  },
  {
    name: 'code_search',
    category: 'Source Code',
    description:
      'Search across repository source files for text or regex matches (safe pure-Node scan, zero shell execution).',
    accessLevel: 'read',
    parameters: {
      query: { type: 'string', description: 'Search substring or regex pattern', required: true },
      directory: { type: 'string', description: 'Relative subdirectory filter (default ".")' },
      isRegex: { type: 'boolean', description: 'Interpret query as case-insensitive regex (default false)' },
      limit: { type: 'number', description: 'Max matched lines to return (default 40, max 80)' }
    }
  },
  {
    name: 'code_propose_edit',
    category: 'Source Code',
    description:
      'Stage a source code modification diff into the Super Admin Edit Approval Queue. Never writes directly to disk until a Super Admin approves.',
    accessLevel: 'staged_edit',
    parameters: {
      filePath: { type: 'string', description: 'Target file path relative to repo root', required: true },
      summary: { type: 'string', description: 'Short 1-line summary of the proposed change', required: true },
      rationale: { type: 'string', description: 'Why this change is needed' },
      targetContent: { type: 'string', description: 'Exact verbatim snippet to replace (preferred over full file)' },
      replacementContent: { type: 'string', description: 'Replacement snippet when targetContent is provided' },
      proposedContent: { type: 'string', description: 'Complete proposed file content (if not using targetContent/replacementContent)' }
    }
  },

  // CMS & SEO (6)
  {
    name: 'cms_list_articles',
    category: 'CMS & SEO',
    description: 'List Insights engineering articles (draft and published) with quality scores and metadata.',
    accessLevel: 'read',
    parameters: {
      status: { type: 'string', description: 'Filter by "all", "published", or "draft"', enumValues: ['all', 'published', 'draft'] },
      limit: { type: 'number', description: 'Max articles to return (default 25)' }
    }
  },
  {
    name: 'cms_upsert_article',
    category: 'CMS & SEO',
    description: 'Create or update an Insights article with automatic AdSense/SEO Quality Gate scoring.',
    accessLevel: 'write',
    parameters: {
      id: { type: 'string', description: 'Existing article ID when updating (omit to create new)' },
      title: { type: 'string', description: 'Article H1 title', required: true },
      slug: { type: 'string', description: 'URL slug (auto-generated from title if omitted)' },
      category: {
        type: 'string',
        description: 'Service category',
        enumValues: [
          'AI Integration',
          'Full-Stack SaaS',
          'Cloud & DevOps',
          'API Architecture',
          'Engineering Playbooks'
        ]
      },
      summary_tldr: { type: 'string', description: 'Concise TL;DR summary', required: true },
      content_markdown: { type: 'string', description: 'Full markdown body', required: true },
      primary_keyword: { type: 'string', description: 'Target SEO keyword' },
      meta_title: { type: 'string', description: 'SEO title tag' },
      meta_description: { type: 'string', description: 'SEO meta description' },
      status: { type: 'string', description: 'draft or published (published requires Quality Gate pass)', enumValues: ['draft', 'published'] }
    }
  },
  {
    name: 'cms_get_pages',
    category: 'CMS & SEO',
    description: 'Inspect configured page content, hero copy, and showcase images for Home, Services, About, or Contact.',
    accessLevel: 'read',
    parameters: {
      pageKey: { type: 'string', description: 'Optional page filter', enumValues: ['home', 'services', 'about', 'contact'] }
    }
  },
  {
    name: 'cms_update_page',
    category: 'CMS & SEO',
    description: 'Update editable fields on a public page (hero copy, section headings, contact info, or showcase slides).',
    accessLevel: 'write',
    parameters: {
      pageKey: { type: 'string', description: 'Target page key', required: true, enumValues: ['home', 'services', 'about', 'contact'] },
      patch: { type: 'object', description: 'Partial PageContentConfig fields to merge and save', required: true }
    }
  },
  {
    name: 'seo_get_search_console',
    category: 'CMS & SEO',
    description: 'Retrieve Google Search Console inspection summary, indexed URL coverage, queries, and link audit stats.',
    accessLevel: 'read',
    parameters: {}
  },
  {
    name: 'seo_ai_visibility',
    category: 'CMS & SEO',
    description: 'Inspect AI Search Visibility (GEO) status or run a live AI citation & ranking visibility check.',
    accessLevel: 'write',
    parameters: {
      action: { type: 'string', description: '"status" to read dashboard or "run_test" to execute probe', enumValues: ['status', 'run_test'] }
    }
  },

  // CRM & Inbox (6)
  {
    name: 'crm_list_inquiries',
    category: 'CRM & Inbox',
    description: 'List client consultation inquiries from the Lark Mail & Lead Inbox with status and assignment info.',
    accessLevel: 'read',
    parameters: {
      status: { type: 'string', description: 'Optional status filter', enumValues: ['new', 'reviewing', 'replied', 'archived'] },
      limit: { type: 'number', description: 'Max inquiries (default 30)' }
    }
  },
  {
    name: 'crm_update_inquiry_status',
    category: 'CRM & Inbox',
    description: 'Update a consultation inquiry status (new, reviewed, scheduled).',
    accessLevel: 'write',
    parameters: {
      inquiryId: { type: 'string', description: 'Inquiry ID', required: true },
      status: { type: 'string', description: 'Next inquiry status', required: true, enumValues: ['new', 'reviewed', 'scheduled'] }
    }
  },
  {
    name: 'crm_list_leads',
    category: 'CRM & Inbox',
    description: 'List outbound and inbound CRM prospecting pipeline leads.',
    accessLevel: 'read',
    parameters: {
      stage: { type: 'string', description: 'Optional stage filter' },
      limit: { type: 'number', description: 'Max leads (default 30)' }
    }
  },
  {
    name: 'crm_upsert_lead',
    category: 'CRM & Inbox',
    description: 'Create or update a CRM prospecting lead record.',
    accessLevel: 'write',
    parameters: {
      lead: { type: 'object', description: 'CrmLead fields (company_name, contact_name, email, stage, notes, etc.)', required: true }
    }
  },
  {
    name: 'chat_list_sessions_and_templates',
    category: 'CRM & Inbox',
    description: 'Inspect recent live website visitor chat sessions alongside configured Auto-Response Q&A templates and settings.',
    accessLevel: 'read',
    parameters: {
      limit: { type: 'number', description: 'Max recent chat sessions to return (default 20)' }
    }
  },
  {
    name: 'chat_manage_auto_response_or_reply',
    category: 'CRM & Inbox',
    description: 'Reply to a visitor chat session, purge empty anonymous sessions, toggle auto-response greeting, or upsert/delete an FAQ template.',
    accessLevel: 'write',
    parameters: {
      action: {
        type: 'string',
        description: 'Operation to execute',
        required: true,
        enumValues: ['reply_session', 'purge_empty', 'upsert_template', 'delete_template', 'save_settings']
      },
      sessionId: { type: 'string', description: 'Visitor chat session ID (for reply_session)' },
      replyText: { type: 'string', description: 'Operator reply text (for reply_session)' },
      template: { type: 'object', description: 'ChatAutoResponseTemplate payload (for upsert_template)' },
      templateId: { type: 'string', description: 'Template ID (for delete_template)' },
      settingsPatch: { type: 'object', description: 'Auto-response global settings patch (for save_settings)' }
    }
  },

  // Agents & Workflows (4)
  {
    name: 'agents_get_status',
    category: 'Agents & Workflows',
    description: 'Compute live telemetry across all 8 GitStack autonomous agents (Aria, Atlas, Nova, Echo, Pulse, Kai, Sentinel, Mira) and overall Site Audit.',
    accessLevel: 'read',
    parameters: {}
  },
  {
    name: 'workflows_list',
    category: 'Agents & Workflows',
    description: 'List Back Office team workflow items and active tasks.',
    accessLevel: 'read',
    parameters: {}
  },
  {
    name: 'workflows_create_or_update',
    category: 'Agents & Workflows',
    description: 'Create a new team workflow task or update an existing workflow item status/priority.',
    accessLevel: 'write',
    parameters: {
      id: { type: 'string', description: 'Existing workflow item ID (omit to create)' },
      title: { type: 'string', description: 'Workflow title' },
      description: { type: 'string', description: 'Workflow description' },
      status: { type: 'string', description: 'todo | in_progress | review | done' },
      priority: { type: 'string', description: 'low | medium | high | urgent' }
    }
  },
  {
    name: 'contacts_scan_registry',
    category: 'Agents & Workflows',
    description: 'Scan every email address, phone number, and contact identity configured across pages, CRM, inquiries, and profiles.',
    accessLevel: 'read',
    parameters: {}
  },

  // Infra & Security (5)
  {
    name: 'infra_quota_shield',
    category: 'Infra & Security',
    description: 'Inspect Supabase Quota Shield telemetry, update Low-Quota/background throttling settings, or flush cached egress responses.',
    accessLevel: 'write',
    parameters: {
      action: { type: 'string', description: '"status", "update", or "flush_cache"', enumValues: ['status', 'update', 'flush_cache'] },
      config: { type: 'object', description: 'QuotaShieldUpdatePayload fields when action="update"' }
    }
  },
  {
    name: 'qa_get_or_run_scan',
    category: 'Infra & Security',
    description: 'Get Product QA & Logs dashboard metrics or execute an immediate live QA scan.',
    accessLevel: 'write',
    parameters: {
      action: { type: 'string', description: '"status" or "run_scan"', enumValues: ['status', 'run_scan'] }
    }
  },
  {
    name: 'security_get_or_scan',
    category: 'Infra & Security',
    description: 'Inspect Cybersecurity & AI Sentinel posture or run domain security posture evaluation.',
    accessLevel: 'write',
    parameters: {
      action: { type: 'string', description: '"status" or "run_scan"', enumValues: ['status', 'run_scan'] }
    }
  },
  {
    name: 'demo_guard_status_or_scan',
    category: 'Infra & Security',
    description: 'Inspect Demo Guard isolation & code drift baseline or run an immediate parity scan.',
    accessLevel: 'write',
    parameters: {
      action: { type: 'string', description: '"status" or "run_scan"', enumValues: ['status', 'run_scan'] }
    }
  },
  {
    name: 'site_get_or_update_settings',
    category: 'Infra & Security',
    description: 'Inspect or update global Site Settings (branding, CTA, AdSense, GA4, GTM, Buy Me a Coffee, or Data Explorer overview).',
    accessLevel: 'write',
    parameters: {
      action: { type: 'string', description: '"get_settings", "update_settings", or "data_overview"', enumValues: ['get_settings', 'update_settings', 'data_overview'] },
      patch: { type: 'object', description: 'Partial AdSenseSettings fields when action="update_settings"' },
      tableName: { type: 'string', description: 'Optional table name to inspect rows when action="data_overview"' }
    }
  }
];

function summarizeResultPreview(result: unknown): string {
  try {
    const raw = JSON.stringify(result);
    return raw.length > 260 ? `${raw.slice(0, 257)}...` : raw;
  } catch {
    return String(result).slice(0, 260);
  }
}

export interface ToolExecutionContext {
  actor: string;
  transport: 'gemini_chat' | 'mcp_http' | 'mcp_sse' | 'admin_ui';
  userToken?: string;
}

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<{ ok: boolean; data?: unknown; error?: string; durationMs: number; proposalId?: string }> {
  const started = Date.now();
  const safeArgs = args && typeof args === 'object' ? args : {};

  const recordAudit = async (status: 'ok' | 'blocked' | 'error', summary: string) => {
    const durationMs = Date.now() - started;
    await mutateState((state) => {
      state.auditLogs.unshift({
        id: `mcpa_${crypto.randomUUID().slice(0, 10)}`,
        timestamp: new Date().toISOString(),
        actor: ctx.actor,
        transport: ctx.transport,
        toolName,
        status,
        durationMs,
        summary: summary.slice(0, 220),
        argsPreview: JSON.stringify(safeArgs).slice(0, 220)
      });
    }).catch(() => undefined);
    return durationMs;
  };

  try {
    let data: unknown;
    let createdProposalId: string | undefined;

    switch (toolName) {
      case 'code_list_files': {
        data = await listSourceFiles(
          typeof safeArgs.directory === 'string' ? safeArgs.directory : '.',
          typeof safeArgs.maxDepth === 'number' ? safeArgs.maxDepth : 3,
          typeof safeArgs.limit === 'number' ? safeArgs.limit : 180
        );
        break;
      }

      case 'code_read_file': {
        data = await readSourceFile(
          String(safeArgs.filePath || ''),
          typeof safeArgs.startLine === 'number' ? safeArgs.startLine : 1,
          typeof safeArgs.endLine === 'number' ? safeArgs.endLine : undefined
        );
        break;
      }

      case 'code_search': {
        data = await searchSourceCode(
          String(safeArgs.query || ''),
          typeof safeArgs.directory === 'string' ? safeArgs.directory : '.',
          Boolean(safeArgs.isRegex),
          typeof safeArgs.limit === 'number' ? safeArgs.limit : 40
        );
        break;
      }

      case 'code_propose_edit': {
        const proposal = await proposeCodeEdit({
          filePath: String(safeArgs.filePath || ''),
          summary: String(safeArgs.summary || ''),
          rationale: typeof safeArgs.rationale === 'string' ? safeArgs.rationale : undefined,
          targetContent: typeof safeArgs.targetContent === 'string' ? safeArgs.targetContent : undefined,
          replacementContent:
            typeof safeArgs.replacementContent === 'string' ? safeArgs.replacementContent : undefined,
          proposedContent: typeof safeArgs.proposedContent === 'string' ? safeArgs.proposedContent : undefined,
          requestedBy: ctx.actor,
          source: ctx.transport === 'gemini_chat' ? 'gemini_chat' : 'external_mcp'
        });
        createdProposalId = proposal.id;
        data = {
          proposalId: proposal.id,
          status: proposal.status,
          filePath: proposal.filePath,
          summary: proposal.summary,
          diffPreview: proposal.diffPreview,
          message: 'Staged cleanly in Super Admin Edit Approval Queue. Requires manual approval before disk write.'
        };
        break;
      }

      case 'cms_list_articles': {
        const posts = await listPosts(true, ctx.userToken);
        const statusFilter = typeof safeArgs.status === 'string' ? safeArgs.status : 'all';
        const limit = typeof safeArgs.limit === 'number' ? Math.max(1, Math.min(100, safeArgs.limit)) : 25;
        const filtered = posts
          .filter((p) => (statusFilter === 'all' ? true : p.status === statusFilter))
          .slice(0, limit)
          .map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            category: p.category,
            status: p.status,
            quality_score: p.quality_score,
            word_count: p.word_count,
            updated_at: p.updated_at
          }));
        data = { total: posts.length, returned: filtered.length, articles: filtered };
        break;
      }

      case 'cms_upsert_article': {
        const existing = await listPosts(true, ctx.userToken);
        const prev = typeof safeArgs.id === 'string' ? existing.find((p) => p.id === safeArgs.id) : undefined;
        const title = String(safeArgs.title || prev?.title || '').trim();
        if (!title) throw new Error('Article title is required.');
        const slug = String(safeArgs.slug || prev?.slug || slugify(title));
        const category = (safeArgs.category || prev?.category || 'AI Integration') as ServiceCategory;
        const summary_tldr = String(safeArgs.summary_tldr || prev?.summary_tldr || '').trim();
        const content_markdown = String(safeArgs.content_markdown || prev?.content_markdown || '').trim();
        const primary_keyword = String(safeArgs.primary_keyword || prev?.primary_keyword || 'enterprise software');
        const meta_title = String(safeArgs.meta_title || prev?.meta_title || `${title} | GitStack`).slice(0, 70);
        const meta_description = String(safeArgs.meta_description || prev?.meta_description || summary_tldr).slice(0, 160);
        const desiredStatus = safeArgs.status === 'published' ? 'published' : 'draft';

        const report = evaluateArticleQuality({
          title,
          summary_tldr,
          content_markdown,
          author_name: prev?.author_name || 'Rolan Molano',
          author_role: prev?.author_role || 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
          author_bio:
            prev?.author_bio ||
            'Principal Cloud Architect with 13+ years designing high-throughput backend systems, AI workflows, and cloud compliance platforms.',
          cover_image: prev?.cover_image || '/assets/og-cover.png',
          cover_alt: prev?.cover_alt || `${title} architecture illustration`,
          meta_title,
          meta_description,
          primary_keyword,
          faqs: prev?.faqs || [],
          references: prev?.references || []
        });

        const finalStatus = desiredStatus === 'published' && report.publishEligible ? 'published' : 'draft';
        const now = new Date().toISOString();
        const article: Article = {
          id: prev?.id || `art_${crypto.randomUUID().slice(0, 10)}`,
          title,
          slug,
          category,
          summary_tldr,
          content_markdown,
          author_name: prev?.author_name || 'Rolan Molano',
          author_role: prev?.author_role || 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
          author_bio:
            prev?.author_bio ||
            'Principal Cloud Architect with 13+ years designing high-throughput backend systems, AI workflows, and cloud compliance platforms.',
          cover_image: prev?.cover_image || '/assets/og-cover.png',
          cover_alt: prev?.cover_alt || `${title} architecture illustration`,
          meta_title,
          meta_description,
          primary_keyword,
          faqs: prev?.faqs || [],
          references: prev?.references || [],
          status: finalStatus,
          quality_score: report.qualityScore,
          geo_score: report.geoScore,
          word_count: report.wordCount,
          read_time_minutes: report.readTimeMinutes,
          published_at: finalStatus === 'published' ? prev?.published_at || now : prev?.published_at || null,
          updated_at: now,
          created_at: prev?.created_at || now
        };
        const saved = await upsertPost(article, ctx.userToken);
        data = {
          article: {
            id: saved.id,
            title: saved.title,
            slug: saved.slug,
            status: saved.status,
            quality_score: saved.quality_score
          },
          qualityGatePassed: report.publishEligible,
          note:
            desiredStatus === 'published' && !report.publishEligible
              ? 'Saved as draft because Quality Gate checks did not yet pass.'
              : 'Saved successfully.'
        };
        break;
      }

      case 'cms_get_pages': {
        const pages = await listPageContents(ctx.userToken);
        const keyFilter = typeof safeArgs.pageKey === 'string' ? safeArgs.pageKey : undefined;
        data = keyFilter ? pages.find((p) => p.page_key === keyFilter) || null : pages;
        break;
      }

      case 'cms_update_page': {
        const pageKey = String(safeArgs.pageKey || '') as PageKey;
        if (!['home', 'services', 'about', 'contact'].includes(pageKey)) {
          throw new Error('pageKey must be one of home, services, about, contact.');
        }
        const pages = await listPageContents(ctx.userToken);
        const existing = pages.find((p) => p.page_key === pageKey);
        if (!existing) throw new Error(`Page "${pageKey}" not found.`);
        const patch = (safeArgs.patch && typeof safeArgs.patch === 'object'
          ? safeArgs.patch
          : {}) as Partial<PageContentConfig>;
        const next: PageContentConfig = {
          ...existing,
          ...patch,
          page_key: pageKey,
          updated_at: new Date().toISOString()
        };
        data = await upsertPageContent(next, ctx.userToken);
        break;
      }

      case 'seo_get_search_console': {
        data = await getSearchConsoleDashboard({ userToken: ctx.userToken });
        break;
      }

      case 'seo_ai_visibility': {
        if (safeArgs.action === 'run_test') {
          data = await runDailyAiSearchVisibilityTest({
            triggerType: 'manual',
            sendEmailReport: false,
            userToken: ctx.userToken
          });
        } else {
          data = await getAiSearchVisibilityDashboard(ctx.userToken);
        }
        break;
      }

      case 'crm_list_inquiries': {
        const all = await listInquiries(ctx.userToken);
        const statusFilter = typeof safeArgs.status === 'string' ? safeArgs.status : undefined;
        const limit = typeof safeArgs.limit === 'number' ? Math.max(1, Math.min(100, safeArgs.limit)) : 30;
        const filtered = (statusFilter ? all.filter((i) => i.status === statusFilter) : all).slice(0, limit);
        data = { total: all.length, returned: filtered.length, inquiries: filtered };
        break;
      }

      case 'crm_update_inquiry_status': {
        const inquiryId = String(safeArgs.inquiryId || '');
        const status = String(safeArgs.status || '') as InquiryStatus;
        if (!inquiryId || !['new', 'reviewed', 'scheduled'].includes(status)) {
          throw new Error('Valid inquiryId and status (new, reviewed, scheduled) are required.');
        }
        data = await updateInquiryStatus(inquiryId, status, ctx.userToken);
        break;
      }

      case 'crm_list_leads': {
        const all = await listCrmLeads(ctx.userToken);
        const stageFilter = typeof safeArgs.stage === 'string' ? safeArgs.stage : undefined;
        const limit = typeof safeArgs.limit === 'number' ? Math.max(1, Math.min(100, safeArgs.limit)) : 30;
        const filtered = (stageFilter ? all.filter((l) => l.stage === stageFilter) : all).slice(0, limit);
        data = { total: all.length, returned: filtered.length, leads: filtered };
        break;
      }

      case 'crm_upsert_lead': {
        const rawLead = (safeArgs.lead && typeof safeArgs.lead === 'object' ? safeArgs.lead : {}) as Partial<CrmLead>;
        if (!rawLead.company_name && !rawLead.email && !rawLead.id) {
          throw new Error('Provide lead.company_name, lead.email, or lead.id.');
        }
        const now = new Date().toISOString();
        const lead: CrmLead = {
          id: rawLead.id || `lead_${crypto.randomUUID().slice(0, 10)}`,
          contact_name: String(rawLead.contact_name || 'Prospective Lead'),
          role_title: String(rawLead.role_title || ''),
          email: String(rawLead.email || ''),
          email_status: rawLead.email_status || 'inferred',
          company_name: String(rawLead.company_name || 'Prospective Client'),
          company_domain: String(rawLead.company_domain || ''),
          website_url: String(rawLead.website_url || ''),
          github_url: String(rawLead.github_url || ''),
          phone: rawLead.phone ? String(rawLead.phone) : undefined,
          location: rawLead.location ? String(rawLead.location) : undefined,
          source_type: rawLead.source_type || 'manual',
          source_urls: Array.isArray(rawLead.source_urls) ? rawLead.source_urls : [],
          tech_stack: Array.isArray(rawLead.tech_stack) ? rawLead.tech_stack : [],
          research_brief: String(rawLead.research_brief || ''),
          recommended_service: rawLead.recommended_service || 'AI Integration',
          fit_score: Number(rawLead.fit_score ?? 75),
          deal_value: Number(rawLead.deal_value ?? 0),
          stage: rawLead.stage || 'discovered',
          proposal_subject: String(rawLead.proposal_subject || ''),
          proposal_body: String(rawLead.proposal_body || ''),
          follow_up_sequence: Array.isArray(rawLead.follow_up_sequence) ? rawLead.follow_up_sequence : [],
          assigned_to: rawLead.assigned_to || null,
          last_contacted_at: rawLead.last_contacted_at || null,
          next_followup_at: rawLead.next_followup_at || null,
          converted_inquiry_id: rawLead.converted_inquiry_id || null,
          created_at: rawLead.created_at || now,
          updated_at: now
        };
        data = await upsertCrmLead(lead, ctx.userToken);
        break;
      }

      case 'chat_list_sessions_and_templates': {
        const limit = typeof safeArgs.limit === 'number' ? Math.max(1, Math.min(80, safeArgs.limit)) : 20;
        const [sessions, templates, settings] = await Promise.all([
          listWebsiteChatSessions(ctx.userToken),
          listChatAutoResponses({ userToken: ctx.userToken }),
          getChatAutoResponseSettings(ctx.userToken)
        ]);
        data = {
          totalSessions: sessions.length,
          sessions: sessions.slice(0, limit),
          templates,
          settings
        };
        break;
      }

      case 'chat_manage_auto_response_or_reply': {
        const action = String(safeArgs.action || '');
        if (action === 'reply_session') {
          const sessionId = String(safeArgs.sessionId || '');
          const replyText = String(safeArgs.replyText || '').trim();
          if (!sessionId || !replyText) throw new Error('sessionId and replyText are required.');
          const msg: WebsiteChatMessage = {
            id: `wmsg_${crypto.randomUUID().slice(0, 12)}`,
            session_id: sessionId,
            sender_role: 'admin',
            sender_name: `Super Admin (${ctx.actor})`,
            body: replyText,
            created_at: new Date().toISOString()
          };
          data = await appendWebsiteChatMessage(msg, ctx.userToken);
        } else if (action === 'purge_empty') {
          data = await purgeEmptyWebsiteChatSessions(ctx.userToken);
        } else if (action === 'upsert_template') {
          const tpl = (safeArgs.template && typeof safeArgs.template === 'object'
            ? safeArgs.template
            : {}) as Partial<ChatAutoResponseTemplate> & { answer_text?: string; trigger_keywords?: string[] };
          const answerBody = String(tpl.answer_body || tpl.answer_text || '').trim();
          if (!tpl.question_label || !answerBody) {
            throw new Error('template.question_label and template.answer_body are required.');
          }
          const now = new Date().toISOString();
          data = await upsertChatAutoResponse(
            {
              id: tpl.id || `car_${crypto.randomUUID().slice(0, 10)}`,
              question_label: String(tpl.question_label),
              keywords: Array.isArray(tpl.keywords)
                ? tpl.keywords
                : Array.isArray(tpl.trigger_keywords)
                  ? tpl.trigger_keywords
                  : [],
              answer_body: answerBody,
              category: tpl.category || 'General',
              sort_order: Number(tpl.sort_order ?? 10),
              is_active: tpl.is_active !== false,
              show_as_quick_chip: tpl.show_as_quick_chip !== false,
              escalate_prompt_enabled: tpl.escalate_prompt_enabled !== false,
              usage_count: Number(tpl.usage_count ?? 0),
              created_at: tpl.created_at || now,
              updated_at: now
            },
            ctx.userToken
          );
        } else if (action === 'delete_template') {
          const templateId = String(safeArgs.templateId || '');
          if (!templateId) throw new Error('templateId is required.');
          await deleteChatAutoResponse(templateId, ctx.userToken);
          data = { deleted: templateId };
        } else if (action === 'save_settings') {
          const current = await getChatAutoResponseSettings(ctx.userToken);
          const patch = (safeArgs.settingsPatch && typeof safeArgs.settingsPatch === 'object'
            ? safeArgs.settingsPatch
            : {}) as Record<string, unknown>;
          data = await saveChatAutoResponseSettings(
            { ...current, ...patch, id: 'default', updated_at: new Date().toISOString() },
            ctx.userToken
          );
        } else {
          throw new Error('Unsupported chat action.');
        }
        break;
      }

      case 'agents_get_status': {
        const [
          posts,
          comments,
          inquiries,
          subscribers,
          settings,
          pageContents,
          chatThreads,
          analytics,
          tasks,
          profiles,
          supabaseTablesReady,
          socialStatus,
          demoGuardSnapshot
        ] = await Promise.all([
          listPosts(true, ctx.userToken),
          listComments(null, true, ctx.userToken),
          listInquiries(ctx.userToken),
          listSubscribers(ctx.userToken),
          getAdSenseSettings(ctx.userToken),
          listPageContents(ctx.userToken),
          listChatThreads(ctx.userToken),
          getAnalyticsSummary(14, ctx.userToken),
          listAgentTasks(ctx.userToken),
          listAgentOfficeProfiles(ctx.userToken),
          checkSupabaseTablesReady(),
          getSocialConnectionsStatus(ctx.userToken).catch(() => null),
          getDemoGuardAgentSnapshot().catch(() => undefined)
        ]);
        const growthSnapshot = await getAgentGrowthSnapshot(
          Boolean(socialStatus?.facebook.connected),
          Boolean(socialStatus?.tiktok.connected)
        ).catch(() => undefined);
        const publishedCount = posts.filter((p) => p.status === 'published').length;
        const agents = buildAllAgentReports({
          posts,
          comments,
          inquiries,
          subscribers,
          settings,
          siteAudit: {
            readyForAdSense: true,
            passedCount: 6,
            totalChecks: 6,
            publishedArticleCount: publishedCount,
            thinArticleCount: posts.filter((p) => p.status === 'published' && p.word_count < 800).length,
            averageWordCount: 1050,
            checks: []
          },
          pageContents,
          chatThreads,
          analytics,
          supabaseTablesReady,
          growthSnapshot,
          demoGuardSnapshot
        });
        data = {
          agentCount: agents.length,
          agents: agents.map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            score: a.score,
            status: a.status,
            summary: a.summary
          })),
          activeTaskCount: tasks.length,
          officeProfilesCount: profiles.length
        };
        break;
      }

      case 'workflows_list': {
        data = await listWorkflowItems(undefined, ctx.userToken);
        break;
      }

      case 'workflows_create_or_update': {
        const now = new Date().toISOString();
        if (typeof safeArgs.id === 'string' && safeArgs.id.trim()) {
          const patch: Partial<UserWorkflowItem> = {};
          if (typeof safeArgs.title === 'string') patch.title = safeArgs.title;
          if (typeof safeArgs.description === 'string') patch.description = safeArgs.description;
          if (typeof safeArgs.status === 'string') {
            patch.status = safeArgs.status as UserWorkflowItem['status'];
          }
          if (typeof safeArgs.priority === 'string') {
            patch.priority = safeArgs.priority as UserWorkflowItem['priority'];
          }
          data = await updateWorkflowItem(safeArgs.id.trim(), patch, ctx.userToken);
        } else {
          const item: UserWorkflowItem = {
            id: `wf_${crypto.randomUUID().slice(0, 10)}`,
            user_id: ctx.actor,
            assigned_by: ctx.actor,
            title: String(safeArgs.title || 'New Operational Task'),
            description: String(safeArgs.description || ''),
            category: 'project_task',
            status: (safeArgs.status as UserWorkflowItem['status']) || 'todo',
            priority: (safeArgs.priority as UserWorkflowItem['priority']) || 'medium',
            due_date: null,
            linked_entity_type: 'none',
            linked_entity_id: null,
            created_at: now,
            updated_at: now
          };
          data = await createWorkflowItem(item, ctx.userToken);
        }
        break;
      }

      case 'contacts_scan_registry': {
        data = await scanAllContactsAndIdentities(ctx.userToken);
        break;
      }

      case 'infra_quota_shield': {
        const action = String(safeArgs.action || 'status');
        if (action === 'flush_cache') {
          data = await flushQuotaShieldCache();
        } else if (action === 'update') {
          const cfg = (safeArgs.config && typeof safeArgs.config === 'object'
            ? safeArgs.config
            : {}) as QuotaShieldUpdatePayload;
          data = await updateQuotaShieldConfig(cfg);
        } else {
          data = await getQuotaShieldStatus();
        }
        break;
      }

      case 'qa_get_or_run_scan': {
        data =
          safeArgs.action === 'run_scan'
            ? await runLiveQaAgentScan(`mcp:${ctx.actor}`, ctx.userToken)
            : await getQaDashboardData(ctx.userToken);
        break;
      }

      case 'security_get_or_scan': {
        data =
          safeArgs.action === 'run_scan'
            ? await evaluateCyberDomainsAndPosture(ctx.userToken)
            : await getCyberSecurityDashboard(ctx.userToken);
        break;
      }

      case 'demo_guard_status_or_scan': {
        data =
          safeArgs.action === 'run_scan'
            ? await runDemoGuardAndAdminParityScan({ reason: 'manual', adminToken: ctx.userToken })
            : await getDemoGuardDashboard();
        break;
      }

      case 'site_get_or_update_settings': {
        const action = String(safeArgs.action || 'get_settings');
        if (action === 'data_overview') {
          if (typeof safeArgs.tableName === 'string' && safeArgs.tableName.trim()) {
            data = await getDataTableRows({
              tableName: safeArgs.tableName.trim(),
              limit: 25
            });
          } else {
            data = await getDataExplorerOverview();
          }
        } else if (action === 'update_settings') {
          const current = await getAdSenseSettings(ctx.userToken);
          const patch = (safeArgs.patch && typeof safeArgs.patch === 'object'
            ? safeArgs.patch
            : {}) as Partial<AdSenseSettings>;
          data = await saveAdSenseSettings(
            { ...current, ...patch, updated_at: new Date().toISOString() },
            ctx.userToken
          );
        } else {
          data = await getAdSenseSettings(ctx.userToken);
        }
        break;
      }

      default:
        throw new Error(`Unknown MCP tool: "${toolName}"`);
    }

    const durationMs = await recordAudit('ok', summarizeResultPreview(data));
    return { ok: true, data, durationMs, proposalId: createdProposalId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MCP tool execution failed.';
    const isBlocked = message.toLowerCase().includes('security policy') || message.toLowerCase().includes('access denied');
    const durationMs = await recordAudit(isBlocked ? 'blocked' : 'error', message);
    return { ok: false, error: message, durationMs };
  }
}

// --- Standard MCP JSON-RPC 2.0 + SSE Transport ---

const sseClients = new Map<string, Response>();

export function registerMcpSseClient(sessionId: string, res: Response) {
  sseClients.set(sessionId, res);
}

export function unregisterMcpSseClient(sessionId: string) {
  sseClients.delete(sessionId);
}

export function pushMcpSseMessage(sessionId: string, event: string, payload: unknown): boolean {
  const client = sseClients.get(sessionId);
  if (!client || client.writableEnded) return false;
  client.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  return true;
}

function toJsonSchema(descriptor: McpToolDescriptor) {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [key, def] of Object.entries(descriptor.parameters)) {
    const prop: Record<string, unknown> = {
      type: def.type,
      description: def.description
    };
    if (def.enumValues && def.enumValues.length > 0) {
      prop.enum = def.enumValues;
    }
    properties[key] = prop;
    if (def.required) required.push(key);
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {})
  };
}

export interface JsonRpcRequestPayload {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export async function handleMcpJsonRpc(
  body: JsonRpcRequestPayload,
  ctx: ToolExecutionContext
): Promise<Record<string, unknown> | null> {
  const id = body?.id ?? null;
  const method = String(body?.method || '');
  const params = (body?.params && typeof body.params === 'object' ? body.params : {}) as Record<string, unknown>;

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null;
  }

  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false }
          },
          serverInfo: {
            name: 'gitstack-command-mcp',
            version: '1.0.0'
          }
        }
      };
    }

    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOL_DESCRIPTORS.map((t) => ({
            name: t.name,
            description: `[${t.category} · ${t.accessLevel}] ${t.description}`,
            inputSchema: toJsonSchema(t)
          }))
        }
      };
    }

    if (method === 'tools/call') {
      const name = String(params.name || '');
      const toolArgs = (params.arguments && typeof params.arguments === 'object'
        ? params.arguments
        : {}) as Record<string, unknown>;
      const outcome = await executeMcpTool(name, toolArgs, ctx);
      if (!outcome.ok) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: outcome.error || 'Tool call failed.' }]
          }
        };
      }
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(outcome.data, null, 2) }]
        }
      };
    }

    if (method === 'resources/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'gitstack://code/tree',
              name: 'Project Source Tree',
              description: 'Confined file tree of the GitStack repository',
              mimeType: 'application/json'
            },
            {
              uri: 'gitstack://proposals/pending',
              name: 'Pending Code Change Proposals',
              description: 'Staged source diffs awaiting Super Admin approval',
              mimeType: 'application/json'
            },
            {
              uri: 'gitstack://workspace/agents',
              name: 'Live 8-Agent Telemetry',
              description: 'Operational snapshot of GitStack agents & site health',
              mimeType: 'application/json'
            }
          ]
        }
      };
    }

    if (method === 'resources/read') {
      const uri = String(params.uri || '');
      if (uri === 'gitstack://code/tree') {
        const tree = await listSourceFiles('.', 3, 250);
        return {
          jsonrpc: '2.0',
          id,
          result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(tree, null, 2) }] }
        };
      }
      if (uri === 'gitstack://proposals/pending') {
        const state = await readState();
        const pending = state.proposals.filter((p) => p.status === 'pending');
        return {
          jsonrpc: '2.0',
          id,
          result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(pending, null, 2) }] }
        };
      }
      if (uri === 'gitstack://workspace/agents') {
        const res = await executeMcpTool('agents_get_status', {}, ctx);
        return {
          jsonrpc: '2.0',
          id,
          result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(res.data, null, 2) }] }
        };
      }
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Unknown resource URI: ${uri}` }
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Unsupported MCP method: ${method}` }
    };
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: err instanceof Error ? err.message : 'Internal MCP gateway error'
      }
    };
  }
}

// --- In-App Gemini Multi-Turn Function Calling Orchestrator ---

function toGeminiSchemaType(type: 'string' | 'number' | 'boolean' | 'object' | 'array'): Type {
  switch (type) {
    case 'number':
      return Type.NUMBER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'object':
      return Type.OBJECT;
    case 'array':
      return Type.ARRAY;
    default:
      return Type.STRING;
  }
}

function buildGeminiDeclarations(): FunctionDeclaration[] {
  return MCP_TOOL_DESCRIPTORS.map((descriptor) => {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];

    for (const [key, param] of Object.entries(descriptor.parameters)) {
      const schema: Schema = {
        type: toGeminiSchemaType(param.type),
        description: param.description
      };
      if (param.enumValues && param.enumValues.length > 0) {
        schema.enum = param.enumValues;
      }
      properties[key] = schema;
      if (param.required) required.push(key);
    }

    return {
      name: descriptor.name,
      description: `${descriptor.description} [${descriptor.category} · ${descriptor.accessLevel}]`,
      parameters: {
        type: Type.OBJECT,
        properties,
        ...(required.length > 0 ? { required } : {})
      }
    };
  });
}

export async function runGeminiMcpChat(input: {
  message: string;
  history?: McpChatHistoryTurn[];
  thinkingMode?: 'fast' | 'deep';
  actor: string;
  userToken?: string;
}): Promise<McpChatResponse> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'Server GEMINI_API_KEY is not configured. Configure GEMINI_API_KEY in server environment variables to run Gemini Command Chat.'
    );
  }

  const userMessage = String(input.message || '').trim();
  if (!userMessage) {
    throw new Error('Command prompt message cannot be empty.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const modelUsed = 'gemini-4-hydrogen';
  const thinkingLevel = input.thinkingMode === 'deep' ? 'XHIGH' : 'MEDIUM';
  const declarations = buildGeminiDeclarations();

  const contents: Content[] = [];
  if (Array.isArray(input.history)) {
    for (const turn of input.history.slice(-12)) {
      if (!turn || !turn.text || !turn.text.trim()) continue;
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text.trim() }]
      });
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const systemInstruction = [
    'You are the GitStack Super Admin MCP Command Copilot running inside the live Back Office.',
    'You have direct tool access to all Back Office modules (CMS, SEO, CRM, Live Chat & Auto-Response, 8 Agents, Workflows, Quota Shield, QA, Cybersecurity, Demo Guard, Site Settings) AND confined project source code tools (code_list_files, code_read_file, code_search, code_propose_edit).',
    'Rules:',
    '1. Always call real tools before claiming live data values or source code contents.',
    '2. When inspecting or modifying source code, read the exact target lines with code_read_file first, then stage changes with code_propose_edit using exact targetContent/replacementContent so the Super Admin can review and click Approve & Apply.',
    '3. Never attempt to read secrets or .env files.',
    '4. Respond concisely in structured Markdown citing concrete file paths, IDs, metrics, or staged proposal IDs created during your tool calls.'
  ].join('\n');

  const traces: McpToolTrace[] = [];
  const createdProposalIds: string[] = [];

  for (let step = 0; step < 8; step += 1) {
    const response = await ai.models.generateContent({
      model: modelUsed,
      contents,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: thinkingLevel === 'XHIGH' ? ThinkingLevel.XHIGH : ThinkingLevel.MEDIUM
        },
        tools: [{ functionDeclarations: declarations }]
      }
    });

    const candidateContent = response.candidates?.[0]?.content;
    if (candidateContent) {
      contents.push(candidateContent);
    }

    const calls = response.functionCalls || [];
    if (calls.length === 0) {
      return {
        reply: (response.text || '').trim() || 'Completed command execution.',
        traces,
        createdProposalIds,
        modelUsed,
        thinkingLevel
      };
    }

    const responseParts: Part[] = [];
    for (const call of calls) {
      const toolName = String(call.name || '');
      const toolArgs = (call.args && typeof call.args === 'object' ? call.args : {}) as Record<string, unknown>;
      const outcome = await executeMcpTool(toolName, toolArgs, {
        actor: input.actor,
        transport: 'gemini_chat',
        userToken: input.userToken
      });

      if (outcome.proposalId) {
        createdProposalIds.push(outcome.proposalId);
      }

      traces.push({
        id: `mcptr_${crypto.randomUUID().slice(0, 8)}`,
        toolName,
        args: toolArgs,
        status: outcome.ok ? 'ok' : outcome.error?.toLowerCase().includes('security') ? 'blocked' : 'error',
        durationMs: outcome.durationMs,
        resultPreview: summarizeResultPreview(outcome.ok ? outcome.data : { error: outcome.error })
      });

      responseParts.push({
        functionResponse: {
          id: call.id,
          name: toolName,
          response: outcome.ok ? { result: outcome.data } : { error: outcome.error || 'Execution failed' }
        }
      });
    }

    contents.push({
      role: 'user',
      parts: responseParts
    });
  }

  return {
    reply:
      'Reached the 8-step tool execution ceiling for this turn. Review the executed tool traces above or ask a follow-up prompt to continue.',
    traces,
    createdProposalIds,
    modelUsed,
    thinkingLevel
  };
}

// --- Dashboard Aggregator ---

export async function getMcpDashboard(): Promise<McpDashboardResponse> {
  const state = await readState();
  return {
    tokens: state.tokens.map(toTokenSummary),
    proposals: state.proposals,
    auditLogs: state.auditLogs.slice(0, 80),
    tools: MCP_TOOL_DESCRIPTORS,
    mcpEndpointPath: '/api/mcp',
    sseEndpointPath: '/api/mcp/sse',
    geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim())
  };
}
