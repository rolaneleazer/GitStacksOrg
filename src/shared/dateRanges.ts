import type { AnalyticsDatePreset } from './types.ts';

export interface ResolvedDateRange {
  preset: AnalyticsDatePreset;
  label: string;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC)
  startIso: string;
  endIso: string;
  ga4StartDate: string;
  ga4EndDate: string;
  bucketMode: 'minute' | 'hour' | 'day' | 'month';
  daysSpan: number;
}

export const ANALYTICS_DATE_PRESETS: Array<{
  id: AnalyticsDatePreset;
  label: string;
  shortLabel: string;
}> = [
  { id: 'realtime', label: 'Realtime (Last 30 min)', shortLabel: 'Realtime' },
  { id: 'today', label: 'Today', shortLabel: 'Today' },
  { id: 'yesterday', label: 'Yesterday', shortLabel: 'Yesterday' },
  { id: '7d', label: 'Last 7 Days', shortLabel: '7d' },
  { id: '14d', label: 'Last 14 Days', shortLabel: '14d' },
  { id: '28d', label: 'Last 28 Days', shortLabel: '28d' },
  { id: 'this_month', label: 'This Month', shortLabel: 'This Month' },
  { id: 'last_month', label: 'Last Month', shortLabel: 'Last Month' },
  { id: 'this_year', label: 'This Year (Jan – Today)', shortLabel: 'This Year' },
  { id: 'custom', label: 'Custom Range', shortLabel: 'Custom' }
];

function toUtcDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYyyyMmDd(raw?: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const parsed = new Date(`${raw.trim()}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveDateRangeBounds(
  presetInput?: string | null,
  customStart?: string | null,
  customEnd?: string | null,
  fallbackDays?: number
): ResolvedDateRange {
  const validPresets = new Set<AnalyticsDatePreset>([
    'realtime',
    'today',
    'yesterday',
    '7d',
    '14d',
    '28d',
    'this_month',
    'last_month',
    'this_year',
    'custom'
  ]);

  let preset: AnalyticsDatePreset =
    presetInput && validPresets.has(presetInput as AnalyticsDatePreset)
      ? (presetInput as AnalyticsDatePreset)
      : fallbackDays === 1
        ? 'today'
        : fallbackDays === 7
          ? '7d'
          : fallbackDays === 30
            ? '28d'
            : '14d';

  const now = new Date();
  const todayUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayStr = toUtcDateStr(todayUtcStart);

  if (preset === 'realtime') {
    const start = new Date(now.getTime() - 30 * 60 * 1000);
    return {
      preset,
      label: 'Realtime · Last 30 Minutes',
      startDate: todayStr,
      endDate: todayStr,
      startIso: start.toISOString(),
      endIso: now.toISOString(),
      ga4StartDate: todayStr,
      ga4EndDate: todayStr,
      bucketMode: 'minute',
      daysSpan: 1
    };
  }

  if (preset === 'today') {
    const end = new Date(todayUtcStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    return {
      preset,
      label: `Today (${todayStr})`,
      startDate: todayStr,
      endDate: todayStr,
      startIso: todayUtcStart.toISOString(),
      endIso: end.toISOString(),
      ga4StartDate: 'today',
      ga4EndDate: 'today',
      bucketMode: 'hour',
      daysSpan: 1
    };
  }

  if (preset === 'yesterday') {
    const yStart = new Date(todayUtcStart.getTime() - 24 * 60 * 60 * 1000);
    const yEnd = new Date(todayUtcStart.getTime() - 1);
    const yStr = toUtcDateStr(yStart);
    return {
      preset,
      label: `Yesterday (${yStr})`,
      startDate: yStr,
      endDate: yStr,
      startIso: yStart.toISOString(),
      endIso: yEnd.toISOString(),
      ga4StartDate: 'yesterday',
      ga4EndDate: 'yesterday',
      bucketMode: 'hour',
      daysSpan: 1
    };
  }

  if (preset === '7d' || preset === '14d' || preset === '28d') {
    const span = preset === '7d' ? 7 : preset === '28d' ? 28 : 14;
    const start = new Date(todayUtcStart.getTime() - (span - 1) * 24 * 60 * 60 * 1000);
    const end = new Date(todayUtcStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startStr = toUtcDateStr(start);
    return {
      preset,
      label: `Last ${span} Days (${startStr} – ${todayStr})`,
      startDate: startStr,
      endDate: todayStr,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      ga4StartDate: startStr,
      ga4EndDate: todayStr,
      bucketMode: 'day',
      daysSpan: span
    };
  }

  if (preset === 'this_month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(todayUtcStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startStr = toUtcDateStr(start);
    const daysSpan = Math.max(
      1,
      Math.round((todayUtcStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    return {
      preset,
      label: `This Month (${startStr} – ${todayStr})`,
      startDate: startStr,
      endDate: todayStr,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      ga4StartDate: startStr,
      ga4EndDate: todayStr,
      bucketMode: 'day',
      daysSpan
    };
  }

  if (preset === 'last_month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const endDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const end = new Date(endDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startStr = toUtcDateStr(start);
    const endStr = toUtcDateStr(endDay);
    const daysSpan = Math.max(
      1,
      Math.round((endDay.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    return {
      preset,
      label: `Last Month (${startStr} – ${endStr})`,
      startDate: startStr,
      endDate: endStr,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      ga4StartDate: startStr,
      ga4EndDate: endStr,
      bucketMode: 'day',
      daysSpan
    };
  }

  if (preset === 'this_year') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const end = new Date(todayUtcStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startStr = toUtcDateStr(start);
    const daysSpan = Math.max(
      1,
      Math.round((todayUtcStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    return {
      preset,
      label: `This Year (${startStr} – ${todayStr})`,
      startDate: startStr,
      endDate: todayStr,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      ga4StartDate: startStr,
      ga4EndDate: todayStr,
      bucketMode: daysSpan > 62 ? 'month' : 'day',
      daysSpan
    };
  }

  // Custom date range
  const parsedStart = parseYyyyMmDd(customStart) || new Date(todayUtcStart.getTime() - 13 * 24 * 60 * 60 * 1000);
  const parsedEnd = parseYyyyMmDd(customEnd) || todayUtcStart;
  const orderedStart = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
  const orderedEnd = parsedStart <= parsedEnd ? parsedEnd : parsedStart;
  const endInclusive = new Date(orderedEnd.getTime() + 24 * 60 * 60 * 1000 - 1);
  const startStr = toUtcDateStr(orderedStart);
  const endStr = toUtcDateStr(orderedEnd);
  const daysSpan = Math.max(
    1,
    Math.round((orderedEnd.getTime() - orderedStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  return {
    preset: 'custom',
    label: `Custom (${startStr} – ${endStr})`,
    startDate: startStr,
    endDate: endStr,
    startIso: orderedStart.toISOString(),
    endIso: endInclusive.toISOString(),
    ga4StartDate: startStr,
    ga4EndDate: endStr,
    bucketMode: daysSpan <= 2 ? 'hour' : daysSpan > 90 ? 'month' : 'day',
    daysSpan
  };
}
