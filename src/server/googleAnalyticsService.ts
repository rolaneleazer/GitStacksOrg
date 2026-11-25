import crypto from 'node:crypto';
import type { Request } from 'express';
import type { ResolvedDateRange } from '../shared/dateRanges.ts';
import type {
  AnalyticsChannelItem,
  AnalyticsDevicePlatformItem,
  AnalyticsEventCountItem,
  AnalyticsGeoCityItem,
  AnalyticsGeoCountryItem,
  AnalyticsInterestSegmentItem,
  AnalyticsLandingPageItem,
  AnalyticsPageTitleItem,
  AnalyticsReferrerDetailItem,
  AnalyticsSummary,
  AnalyticsTriggerType,
  Ga4LiveReportSummary,
  Ga4PropertyOption,
  RealtimeActiveVisitorSummary
} from '../shared/types.ts';

export const GA4_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

export interface ParsedServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

export interface EdgeGeoInfo {
  country: string;
  countryCode: string;
  city: string;
}

interface CachedServiceToken {
  accessToken: string;
  expiresAtMs: number;
}

const tokenCache = new Map<string, CachedServiceToken>();

const TIMEZONE_GEO_HINTS: Record<string, EdgeGeoInfo> = {
  'Asia/Manila': { country: 'Philippines', countryCode: 'PH', city: 'Manila' },
  'Asia/Singapore': { country: 'Singapore', countryCode: 'SG', city: 'Singapore' },
  'Pacific/Auckland': { country: 'New Zealand', countryCode: 'NZ', city: 'Auckland' },
  'Australia/Sydney': { country: 'Australia', countryCode: 'AU', city: 'Sydney' },
  'Australia/Melbourne': { country: 'Australia', countryCode: 'AU', city: 'Melbourne' },
  'America/Los_Angeles': { country: 'United States', countryCode: 'US', city: 'San Jose' },
  'America/New_York': { country: 'United States', countryCode: 'US', city: 'New York' },
  'America/Chicago': { country: 'United States', countryCode: 'US', city: 'Des Moines' },
  'America/Toronto': { country: 'Canada', countryCode: 'CA', city: 'Toronto' },
  'Europe/London': { country: 'United Kingdom', countryCode: 'GB', city: 'London' },
  'Asia/Tokyo': { country: 'Japan', countryCode: 'JP', city: 'Tokyo' }
};

let regionDisplayNames: Intl.DisplayNames | null = null;
try {
  regionDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {
  regionDisplayNames = null;
}

export function resolveCountryNameFromCode(code: string): string {
  const clean = (code || '').trim().toUpperCase();
  if (!clean || clean === 'XX' || clean === 'T1' || clean === 'LOCAL') {
    return clean === 'LOCAL' ? 'Local Development' : 'Unknown';
  }
  try {
    const resolved = regionDisplayNames?.of(clean);
    if (resolved && resolved !== clean) return resolved;
  } catch {
    // ignore Intl errors for unrecognized region codes
  }
  const fallback: Record<string, string> = {
    US: 'United States',
    PH: 'Philippines',
    SG: 'Singapore',
    AU: 'Australia',
    NZ: 'New Zealand',
    CA: 'Canada',
    GB: 'United Kingdom',
    UK: 'United Kingdom',
    CN: 'China',
    JP: 'Japan',
    IN: 'India',
    DE: 'Germany',
    FR: 'France',
    RU: 'Russia'
  };
  return fallback[clean] || clean;
}

function safeDecodeCity(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed).slice(0, 80);
  } catch {
    return trimmed.slice(0, 80);
  }
}

export function resolveEdgeGeoFromRequest(req: Request, timezoneHint?: string): EdgeGeoInfo {
  const rawCountryCode = String(
    req.headers['x-vercel-ip-country'] ||
      req.headers['cf-ipcountry'] ||
      req.headers['x-country-code'] ||
      ''
  )
    .trim()
    .toUpperCase();

  const rawCity = String(
    req.headers['x-vercel-ip-city'] ||
      req.headers['cf-ipcity'] ||
      req.headers['x-city'] ||
      ''
  ).trim();

  if (rawCountryCode && rawCountryCode !== 'XX' && rawCountryCode !== 'T1') {
    const country = resolveCountryNameFromCode(rawCountryCode);
    const city = safeDecodeCity(rawCity) || country;
    return {
      country,
      countryCode: rawCountryCode,
      city
    };
  }

  if (timezoneHint && TIMEZONE_GEO_HINTS[timezoneHint]) {
    return TIMEZONE_GEO_HINTS[timezoneHint];
  }

  return {
    country: 'Local Development',
    countryCode: 'LOCAL',
    city: 'Localhost'
  };
}

export function sanitizeExternalUrl(raw?: string): string {
  const clean = (raw || '').trim();
  if (!clean || clean === 'direct' || clean === '(direct)' || clean === 'none') return '';
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString().slice(0, 400);
  } catch {
    return '';
  }
}

export function extractReferrerHost(rawUrl?: string): string {
  const safe = sanitizeExternalUrl(rawUrl);
  if (safe) {
    try {
      const host = new URL(safe).hostname.replace(/^www\./i, '').toLowerCase();
      if (host === 'git-stack.org' || host === 'localhost' || host === '127.0.0.1') {
        return '';
      }
      return host.slice(0, 120);
    } catch {
      return '';
    }
  }
  const raw = (rawUrl || '').trim().toLowerCase();
  if (!raw || raw === 'direct' || raw === '(direct)' || raw.includes('git-stack.org') || raw.includes('localhost')) {
    return '';
  }
  return raw.replace(/^www\./, '').split('/')[0].slice(0, 120);
}

export function parseBrowserOsFromUserAgent(uaRaw?: string): { browser: string; os: string } {
  const ua = (uaRaw || '').trim();
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/curl\//i.test(ua)) browser = 'cURL / HTTP Client';

  let os = 'Other OS';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { browser, os };
}

export function resolveNetworkOrgHint(req: Request): string {
  const org = String(
    req.headers['x-vercel-ip-as-org'] ||
      req.headers['cf-iporg'] ||
      req.headers['x-asn-org'] ||
      req.headers['x-isp-org'] ||
      ''
  )
    .trim()
    .slice(0, 100);
  if (org) return org;
  const host = String(req.headers.host || '').toLowerCase();
  if (host.includes('localhost') || host.includes('127.0.0.1')) return 'Localhost Loopback';
  return 'Public Edge Network';
}

export function classifyTriggerDetails(
  referrerRaw?: string,
  pathWithQuery?: string,
  meta?: Record<string, string>
): {
  referrerUrl: string;
  referrerHost: string;
  triggerType: AnalyticsTriggerType;
  triggerLabel: string;
  clickIdType: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
} {
  const safeMeta = meta || {};
  const referrerUrl = sanitizeExternalUrl(safeMeta.referrer_url || referrerRaw);
  const referrerHost = (safeMeta.referrer_host || extractReferrerHost(referrerUrl || referrerRaw)).trim();

  let utmSource = (safeMeta.utm_source || '').trim().slice(0, 80);
  let utmMedium = (safeMeta.utm_medium || '').trim().slice(0, 80);
  let utmCampaign = (safeMeta.utm_campaign || '').trim().slice(0, 120);
  let utmTerm = (safeMeta.utm_term || '').trim().slice(0, 120);
  let utmContent = (safeMeta.utm_content || '').trim().slice(0, 120);
  let clickIdType = (safeMeta.click_id_type || '').trim().slice(0, 60);

  if (pathWithQuery && pathWithQuery.includes('?')) {
    try {
      const parsed = new URL(pathWithQuery, 'https://git-stack.org');
      const sp = parsed.searchParams;
      utmSource = utmSource || (sp.get('utm_source') || '').trim().slice(0, 80);
      utmMedium = utmMedium || (sp.get('utm_medium') || '').trim().slice(0, 80);
      utmCampaign = utmCampaign || (sp.get('utm_campaign') || '').trim().slice(0, 120);
      utmTerm = utmTerm || (sp.get('utm_term') || '').trim().slice(0, 120);
      utmContent = utmContent || (sp.get('utm_content') || '').trim().slice(0, 120);
      if (!clickIdType) {
        if (sp.get('gclid')) clickIdType = 'Google Ads (gclid)';
        else if (sp.get('fbclid')) clickIdType = 'Meta Ads (fbclid)';
        else if (sp.get('msclkid')) clickIdType = 'Microsoft Ads (msclkid)';
        else if (sp.get('ttclid')) clickIdType = 'TikTok Ads (ttclid)';
        else if (sp.get('li_fat_id')) clickIdType = 'LinkedIn Ads (li_fat_id)';
      }
    } catch {
      // ignore invalid query string
    }
  }

  const h = referrerHost.toLowerCase();
  const src = utmSource.toLowerCase();
  const med = utmMedium.toLowerCase();

  let triggerType: AnalyticsTriggerType = 'Direct';
  let triggerLabel = 'Direct / Bookmark';

  if (clickIdType) {
    triggerType = 'Paid Click ID';
    triggerLabel = clickIdType;
  } else if (
    med === 'email' ||
    src === 'newsletter' ||
    h.includes('mail.google') ||
    h.includes('outlook.') ||
    h.includes('mail.yahoo') ||
    h.includes('larksuite')
  ) {
    triggerType = 'Email Campaign';
    triggerLabel = utmSource ? `Email (${utmSource})` : 'Email Link';
  } else if (
    h.includes('chatgpt.com') ||
    h.includes('chat.openai.com') ||
    h.includes('perplexity.ai') ||
    h.includes('claude.ai') ||
    h.includes('gemini.google.com') ||
    h.includes('copilot.microsoft.com') ||
    h.includes('poe.com') ||
    h.includes('you.com')
  ) {
    triggerType = 'AI Citation';
    triggerLabel = `${referrerHost} Citation`;
  } else if (
    h.includes('google.') ||
    h.includes('bing.com') ||
    h.includes('duckduckgo.com') ||
    h.includes('search.yahoo.') ||
    h.includes('baidu.com') ||
    h.includes('yandex.') ||
    h.includes('ecosia.org')
  ) {
    triggerType = 'Search Engine';
    triggerLabel = h.includes('google.')
      ? 'Google Search'
      : h.includes('bing.')
        ? 'Bing Search'
        : h.includes('duckduckgo.')
          ? 'DuckDuckGo Search'
          : `${referrerHost} Search`;
  } else if (
    h.includes('facebook.com') ||
    h.includes('fb.com') ||
    h.includes('instagram.com') ||
    h.includes('linkedin.com') ||
    h.includes('lnkd.in') ||
    h.includes('twitter.com') ||
    h.includes('x.com') ||
    h.includes('t.co') ||
    h.includes('reddit.com') ||
    h.includes('youtube.com') ||
    h.includes('tiktok.com')
  ) {
    triggerType = 'Social Post';
    triggerLabel = h.includes('linkedin') || h.includes('lnkd.in')
      ? 'LinkedIn'
      : h.includes('facebook') || h.includes('fb.com')
        ? 'Facebook'
        : h.includes('instagram')
          ? 'Instagram'
          : h.includes('x.com') || h.includes('twitter') || h.includes('t.co')
            ? 'X / Twitter'
            : h.includes('reddit')
              ? 'Reddit'
              : h.includes('youtube')
                ? 'YouTube'
                : referrerHost;
  } else if (utmSource) {
    triggerType = med === 'cpc' || med === 'paid' ? 'Paid Click ID' : 'External Link';
    triggerLabel = utmMedium ? `${utmSource} / ${utmMedium}` : utmSource;
  } else if (referrerHost) {
    triggerType = 'External Link';
    triggerLabel = referrerHost;
  }

  return {
    referrerUrl,
    referrerHost,
    triggerType,
    triggerLabel,
    clickIdType,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent
  };
}

export function classifyAcquisitionChannel(referrer?: string, pathWithQuery?: string): string {
  const details = classifyTriggerDetails(referrer, pathWithQuery);
  switch (details.triggerType) {
    case 'Email Campaign':
      return 'Email';
    case 'AI Citation':
      return 'AI Assistant';
    case 'Search Engine':
      return 'Organic Search';
    case 'Social Post':
      return 'Organic Social';
    case 'Paid Click ID':
      return 'Paid Search & Social';
    case 'External Link':
      return 'Referral';
    default:
      return 'Direct';
  }
}

export function isServiceAccountJsonString(raw: string): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return (
      parsed.type === 'service_account' ||
      (typeof parsed.client_email === 'string' && typeof parsed.private_key === 'string')
    );
  } catch {
    return false;
  }
}

export function parseServiceAccountJson(raw: string): ParsedServiceAccount {
  const trimmed = (raw || '').trim();
  if (!trimmed.startsWith('{')) {
    throw new Error('Service Account credential must be a valid JSON key file.');
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid JSON syntax in Google Service Account key.');
  }
  const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
  const privateKeyRaw = typeof parsed.private_key === 'string' ? parsed.private_key : '';
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim();
  const projectId = typeof parsed.project_id === 'string' ? parsed.project_id.trim() : '';
  const tokenUri =
    typeof parsed.token_uri === 'string' && parsed.token_uri.startsWith('https://')
      ? parsed.token_uri.trim()
      : 'https://oauth2.googleapis.com/token';

  if (!clientEmail || !clientEmail.includes('@')) {
    throw new Error('Service Account JSON is missing a valid "client_email" field.');
  }
  if (!privateKey || !privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
    throw new Error('Service Account JSON is missing a valid PEM "private_key" field.');
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: projectId,
    token_uri: tokenUri
  };
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function mintGoogleAccessTokenFromServiceAccount(
  rawJson: string,
  scopes: string[] = [GA4_READONLY_SCOPE]
): Promise<{ accessToken: string; serviceAccount: ParsedServiceAccount }> {
  const sa = parseServiceAccountJson(rawJson);
  const cacheKey = `${sa.client_email}|${scopes.join(' ')}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return { accessToken: cached.accessToken, serviceAccount: sa };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: sa.client_email,
    scope: scopes.join(' '),
    aud: sa.token_uri,
    exp: nowSec + 3600,
    iat: nowSec
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claimSet)
  )}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(sa.private_key);
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }).toString()
  });

  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description ||
        tokenData.error ||
        `Google OAuth2 token exchange failed (HTTP ${tokenRes.status}).`
    );
  }

  const ttlMs = Math.max(120, Number(tokenData.expires_in || 3600) - 120) * 1000;
  tokenCache.set(cacheKey, {
    accessToken: tokenData.access_token,
    expiresAtMs: Date.now() + ttlMs
  });

  return { accessToken: tokenData.access_token, serviceAccount: sa };
}

export async function discoverGa4PropertiesWithToken(
  accessToken: string,
  serviceAccountEmail?: string
): Promise<Ga4PropertyOption[]> {
  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; status?: string };
    };
    const msg = errJson.error?.message || `HTTP ${res.status}`;
    if (res.status === 403 || res.status === 401) {
      throw new Error(
        `Google Analytics Admin API denied access (${msg}). Enable "Google Analytics Admin API" & "Google Analytics Data API" in Google Cloud Console and add ${
          serviceAccountEmail || 'the service account email'
        } as Viewer in GA4 Property Access Management.`
      );
    }
    throw new Error(`GA4 property discovery failed: ${msg}`);
  }

  const data = (await res.json()) as {
    accountSummaries?: Array<{
      displayName?: string;
      propertySummaries?: Array<{
        property?: string;
        displayName?: string;
      }>;
    }>;
  };

  const discovered: Ga4PropertyOption[] = [];
  for (const acct of data.accountSummaries || []) {
    const accountName = acct.displayName || 'Google Analytics Account';
    for (const prop of acct.propertySummaries || []) {
      if (!prop.property) continue;
      let measurementId = '';
      let streamUri = 'https://git-stack.org';
      try {
        const streamRes = await fetch(
          `https://analyticsadmin.googleapis.com/v1beta/${prop.property}/dataStreams`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
        if (streamRes.ok) {
          const streamJson = (await streamRes.json()) as {
            dataStreams?: Array<{
              webStreamData?: {
                measurementId?: string;
                defaultUri?: string;
              };
            }>;
          };
          const firstWeb = (streamJson.dataStreams || []).find(
            (s) => s.webStreamData?.measurementId
          );
          if (firstWeb?.webStreamData) {
            measurementId = firstWeb.webStreamData.measurementId || '';
            streamUri = firstWeb.webStreamData.defaultUri || streamUri;
          }
        }
      } catch {
        // ignore per-property stream fetch failure
      }

      const numericSuffix = prop.property.replace(/\D/g, '').slice(-8) || '46892014';
      discovered.push({
        property_id: prop.property,
        property_name: prop.displayName || prop.property,
        account_name: accountName,
        measurement_id: measurementId || `G-${numericSuffix}`,
        stream_uri: streamUri
      });
    }
  }

  return discovered;
}

interface Ga4RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  error?: { message?: string; code?: number };
}

async function runGa4Report(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<Ga4RunReportResponse> {
  const normalizedProp = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${normalizedProp}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  const json = (await res.json().catch(() => ({}))) as Ga4RunReportResponse;
  if (!res.ok) {
    throw new Error(json.error?.message || `GA4 runReport HTTP ${res.status}`);
  }
  return json;
}

async function runGa4Realtime(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<Ga4RunReportResponse> {
  const normalizedProp = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${normalizedProp}:runRealtimeReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  const json = (await res.json().catch(() => ({}))) as Ga4RunReportResponse;
  if (!res.ok) {
    throw new Error(json.error?.message || `GA4 runRealtimeReport HTTP ${res.status}`);
  }
  return json;
}

export async function fetchGa4FullReport(params: {
  accessToken: string;
  propertyOption: Ga4PropertyOption;
  range: ResolvedDateRange;
  authMode: 'service_account' | 'oauth';
  firstPartySummary?: AnalyticsSummary | null;
}): Promise<Ga4LiveReportSummary> {
  const { accessToken, propertyOption, range, authMode, firstPartySummary } = params;
  const dateRangePayload = [{ startDate: range.ga4StartDate, endDate: range.ga4EndDate }];
  const trendDimension = range.bucketMode === 'hour' ? 'dateHour' : 'date';

  const [
    trendRes,
    audienceRes,
    channelRes,
    countryRes,
    cityRes,
    landingRes,
    pageTitleRes,
    eventCountRes,
    deviceRes,
    pageReferrerRes,
    interestRes,
    rtTotalRes,
    rtCountryRes,
    rtCityRes,
    rtPageRes,
    rtMinuteRes
  ] = await Promise.all([
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: trendDimension }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'keyEvents' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'userEngagementDuration' }
      ],
      orderBys: [{ dimension: { dimensionName: trendDimension } }],
      limit: 400
    }),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'newVsReturning' }],
      metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }]
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'firstUserDefaultChannelGroup' }],
      metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
      limit: 10
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'country' }, { name: 'countryId' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 15
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'city' }, { name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 15
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'averageSessionDuration' },
        { name: 'keyEvents' },
        { name: 'sessionKeyEventRate' }
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 12
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'keyEvents' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 12
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 6
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [
        { name: 'pageReferrer' },
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
        { name: 'sessionCampaignName' }
      ],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20
    }).catch(() => ({ rows: [] })),
    runGa4Report(accessToken, propertyOption.property_id, {
      dateRanges: dateRangePayload,
      dimensions: [{ name: 'brandingInterest' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 12
    }).catch(() => ({ rows: [] })),
    runGa4Realtime(accessToken, propertyOption.property_id, {
      metrics: [{ name: 'activeUsers' }, { name: 'keyEvents' }]
    }).catch(() => ({ rows: [] })),
    runGa4Realtime(accessToken, propertyOption.property_id, {
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 10
    }).catch(() => ({ rows: [] })),
    runGa4Realtime(accessToken, propertyOption.property_id, {
      dimensions: [{ name: 'city' }, { name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 10
    }).catch(() => ({ rows: [] })),
    runGa4Realtime(accessToken, propertyOption.property_id, {
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      limit: 10
    }).catch(() => ({ rows: [] })),
    runGa4Realtime(accessToken, propertyOption.property_id, {
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'activeUsers' }]
    }).catch(() => ({ rows: [] }))
  ]);

  let screenPageViews = 0;
  let conversions = 0;
  let activeUsers = 0;
  let newUsersTotal = 0;
  let totalSessions = 0;
  let totalEngagementSec = 0;

  const dailySeries = (trendRes.rows || []).map((r) => {
    const rawDim = r.dimensionValues?.[0]?.value || '';
    let formattedDate = rawDim;
    if (trendDimension === 'dateHour' && rawDim.length === 10) {
      formattedDate = `${rawDim.slice(0, 4)}-${rawDim.slice(4, 6)}-${rawDim.slice(6, 8)} ${rawDim.slice(8, 10)}:00`;
    } else if (rawDim.length === 8) {
      formattedDate = `${rawDim.slice(0, 4)}-${rawDim.slice(4, 6)}-${rawDim.slice(6, 8)}`;
    }
    const pv = Number(r.metricValues?.[0]?.value || 0);
    const conv = Number(r.metricValues?.[1]?.value || 0);
    const users = Number(r.metricValues?.[2]?.value || 0);
    const nu = Number(r.metricValues?.[3]?.value || 0);
    const sess = Number(r.metricValues?.[4]?.value || 0);
    const engSec = Number(r.metricValues?.[5]?.value || 0);

    screenPageViews += pv;
    conversions += conv;
    activeUsers += users;
    newUsersTotal += nu;
    totalSessions += sess;
    totalEngagementSec += engSec;

    return {
      date: formattedDate,
      pageviews: pv,
      conversions: conv,
      activeUsers: users,
      newUsers: nu,
      avgEngagementSeconds: users > 0 ? Math.round(engSec / users) : 0
    };
  });

  let newUsers = newUsersTotal;
  let returningUsers = 0;
  for (const r of audienceRes.rows || []) {
    const label = (r.dimensionValues?.[0]?.value || '').toLowerCase();
    const u = Number(r.metricValues?.[0]?.value || 0);
    if (label === 'new') newUsers = u;
    if (label === 'returning') returningUsers = u;
  }

  const channels: AnalyticsChannelItem[] = (channelRes.rows || []).map((r) => ({
    channel: r.dimensionValues?.[0]?.value || 'Direct',
    activeUsers: Number(r.metricValues?.[0]?.value || 0),
    newUsers: Number(r.metricValues?.[1]?.value || 0),
    sessions: Number(r.metricValues?.[2]?.value || 0)
  }));

  const countries: AnalyticsGeoCountryItem[] = (countryRes.rows || []).map((r) => ({
    country: r.dimensionValues?.[0]?.value || '(not set)',
    countryCode: r.dimensionValues?.[1]?.value || '',
    activeUsers: Number(r.metricValues?.[0]?.value || 0),
    sessions: Number(r.metricValues?.[1]?.value || 0)
  }));

  const cities: AnalyticsGeoCityItem[] = (cityRes.rows || [])
    .filter((r) => (r.dimensionValues?.[0]?.value || '') !== '(not set)')
    .map((r) => ({
      city: r.dimensionValues?.[0]?.value || 'Unknown',
      country: r.dimensionValues?.[1]?.value || '',
      activeUsers: Number(r.metricValues?.[0]?.value || 0)
    }));

  const landingPages: AnalyticsLandingPageItem[] = (landingRes.rows || []).map((r) => {
    const rawRate = Number(r.metricValues?.[5]?.value || 0);
    return {
      landingPage: r.dimensionValues?.[0]?.value || '/',
      sessions: Number(r.metricValues?.[0]?.value || 0),
      activeUsers: Number(r.metricValues?.[1]?.value || 0),
      newUsers: Number(r.metricValues?.[2]?.value || 0),
      avgEngagementSeconds: Math.round(Number(r.metricValues?.[3]?.value || 0)),
      keyEvents: Number(r.metricValues?.[4]?.value || 0),
      keyEventRatePercent: Number((rawRate <= 1 ? rawRate * 100 : rawRate).toFixed(1))
    };
  });

  const pageTitles: AnalyticsPageTitleItem[] = (pageTitleRes.rows || []).map((r) => ({
    title: r.dimensionValues?.[0]?.value || 'GitStack Page',
    path: r.dimensionValues?.[1]?.value || '/',
    views: Number(r.metricValues?.[0]?.value || 0),
    activeUsers: Number(r.metricValues?.[1]?.value || 0)
  }));

  const topPages = pageTitles.slice(0, 8).map((p) => ({
    path: p.path,
    views: p.views
  }));

  const eventCounts: AnalyticsEventCountItem[] = (eventCountRes.rows || []).map((r) => ({
    eventName: r.dimensionValues?.[0]?.value || 'event',
    count: Number(r.metricValues?.[0]?.value || 0),
    conversions: Number(r.metricValues?.[1]?.value || 0)
  }));

  const rawDevices = (deviceRes.rows || []).map((r) => ({
    device: r.dimensionValues?.[0]?.value || 'desktop',
    users: Number(r.metricValues?.[0]?.value || 0)
  }));
  const devTotal = rawDevices.reduce((sum, d) => sum + d.users, 0) || 1;
  const devices: AnalyticsDevicePlatformItem[] = rawDevices.map((d) => ({
    device: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    platform: 'Web',
    users: d.users,
    percent: Number(((d.users / devTotal) * 100).toFixed(1))
  }));

  // Realtime from GA4
  const rtRow = rtTotalRes.rows?.[0];
  const rtUsers30m = Number(rtRow?.metricValues?.[0]?.value || 0);
  const rtConv30m = Number(rtRow?.metricValues?.[1]?.value || 0);
  const minuteMap = new Map<number, number>();
  for (const r of rtMinuteRes.rows || []) {
    const minsAgo = Number(r.dimensionValues?.[0]?.value || 0);
    minuteMap.set(minsAgo, (minuteMap.get(minsAgo) || 0) + Number(r.metricValues?.[0]?.value || 0));
  }
  const perMinute: RealtimeActiveVisitorSummary['perMinute'] = [];
  for (let m = 29; m >= 0; m--) {
    perMinute.push({
      minuteLabel: m === 0 ? 'Now' : `-${m}m`,
      activeUsers: minuteMap.get(m) || 0,
      events: minuteMap.get(m) || 0
    });
  }
  const rtUsers5m = [0, 1, 2, 3, 4].reduce((sum, m) => sum + (minuteMap.get(m) || 0), 0);

  const ga4Realtime: RealtimeActiveVisitorSummary = {
    activeUsers30m: rtUsers30m,
    activeUsers5m: rtUsers5m || rtUsers30m,
    events30m: rtUsers30m,
    conversions30m: rtConv30m,
    perMinute,
    activePages: (rtPageRes.rows || []).map((r) => ({
      path: '/',
      title: r.dimensionValues?.[0]?.value || 'GitStack',
      activeUsers: Number(r.metricValues?.[0]?.value || 0),
      views: Number(r.metricValues?.[1]?.value || 0)
    })),
    activeCountries: (rtCountryRes.rows || []).map((r) => ({
      country: r.dimensionValues?.[0]?.value || 'Unknown',
      activeUsers: Number(r.metricValues?.[0]?.value || 0)
    })),
    activeCities: (rtCityRes.rows || []).map((r) => ({
      city: r.dimensionValues?.[0]?.value || 'Unknown',
      country: r.dimensionValues?.[1]?.value || '',
      activeUsers: Number(r.metricValues?.[0]?.value || 0)
    })),
    activeChannels: firstPartySummary?.realtime?.activeChannels || [],
    recentVisitors: firstPartySummary?.realtime?.recentVisitors || [],
    sampledAt: new Date().toISOString()
  };

  const referrerDetails: AnalyticsReferrerDetailItem[] = (pageReferrerRes.rows || []).map((r) => {
    const rawRef = r.dimensionValues?.[0]?.value || '';
    const src = r.dimensionValues?.[1]?.value || '';
    const med = r.dimensionValues?.[2]?.value || '';
    const cmp = r.dimensionValues?.[3]?.value || '';
    const cleanRef = rawRef === '(not set)' ? '' : rawRef;
    const classified = classifyTriggerDetails(cleanRef, '', {
      utm_source: src === '(direct)' || src === '(not set)' ? '' : src,
      utm_medium: med === '(none)' || med === '(not set)' ? '' : med,
      utm_campaign: cmp === '(not set)' ? '' : cmp
    });
    return {
      referrerUrl: classified.referrerUrl,
      referrerHost: classified.referrerHost || (src && src !== '(direct)' ? src : 'Direct'),
      triggerType: classified.triggerType,
      triggerLabel: classified.triggerLabel,
      utmSource: classified.utmSource || undefined,
      utmMedium: classified.utmMedium || undefined,
      utmCampaign: classified.utmCampaign || undefined,
      sessions: Number(r.metricValues?.[0]?.value || 0),
      activeUsers: Number(r.metricValues?.[1]?.value || 0),
      conversions: Number(r.metricValues?.[2]?.value || 0)
    };
  });

  const rawGa4Interests = (interestRes.rows || [])
    .map((r) => ({
      interest: (r.dimensionValues?.[0]?.value || '').trim(),
      users: Number(r.metricValues?.[0]?.value || 0),
      sessions: Number(r.metricValues?.[1]?.value || 0)
    }))
    .filter((item) => item.interest && item.interest !== '(not set)');

  const interestUserSum = rawGa4Interests.reduce((sum, i) => sum + i.users, 0) || 1;
  const ga4InterestSegments: AnalyticsInterestSegmentItem[] = rawGa4Interests.map((item) => ({
    interest: item.interest,
    category: 'Google Signals Affinity',
    source: 'ga4_signals',
    users: item.users,
    sessions: item.sessions,
    sharePercent: Number(((item.users / interestUserSum) * 100).toFixed(1))
  }));

  return {
    property_id: propertyOption.property_id,
    property_name: propertyOption.property_name,
    measurement_id: propertyOption.measurement_id,
    days: range.daysSpan,
    preset: range.preset,
    startDate: range.startDate,
    endDate: range.endDate,
    authMode,
    synced_at: new Date().toISOString(),
    activeUsers,
    newUsers,
    returningUsers,
    totalSessions,
    screenPageViews,
    conversions,
    avgEngagementSeconds: activeUsers > 0 ? Math.round(totalEngagementSec / activeUsers) : 0,
    dailySeries,
    topPages,
    topReferrers: channels.map((c) => ({ referrer: c.channel, visits: c.sessions })),
    countries,
    cities,
    channels,
    landingPages,
    pageTitles,
    eventCounts,
    devices,
    realtime: ga4Realtime,
    referrerDetails,
    ga4InterestSegments
  };
}
