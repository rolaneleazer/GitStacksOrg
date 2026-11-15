import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type {
  IntegrationConfigMeta,
  IntegrationProviderId,
  IntegrationSecretRecord,
  IntegrationStatusItem
} from '../shared/types.ts';
import {
  getIntegrationSecretRow,
  listIntegrationSecretRows,
  upsertIntegrationSecretRow
} from './repository.ts';

export const VALID_INTEGRATION_PROVIDERS: IntegrationProviderId[] = [
  'lark_smtp',
  'apollo',
  'google_maps',
  'gemini',
  'github'
];

interface ProviderMetaDef {
  label: string;
  category: IntegrationStatusItem['category'];
  description: string;
  docsHint: string;
  defaultConfigMeta: IntegrationConfigMeta;
}

const PROVIDER_DEFS: Record<IntegrationProviderId, ProviderMetaDef> = {
  lark_smtp: {
    label: 'Lark Mail (SMTP SSL)',
    category: 'Email Outreach',
    description:
      'Direct encrypted SMTP SSL (port 465) mail transport using your Lark Mail third-party Authorization Code.',
    docsHint: 'Lark Mail Settings -> Third-Party Email Clients -> Generate Authorization Code',
    defaultConfigMeta: {
      email: '',
      sender_name: 'GitStack Solutions',
      smtp_host: 'smtp.larksuite.com',
      smtp_port: 465,
      smtp_ssl: true,
      imap_host: 'imap.larksuite.com',
      imap_port: 993,
      imap_ssl: true
    }
  },
  apollo: {
    label: 'Apollo.io People API',
    category: 'Lead Prospecting',
    description:
      'Searches B2B decision-makers by role, location, keywords, and enriches verified work emails.',
    docsHint: 'Apollo.io -> Settings -> Integrations -> API Keys',
    defaultConfigMeta: {}
  },
  google_maps: {
    label: 'Google Maps Platform',
    category: 'Lead Prospecting',
    description:
      'Powers the Map Finder establishment search, interactive pins, and local business website/email extraction.',
    docsHint: 'Google Cloud Console -> APIs & Services -> Credentials (Places API New + Maps JS)',
    defaultConfigMeta: {}
  },
  gemini: {
    label: 'Gemini AI Research',
    category: 'AI & Grounding',
    description:
      'Drives AI lead qualification, website analysis, executive proposal drafting, and Google Search grounding.',
    docsHint: 'Google AI Studio -> Get API Key',
    defaultConfigMeta: {}
  },
  github: {
    label: 'GitHub REST API',
    category: 'Open-Source Scraping',
    description:
      'Raises GitHub Search & Repo Maintainer scraping rate limits from 60 to 5,000 requests/hour.',
    docsHint: 'GitHub -> Settings -> Developer Settings -> Personal Access Token (public_repo read)',
    defaultConfigMeta: {}
  }
};

function getVaultEncryptionKey(): Buffer {
  const raw =
    process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ||
    process.env.STUDIO_SESSION_SECRET?.trim() ||
    `${process.cwd()}_gitstack_integrations_vault_v1`;
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptVaultSecret(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (!trimmed) return '';
  const key = getVaultEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptVaultSecret(payload: string): string {
  if (!payload || !payload.includes(':')) return '';
  try {
    const [ivHex, tagHex, ctHex] = payload.split(':');
    if (!ivHex || !tagHex || !ctHex) return '';
    const key = getVaultEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final()
    ]);
    return plain.toString('utf8').trim();
  } catch {
    return '';
  }
}

function makeSecretHint(secret: string): string {
  const clean = secret.trim();
  if (!clean) return '';
  if (clean.length <= 4) return '••••';
  return `••••${clean.slice(-4)}`;
}

function getEnvFallbackSecret(provider: IntegrationProviderId): string {
  switch (provider) {
    case 'lark_smtp':
      return process.env.LARK_SMTP_AUTH_CODE?.trim() || '';
    case 'apollo':
      return process.env.APOLLO_API_KEY?.trim() || '';
    case 'google_maps':
      return (
        process.env.GOOGLE_MAPS_API_KEY?.trim() ||
        process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
        ''
      );
    case 'gemini': {
      const k = process.env.GEMINI_API_KEY?.trim() || '';
      return k && k !== 'MY_GEMINI_API_KEY' ? k : '';
    }
    case 'github':
      return process.env.GITHUB_TOKEN?.trim() || '';
    default:
      return '';
  }
}

function mergeConfigMeta(
  provider: IntegrationProviderId,
  existing?: IntegrationConfigMeta | null,
  incoming?: IntegrationConfigMeta | null
): IntegrationConfigMeta {
  const defaults = PROVIDER_DEFS[provider].defaultConfigMeta;
  const merged: IntegrationConfigMeta = {
    ...defaults,
    ...(existing || {}),
    ...(incoming || {})
  };
  if (provider === 'lark_smtp') {
    if (!merged.email && process.env.LARK_SMTP_EMAIL?.trim()) {
      merged.email = process.env.LARK_SMTP_EMAIL.trim();
    }
    merged.smtp_host = (merged.smtp_host || 'smtp.larksuite.com').trim();
    merged.smtp_port = Number(merged.smtp_port) || 465;
    merged.smtp_ssl = merged.smtp_ssl !== false;
    merged.imap_host = (merged.imap_host || 'imap.larksuite.com').trim();
    merged.imap_port = Number(merged.imap_port) || 993;
    merged.imap_ssl = merged.imap_ssl !== false;
    merged.email = (merged.email || '').trim().toLowerCase();
    merged.sender_name = (merged.sender_name || 'GitStack Solutions').trim();
  }
  return merged;
}

export async function resolveIntegrationConfig(
  provider: IntegrationProviderId,
  userToken?: string
): Promise<{
  secret: string;
  source: 'vault' | 'env' | 'disconnected';
  configMeta: IntegrationConfigMeta;
  row: IntegrationSecretRecord | null;
}> {
  const row = await getIntegrationSecretRow(provider, userToken).catch(() => null);
  const envSecret = getEnvFallbackSecret(provider);
  const configMeta = mergeConfigMeta(provider, row?.config_meta, undefined);

  if (row) {
    if (!row.enabled) {
      return { secret: '', source: 'disconnected', configMeta, row };
    }
    if (row.encrypted_secret) {
      const decrypted = decryptVaultSecret(row.encrypted_secret);
      if (decrypted) {
        if (provider === 'lark_smtp' && !configMeta.email) {
          return { secret: '', source: 'disconnected', configMeta, row };
        }
        return { secret: decrypted, source: 'vault', configMeta, row };
      }
    }
    if (envSecret) {
      if (provider === 'lark_smtp' && !configMeta.email) {
        return { secret: '', source: 'disconnected', configMeta, row };
      }
      return { secret: envSecret, source: 'env', configMeta, row };
    }
    return { secret: '', source: 'disconnected', configMeta, row };
  }

  if (envSecret) {
    if (provider === 'lark_smtp' && !configMeta.email) {
      return { secret: '', source: 'disconnected', configMeta, row: null };
    }
    return { secret: envSecret, source: 'env', configMeta, row: null };
  }

  return { secret: '', source: 'disconnected', configMeta, row: null };
}

export async function resolveIntegrationSecret(
  provider: IntegrationProviderId,
  userToken?: string
): Promise<string> {
  const resolved = await resolveIntegrationConfig(provider, userToken);
  return resolved.secret;
}

function buildStatusItem(
  provider: IntegrationProviderId,
  row: IntegrationSecretRecord | null
): IntegrationStatusItem {
  const def = PROVIDER_DEFS[provider];
  const envSecret = getEnvFallbackSecret(provider);
  const envFallbackAvailable = Boolean(envSecret);
  const configMeta = mergeConfigMeta(provider, row?.config_meta, undefined);

  let source: IntegrationStatusItem['source'] = 'disconnected';
  let connected = false;
  let maskedHint = '';

  if (row) {
    if (!row.enabled) {
      source = 'disconnected';
      connected = false;
      maskedHint = '';
    } else if (row.encrypted_secret) {
      source = 'vault';
      connected = provider === 'lark_smtp' ? Boolean(configMeta.email) : true;
      maskedHint = row.secret_hint || '••••';
    } else if (envSecret) {
      source = 'env';
      connected = provider === 'lark_smtp' ? Boolean(configMeta.email) : true;
      maskedHint = makeSecretHint(envSecret);
    }
  } else if (envSecret) {
    source = 'env';
    connected = provider === 'lark_smtp' ? Boolean(configMeta.email) : true;
    maskedHint = makeSecretHint(envSecret);
  }

  return {
    provider,
    label: def.label,
    category: def.category,
    description: def.description,
    connected,
    enabled: row ? row.enabled : connected,
    source,
    envFallbackAvailable,
    maskedHint,
    configMeta,
    lastTestedAt: row?.last_tested_at || null,
    lastTestStatus: row?.last_test_status || 'untested',
    lastTestMessage: row?.last_test_message || '',
    updatedAt: row?.updated_at || null,
    docsHint: def.docsHint
  };
}

export async function getAllIntegrationStatuses(
  userToken?: string
): Promise<IntegrationStatusItem[]> {
  const rows = await listIntegrationSecretRows(userToken).catch(() => []);
  const byProvider = new Map<IntegrationProviderId, IntegrationSecretRecord>();
  for (const row of rows) {
    byProvider.set(row.provider, row);
  }
  return VALID_INTEGRATION_PROVIDERS.map((p) => buildStatusItem(p, byProvider.get(p) || null));
}

async function runProviderLiveProbe(
  provider: IntegrationProviderId,
  secret: string,
  configMeta: IntegrationConfigMeta
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const started = Date.now();
  if (!secret) {
    return {
      ok: false,
      latencyMs: 0,
      message: `No active credential provided for ${PROVIDER_DEFS[provider].label}.`
    };
  }

  try {
    if (provider === 'lark_smtp') {
      const email = (configMeta.email || '').trim();
      const host = (configMeta.smtp_host || 'smtp.larksuite.com').trim();
      const port = Number(configMeta.smtp_port) || 465;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          message: 'A valid Lark Mail email address (e.g. rolan@git-stack.org) is required.'
        };
      }
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465 || configMeta.smtp_ssl !== false,
        auth: {
          user: email,
          pass: secret
        },
        connectionTimeout: 9000,
        greetingTimeout: 9000,
        socketTimeout: 10000
      });
      await transporter.verify();
      const latencyMs = Date.now() - started;
      return {
        ok: true,
        latencyMs,
        message: `SMTP SSL handshake verified for ${email} (${host}:${port}) in ${latencyMs}ms.`
      };
    }

    if (provider === 'apollo') {
      const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': secret
        },
        body: JSON.stringify({ page: 1, per_page: 1, person_titles: ['CTO'] })
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          ok: false,
          latencyMs,
          message: `Apollo API returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`
        };
      }
      const data = (await res.json().catch(() => ({}))) as { total_entries?: number };
      return {
        ok: true,
        latencyMs,
        message: `Apollo.io API authenticated (${Number(data.total_entries || 0).toLocaleString()} index entries) in ${latencyMs}ms.`
      };
    }

    if (provider === 'google_maps') {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': secret,
          'X-Goog-FieldMask': 'places.id,places.displayName',
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
        },
        body: JSON.stringify({ textQuery: 'Googleplex Mountain View', pageSize: 1 })
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        return {
          ok: false,
          latencyMs,
          message:
            errJson.error?.message || `Google Maps Places API returned HTTP ${res.status}.`
        };
      }
      return {
        ok: true,
        latencyMs,
        message: `Google Maps Places API (New) verified in ${latencyMs}ms.`
      };
    }

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey: secret,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });
      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: 'Reply with OK'
      });
      const latencyMs = Date.now() - started;
      if (!resp.text) {
        return {
          ok: false,
          latencyMs,
          message: 'Gemini API responded with an empty completion.'
        };
      }
      return {
        ok: true,
        latencyMs,
        message: `Gemini API (gemini-4-hydrogen) verified in ${latencyMs}ms.`
      };
    }

    if (provider === 'github') {
      const res = await fetch('https://api.github.com/rate_limit', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${secret}`,
          'User-Agent': 'GitStack-CRM-Prospecting/1.0'
        }
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          message: `GitHub API returned HTTP ${res.status}. Check token permissions.`
        };
      }
      const data = (await res.json().catch(() => ({}))) as {
        rate?: { remaining?: number; limit?: number };
      };
      return {
        ok: true,
        latencyMs,
        message: `GitHub PAT verified (${data.rate?.remaining ?? '?'}/${data.rate?.limit ?? '?'} quota remaining) in ${latencyMs}ms.`
      };
    }

    return { ok: false, latencyMs: 0, message: 'Unsupported provider.' };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : 'Live connectivity test failed.'
    };
  }
}

export async function saveAndVerifyIntegration(
  provider: IntegrationProviderId,
  input: {
    secret?: string;
    configMeta?: IntegrationConfigMeta;
    useEnvFallback?: boolean;
    skipVerify?: boolean;
  },
  operatorEmail: string,
  userToken?: string
): Promise<{
  integration: IntegrationStatusItem;
  testResult: { ok: boolean; latencyMs: number; message: string };
}> {
  const existing = await getIntegrationSecretRow(provider, userToken).catch(() => null);
  const nextMeta = mergeConfigMeta(provider, existing?.config_meta, input.configMeta);

  let plaintextSecret = (input.secret || '').trim();
  let encryptedSecret = existing?.encrypted_secret || '';
  let secretHint = existing?.secret_hint || '';

  if (input.useEnvFallback) {
    const envSecret = getEnvFallbackSecret(provider);
    if (!envSecret) {
      throw new Error(`No server environment fallback key is set for ${PROVIDER_DEFS[provider].label}.`);
    }
    plaintextSecret = envSecret;
    encryptedSecret = '';
    secretHint = makeSecretHint(envSecret);
  } else if (plaintextSecret) {
    encryptedSecret = encryptVaultSecret(plaintextSecret);
    secretHint = makeSecretHint(plaintextSecret);
  } else if (existing?.enabled && existing.encrypted_secret) {
    plaintextSecret = decryptVaultSecret(existing.encrypted_secret);
  } else if (getEnvFallbackSecret(provider)) {
    plaintextSecret = getEnvFallbackSecret(provider);
    encryptedSecret = '';
    secretHint = makeSecretHint(plaintextSecret);
  }

  if (!plaintextSecret) {
    throw new Error(
      provider === 'lark_smtp'
        ? 'Enter your Lark Mail Authorization Code to connect.'
        : `Enter a valid secret key for ${PROVIDER_DEFS[provider].label}.`
    );
  }

  const testResult = input.skipVerify
    ? { ok: true, latencyMs: 0, message: 'Saved to encrypted vault.' }
    : await runProviderLiveProbe(provider, plaintextSecret, nextMeta);

  if (!testResult.ok) {
    throw new Error(testResult.message);
  }

  const now = new Date().toISOString();
  const record: IntegrationSecretRecord = {
    provider,
    enabled: true,
    encrypted_secret: encryptedSecret,
    secret_hint: secretHint,
    config_meta: nextMeta,
    last_tested_at: now,
    last_test_status: 'ok',
    last_test_message: testResult.message,
    updated_by: operatorEmail,
    updated_at: now
  };

  const saved = await upsertIntegrationSecretRow(record, userToken);
  return {
    integration: buildStatusItem(provider, saved),
    testResult
  };
}

export async function testIntegrationConnection(
  provider: IntegrationProviderId,
  draftInput: {
    secret?: string;
    configMeta?: IntegrationConfigMeta;
  } | null,
  operatorEmail: string,
  userToken?: string
): Promise<{
  integration: IntegrationStatusItem;
  testResult: { ok: boolean; latencyMs: number; message: string };
}> {
  const resolved = await resolveIntegrationConfig(provider, userToken);
  const draftSecret = (draftInput?.secret || '').trim();
  const effectiveSecret = draftSecret || resolved.secret;
  const effectiveMeta = mergeConfigMeta(provider, resolved.configMeta, draftInput?.configMeta);

  const testResult = await runProviderLiveProbe(provider, effectiveSecret, effectiveMeta);
  const now = new Date().toISOString();

  // Persist test telemetry on stored row if one exists or if provider is active
  if (resolved.row || effectiveSecret) {
    const nextRow: IntegrationSecretRecord = {
      provider,
      enabled: resolved.row ? resolved.row.enabled : Boolean(effectiveSecret),
      encrypted_secret: resolved.row?.encrypted_secret || '',
      secret_hint: resolved.row?.secret_hint || makeSecretHint(effectiveSecret),
      config_meta: resolved.row ? mergeConfigMeta(provider, resolved.row.config_meta, undefined) : effectiveMeta,
      last_tested_at: now,
      last_test_status: testResult.ok ? 'ok' : 'error',
      last_test_message: testResult.message,
      updated_by: resolved.row?.updated_by || operatorEmail,
      updated_at: resolved.row?.updated_at || now
    };
    const saved = await upsertIntegrationSecretRow(nextRow, userToken).catch(() => nextRow);
    return {
      integration: buildStatusItem(provider, saved),
      testResult
    };
  }

  return {
    integration: {
      ...buildStatusItem(provider, null),
      lastTestedAt: now,
      lastTestStatus: testResult.ok ? 'ok' : 'error',
      lastTestMessage: testResult.message
    },
    testResult
  };
}

export async function disconnectIntegration(
  provider: IntegrationProviderId,
  operatorEmail: string,
  userToken?: string
): Promise<IntegrationStatusItem> {
  const existing = await getIntegrationSecretRow(provider, userToken).catch(() => null);
  const preservedMeta = mergeConfigMeta(provider, existing?.config_meta, undefined);
  const now = new Date().toISOString();

  const record: IntegrationSecretRecord = {
    provider,
    enabled: false,
    encrypted_secret: '',
    secret_hint: '',
    config_meta: preservedMeta,
    last_tested_at: existing?.last_tested_at || null,
    last_test_status: 'untested',
    last_test_message: 'Disconnected in Back Office Integrations Vault.',
    updated_by: operatorEmail,
    updated_at: now
  };

  const saved = await upsertIntegrationSecretRow(record, userToken);
  return buildStatusItem(provider, saved);
}

export async function sendLarkSmtpMail(
  payload: {
    toEmail: string;
    toName?: string;
    subject: string;
    bodyText: string;
  },
  userToken?: string
): Promise<{ messageId: string; fromEmail: string }> {
  const resolved = await resolveIntegrationConfig('lark_smtp', userToken);
  const senderEmail = (resolved.configMeta.email || '').trim();
  const senderName = (resolved.configMeta.sender_name || 'GitStack Solutions').trim();
  const host = (resolved.configMeta.smtp_host || 'smtp.larksuite.com').trim();
  const port = Number(resolved.configMeta.smtp_port) || 465;

  if (!resolved.secret || !senderEmail) {
    throw new Error(
      'Lark Mail SMTP is not connected. Configure your Lark Mail email & Authorization Code in Settings -> Integrations Vault.'
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465 || resolved.configMeta.smtp_ssl !== false,
    auth: {
      user: senderEmail,
      pass: resolved.secret
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  const info = await transporter.sendMail({
    from: `"${senderName.replace(/"/g, '')}" <${senderEmail}>`,
    to: payload.toName ? `"${payload.toName.replace(/"/g, '')}" <${payload.toEmail}>` : payload.toEmail,
    subject: payload.subject,
    text: payload.bodyText
  });

  return {
    messageId: info.messageId || `lark-smtp-${crypto.randomUUID().slice(0, 10)}`,
    fromEmail: senderEmail
  };
}
