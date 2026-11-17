import type { AdSenseSettings, GtmEventCategory } from '../shared/types.ts';
import type { ConsentPreference } from '../components/AdSenseCompliance.tsx';

export const DEFAULT_GTM_CONTAINER_ID = 'GTM-MFP3W7MS';

interface BufferedGtmEvent {
  event_name: string;
  event_category: GtmEventCategory;
  page_path: string;
  page_title: string;
  session_id: string;
  is_conversion: boolean;
  payload: Record<string, unknown>;
  created_at: string;
}

const SESSION_ID_KEY = 'gitstack_visitor_sid';
const CONVERSION_EVENTS = new Set([
  'inquiry_submitted',
  'newsletter_subscribed',
  'demo_signup',
  'demo_sandbox_action',
  'buy_me_a_coffee_click',
  'consultation_booked',
  'generate_lead',
  'sign_up',
  'purchase',
  'conversion'
]);
const PAGEVIEW_EVENTS = new Set(['page_view', 'pageview', 'virtual_pageview', 'gtag_config']);
const LIFECYCLE_EVENTS = new Set([
  'gtm.js',
  'gtm.dom',
  'gtm.load',
  'gtag_js',
  'gtm_initialized'
]);
const ENGAGEMENT_EVENTS = new Set([
  'scroll_depth',
  'cta_click',
  'comment_submitted',
  'article_read',
  'chat_started',
  'gtm.click',
  'gtm.linkClick'
]);

let runtimeEnabled = true;
let runtimeContainerId = DEFAULT_GTM_CONTAINER_ID;
let runtimeTrackDataLayer = true;
let runtimeTrackConversions = true;
let runtimeExcludeAdmin = true;
let gtagJsInitialized = false;
let lastTrackedRoute = '';
let flushTimer: number | null = null;
const eventQueue: BufferedGtmEvent[] = [];
const recentLocalEvents: BufferedGtmEvent[] = [];

function getVisitorSessionId(): string {
  try {
    let sid = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = `vis-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_ID_KEY, sid);
    }
    return sid;
  } catch {
    return 'vis-anon';
  }
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/obama') || pathname.startsWith('/studio');
}

function sanitizeJsonValue(val: unknown, depth = 0): unknown {
  if (depth > 3) return '[Nested]';
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val.slice(0, 300);
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) {
    return val.slice(0, 12).map((item) => sanitizeJsonValue(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (count >= 16) break;
      if (typeof v === 'function') continue;
      out[k.slice(0, 60)] = sanitizeJsonValue(v, depth + 1);
      count++;
    }
    return out;
  }
  return String(val).slice(0, 120);
}

function parseDataLayerEntry(entry: unknown): {
  event_name: string;
  event_category: GtmEventCategory;
  is_conversion: boolean;
  payload: Record<string, unknown>;
} | null {
  if (!entry) return null;

  let eventName = '';
  let payload: Record<string, unknown> = {};

  // Handle Arguments object or array pushed by gtag(...)
  const isArgumentsLike =
    typeof entry === 'object' &&
    entry !== null &&
    ('callee' in entry || Array.isArray(entry)) &&
    typeof (entry as ArrayLike<unknown>).length === 'number';

  if (isArgumentsLike) {
    const arr = Array.from(entry as ArrayLike<unknown>);
    const cmd = String(arr[0] || '').trim();
    if (cmd === 'js') {
      eventName = 'gtag_js';
      payload = {
        command: 'js',
        timestamp: arr[1] instanceof Date ? arr[1].toISOString() : String(arr[1] || '')
      };
    } else if (cmd === 'config') {
      eventName = 'gtag_config';
      payload = {
        command: 'config',
        target_id: String(arr[1] || ''),
        ...(typeof arr[2] === 'object' && arr[2] ? (sanitizeJsonValue(arr[2]) as Record<string, unknown>) : {})
      };
    } else if (cmd === 'event') {
      eventName = String(arr[1] || 'gtag_event').trim();
      const extra =
        typeof arr[2] === 'object' && arr[2]
          ? (sanitizeJsonValue(arr[2]) as Record<string, unknown>)
          : {};
      payload = { command: 'event', event_name: eventName, ...extra };
    } else {
      eventName = cmd ? `gtag_${cmd}` : 'datalayer_array';
      payload = { args: sanitizeJsonValue(arr) as unknown };
    }
  } else if (typeof entry === 'object') {
    const rec = sanitizeJsonValue(entry) as Record<string, unknown>;
    if (typeof rec.event === 'string' && rec.event.trim()) {
      eventName = rec.event.trim();
    } else if ('gtm.start' in rec) {
      eventName = 'gtm.js';
    } else {
      eventName = 'datalayer_push';
    }
    payload = rec;
  } else {
    return null;
  }

  if (!eventName) return null;

  let category: GtmEventCategory = 'custom';
  const explicitConversion = Boolean(payload.is_conversion);
  const isConv =
    explicitConversion || CONVERSION_EVENTS.has(eventName) || eventName.includes('conversion');

  if (isConv) {
    category = 'conversion';
  } else if (PAGEVIEW_EVENTS.has(eventName)) {
    category = 'pageview';
  } else if (LIFECYCLE_EVENTS.has(eventName)) {
    category = 'lifecycle';
  } else if (ENGAGEMENT_EVENTS.has(eventName)) {
    category = 'engagement';
  }

  return {
    event_name: eventName.slice(0, 100),
    event_category: category,
    is_conversion: isConv,
    payload
  };
}

function enqueueCapturedEvent(entry: unknown, forceRecord = false) {
  if (!runtimeEnabled || !runtimeTrackDataLayer) return;
  if (typeof window === 'undefined') return;

  const currentPath = window.location.pathname || '/';
  if (!forceRecord && runtimeExcludeAdmin && isAdminPath(currentPath)) {
    return;
  }

  const parsed = parseDataLayerEntry(entry);
  if (!parsed) return;
  if (parsed.is_conversion && !runtimeTrackConversions && !forceRecord) {
    // Still capture as non-conversion or respect conversion flag: record but mark conversion flag false
    parsed.is_conversion = false;
  }

  let visitorId = getVisitorSessionId();
  let isReturning = false;
  let landingPage = currentPath;
  let timezone = 'UTC';
  try {
    const existingVid = window.localStorage.getItem('gitstack_visitor_uid');
    const firstSeenStr = window.localStorage.getItem('gitstack_visitor_first_seen');
    if (existingVid) {
      visitorId = existingVid;
      const firstSeenMs = Number(firstSeenStr || 0);
      if (firstSeenMs > 0 && Date.now() - firstSeenMs > 30 * 60 * 1000) {
        isReturning = true;
      }
    }
    landingPage = window.sessionStorage.getItem('gitstack_landing_page') || currentPath;
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // ignore storage limits
  }
  const width = window.innerWidth || 1280;
  const deviceType = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

  const record: BufferedGtmEvent = {
    event_name: parsed.event_name,
    event_category: parsed.event_category,
    page_path: currentPath,
    page_title: typeof document !== 'undefined' ? document.title.slice(0, 160) : '',
    session_id: getVisitorSessionId(),
    is_conversion: parsed.is_conversion,
    payload: {
      visitor_id: visitorId,
      is_returning: isReturning,
      landing_page: landingPage,
      device_type: deviceType,
      timezone,
      referrer: (typeof document !== 'undefined' ? document.referrer : '') || 'direct',
      ...parsed.payload
    },
    created_at: new Date().toISOString()
  };

  recentLocalEvents.unshift(record);
  if (recentLocalEvents.length > 100) {
    recentLocalEvents.length = 100;
  }

  eventQueue.push(record);
  if (parsed.is_conversion || eventQueue.length >= 8) {
    flushGtmEvents();
  } else {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (typeof window === 'undefined' || flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushGtmEvents();
  }, 1200);
}

export function flushGtmEvents() {
  if (typeof window === 'undefined' || eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, 25);
  const body = JSON.stringify({
    container_id: runtimeContainerId,
    events: batch
  });

  try {
    fetch('/api/public/gtm/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // ignore transport errors
  }
}

function installDataLayerInterceptor() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  const dl = window.dataLayer as unknown[] & { __gitstackWrapped?: boolean };
  if (dl.__gitstackWrapped) return;

  const originalPush = dl.push.bind(dl);
  dl.push = function wrappedPush(...items: unknown[]) {
    const res = originalPush(...items);
    for (const item of items) {
      try {
        enqueueCapturedEvent(item);
      } catch {
        // ignore telemetry capture errors
      }
    }
    return res;
  };
  dl.__gitstackWrapped = true;

  window.addEventListener('pagehide', () => flushGtmEvents());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushGtmEvents();
  });
}

export function initOrUpdateGtmRuntime(
  settings: AdSenseSettings | null,
  consent: ConsentPreference,
  route: string
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const containerId = (settings?.gtm_container_id || DEFAULT_GTM_CONTAINER_ID)
    .trim()
    .toUpperCase();
  const enabled = settings?.gtm_enabled !== undefined ? Boolean(settings.gtm_enabled) : true;
  const trackDataLayer =
    settings?.gtm_track_datalayer !== undefined ? Boolean(settings.gtm_track_datalayer) : true;
  const trackConversions =
    settings?.gtm_track_conversions !== undefined ? Boolean(settings.gtm_track_conversions) : true;
  const respectConsent = Boolean(settings?.gtm_respect_consent);
  const excludeAdmin =
    settings?.gtm_exclude_admin !== undefined ? Boolean(settings.gtm_exclude_admin) : true;

  runtimeEnabled = enabled;
  runtimeContainerId = /^GTM-[A-Z0-9]{4,12}$/.test(containerId)
    ? containerId
    : DEFAULT_GTM_CONTAINER_ID;
  runtimeTrackDataLayer = trackDataLayer;
  runtimeTrackConversions = trackConversions;
  runtimeExcludeAdmin = excludeAdmin;

  if (!enabled) return;
  if (respectConsent && consent !== 'all') return;
  if (excludeAdmin && isAdminPath(route)) return;

  installDataLayerInterceptor();

  // Ensure global gtag function matches the exact user snippet
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(args);
    };
  }

  // Inject or update the async GTM container script
  const existingScript = document.getElementById('gitstack-gtm-script') as HTMLScriptElement | null;
  const targetSrc = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(runtimeContainerId)}`;

  if (!existingScript) {
    window.dataLayer?.push({
      'gtm.start': Date.now(),
      event: 'gtm.js'
    });

    const script = document.createElement('script');
    script.id = 'gitstack-gtm-script';
    script.dataset.containerId = runtimeContainerId;
    script.async = true;
    script.src = targetSrc;
    document.head.appendChild(script);
  } else if (existingScript.dataset.containerId !== runtimeContainerId) {
    existingScript.remove();
    const script = document.createElement('script');
    script.id = 'gitstack-gtm-script';
    script.dataset.containerId = runtimeContainerId;
    script.async = true;
    script.src = targetSrc;
    document.head.appendChild(script);
  }

  if (existingScript) {
    existingScript.dataset.containerId = runtimeContainerId;
  }

  if (!gtagJsInitialized) {
    gtagJsInitialized = true;
    window.gtag('js', new Date());
  }

  const normalizedRoute = route || '/';
  if (lastTrackedRoute !== normalizedRoute) {
    lastTrackedRoute = normalizedRoute;
    window.dataLayer?.push({
      event: 'page_view',
      page_path: normalizedRoute,
      page_title: document.title || 'GitStack',
      container_id: runtimeContainerId
    });
  }
}

export function pushGtmEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  options?: { isConversion?: boolean }
) {
  if (typeof window === 'undefined') return;
  installDataLayerInterceptor();

  const payload = {
    event: eventName,
    page_path: window.location.pathname || '/',
    container_id: runtimeContainerId,
    ...(options?.isConversion ? { is_conversion: true } : {}),
    ...params
  };
  window.dataLayer?.push(payload);
}

export function getRecentClientDataLayerEvents(): BufferedGtmEvent[] {
  return [...recentLocalEvents];
}

export function getGtmSnippetString(containerId = DEFAULT_GTM_CONTAINER_ID): string {
  const safeId = (containerId || DEFAULT_GTM_CONTAINER_ID).trim().toUpperCase();
  return `<script async src="https://www.googletagmanager.com/gtm.js?id=${safeId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
</script>`;
}
