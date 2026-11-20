import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type {
  ApolloCapabilityMode,
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
import {
  discoverGa4PropertiesWithToken,
  GA4_READONLY_SCOPE,
  isServiceAccountJsonString,
  mintGoogleAccessTokenFromServiceAccount
} from './googleAnalyticsService.ts';

export const VALID_INTEGRATION_PROVIDERS: IntegrationProviderId[] = [
  'lark_smtp',
  'google_analytics',
  'google_tag_manager',
  'google_search_console',
  'facebook_page',
  'tiktok',
  'apollo',
  'google_maps',
  'gemini',
  'github',
  'cloudflare'
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
  google_analytics: {
    label: 'Google Analytics 4 (Service Account / OAuth)',
    category: 'Web Analytics',
    description:
      'Connects Google Analytics 4 via a server-side Google Cloud Service Account JSON key (zero domain limits in production) or optional Google Sign-In popup.',
    docsHint: 'Paste a Google Cloud Service Account JSON key and add its client_email as Viewer in GA4 Property Access Management.',
    defaultConfigMeta: {
      ga4_account_email: '',
      ga4_account_name: '',
      ga4_auth_mode: undefined,
      ga4_service_account_email: '',
      ga4_property_id: '',
      ga4_property_name: '',
      ga4_measurement_id: '',
      ga4_stream_uri: '',
      ga4_properties_list: [],
      ga4_cached_report: null
    }
  },
  google_tag_manager: {
    label: 'Google Tag Manager (One-Click OAuth)',
    category: 'Web Analytics',
    description:
      'Connects your Google Tag Manager account via Google OAuth to inspect containers, workspaces, tags, triggers, and variables alongside live dataLayer telemetry.',
    docsHint: 'Open the Tag Manager tab in Back Office and click "Connect GTM OAuth".',
    defaultConfigMeta: {
      gtm_account_email: '',
      gtm_account_name: '',
      gtm_account_id: '',
      gtm_container_id: '',
      gtm_container_public_id: 'GTM-MFP3W7MS',
      gtm_container_name: '',
      gtm_workspace_id: '',
      gtm_workspace_name: '',
      gtm_containers_list: [],
      gtm_snapshot: null
    }
  },
  google_search_console: {
    label: 'Google Search Console (Optional Live Metrics)',
    category: 'Search & Social',
    description:
      'Pulls live 28-day search clicks, impressions, CTR, average position, and top queries per URL using a Google Cloud Service Account JSON key.',
    docsHint:
      'Paste a GCP Service Account JSON key and add its client_email as a Full/Restricted user in Google Search Console -> Settings -> Users & permissions.',
    defaultConfigMeta: {
      gsc_site_url: 'https://git-stack.org/',
      gsc_service_account_email: ''
    }
  },
  facebook_page: {
    label: 'Facebook Page (Meta Graph API)',
    category: 'Search & Social',
    description:
      'Connects your Facebook Business Page via Page Access Token or Meta OAuth to publish approved organic marketing and Google Trends posts directly.',
    docsHint:
      'Meta Developers -> Graph API Explorer (pages_manage_posts, pages_read_engagement) or connect via OAuth inside Marketing & Social.',
    defaultConfigMeta: {
      fb_page_id: '',
      fb_page_name: '',
      fb_page_url: '',
      fb_app_id: ''
    }
  },
  tiktok: {
    label: 'TikTok Business / Creator Posting API',
    category: 'Search & Social',
    description:
      'Connects your TikTok account via Content Posting API token or TikTok Login Kit OAuth to push approved short-form marketing posts.',
    docsHint:
      'TikTok for Developers -> Login Kit & Content Posting API (user.info.basic, video.publish / video.upload).',
    defaultConfigMeta: {
      tiktok_open_id: '',
      tiktok_handle: '',
      tiktok_display_name: '',
      tiktok_client_key: ''
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
  },
  cloudflare: {
    label: 'Cloudflare Analytics',
    category: 'Cloud & Edge',
    description:
      'Streams real-time edge requests, bandwidth, cache ratio, 5xx errors, and Top-N traffic breakdowns via Cloudflare GraphQL.',
      docsHint: 'Cloudflare Dashboard -> Account or Profile API Tokens (Zone:Read + Analytics:Read)',
      defaultConfigMeta: {
        zone_id: '',
        zone_name: 'git-stack.org'
      }
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
  if (isServiceAccountJsonString(clean)) {
    try {
      const parsed = JSON.parse(clean) as { client_email?: string };
      if (parsed.client_email) {
        return `SA:${parsed.client_email.slice(0, 28)}`;
      }
    } catch {
      // ignore
    }
    return 'Service Account JSON';
  }
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
    case 'cloudflare':
      return process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
    case 'google_search_console':
      return process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() || '';
    case 'facebook_page':
      return process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || '';
    case 'tiktok':
      return process.env.TIKTOK_ACCESS_TOKEN?.trim() || '';
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
  if (provider === 'cloudflare') {
    merged.zone_id = (merged.zone_id || process.env.CLOUDFLARE_ZONE_ID || '').trim();
    merged.zone_name = (
      merged.zone_name ||
      process.env.CLOUDFLARE_ZONE_NAME ||
      'git-stack.org'
    )
      .trim()
      .toLowerCase();
  }
  if (provider === 'google_analytics') {
    merged.ga4_account_email = (merged.ga4_account_email || '').trim().toLowerCase();
    merged.ga4_account_name = (merged.ga4_account_name || '').trim();
    merged.ga4_service_account_email = (merged.ga4_service_account_email || '')
      .trim()
      .toLowerCase();
    merged.ga4_property_id = (merged.ga4_property_id || '').trim();
    merged.ga4_property_name = (merged.ga4_property_name || '').trim();
    merged.ga4_measurement_id = (merged.ga4_measurement_id || '').trim().toUpperCase();
    merged.ga4_stream_uri = (merged.ga4_stream_uri || '').trim();
  }
  if (provider === 'google_tag_manager') {
    merged.gtm_account_email = (merged.gtm_account_email || '').trim().toLowerCase();
    merged.gtm_account_name = (merged.gtm_account_name || '').trim();
    merged.gtm_account_id = (merged.gtm_account_id || '').trim();
    merged.gtm_container_id = (merged.gtm_container_id || '').trim();
    merged.gtm_container_public_id = (
      merged.gtm_container_public_id || 'GTM-MFP3W7MS'
    )
      .trim()
      .toUpperCase();
    merged.gtm_container_name = (merged.gtm_container_name || '').trim();
    merged.gtm_workspace_id = (merged.gtm_workspace_id || '').trim();
    merged.gtm_workspace_name = (merged.gtm_workspace_name || '').trim();
  }
  if (provider === 'google_search_console') {
    merged.gsc_site_url = (merged.gsc_site_url || process.env.GSC_SITE_URL || 'https://git-stack.org/').trim();
    merged.gsc_service_account_email = (merged.gsc_service_account_email || '').trim().toLowerCase();
  }
  if (provider === 'facebook_page') {
    merged.fb_page_id = (merged.fb_page_id || process.env.FACEBOOK_PAGE_ID || '').trim();
    merged.fb_page_name = (merged.fb_page_name || '').trim();
    merged.fb_page_url = (merged.fb_page_url || '').trim();
    merged.fb_app_id = (merged.fb_app_id || process.env.FACEBOOK_APP_ID || '').trim();
  }
  if (provider === 'tiktok') {
    merged.tiktok_open_id = (merged.tiktok_open_id || '').trim();
    merged.tiktok_handle = (merged.tiktok_handle || '').trim();
    merged.tiktok_display_name = (merged.tiktok_display_name || '').trim();
    merged.tiktok_client_key = (merged.tiktok_client_key || process.env.TIKTOK_CLIENT_KEY || '').trim();
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
): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
  apolloCapability?: ApolloCapabilityMode;
}> {
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
      const healthRes = await fetch('https://api.apollo.io/api/v1/auth/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': secret
        }
      });

      if (!healthRes.ok) {
        const latencyMs = Date.now() - started;
        const errText = await healthRes.text().catch(() => '');
        return {
          ok: false,
          latencyMs,
          message: `Apollo key rejected on auth/health (HTTP ${healthRes.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`
        };
      }

      const searchRes = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': secret
        },
        body: JSON.stringify({ page: 1, per_page: 1, person_titles: ['CTO'] })
      });
      const latencyMs = Date.now() - started;

      if (searchRes.ok) {
        const data = (await searchRes.json().catch(() => ({}))) as { total_entries?: number };
        return {
          ok: true,
          latencyMs,
          apolloCapability: 'full_search',
          message: `Apollo.io Full Paid API verified (${Number(data.total_entries || 0).toLocaleString()} index entries) in ${latencyMs}ms.`
        };
      }

      if (searchRes.status === 403) {
        return {
          ok: true,
          latencyMs,
          apolloCapability: 'trial_or_scoped',
          message: `Apollo key authenticated (auth/health 200 in ${latencyMs}ms) — Trial / Scoped Plan: People Search API returns HTTP 403 until upgraded to a paid billing plan or Master Key. Use Apollo CSV Export in CRM Import.`
        };
      }

      if (searchRes.status === 401) {
        const errText = await searchRes.text().catch(() => '');
        return {
          ok: false,
          latencyMs,
          message: `Apollo API returned HTTP 401${errText ? `: ${errText.slice(0, 140)}` : ''}`
        };
      }

      return {
        ok: true,
        latencyMs,
        apolloCapability: 'trial_or_scoped',
        message: `Apollo key authenticated (auth/health 200 in ${latencyMs}ms), but People Search returned HTTP ${searchRes.status}.`
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

    if (provider === 'cloudflare') {
      const zoneIdDraft = (configMeta?.zone_id || '').trim();
      const zoneNameDraft = (configMeta?.zone_name || 'git-stack.org').trim().toLowerCase();

      // User API tokens verify via /user/tokens/verify; Account API tokens (cfat_...) verify via /zones + /accounts/{id}/tokens/verify
      const userVerifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json'
        }
      }).catch(() => null);
      const userTokenVerified = Boolean(userVerifyRes && userVerifyRes.ok);

      let resolvedZoneName = zoneNameDraft;
      let resolvedZoneId = zoneIdDraft;
      let resolvedAccountId = '';
      let planName = '';
      let zoneErrorMsg = '';

      if (resolvedZoneId) {
        const zRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(resolvedZoneId)}`,
          {
            headers: {
              Authorization: `Bearer ${secret}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const zJson = (await zRes.json().catch(() => ({}))) as {
          success?: boolean;
          errors?: Array<{ message?: string }>;
          result?: { id?: string; name?: string; plan?: { name?: string }; account?: { id?: string } };
        };
        if (!zRes.ok || zJson.success === false) {
          zoneErrorMsg =
            zJson.errors?.[0]?.message ||
            `Cloudflare Zone "${resolvedZoneId}" returned HTTP ${zRes.status}. Verify Zone ID and Zone:Read + Analytics:Read permissions.`;
        } else {
          resolvedZoneId = zJson.result?.id || resolvedZoneId;
          resolvedZoneName = zJson.result?.name || resolvedZoneName;
          resolvedAccountId = zJson.result?.account?.id || '';
          planName = zJson.result?.plan?.name || '';
        }
      } else {
        const listUrl = `https://api.cloudflare.com/client/v4/zones${
          zoneNameDraft ? `?name=${encodeURIComponent(zoneNameDraft)}` : ''
        }`;
        const listRes = await fetch(listUrl, {
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json'
          }
        });
        const listJson = (await listRes.json().catch(() => ({}))) as {
          success?: boolean;
          errors?: Array<{ message?: string }>;
          result?: Array<{
            id: string;
            name: string;
            plan?: { name?: string };
            account?: { id?: string };
          }>;
        };
        if (!listRes.ok || listJson.success === false) {
          zoneErrorMsg =
            listJson.errors?.[0]?.message ||
            `Cloudflare Zone lookup returned HTTP ${listRes.status}. Check token permissions (Zone:Read, Analytics:Read).`;
        } else {
          const first = listJson.result?.[0];
          if (first) {
            resolvedZoneId = first.id;
            resolvedZoneName = first.name;
            resolvedAccountId = first.account?.id || '';
            planName = first.plan?.name || '';
          }
        }
      }

      let accountTokenVerified = false;
      if (!userTokenVerified && resolvedAccountId) {
        const acctVerifyRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(resolvedAccountId)}/tokens/verify`,
          {
            headers: {
              Authorization: `Bearer ${secret}`,
              'Content-Type': 'application/json'
            }
          }
        ).catch(() => null);
        accountTokenVerified = Boolean(acctVerifyRes && acctVerifyRes.ok);
      }

      const latencyMs = Date.now() - started;

      if (!userTokenVerified && !accountTokenVerified && !resolvedZoneId) {
        const userBody = userVerifyRes
          ? ((await userVerifyRes.json().catch(() => ({}))) as {
              errors?: Array<{ message?: string }>;
            })
          : {};
        return {
          ok: false,
          latencyMs,
          message:
            zoneErrorMsg ||
            userBody.errors?.[0]?.message ||
            'Cloudflare API Token verification failed. Ensure the token is active and has Zone:Read + Analytics:Read permissions.'
        };
      }

      if (zoneErrorMsg && !resolvedZoneId) {
        return {
          ok: false,
          latencyMs,
          message: zoneErrorMsg
        };
      }

      if (configMeta) {
        if (resolvedZoneId) configMeta.zone_id = resolvedZoneId;
        if (resolvedZoneName) configMeta.zone_name = resolvedZoneName;
      }

      const tokenKind = accountTokenVerified ? 'Account API Token' : 'API Token';
      return {
        ok: true,
        latencyMs,
        message: resolvedZoneId
          ? `Cloudflare ${tokenKind} connected for ${resolvedZoneName} (${planName || 'Active Zone'}) in ${latencyMs}ms.`
          : `Cloudflare ${tokenKind} verified in ${latencyMs}ms. Enter your Zone ID for ${zoneNameDraft} to stream GraphQL metrics.`
      };
    }

    if (provider === 'google_search_console') {
      const gscScope = 'https://www.googleapis.com/auth/webmasters.readonly';
      let accessToken = secret;
      if (isServiceAccountJsonString(secret)) {
        const minted = await mintGoogleAccessTokenFromServiceAccount(secret, [gscScope]);
        accessToken = minted.accessToken;
        if (configMeta) {
          configMeta.gsc_service_account_email = minted.serviceAccount.client_email.toLowerCase();
        }
      }
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const latencyMs = Date.now() - started;
      const sitesJson = (await sitesRes.json().catch(() => ({}))) as {
        siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
        error?: { message?: string };
      };
      if (!sitesRes.ok) {
        return {
          ok: false,
          latencyMs,
          message:
            sitesJson.error?.message ||
            `Google Search Console API returned HTTP ${sitesRes.status}. Verify webmasters.readonly access.`
        };
      }
      const verifiedSites = sitesJson.siteEntry || [];
      if (configMeta && verifiedSites.length > 0 && !configMeta.gsc_site_url) {
        configMeta.gsc_site_url = verifiedSites[0].siteUrl || 'https://git-stack.org/';
      }
      return {
        ok: true,
        latencyMs,
        message: `Google Search Console verified (${verifiedSites.length} property${verifiedSites.length === 1 ? '' : ' properties'}) in ${latencyMs}ms.`
      };
    }

    if (provider === 'facebook_page') {
      const pageId = (configMeta?.fb_page_id || '').trim() || 'me';
      const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}?fields=id,name,link&access_token=${encodeURIComponent(secret)}`;
      const fbRes = await fetch(url);
      const latencyMs = Date.now() - started;
      const fbJson = (await fbRes.json().catch(() => ({}))) as {
        id?: string;
        name?: string;
        link?: string;
        error?: { message?: string };
      };
      if (!fbRes.ok || fbJson.error) {
        return {
          ok: false,
          latencyMs,
          message:
            fbJson.error?.message ||
            `Facebook Graph API returned HTTP ${fbRes.status}. Check Page ID and Page Access Token.`
        };
      }
      if (configMeta) {
        if (fbJson.id) configMeta.fb_page_id = fbJson.id;
        if (fbJson.name) configMeta.fb_page_name = fbJson.name;
        if (fbJson.link) configMeta.fb_page_url = fbJson.link;
      }
      return {
        ok: true,
        latencyMs,
        message: `Facebook Page "${fbJson.name || pageId}" connected and verified in ${latencyMs}ms.`
      };
    }

    if (provider === 'tiktok') {
      const ttRes = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username',
        {
          headers: { Authorization: `Bearer ${secret}` }
        }
      );
      const latencyMs = Date.now() - started;
      const ttJson = (await ttRes.json().catch(() => ({}))) as {
        data?: { user?: { open_id?: string; display_name?: string; username?: string } };
        error?: { code?: string; message?: string };
      };
      if (!ttRes.ok || (ttJson.error?.code && ttJson.error.code !== 'ok')) {
        return {
          ok: false,
          latencyMs,
          message:
            ttJson.error?.message ||
            `TikTok API returned HTTP ${ttRes.status}. Check Access Token and user.info.basic / video.publish scopes.`
        };
      }
      const user = ttJson.data?.user;
      if (configMeta && user) {
        if (user.open_id) configMeta.tiktok_open_id = user.open_id;
        if (user.display_name) configMeta.tiktok_display_name = user.display_name;
        if (user.username) configMeta.tiktok_handle = `@${user.username.replace(/^@/, '')}`;
      }
      return {
        ok: true,
        latencyMs,
        message: `TikTok account "${user?.display_name || user?.username || 'Connected Creator'}" verified in ${latencyMs}ms.`
      };
    }

    if (provider === 'google_analytics') {
      if (isServiceAccountJsonString(secret)) {
        const { accessToken, serviceAccount } = await mintGoogleAccessTokenFromServiceAccount(
          secret,
          [GA4_READONLY_SCOPE]
        );
        const properties = await discoverGa4PropertiesWithToken(
          accessToken,
          serviceAccount.client_email
        );
        configMeta.ga4_auth_mode = 'service_account';
        configMeta.ga4_service_account_email = serviceAccount.client_email.toLowerCase();
        configMeta.ga4_account_email = serviceAccount.client_email.toLowerCase();
        configMeta.ga4_account_name = `Service Account (${serviceAccount.project_id || 'GCP'})`;
        if (properties.length > 0) {
          configMeta.ga4_properties_list = properties;
          const matching =
            properties.find((p) => p.property_id === configMeta.ga4_property_id) || properties[0];
          if (matching) {
            configMeta.ga4_property_id = matching.property_id;
            configMeta.ga4_property_name = matching.property_name;
            configMeta.ga4_measurement_id =
              configMeta.ga4_measurement_id || matching.measurement_id;
            configMeta.ga4_stream_uri = matching.stream_uri;
          }
        }
        const latencyMs = Date.now() - started;
        return {
          ok: true,
          latencyMs,
          message:
            properties.length > 0
              ? `Service Account verified (${serviceAccount.client_email}) · Found ${properties.length} GA4 propert${properties.length === 1 ? 'y' : 'ies'} in ${latencyMs}ms.`
              : `Service Account token verified (${serviceAccount.client_email}) in ${latencyMs}ms. Note: No GA4 properties listed yet — grant Viewer role to this email in GA4 Property Access Management.`
        };
      }

      const email = (configMeta.ga4_account_email || '').trim();
      const propName = (configMeta.ga4_property_name || 'GitStack Production GA4').trim();
      const measId = (configMeta.ga4_measurement_id || '').trim();
      if (secret && secret !== 'oauth_session') {
        const res = await fetch(
          'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50',
          {
            headers: {
              Authorization: `Bearer ${secret}`
            }
          }
        ).catch(() => null);
        const latencyMs = Date.now() - started;
        if (res && res.ok) {
          return {
            ok: true,
            latencyMs,
            message: `Google Analytics 4 verified for ${email || 'Google Account'} · ${propName}${measId ? ` (${measId})` : ''} in ${latencyMs}ms.`
          };
        }
      }
      const latencyMs = Date.now() - started;
      if (email) {
        return {
          ok: true,
          latencyMs,
          message: `Google Analytics 4 connected (${email}) · ${propName}${measId ? ` (${measId})` : ''}.`
        };
      }
      return {
        ok: false,
        latencyMs,
        message: 'Upload a Google Cloud Service Account JSON key or connect via Google OAuth.'
      };
    }

    if (provider === 'google_tag_manager') {
      const email = (configMeta.gtm_account_email || '').trim();
      const containerPublicId = (configMeta.gtm_container_public_id || 'GTM-MFP3W7MS').trim();
      const containerName = (configMeta.gtm_container_name || 'GitStack GTM Container').trim();
      if (secret && secret !== 'oauth_session') {
        const res = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/accounts', {
          headers: { Authorization: `Bearer ${secret}` }
        }).catch(() => null);
        const latencyMs = Date.now() - started;
        if (res && res.ok) {
          return {
            ok: true,
            latencyMs,
            message: `Google Tag Manager OAuth verified for ${email || 'Google Account'} · ${containerName} (${containerPublicId}) in ${latencyMs}ms.`
          };
        }
      }
      const latencyMs = Date.now() - started;
      if (email) {
        return {
          ok: true,
          latencyMs,
          message: `Google Tag Manager connected via Google OAuth (${email}) · ${containerName} (${containerPublicId}).`
        };
      }
      return {
        ok: false,
        latencyMs,
        message: 'Click "Connect GTM OAuth" in the Tag Manager tab to authenticate your Google Account.'
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

  if (!plaintextSecret && provider === 'google_analytics' && nextMeta.ga4_account_email) {
    plaintextSecret = 'oauth_session';
    encryptedSecret = encryptVaultSecret(plaintextSecret);
    secretHint = 'OAuth';
  }

  if (!plaintextSecret && provider === 'google_tag_manager' && nextMeta.gtm_account_email) {
    plaintextSecret = 'oauth_session';
    encryptedSecret = encryptVaultSecret(plaintextSecret);
    secretHint = 'OAuth';
  }

  if (!plaintextSecret) {
    throw new Error(
      provider === 'lark_smtp'
        ? 'Enter your Lark Mail Authorization Code to connect.'
        : provider === 'google_analytics'
          ? 'Click "Connect with Google Analytics" to authenticate your Google Account.'
          : provider === 'google_tag_manager'
            ? 'Click "Connect GTM OAuth" to authenticate your Google Account.'
            : `Enter a valid secret key for ${PROVIDER_DEFS[provider].label}.`
    );
  }

  const testResult = input.skipVerify
    ? { ok: true, latencyMs: 0, message: 'Saved to encrypted vault.' }
    : await runProviderLiveProbe(provider, plaintextSecret, nextMeta);

  if (!testResult.ok) {
    throw new Error(testResult.message);
  }

  if (provider === 'apollo' && testResult.apolloCapability) {
    nextMeta.apollo_capability = testResult.apolloCapability;
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
  const updatedMeta =
    provider === 'apollo' && testResult.apolloCapability
      ? { ...effectiveMeta, apollo_capability: testResult.apolloCapability }
      : resolved.row
        ? mergeConfigMeta(provider, resolved.row.config_meta, undefined)
        : effectiveMeta;

  // Persist test telemetry on stored row if one exists or if provider is active
  if (resolved.row || effectiveSecret) {
    const nextRow: IntegrationSecretRecord = {
      provider,
      enabled: resolved.row ? resolved.row.enabled : Boolean(effectiveSecret),
      encrypted_secret: resolved.row?.encrypted_secret || '',
      secret_hint: resolved.row?.secret_hint || makeSecretHint(effectiveSecret),
      config_meta: updatedMeta,
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
  if (provider === 'apollo') {
    delete preservedMeta.apollo_capability;
  }
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
    bodyHtml?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
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
    text: payload.bodyText,
    ...(payload.bodyHtml ? { html: payload.bodyHtml } : {}),
    ...(payload.attachments && payload.attachments.length > 0
      ? {
          attachments: payload.attachments.map((att) => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType || 'application/pdf'
          }))
        }
      : {})
  });

  return {
    messageId: info.messageId || `lark-smtp-${crypto.randomUUID().slice(0, 10)}`,
    fromEmail: senderEmail
  };
}
