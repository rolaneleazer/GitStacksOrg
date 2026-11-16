import type {
  CloudflareAnalyticsResponse,
  CloudflareTimeSeriesPoint,
  CloudflareTopItem,
  CloudflareWindowPreset
} from '../shared/types.ts';
import { resolveIntegrationConfig } from './vault.ts';

const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

function getWindowRange(preset: CloudflareWindowPreset): {
  start: Date;
  end: Date;
  prevStart: Date;
  bucketDimension: 'datetimeFifteenMinutes' | 'datetimeHour';
} {
  const end = new Date();
  let hours = 24;
  let bucketDimension: 'datetimeFifteenMinutes' | 'datetimeHour' = 'datetimeHour';
  if (preset === '1h') {
    hours = 1;
    bucketDimension = 'datetimeFifteenMinutes';
  } else if (preset === '6h') {
    hours = 6;
    bucketDimension = 'datetimeFifteenMinutes';
  } else if (preset === '7d') {
    hours = 24 * 7;
    bucketDimension = 'datetimeHour';
  }
  const spanMs = hours * 60 * 60 * 1000;
  const start = new Date(end.getTime() - spanMs);
  const prevStart = new Date(start.getTime() - spanMs);
  return { start, end, prevStart, bucketDimension };
}

function formatBucketLabel(iso: string, preset: CloudflareWindowPreset): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (preset === '7d') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
  }
  return d.toLocaleTimeString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function runGraphQlQuery<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message?: string; path?: unknown[] }> }> {
  const res = await fetch(CF_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: Array<{ message?: string; path?: unknown[] }>;
  };
  if (!res.ok) {
    const errMsg = json.errors?.[0]?.message || `Cloudflare GraphQL returned HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return json;
}

interface AdaptiveGroupRow {
  count?: number;
  sum?: { edgeResponseBytes?: number; visits?: number };
  dimensions?: Record<string, unknown>;
}

interface HourlyGroupRow {
  sum?: {
    requests?: number;
    bytes?: number;
    cachedRequests?: number;
    pageViews?: number;
    countryMap?: Array<{ clientCountryName?: string; requests?: number; bytes?: number }>;
    responseStatusMap?: Array<{ edgeResponseStatus?: number; requests?: number }>;
    browserMap?: Array<{ uaBrowserFamily?: string; pageViews?: number }>;
  };
  uniq?: { uniques?: number };
  dimensions?: { datetime?: string };
}

function createEmptyResponse(
  connected: boolean,
  source: 'vault' | 'env' | 'disconnected',
  zoneId: string,
  zoneName: string,
  windowPreset: CloudflareWindowPreset,
  notice?: string
): CloudflareAnalyticsResponse {
  return {
    connected,
    source,
    zoneId,
    zoneName,
    window: windowPreset,
    fetchedAt: new Date().toISOString(),
    notice,
    summary: {
      totalRequests: 0,
      requestsDeltaPct: null,
      totalBytes: 0,
      bytesDeltaPct: null,
      totalVisits: 0,
      cacheHitRate: 0,
      cacheHitRateDeltaPct: null,
      error5xxRate: 0,
      error5xxDeltaPct: null,
      statusTotals: { s1xx: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0 },
      cacheTotals: { dynamic: 0, none: 0, expired: 0, miss: 0, hit: 0 }
    },
    series: [],
    breakdowns: {
      topPaths: [],
      topCountries: [],
      topClientIps: [],
      topHosts: [],
      topBrowsers: [],
      topOperatingSystems: [],
      topDeviceTypes: [],
      topUserAgents: [],
      topHttpVersions: [],
      topStatusCodes: [],
      topDataCenters: []
    }
  };
}

function mapStatusCodeLabel(code: number): string {
  const labels: Record<number, string> = {
    200: '200 OK',
    204: '204 No Content',
    206: '206 Partial Content',
    301: '301 Moved Permanently',
    302: '302 Found',
    304: '304 Not Modified',
    307: '307 Temporary Redirect',
    308: '308 Permanent Redirect',
    400: '400 Bad Request',
    401: '401 Unauthorized',
    403: '403 Forbidden',
    404: '404 Not Found',
    429: '429 Too Many Requests',
    499: '499 Client Closed Request',
    500: '500 Internal Server Error',
    502: '502 Bad Gateway',
    503: '503 Service Unavailable',
    504: '504 Gateway Timeout',
    520: '520 Web Server Unknown Error',
    521: '521 Web Server Is Down',
    522: '522 Connection Timed Out',
    524: '524 A Timeout Occurred',
    530: '530 DNS Error'
  };
  return labels[code] || `${code}`;
}

export async function fetchCloudflareZoneAnalytics(
  windowPreset: CloudflareWindowPreset = '24h',
  userToken?: string
): Promise<CloudflareAnalyticsResponse> {
  const resolved = await resolveIntegrationConfig('cloudflare', userToken);
  const token = resolved.secret;
  let zoneId = (resolved.configMeta.zone_id || '').trim();
  let zoneName = (resolved.configMeta.zone_name || 'git-stack.org').trim();

  if (!token || resolved.source === 'disconnected') {
    return createEmptyResponse(
      false,
      'disconnected',
      zoneId,
      zoneName,
      windowPreset,
      'Cloudflare is not connected yet. Add your Cloudflare API Token and Zone ID in Settings & Integrations.'
    );
  }

  let planName = '';
  if (!zoneId) {
    const zLookup = await fetch(
      `https://api.cloudflare.com/client/v4/zones${zoneName ? `?name=${encodeURIComponent(zoneName)}` : ''}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      }
    );
    if (zLookup.ok) {
      const zJson = (await zLookup.json().catch(() => ({}))) as {
        result?: Array<{ id: string; name: string; plan?: { name?: string } }>;
      };
      const first = zJson.result?.[0];
      if (first) {
        zoneId = first.id;
        zoneName = first.name;
        planName = first.plan?.name || '';
      }
    }
  } else {
    const zInfo = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      }
    ).catch(() => null);
    if (zInfo && zInfo.ok) {
      const zJson = (await zInfo.json().catch(() => ({}))) as {
        result?: { name?: string; plan?: { name?: string } };
      };
      zoneName = zJson.result?.name || zoneName;
      planName = zJson.result?.plan?.name || '';
    }
  }

  if (!zoneId) {
    return createEmptyResponse(
      true,
      resolved.source,
      '',
      zoneName,
      windowPreset,
      'Cloudflare API Token is saved, but no Zone ID was found for this domain. Add your Zone ID inside Settings & Integrations -> Cloudflare.'
    );
  }

  const { start, end, prevStart, bucketDimension } = getWindowRange(windowPreset);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const prevStartIso = prevStart.toISOString();

  // Primary GraphQL query covering time series + prior window comparison via httpRequestsAdaptiveGroups
  const seriesQuery = `
    query ZoneSeries($zoneTag: String!, $start: Time!, $end: Time!, $prevStart: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          currentSeries: httpRequestsAdaptiveGroups(
            limit: 1000
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [${bucketDimension}_ASC]
          ) {
            count
            sum { edgeResponseBytes }
            dimensions {
              bucket: ${bucketDimension}
              edgeResponseStatus
              cacheStatus
            }
          }
          prevSummary: httpRequestsAdaptiveGroups(
            limit: 200
            filter: { datetime_geq: $prevStart, datetime_lt: $start }
          ) {
            count
            sum { edgeResponseBytes }
            dimensions {
              edgeResponseStatus
              cacheStatus
            }
          }
        }
      }
    }
  `;

  type SeriesResult = {
    viewer?: {
      zones?: Array<{
        currentSeries?: AdaptiveGroupRow[];
        prevSummary?: AdaptiveGroupRow[];
      }>;
    };
  };

  let currentRows: AdaptiveGroupRow[] = [];
  let prevRows: AdaptiveGroupRow[] = [];
  let notice: string | undefined;

  const seriesRes = await runGraphQlQuery<SeriesResult>(token, seriesQuery, {
    zoneTag: zoneId,
    start: startIso,
    end: endIso,
    prevStart: prevStartIso
  }).catch((err) => ({
    data: undefined as SeriesResult | undefined,
    errors: [{ message: err instanceof Error ? err.message : 'GraphQL series query failed' }]
  }));

  if (seriesRes.data?.viewer?.zones?.[0]?.currentSeries) {
    currentRows = seriesRes.data.viewer.zones[0].currentSeries || [];
    prevRows = seriesRes.data.viewer.zones[0].prevSummary || [];
  } else if (seriesRes.errors?.length) {
    notice = seriesRes.errors[0]?.message || undefined;
  }

  // Query all 11 Top-N dimensions independently in safe GraphQL sub-queries so Free plan limits on 1 dimension never break the others
  const breakdownSpecs: Array<{
    key: keyof CloudflareAnalyticsResponse['breakdowns'];
    dimension: string;
    formatLabel?: (raw: string) => string;
  }> = [
    { key: 'topPaths', dimension: 'clientRequestPath' },
    { key: 'topCountries', dimension: 'clientCountryName' },
    { key: 'topClientIps', dimension: 'clientIP' },
    { key: 'topHosts', dimension: 'clientRequestHTTPHost' },
    { key: 'topBrowsers', dimension: 'userAgentBrowser' },
    { key: 'topOperatingSystems', dimension: 'userAgentOS' },
    { key: 'topDeviceTypes', dimension: 'clientDeviceType' },
    { key: 'topUserAgents', dimension: 'clientRequestUserAgent' },
    { key: 'topHttpVersions', dimension: 'clientRequestHTTPProtocol' },
    {
      key: 'topStatusCodes',
      dimension: 'edgeResponseStatus',
      formatLabel: (v) => mapStatusCodeLabel(Number(v) || 0)
    },
    { key: 'topDataCenters', dimension: 'coloCode' }
  ];

  const fullBreakdownsQuery = `
    query ZoneBreakdowns($zoneTag: String!, $start: Time!, $end: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          ${breakdownSpecs
            .map(
              (s) => `
          ${s.key}: httpRequestsAdaptiveGroups(
            limit: 10
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [count_DESC]
          ) {
            count
            sum { edgeResponseBytes }
            dimensions { val: ${s.dimension} }
          }`
            )
            .join('\n')}
        }
      }
    }
  `;

  type BreakdownResult = {
    viewer?: {
      zones?: Array<Record<string, AdaptiveGroupRow[]>>;
    };
  };

  const breakdowns: CloudflareAnalyticsResponse['breakdowns'] = {
    topPaths: [],
    topCountries: [],
    topClientIps: [],
    topHosts: [],
    topBrowsers: [],
    topOperatingSystems: [],
    topDeviceTypes: [],
    topUserAgents: [],
    topHttpVersions: [],
    topStatusCodes: [],
    topDataCenters: []
  };

  const bdRes = await runGraphQlQuery<BreakdownResult>(token, fullBreakdownsQuery, {
    zoneTag: zoneId,
    start: startIso,
    end: endIso
  }).catch(() => ({ data: undefined as BreakdownResult | undefined, errors: undefined }));

  const zoneBreakdowns = bdRes.data?.viewer?.zones?.[0];
  if (zoneBreakdowns) {
    for (const spec of breakdownSpecs) {
      const rows = zoneBreakdowns[spec.key];
      if (Array.isArray(rows)) {
        breakdowns[spec.key] = rows.map((r) => {
          const raw = String(r.dimensions?.val ?? 'Unknown').trim() || 'Unknown/Others';
          return {
            label: spec.formatLabel ? spec.formatLabel(raw) : raw,
            count: Number(r.count) || 0,
            bytes: Number(r.sum?.edgeResponseBytes) || 0
          } satisfies CloudflareTopItem;
        });
      }
    }
  } else {
    // Retry each Top-N dimension cleanly so restricted dimensions on Free tier do not zero out available breakdowns
    await Promise.all(
      breakdownSpecs.map(async (spec) => {
        const singleQuery = `
          query SingleBreakdown($zoneTag: String!, $start: Time!, $end: Time!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                rows: httpRequestsAdaptiveGroups(
                  limit: 10
                  filter: { datetime_geq: $start, datetime_lt: $end }
                  orderBy: [count_DESC]
                ) {
                  count
                  sum { edgeResponseBytes }
                  dimensions { val: ${spec.dimension} }
                }
              }
            }
          }
        `;
        const res = await runGraphQlQuery<{
          viewer?: { zones?: Array<{ rows?: AdaptiveGroupRow[] }> };
        }>(token, singleQuery, {
          zoneTag: zoneId,
          start: startIso,
          end: endIso
        }).catch(() => null);
        const rows = res?.data?.viewer?.zones?.[0]?.rows;
        if (Array.isArray(rows)) {
          breakdowns[spec.key] = rows.map((r) => {
            const raw = String(r.dimensions?.val ?? 'Unknown').trim() || 'Unknown/Others';
            return {
              label: spec.formatLabel ? spec.formatLabel(raw) : raw,
              count: Number(r.count) || 0,
              bytes: Number(r.sum?.edgeResponseBytes) || 0
            };
          });
        }
      })
    );
  }

  // Fallback to httpRequests1hGroups if adaptive groups returned zero series rows
  let totalVisits = 0;
  if (currentRows.length === 0) {
    const hourlyQuery = `
      query HourlyFallback($zoneTag: String!, $start: Time!, $end: Time!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1hGroups(
              limit: 200
              filter: { datetime_geq: $start, datetime_lt: $end }
              orderBy: [datetime_ASC]
            ) {
              sum {
                requests
                bytes
                cachedRequests
                pageViews
                countryMap { clientCountryName requests bytes }
                responseStatusMap { edgeResponseStatus requests }
                browserMap { uaBrowserFamily pageViews }
              }
              uniq { uniques }
              dimensions { datetime }
            }
          }
        }
      }
    `;
    const hRes = await runGraphQlQuery<{
      viewer?: { zones?: Array<{ httpRequests1hGroups?: HourlyGroupRow[] }> };
    }>(token, hourlyQuery, { zoneTag: zoneId, start: startIso, end: endIso }).catch(() => null);
    const hRows = hRes?.data?.viewer?.zones?.[0]?.httpRequests1hGroups || [];
    if (hRows.length > 0) {
      const series: CloudflareTimeSeriesPoint[] = [];
      let totalRequests = 0;
      let totalBytes = 0;
      let cachedTotal = 0;
      let s1xx = 0;
      let s2xx = 0;
      let s3xx = 0;
      let s4xx = 0;
      let s5xx = 0;

      const countryAgg = new Map<string, number>();
      const statusAgg = new Map<number, number>();
      const browserAgg = new Map<string, number>();

      for (const hr of hRows) {
        const reqs = Number(hr.sum?.requests) || 0;
        const b = Number(hr.sum?.bytes) || 0;
        const cached = Number(hr.sum?.cachedRequests) || 0;
        totalRequests += reqs;
        totalBytes += b;
        cachedTotal += cached;
        totalVisits += Number(hr.sum?.pageViews) || 0;

        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        for (const st of hr.sum?.responseStatusMap || []) {
          const code = Number(st.edgeResponseStatus) || 0;
          const cnt = Number(st.requests) || 0;
          statusAgg.set(code, (statusAgg.get(code) || 0) + cnt);
          if (code >= 500) b5 += cnt;
          else if (code >= 400) b4 += cnt;
          else if (code >= 300) b3 += cnt;
          else if (code >= 200) b2 += cnt;
          else b1 += cnt;
        }
        s1xx += b1;
        s2xx += b2;
        s3xx += b3;
        s4xx += b4;
        s5xx += b5;

        for (const c of hr.sum?.countryMap || []) {
          const name = c.clientCountryName || 'Unknown';
          countryAgg.set(name, (countryAgg.get(name) || 0) + (Number(c.requests) || 0));
        }
        for (const br of hr.sum?.browserMap || []) {
          const fam = br.uaBrowserFamily || 'Unknown/Others';
          browserAgg.set(fam, (browserAgg.get(fam) || 0) + (Number(br.pageViews) || 0));
        }

        const ts = hr.dimensions?.datetime || startIso;
        series.push({
          timestamp: ts,
          label: formatBucketLabel(ts, windowPreset),
          requests: reqs,
          bytes: b,
          visits: Number(hr.sum?.pageViews) || 0,
          status1xx: b1,
          status2xx: b2,
          status3xx: b3,
          status4xx: b4,
          status5xx: b5,
          cacheDynamic: Math.max(0, reqs - cached),
          cacheNone: 0,
          cacheExpired: 0,
          cacheMiss: 0,
          cacheHit: cached
        });
      }

      if (breakdowns.topCountries.length === 0) {
        breakdowns.topCountries = Array.from(countryAgg.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([label, count]) => ({ label, count }));
      }
      if (breakdowns.topStatusCodes.length === 0) {
        breakdowns.topStatusCodes = Array.from(statusAgg.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([code, count]) => ({ label: mapStatusCodeLabel(code), count }));
      }
      if (breakdowns.topBrowsers.length === 0) {
        breakdowns.topBrowsers = Array.from(browserAgg.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([label, count]) => ({ label, count }));
      }

      return {
        connected: true,
        source: resolved.source,
        zoneId,
        zoneName,
        planName,
        window: windowPreset,
        fetchedAt: new Date().toISOString(),
        notice,
        summary: {
          totalRequests,
          requestsDeltaPct: null,
          totalBytes,
          bytesDeltaPct: null,
          totalVisits,
          cacheHitRate: totalRequests ? Number(((cachedTotal / totalRequests) * 100).toFixed(2)) : 0,
          cacheHitRateDeltaPct: null,
          error5xxRate: totalRequests ? Number(((s5xx / totalRequests) * 100).toFixed(2)) : 0,
          error5xxDeltaPct: null,
          statusTotals: { s1xx, s2xx, s3xx, s4xx, s5xx },
          cacheTotals: {
            dynamic: Math.max(0, totalRequests - cachedTotal),
            none: 0,
            expired: 0,
            miss: 0,
            hit: cachedTotal
          }
        },
        series,
        breakdowns
      };
    }
  }

  // Aggregate adaptive time-series buckets cleanly
  const bucketMap = new Map<string, CloudflareTimeSeriesPoint>();
  let totalRequests = 0;
  let totalBytes = 0;
  let s1xx = 0;
  let s2xx = 0;
  let s3xx = 0;
  let s4xx = 0;
  let s5xx = 0;
  let cacheDynamic = 0;
  let cacheNone = 0;
  let cacheExpired = 0;
  let cacheMiss = 0;
  let cacheHit = 0;

  for (const row of currentRows) {
    const reqs = Number(row.count) || 0;
    const b = Number(row.sum?.edgeResponseBytes) || 0;
    const status = Number(row.dimensions?.edgeResponseStatus) || 0;
    const cache = String(row.dimensions?.cacheStatus || 'none').toLowerCase();
    const ts = String(row.dimensions?.bucket || startIso);

    totalRequests += reqs;
    totalBytes += b;

    const pt = bucketMap.get(ts) || {
      timestamp: ts,
      label: formatBucketLabel(ts, windowPreset),
      requests: 0,
      bytes: 0,
      visits: 0,
      status1xx: 0,
      status2xx: 0,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0,
      cacheDynamic: 0,
      cacheNone: 0,
      cacheExpired: 0,
      cacheMiss: 0,
      cacheHit: 0
    };

    pt.requests += reqs;
    pt.bytes += b;

    if (status >= 500) {
      pt.status5xx += reqs;
      s5xx += reqs;
    } else if (status >= 400) {
      pt.status4xx += reqs;
      s4xx += reqs;
    } else if (status >= 300) {
      pt.status3xx += reqs;
      s3xx += reqs;
    } else if (status >= 200) {
      pt.status2xx += reqs;
      s2xx += reqs;
    } else {
      pt.status1xx += reqs;
      s1xx += reqs;
    }

    if (cache === 'hit') {
      pt.cacheHit += reqs;
      cacheHit += reqs;
    } else if (cache === 'miss') {
      pt.cacheMiss += reqs;
      cacheMiss += reqs;
    } else if (cache === 'expired') {
      pt.cacheExpired += reqs;
      cacheExpired += reqs;
    } else if (cache === 'dynamic') {
      pt.cacheDynamic += reqs;
      cacheDynamic += reqs;
    } else {
      pt.cacheNone += reqs;
      cacheNone += reqs;
    }

    bucketMap.set(ts, pt);
  }

  let prevRequests = 0;
  let prevBytes = 0;
  let prevHit = 0;
  let prev5xx = 0;
  for (const row of prevRows) {
    const reqs = Number(row.count) || 0;
    const b = Number(row.sum?.edgeResponseBytes) || 0;
    const status = Number(row.dimensions?.edgeResponseStatus) || 0;
    const cache = String(row.dimensions?.cacheStatus || 'none').toLowerCase();
    prevRequests += reqs;
    prevBytes += b;
    if (status >= 500) prev5xx += reqs;
    if (cache === 'hit') prevHit += reqs;
  }

  const cacheHitRate = totalRequests ? Number(((cacheHit / totalRequests) * 100).toFixed(2)) : 0;
  const prevHitRate = prevRequests ? Number(((prevHit / prevRequests) * 100).toFixed(2)) : 0;
  const error5xxRate = totalRequests ? Number(((s5xx / totalRequests) * 100).toFixed(2)) : 0;
  const prev5xxRate = prevRequests ? Number(((prev5xx / prevRequests) * 100).toFixed(2)) : 0;

  const series = Array.from(bucketMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    connected: true,
    source: resolved.source,
    zoneId,
    zoneName,
    planName,
    window: windowPreset,
    fetchedAt: new Date().toISOString(),
    notice,
    summary: {
      totalRequests,
      requestsDeltaPct: prevRequests > 0 ? calcDeltaPct(totalRequests, prevRequests) : null,
      totalBytes,
      bytesDeltaPct: prevBytes > 0 ? calcDeltaPct(totalBytes, prevBytes) : null,
      totalVisits,
      cacheHitRate,
      cacheHitRateDeltaPct: prevRequests > 0 ? calcDeltaPct(cacheHitRate, prevHitRate) : null,
      error5xxRate,
      error5xxDeltaPct: prevRequests > 0 ? calcDeltaPct(error5xxRate, prev5xxRate) : null,
      statusTotals: { s1xx, s2xx, s3xx, s4xx, s5xx },
      cacheTotals: {
        dynamic: cacheDynamic,
        none: cacheNone,
        expired: cacheExpired,
        miss: cacheMiss,
        hit: cacheHit
      }
    },
    series,
    breakdowns
  };
}
