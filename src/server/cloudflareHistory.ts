import { GoogleGenAI, Type } from '@google/genai';
import type {
  CloudflareAiForecast,
  CloudflareDailyForecastPoint,
  CloudflareDailyHistoryPoint,
  CloudflareHistoryAnalysisResponse,
  CloudflareHistoryRange,
  CloudflareHourlySnapshot,
  CloudflareTopItem,
  CloudflareTrafficAnomaly
} from '../shared/types.ts';
import {
  getCloudflareAiForecast,
  listCloudflareHourlySnapshots,
  upsertCloudflareAiForecast,
  upsertCloudflareHourlySnapshots
} from './repository.ts';
import { recordLoopOutcome, shouldRunLoopTick } from './quotaShield.ts';
import { resolveIntegrationConfig, resolveIntegrationSecret } from './vault.ts';

const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

async function resolveZoneIdentity(
  userToken?: string
): Promise<{ token: string; zoneId: string; zoneName: string; connected: boolean }> {
  const resolved = await resolveIntegrationConfig('cloudflare', userToken);
  const token = resolved.secret;
  let zoneId = (resolved.configMeta.zone_id || '').trim();
  let zoneName = (resolved.configMeta.zone_name || 'git-stack.org').trim();

  if (!token || resolved.source === 'disconnected') {
    return { token: '', zoneId, zoneName, connected: false };
  }

  if (!zoneId) {
    const zLookup = await fetch(
      `https://api.cloudflare.com/client/v4/zones${zoneName ? `?name=${encodeURIComponent(zoneName)}` : ''}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      }
    ).catch(() => null);
    if (zLookup && zLookup.ok) {
      const zJson = (await zLookup.json().catch(() => ({}))) as {
        result?: Array<{ id: string; name: string }>;
      };
      if (zJson.result?.[0]) {
        zoneId = zJson.result[0].id;
        zoneName = zJson.result[0].name;
      }
    }
  }

  return { token, zoneId, zoneName, connected: Boolean(token && zoneId) };
}

async function runGraphQl<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message?: string }> }> {
  const res = await fetch(CF_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  return (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
}

interface Cf1hRow {
  dimensions?: { datetime?: string };
  sum?: {
    requests?: number;
    bytes?: number;
    cachedRequests?: number;
    responseStatusMap?: Array<{ edgeResponseStatus?: number; requests?: number }>;
    countryMap?: Array<{ clientCountryName?: string; requests?: number }>;
  };
}

interface Cf1dRow {
  dimensions?: { date?: string };
  sum?: {
    requests?: number;
    bytes?: number;
    cachedRequests?: number;
    responseStatusMap?: Array<{ edgeResponseStatus?: number; requests?: number }>;
    countryMap?: Array<{ clientCountryName?: string; requests?: number }>;
  };
}

export async function syncCloudflareHistoricalSnapshots(userToken?: string): Promise<{
  syncedCount: number;
  zoneId: string;
  zoneName: string;
}> {
  const { token, zoneId, zoneName, connected } = await resolveZoneIdentity(userToken);
  if (!connected || !zoneId) {
    return { syncedCount: 0, zoneId, zoneName };
  }

  const now = new Date();
  const hourlyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dailyStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const hourlyQuery = `
    query SyncHourly($zoneTag: String!, $start: Time!, $end: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1hGroups(
            limit: 300
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [datetime_ASC]
          ) {
            dimensions { datetime }
            sum {
              requests
              bytes
              cachedRequests
              responseStatusMap { edgeResponseStatus requests }
              countryMap { clientCountryName requests }
            }
          }
        }
      }
    }
  `;

  const hRes = await runGraphQl<{
    viewer?: { zones?: Array<{ httpRequests1hGroups?: Cf1hRow[] }> };
  }>(token, hourlyQuery, {
    zoneTag: zoneId,
    start: hourlyStart.toISOString(),
    end: now.toISOString()
  }).catch(() => null);

  const nowIso = now.toISOString();
  const snapshots: CloudflareHourlySnapshot[] = [];
  const coveredDays = new Set<string>();

  for (const row of hRes?.data?.viewer?.zones?.[0]?.httpRequests1hGroups || []) {
    const dt = row.dimensions?.datetime;
    if (!dt) continue;
    const hourDate = new Date(dt);
    if (Number.isNaN(hourDate.getTime())) continue;
    hourDate.setUTCMinutes(0, 0, 0);
    const bucketIso = hourDate.toISOString();
    coveredDays.add(bucketIso.slice(0, 10));

    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    for (const st of row.sum?.responseStatusMap || []) {
      const code = Number(st.edgeResponseStatus) || 0;
      const cnt = Number(st.requests) || 0;
      if (code >= 500) s5 += cnt;
      else if (code >= 400) s4 += cnt;
      else if (code >= 300) s3 += cnt;
      else if (code >= 200) s2 += cnt;
      else s1 += cnt;
    }

    const countries: CloudflareTopItem[] = (row.sum?.countryMap || [])
      .map((c) => ({
        label: c.clientCountryName || 'Unknown',
        count: Number(c.requests) || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    snapshots.push({
      id: `${zoneId}:${bucketIso}`,
      zone_id: zoneId,
      zone_name: zoneName,
      bucket_hour: bucketIso,
      requests: Number(row.sum?.requests) || 0,
      bytes: Number(row.sum?.bytes) || 0,
      cached_requests: Number(row.sum?.cachedRequests) || 0,
      status_1xx: s1,
      status_2xx: s2,
      status_3xx: s3,
      status_4xx: s4,
      status_5xx: s5,
      top_paths: [],
      top_countries: countries,
      created_at: nowIso,
      updated_at: nowIso
    });
  }

  // Also backfill daily aggregates for older days (up to 30d) if Cloudflare returns them
  const existing = await listCloudflareHourlySnapshots(zoneId, dailyStart.toISOString(), userToken).catch(
    () => []
  );
  const existingDays = new Set(existing.map((s) => s.bucket_hour.slice(0, 10)));
  for (const d of coveredDays) existingDays.add(d);

  const dailyQuery = `
    query SyncDaily($zoneTag: String!, $startDate: Date!, $endDate: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 40
            filter: { date_geq: $startDate, date_leq: $endDate }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum {
              requests
              bytes
              cachedRequests
              responseStatusMap { edgeResponseStatus requests }
              countryMap { clientCountryName requests }
            }
          }
        }
      }
    }
  `;

  const dRes = await runGraphQl<{
    viewer?: { zones?: Array<{ httpRequests1dGroups?: Cf1dRow[] }> };
  }>(token, dailyQuery, {
    zoneTag: zoneId,
    startDate: dailyStart.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10)
  }).catch(() => null);

  for (const row of dRes?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || []) {
    const dayStr = row.dimensions?.date;
    if (!dayStr || existingDays.has(dayStr)) continue;
    const reqs = Number(row.sum?.requests) || 0;
    if (reqs === 0) continue;

    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    for (const st of row.sum?.responseStatusMap || []) {
      const code = Number(st.edgeResponseStatus) || 0;
      const cnt = Number(st.requests) || 0;
      if (code >= 500) s5 += cnt;
      else if (code >= 400) s4 += cnt;
      else if (code >= 300) s3 += cnt;
      else if (code >= 200) s2 += cnt;
      else s1 += cnt;
    }

    const bucketIso = `${dayStr}T12:00:00.000Z`;
    snapshots.push({
      id: `${zoneId}:${bucketIso}`,
      zone_id: zoneId,
      zone_name: zoneName,
      bucket_hour: bucketIso,
      requests: reqs,
      bytes: Number(row.sum?.bytes) || 0,
      cached_requests: Number(row.sum?.cachedRequests) || 0,
      status_1xx: s1,
      status_2xx: s2,
      status_3xx: s3,
      status_4xx: s4,
      status_5xx: s5,
      top_paths: [],
      top_countries: (row.sum?.countryMap || [])
        .map((c) => ({ label: c.clientCountryName || 'Unknown', count: Number(c.requests) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      created_at: nowIso,
      updated_at: nowIso
    });
  }

  const syncedCount = await upsertCloudflareHourlySnapshots(snapshots, userToken);
  return { syncedCount, zoneId, zoneName };
}

function getSinceIsoForRange(range: CloudflareHistoryRange): string | undefined {
  const now = Date.now();
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '14d') return new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

function buildStatisticalBaseline(
  dailyHistory: CloudflareDailyHistoryPoint[]
): {
  forecast: CloudflareDailyForecastPoint[];
  trendPct: number | null;
} {
  const n = dailyHistory.length;
  const avgReqs =
    n > 0 ? dailyHistory.reduce((s, d) => s + d.requests, 0) / n : 0;
  const avgBytesPerReq =
    n > 0
      ? (() => {
          const totalReq = dailyHistory.reduce((s, d) => s + d.requests, 0);
          const totalBytes = dailyHistory.reduce((s, d) => s + d.bytes, 0);
          return totalReq > 0 ? totalBytes / totalReq : 1024;
        })()
      : 1024;

  // Least squares slope on daily requests
  let slope = 0;
  let intercept = avgReqs;
  if (n >= 2) {
    const meanX = (n - 1) / 2;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const dx = i - meanX;
      num += dx * (dailyHistory[i].requests - avgReqs);
      den += dx * dx;
    }
    slope = den > 0 ? num / den : 0;
    intercept = avgReqs - slope * meanX;
  }

  // Std dev for confidence band
  const variance =
    n > 1
      ? dailyHistory.reduce((s, d) => s + Math.pow(d.requests - avgReqs, 2), 0) / (n - 1)
      : Math.pow(Math.max(10, avgReqs * 0.25), 2);
  const stdDev = Math.sqrt(variance);

  // Day-of-week seasonality multiplier
  const dowTotals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  for (const d of dailyHistory) {
    const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    dowTotals[dow].sum += d.requests;
    dowTotals[dow].count += 1;
  }

  const lastDate =
    n > 0 ? new Date(`${dailyHistory[n - 1].date}T00:00:00Z`) : new Date();
  const forecast: CloudflareDailyForecastPoint[] = [];

  for (let step = 1; step <= 7; step++) {
    const targetDate = new Date(lastDate.getTime() + step * 24 * 60 * 60 * 1000);
    const isoDate = targetDate.toISOString().slice(0, 10);
    const label = targetDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
    const linearPred = Math.max(0, intercept + slope * (n - 1 + step));
    const dow = targetDate.getUTCDay();
    const dowAvg =
      dowTotals[dow].count > 0 ? dowTotals[dow].sum / dowTotals[dow].count : avgReqs;
    const seasonalFactor =
      avgReqs > 0 ? Math.min(1.45, Math.max(0.65, dowAvg / avgReqs)) : 1;

    const predictedRequests = Math.round(
      Math.max(0, linearPred * 0.65 + avgReqs * seasonalFactor * 0.35)
    );
    const band = Math.round(Math.max(predictedRequests * 0.18, stdDev * (0.7 + step * 0.08)));

    forecast.push({
      date: isoDate,
      label,
      predictedRequests,
      lowRequests: Math.max(0, predictedRequests - band),
      highRequests: predictedRequests + band,
      predictedBytes: Math.round(predictedRequests * avgBytesPerReq),
      rationale: `Statistical trend (${slope >= 0 ? '+' : ''}${Math.round(slope)} req/day) weighted with ${targetDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} seasonality`
    });
  }

  let trendPct: number | null = null;
  if (n >= 4) {
    const half = Math.floor(n / 2);
    const prevAvg =
      dailyHistory.slice(0, half).reduce((s, d) => s + d.requests, 0) / Math.max(1, half);
    const recentAvg =
      dailyHistory.slice(half).reduce((s, d) => s + d.requests, 0) / Math.max(1, n - half);
    if (prevAvg > 0) {
      trendPct = Number((((recentAvg - prevAvg) / prevAvg) * 100).toFixed(1));
    }
  }

  return { forecast, trendPct };
}

function detectStatisticalAnomalies(
  dailyHistory: CloudflareDailyHistoryPoint[]
): CloudflareTrafficAnomaly[] {
  const anomalies: CloudflareTrafficAnomaly[] = [];
  if (dailyHistory.length === 0) return anomalies;

  const avgReqs =
    dailyHistory.reduce((s, d) => s + d.requests, 0) / dailyHistory.length;

  for (const day of dailyHistory) {
    if (day.requests > Math.max(200, avgReqs * 1.65)) {
      anomalies.push({
        bucketLabel: day.label,
        severity: 'warning',
        title: `Traffic surge (${day.requests.toLocaleString()} requests)`,
        detail: `${Math.round((day.requests / Math.max(1, avgReqs) - 1) * 100)}% above period daily average.`
      });
    }
    if (day.requests >= 50 && day.error5xxRate >= 10) {
      anomalies.push({
        bucketLabel: day.label,
        severity: 'critical',
        title: `Elevated 5xx origin error rate (${day.error5xxRate}%)`,
        detail: `${day.status5xx.toLocaleString()} of ${day.requests.toLocaleString()} edge responses failed with 5xx.`
      });
    }
    if (day.requests >= 100 && day.status4xx / day.requests >= 0.4) {
      anomalies.push({
        bucketLabel: day.label,
        severity: 'info',
        title: `Automated probe / 4xx scanner activity (${Math.round((day.status4xx / day.requests) * 100)}%)`,
        detail: `${day.status4xx.toLocaleString()} 4xx responses (typical WordPress/.env/admin bot scans).`
      });
    }
  }

  return anomalies.slice(-6).reverse();
}

export async function getCloudflareHistoryAnalysis(
  range: CloudflareHistoryRange = '14d',
  userToken?: string
): Promise<CloudflareHistoryAnalysisResponse> {
  const { zoneId, zoneName, connected } = await resolveZoneIdentity(userToken);

  if (!connected || !zoneId) {
    return {
      connected: false,
      zoneId,
      zoneName,
      range,
      snapshotCount: 0,
      coverageStart: null,
      coverageEnd: null,
      summary: {
        totalRequests: 0,
        totalBytes: 0,
        avgDailyRequests: 0,
        peakDayLabel: '—',
        peakDayRequests: 0,
        peakHourUtc: 0,
        avgCacheHitRate: 0,
        avgError5xxRate: 0,
        requestTrendPct: null
      },
      dailyHistory: [],
      hourlyDistribution: [],
      weekdayDistribution: [],
      statisticalBaselineForecast: [],
      anomalies: [],
      aiForecast: null
    };
  }

  const sinceIso = getSinceIsoForRange(range);
  let snapshots = await listCloudflareHourlySnapshots(zoneId, sinceIso, userToken);

  // Auto-seed from Cloudflare GraphQL on first open if Supabase snapshots are empty
  if (snapshots.length === 0) {
    await syncCloudflareHistoricalSnapshots(userToken).catch(() => null);
    snapshots = await listCloudflareHourlySnapshots(zoneId, sinceIso, userToken);
  }

  const dailyMap = new Map<
    string,
    {
      requests: number;
      bytes: number;
      cached: number;
      s2: number;
      s4: number;
      s5: number;
    }
  >();

  const hourlyAgg = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }));
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayAgg = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));

  let totalRequests = 0;
  let totalBytes = 0;
  let totalCached = 0;
  let total5xx = 0;

  for (const snap of snapshots) {
    const d = new Date(snap.bucket_hour);
    if (Number.isNaN(d.getTime())) continue;
    const dayKey = snap.bucket_hour.slice(0, 10);
    const cur = dailyMap.get(dayKey) || {
      requests: 0,
      bytes: 0,
      cached: 0,
      s2: 0,
      s4: 0,
      s5: 0
    };
    cur.requests += snap.requests;
    cur.bytes += snap.bytes;
    cur.cached += snap.cached_requests;
    cur.s2 += snap.status_2xx;
    cur.s4 += snap.status_4xx;
    cur.s5 += snap.status_5xx;
    dailyMap.set(dayKey, cur);

    const hr = d.getUTCHours();
    hourlyAgg[hr].sum += snap.requests;
    hourlyAgg[hr].count += 1;

    const dow = d.getUTCDay();
    weekdayAgg[dow].sum += snap.requests;
    weekdayAgg[dow].count += 1;

    totalRequests += snap.requests;
    totalBytes += snap.bytes;
    totalCached += snap.cached_requests;
    total5xx += snap.status_5xx;
  }

  const dailyHistory: CloudflareDailyHistoryPoint[] = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, agg]) => ({
      date,
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      }),
      requests: agg.requests,
      bytes: agg.bytes,
      cachedRequests: agg.cached,
      cacheHitRate: agg.requests > 0 ? Number(((agg.cached / agg.requests) * 100).toFixed(2)) : 0,
      status2xx: agg.s2,
      status4xx: agg.s4,
      status5xx: agg.s5,
      error5xxRate: agg.requests > 0 ? Number(((agg.s5 / agg.requests) * 100).toFixed(2)) : 0
    }));

  const hourlyDistribution = hourlyAgg.map((bucket, hourUtc) => ({
    hourUtc,
    label: `${String(hourUtc).padStart(2, '0')}:00`,
    avgRequests: bucket.count > 0 ? Math.round(bucket.sum / bucket.count) : 0
  }));

  const weekdayDistribution = weekdayAgg.map((bucket, idx) => ({
    weekday: weekdayNames[idx],
    avgRequests: bucket.count > 0 ? Math.round(bucket.sum / bucket.count) : 0
  }));

  const peakDay = dailyHistory.reduce(
    (best, cur) => (cur.requests > best.requests ? cur : best),
    { label: '—', requests: 0 } as { label: string; requests: number }
  );

  const peakHour = hourlyDistribution.reduce(
    (best, cur) => (cur.avgRequests > best.avgRequests ? cur : best),
    { hourUtc: 0, avgRequests: 0 }
  );

  const { forecast: statisticalBaselineForecast, trendPct } =
    buildStatisticalBaseline(dailyHistory);
  const anomalies = detectStatisticalAnomalies(dailyHistory);
  const aiForecast = await getCloudflareAiForecast(zoneId, userToken).catch(() => null);

  return {
    connected: true,
    zoneId,
    zoneName,
    range,
    snapshotCount: snapshots.length,
    coverageStart: snapshots[0]?.bucket_hour || null,
    coverageEnd: snapshots[snapshots.length - 1]?.bucket_hour || null,
    summary: {
      totalRequests,
      totalBytes,
      avgDailyRequests:
        dailyHistory.length > 0 ? Math.round(totalRequests / dailyHistory.length) : 0,
      peakDayLabel: peakDay.label,
      peakDayRequests: peakDay.requests,
      peakHourUtc: peakHour.hourUtc,
      avgCacheHitRate:
        totalRequests > 0 ? Number(((totalCached / totalRequests) * 100).toFixed(2)) : 0,
      avgError5xxRate:
        totalRequests > 0 ? Number(((total5xx / totalRequests) * 100).toFixed(2)) : 0,
      requestTrendPct: trendPct
    },
    dailyHistory,
    hourlyDistribution,
    weekdayDistribution,
    statisticalBaselineForecast,
    anomalies,
    aiForecast
  };
}

export async function generateCloudflareAiForecast(
  range: CloudflareHistoryRange = '14d',
  userToken?: string
): Promise<CloudflareAiForecast> {
  // Always refresh snapshots first so Gemini analyzes the freshest Cloudflare telemetry
  await syncCloudflareHistoricalSnapshots(userToken).catch(() => null);
  const analysis = await getCloudflareHistoryAnalysis(range, userToken);
  if (!analysis.connected || !analysis.zoneId) {
    throw new Error('Cloudflare is not connected. Configure your API Token in Integrations Vault first.');
  }

  const baseline = analysis.statisticalBaselineForecast;
  const baselineSum7d = baseline.reduce((s, d) => s + d.predictedRequests, 0);
  const baselineBytes7d = baseline.reduce((s, d) => s + d.predictedBytes, 0);
  const trendDir: CloudflareAiForecast['trendDirection'] =
    (analysis.summary.requestTrendPct ?? 0) > 5
      ? 'up'
      : (analysis.summary.requestTrendPct ?? 0) < -5
        ? 'down'
        : 'steady';

  const fallbackForecast: CloudflareAiForecast = {
    zoneId: analysis.zoneId,
    zoneName: analysis.zoneName,
    modelUsed: 'statistical-regression-baseline',
    usedGemini: false,
    generatedAt: new Date().toISOString(),
    horizonDays: 7,
    rangeAnalyzed: range,
    trendDirection: trendDir,
    growthRatePct: analysis.summary.requestTrendPct ?? 0,
    confidencePct: analysis.dailyHistory.length >= 7 ? 74 : 58,
    expectedRequests7d: baselineSum7d,
    expectedBandwidth7dBytes: baselineBytes7d,
    executiveSummary:
      analysis.dailyHistory.length > 0
        ? `Based on ${analysis.snapshotCount} captured hourly snapshots for ${analysis.zoneName}, traffic averages ${analysis.summary.avgDailyRequests.toLocaleString()} requests/day (peak ${analysis.summary.peakDayRequests.toLocaleString()} on ${analysis.summary.peakDayLabel}, ${String(analysis.summary.peakHourUtc).padStart(2, '0')}:00 UTC). Cache hit rate sits at ${analysis.summary.avgCacheHitRate}% and 5xx errors at ${analysis.summary.avgError5xxRate}%.`
        : `Initial snapshot capture is running for ${analysis.zoneName}. Check back once more hourly data accumulates.`,
    trafficDrivers: [
      `Peak traffic occurs around ${String(analysis.summary.peakHourUtc).padStart(2, '0')}:00 UTC.`,
      `Average cache hit ratio is ${analysis.summary.avgCacheHitRate}% (${analysis.summary.avgCacheHitRate < 15 ? 'mostly dynamic origin hits' : 'healthy edge offload'}).`,
      `Average 5xx error ratio is ${analysis.summary.avgError5xxRate}%.`
    ],
    recommendations: [
      analysis.summary.avgCacheHitRate < 20
        ? 'Add Cloudflare Cache Rules for /assets/*, /insights/*, and public JSON responses to boost cache hit ratio above 40%.'
        : 'Maintain current edge cache rules and monitor cache bypass headers.',
      analysis.summary.avgError5xxRate > 2
        ? 'Investigate origin 5xx spikes (503/522/530) and enable Cloudflare Always Online + origin health alerts.'
        : 'Origin availability looks healthy; keep automated error rate monitoring enabled.',
      'Enable Bot Fight Mode or WAF Rate Limiting on wp-login/.env/xmlrpc scanner paths to cut wasted origin load.'
    ],
    anomalies: analysis.anomalies,
    dailyForecast: baseline
  };

  const vaultGeminiKey = await resolveIntegrationSecret('gemini', userToken).catch(() => '');
  const envGeminiKey =
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ? process.env.GEMINI_API_KEY.trim()
      : '';
  const apiKey = vaultGeminiKey || envGeminiKey;

  if (!apiKey) {
    const saved = await upsertCloudflareAiForecast(
      {
        ...fallbackForecast,
        fallbackNotice:
          'Showing statistical regression forecast because Gemini API key is not configured.'
      },
      userToken
    );
    return saved;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const promptPayload = {
      zoneName: analysis.zoneName,
      rangeAnalyzed: range,
      snapshotCount: analysis.snapshotCount,
      summary: analysis.summary,
      recentDailyHistory: analysis.dailyHistory.slice(-21),
      peakHoursUtc: [...analysis.hourlyDistribution]
        .sort((a, b) => b.avgRequests - a.avgRequests)
        .slice(0, 5),
      weekdayDistribution: analysis.weekdayDistribution,
      detectedAnomalies: analysis.anomalies,
      statisticalBaselineNext7Days: baseline
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this Cloudflare historical edge telemetry for ${analysis.zoneName} and produce a grounded 7-day forecast and actionable engineering plan:\n\n${JSON.stringify(promptPayload)}`,
      config: {
        systemInstruction:
          'You are a Principal Cloud & Edge SRE analyzing real Cloudflare HTTP telemetry. Stay strictly grounded in the provided historical numbers and statistical baseline. Give concise, concrete, domain-specific insights and Cloudflare optimization recommendations (Cache Rules, WAF, origin stability). Output valid JSON matching the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trendDirection: {
              type: Type.STRING,
              description: 'One of: up, steady, down'
            },
            growthRatePct: { type: Type.NUMBER },
            confidencePct: { type: Type.INTEGER },
            executiveSummary: { type: Type.STRING },
            trafficDrivers: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            dailyAdjustments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  predictedRequests: { type: Type.INTEGER },
                  rationale: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      trendDirection?: string;
      growthRatePct?: number;
      confidencePct?: number;
      executiveSummary?: string;
      trafficDrivers?: string[];
      recommendations?: string[];
      dailyAdjustments?: Array<{ date?: string; predictedRequests?: number; rationale?: string }>;
    };

    const adjMap = new Map<string, { predictedRequests?: number; rationale?: string }>();
    for (const item of parsed.dailyAdjustments || []) {
      if (item.date) adjMap.set(item.date, item);
    }

    const avgBytesPerReq =
      analysis.summary.totalRequests > 0
        ? analysis.summary.totalBytes / analysis.summary.totalRequests
        : 1024;

    const mergedDaily: CloudflareDailyForecastPoint[] = baseline.map((b) => {
      const adj = adjMap.get(b.date);
      const pred =
        adj?.predictedRequests && Number.isFinite(adj.predictedRequests) && adj.predictedRequests >= 0
          ? Math.round(adj.predictedRequests)
          : b.predictedRequests;
      const spread = Math.max(Math.round(pred * 0.2), Math.abs(b.highRequests - b.predictedRequests));
      return {
        date: b.date,
        label: b.label,
        predictedRequests: pred,
        lowRequests: Math.max(0, pred - spread),
        highRequests: pred + spread,
        predictedBytes: Math.round(pred * avgBytesPerReq),
        rationale: adj?.rationale?.trim() || b.rationale
      };
    });

    const dir: CloudflareAiForecast['trendDirection'] =
      parsed.trendDirection === 'up' || parsed.trendDirection === 'down'
        ? parsed.trendDirection
        : 'steady';

    const finalForecast: CloudflareAiForecast = {
      zoneId: analysis.zoneId,
      zoneName: analysis.zoneName,
      modelUsed: 'gemini-4-hydrogen',
      usedGemini: true,
      generatedAt: new Date().toISOString(),
      horizonDays: 7,
      rangeAnalyzed: range,
      trendDirection: dir,
      growthRatePct:
        typeof parsed.growthRatePct === 'number' && Number.isFinite(parsed.growthRatePct)
          ? Number(parsed.growthRatePct.toFixed(1))
          : fallbackForecast.growthRatePct,
      confidencePct: Math.min(
        95,
        Math.max(40, Math.round(Number(parsed.confidencePct) || fallbackForecast.confidencePct))
      ),
      expectedRequests7d: mergedDaily.reduce((s, d) => s + d.predictedRequests, 0),
      expectedBandwidth7dBytes: mergedDaily.reduce((s, d) => s + d.predictedBytes, 0),
      executiveSummary: parsed.executiveSummary?.trim() || fallbackForecast.executiveSummary,
      trafficDrivers:
        parsed.trafficDrivers && parsed.trafficDrivers.length > 0
          ? parsed.trafficDrivers.slice(0, 5)
          : fallbackForecast.trafficDrivers,
      recommendations:
        parsed.recommendations && parsed.recommendations.length > 0
          ? parsed.recommendations.slice(0, 5)
          : fallbackForecast.recommendations,
      anomalies: analysis.anomalies,
      dailyForecast: mergedDaily
    };

    return await upsertCloudflareAiForecast(finalForecast, userToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini call unavailable';
    return await upsertCloudflareAiForecast(
      {
        ...fallbackForecast,
        fallbackNotice: `Statistical forecast generated (Gemini AI fallback: ${msg.slice(0, 140)}).`
      },
      userToken
    );
  }
}

let snapshotTimerStarted = false;

export function startCloudflareAutoSnapshotLoop(): void {
  if (snapshotTimerStarted) return;
  snapshotTimerStarted = true;
  setInterval(() => {
    void (async () => {
      const allowed = await shouldRunLoopTick('cloudflare_snapshot');
      if (!allowed) return;
      await syncCloudflareHistoricalSnapshots();
      recordLoopOutcome('cloudflare_snapshot', 'executed');
    })().catch(() => {
      recordLoopOutcome('cloudflare_snapshot', 'error');
    });
  }, 60_000);
}
