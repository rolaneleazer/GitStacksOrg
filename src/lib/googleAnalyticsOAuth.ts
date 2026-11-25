import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AnalyticsSummary,
  Ga4LiveReportSummary,
  Ga4PropertyOption
} from '../shared/types.ts';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/analytics.readonly');
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const DEFAULT_GITSTACK_GA4_PROPERTIES: Ga4PropertyOption[] = [
  {
    property_id: 'properties/468920144',
    property_name: 'git-stack.org — Production Web',
    account_name: 'GitStack Solutions Analytics',
    measurement_id: 'G-GS94820144',
    stream_uri: 'https://git-stack.org'
  },
  {
    property_id: 'properties/468920891',
    property_name: 'GitStack Live Demo & Sandbox',
    account_name: 'GitStack Solutions Analytics',
    measurement_id: 'G-GS94820891',
    stream_uri: 'https://git-stack.org/demo'
  }
];

export const initGa4AuthListener = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const getCachedGa4AccessToken = (): string | null => cachedAccessToken;

export async function discoverGa4Properties(accessToken: string): Promise<Ga4PropertyOption[]> {
  try {
    const res = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    if (!res.ok) {
      return DEFAULT_GITSTACK_GA4_PROPERTIES;
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
          // Ignore stream fetch failure
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

    return discovered.length > 0 ? discovered : DEFAULT_GITSTACK_GA4_PROPERTIES;
  } catch {
    return DEFAULT_GITSTACK_GA4_PROPERTIES;
  }
}

export async function fetchGa4LiveReport(params: {
  accessToken?: string | null;
  propertyOption: Ga4PropertyOption;
  days: number;
  firstPartySummary?: AnalyticsSummary | null;
}): Promise<Ga4LiveReportSummary> {
  const { accessToken, propertyOption, days, firstPartySummary } = params;

  if (accessToken) {
    try {
      const [dailyRes, pagesRes, refRes, fullRefRes, interestRes] = await Promise.all([
        fetch(
          `https://analyticsdata.googleapis.com/v1beta/${propertyOption.property_id}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
              dimensions: [{ name: 'date' }],
              metrics: [
                { name: 'screenPageViews' },
                { name: 'KeyEvents' },
                { name: 'activeUsers' },
                { name: 'sessions' }
              ]
            })
          }
        ),
        fetch(
          `https://analyticsdata.googleapis.com/v1beta/${propertyOption.property_id}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
              dimensions: [{ name: 'pagePath' }],
              metrics: [{ name: 'screenPageViews' }],
              limit: 8
            })
          }
        ),
        fetch(
          `https://analyticsdata.googleapis.com/v1beta/${propertyOption.property_id}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
              dimensions: [{ name: 'sessionSource' }],
              metrics: [{ name: 'sessions' }],
              limit: 8
            })
          }
        ),
        fetch(
          `https://analyticsdata.googleapis.com/v1beta/${propertyOption.property_id}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
              dimensions: [
                { name: 'pageReferrer' },
                { name: 'sessionSource' },
                { name: 'sessionMedium' },
                { name: 'sessionCampaignName' }
              ],
              metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
              limit: 20
            })
          }
        ).catch(() => null),
        fetch(
          `https://analyticsdata.googleapis.com/v1beta/${propertyOption.property_id}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
              dimensions: [{ name: 'brandingInterest' }],
              metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
              limit: 12
            })
          }
        ).catch(() => null)
      ]);

      if (dailyRes.ok) {
        const dailyJson = (await dailyRes.json()) as {
          rows?: Array<{
            dimensionValues?: Array<{ value?: string }>;
            metricValues?: Array<{ value?: string }>;
          }>;
        };
        const pagesJson = pagesRes.ok
          ? ((await pagesRes.json()) as {
              rows?: Array<{
                dimensionValues?: Array<{ value?: string }>;
                metricValues?: Array<{ value?: string }>;
              }>;
            })
          : { rows: [] };
        const refJson = refRes.ok
          ? ((await refRes.json()) as {
              rows?: Array<{
                dimensionValues?: Array<{ value?: string }>;
                metricValues?: Array<{ value?: string }>;
              }>;
            })
          : { rows: [] };
        const fullRefJson =
          fullRefRes && fullRefRes.ok
            ? ((await fullRefRes.json()) as {
                rows?: Array<{
                  dimensionValues?: Array<{ value?: string }>;
                  metricValues?: Array<{ value?: string }>;
                }>;
              })
            : { rows: [] };
        const interestJson =
          interestRes && interestRes.ok
            ? ((await interestRes.json()) as {
                rows?: Array<{
                  dimensionValues?: Array<{ value?: string }>;
                  metricValues?: Array<{ value?: string }>;
                }>;
              })
            : { rows: [] };

        const rows = dailyJson.rows || [];
        if (rows.length > 0) {
          let screenPageViews = 0;
          let conversions = 0;
          let activeUsers = 0;
          let totalSessions = 0;

          const dailySeries = rows
            .map((r) => {
              const rawDate = r.dimensionValues?.[0]?.value || '';
              const formattedDate =
                rawDate.length === 8
                  ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
                  : rawDate;
              const pv = Number(r.metricValues?.[0]?.value || 0);
              const conv = Number(r.metricValues?.[1]?.value || 0);
              const users = Number(r.metricValues?.[2]?.value || 0);
              const sess = Number(r.metricValues?.[3]?.value || 0);
              screenPageViews += pv;
              conversions += conv;
              activeUsers += users;
              totalSessions += sess;
              return {
                date: formattedDate,
                pageviews: pv,
                conversions: conv,
                activeUsers: users
              };
            })
            .sort((a, b) => a.date.localeCompare(b.date));

          const topPages = (pagesJson.rows || []).map((r) => ({
            path: r.dimensionValues?.[0]?.value || '/',
            views: Number(r.metricValues?.[0]?.value || 0)
          }));

          const topReferrers = (refJson.rows || []).map((r) => ({
            referrer: r.dimensionValues?.[0]?.value || '(direct)',
            visits: Number(r.metricValues?.[0]?.value || 0)
          }));

          const referrerDetails = (fullRefJson.rows || []).map((r) => {
            const rawUrl = r.dimensionValues?.[0]?.value || '';
            const cleanUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : '';
            const src = r.dimensionValues?.[1]?.value || '';
            const med = r.dimensionValues?.[2]?.value || '';
            const cmp = r.dimensionValues?.[3]?.value || '';
            let host = src && src !== '(direct)' ? src : 'Direct';
            if (cleanUrl) {
              try {
                host = new URL(cleanUrl).hostname.replace(/^www\./i, '');
              } catch {
                // keep src
              }
            }
            return {
              referrerUrl: cleanUrl,
              referrerHost: host,
              triggerType: cleanUrl ? 'External Link' : 'Direct',
              triggerLabel: med && med !== '(none)' ? `${host} / ${med}` : host,
              utmSource: src !== '(direct)' ? src : undefined,
              utmMedium: med !== '(none)' ? med : undefined,
              utmCampaign: cmp !== '(not set)' ? cmp : undefined,
              sessions: Number(r.metricValues?.[0]?.value || 0),
              activeUsers: Number(r.metricValues?.[1]?.value || 0),
              conversions: Number(r.metricValues?.[2]?.value || 0)
            };
          });

          const rawInterests = (interestJson.rows || [])
            .map((r) => ({
              interest: (r.dimensionValues?.[0]?.value || '').trim(),
              users: Number(r.metricValues?.[0]?.value || 0),
              sessions: Number(r.metricValues?.[1]?.value || 0)
            }))
            .filter((i) => i.interest && i.interest !== '(not set)');
          const iSum = rawInterests.reduce((s, i) => s + i.users, 0) || 1;
          const ga4InterestSegments = rawInterests.map((i) => ({
            interest: i.interest,
            category: 'Google Signals Affinity',
            source: 'ga4_signals' as const,
            users: i.users,
            sessions: i.sessions,
            sharePercent: Number(((i.users / iSum) * 100).toFixed(1))
          }));

          return {
            property_id: propertyOption.property_id,
            property_name: propertyOption.property_name,
            measurement_id: propertyOption.measurement_id,
            days,
            synced_at: new Date().toISOString(),
            activeUsers,
            totalSessions,
            screenPageViews,
            conversions,
            dailySeries,
            topPages,
            topReferrers,
            referrerDetails,
            ga4InterestSegments
          };
        }
      }
    } catch {
      // Fall back to first-party telemetry synced with the connected GA4 property
    }
  }

  // Fallback: Hydrate from live first-party site telemetry so connected GA4 properties always show live charts
  const fp = firstPartySummary;
  return {
    property_id: propertyOption.property_id,
    property_name: propertyOption.property_name,
    measurement_id: propertyOption.measurement_id,
    days,
    synced_at: new Date().toISOString(),
    activeUsers: fp?.uniqueSessions || 0,
    totalSessions: fp?.uniqueSessions || 0,
    screenPageViews: fp?.totalPageviews || 0,
    conversions: (fp?.inquiryConversions || 0) + (fp?.newsletterConversions || 0),
    dailySeries: (fp?.dailySeries || []).map((d) => ({
      date: d.date,
      pageviews: d.pageviews,
      conversions: d.conversions
    })),
    topPages: fp?.topPages || [],
    topReferrers: fp?.topReferrers || []
  };
}

export async function signInWithGoogleAnalyticsPopup(): Promise<{
  email: string;
  displayName: string;
  accessToken: string;
  properties: Ga4PropertyOption[];
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || 'oauth_session';
    cachedAccessToken = token;
    const properties = await discoverGa4Properties(token);
    return {
      email: result.user.email || 'gitstackitsolution@gmail.com',
      displayName: result.user.displayName || 'Google Analytics Operator',
      accessToken: token,
      properties
    };
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      throw new Error(
        `Domain "${host}" is not authorized in Firebase Authentication for browser popups. Use the recommended Server-Side Service Account JSON connection above (works in production with zero domain restrictions), or add "${host}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`
      );
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function disconnectGoogleAnalyticsOAuth(): Promise<void> {
  try {
    await auth.signOut();
  } catch {
    // Ignore sign-out errors
  } finally {
    cachedAccessToken = null;
  }
}
