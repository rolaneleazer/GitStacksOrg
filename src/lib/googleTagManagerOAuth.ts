import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  GtmContainerOption,
  GtmTagSummary,
  GtmTriggerSummary,
  GtmVariableSummary,
  GtmWorkspaceSnapshot
} from '../shared/types.ts';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const gtmProvider = new GoogleAuthProvider();
gtmProvider.addScope('https://www.googleapis.com/auth/tagmanager.readonly');
gtmProvider.setCustomParameters({ prompt: 'select_account' });

const GTM_API_BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';

let cachedGtmAccessToken: string | null = null;

export function getCachedGtmAccessToken(): string | null {
  return cachedGtmAccessToken;
}

async function fetchGtmJson<T>(url: string, accessToken: string): Promise<{ ok: boolean; status: number; data?: T; errorText?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, status: res.status, errorText: errBody };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      errorText: err instanceof Error ? err.message : 'Network error'
    };
  }
}

export async function discoverGtmContainers(accessToken: string): Promise<{
  containers: GtmContainerOption[];
  apiNote?: string;
}> {
  const accountsRes = await fetchGtmJson<{
    account?: Array<{
      accountId?: string;
      name?: string;
    }>;
  }>(`${GTM_API_BASE}/accounts`, accessToken);

  if (!accountsRes.ok) {
    const reason =
      accountsRes.status === 403
        ? 'Google Tag Manager API v2 returned 403 Forbidden. Ensure Tag Manager API is enabled or grant tagmanager.readonly scope.'
        : `Google Tag Manager API returned HTTP ${accountsRes.status || 'network error'}.`;
    return { containers: [], apiNote: reason };
  }

  const accounts = accountsRes.data?.account || [];
  if (accounts.length === 0) {
    return {
      containers: [],
      apiNote: 'Authenticated Google Account has zero Google Tag Manager accounts.'
    };
  }

  const discovered: GtmContainerOption[] = [];

  for (const acct of accounts.slice(0, 8)) {
    const accountId = String(acct.accountId || '').trim();
    if (!accountId) continue;
    const accountName = acct.name || `GTM Account ${accountId}`;

    const containersRes = await fetchGtmJson<{
      container?: Array<{
        containerId?: string;
        publicId?: string;
        name?: string;
        usageContext?: string[];
      }>;
    }>(`${GTM_API_BASE}/accounts/${encodeURIComponent(accountId)}/containers`, accessToken);

    if (!containersRes.ok) continue;

    for (const c of containersRes.data?.container || []) {
      const containerId = String(c.containerId || '').trim();
      if (!containerId) continue;

      let workspaceId = '1';
      let workspaceName = 'Default Workspace';

      const wsRes = await fetchGtmJson<{
        workspace?: Array<{
          workspaceId?: string;
          name?: string;
        }>;
      }>(
        `${GTM_API_BASE}/accounts/${encodeURIComponent(accountId)}/containers/${encodeURIComponent(containerId)}/workspaces`,
        accessToken
      );

      if (wsRes.ok && wsRes.data?.workspace && wsRes.data.workspace.length > 0) {
        workspaceId = String(wsRes.data.workspace[0].workspaceId || '1');
        workspaceName = wsRes.data.workspace[0].name || 'Default Workspace';
      }

      discovered.push({
        accountId,
        accountName,
        containerId,
        publicId: String(c.publicId || '').toUpperCase(),
        name: c.name || c.publicId || containerId,
        usageContext: Array.isArray(c.usageContext) ? c.usageContext : ['web'],
        workspaceId,
        workspaceName
      });
    }
  }

  return {
    containers: discovered,
    apiNote:
      discovered.length === 0
        ? 'No GTM containers were found under the signed-in Google account.'
        : undefined
  };
}

export async function fetchGtmWorkspaceSnapshot(
  accessToken: string,
  container: GtmContainerOption
): Promise<GtmWorkspaceSnapshot> {
  const baseWs = `${GTM_API_BASE}/accounts/${encodeURIComponent(container.accountId)}/containers/${encodeURIComponent(container.containerId)}/workspaces/${encodeURIComponent(container.workspaceId || '1')}`;

  const [tagsRes, triggersRes, varsRes] = await Promise.all([
    fetchGtmJson<{
      tag?: Array<{
        tagId?: string;
        name?: string;
        type?: string;
        paused?: boolean;
        firingTriggerId?: string[];
        tagFiringOption?: string;
      }>;
    }>(`${baseWs}/tags`, accessToken),
    fetchGtmJson<{
      trigger?: Array<{
        triggerId?: string;
        name?: string;
        type?: string;
      }>;
    }>(`${baseWs}/triggers`, accessToken),
    fetchGtmJson<{
      variable?: Array<{
        variableId?: string;
        name?: string;
        type?: string;
      }>;
    }>(`${baseWs}/variables`, accessToken)
  ]);

  const tags: GtmTagSummary[] = (tagsRes.data?.tag || []).map((t) => ({
    tagId: String(t.tagId || ''),
    name: t.name || 'Untitled Tag',
    type: t.type || 'unknown',
    paused: Boolean(t.paused),
    firingTriggerId: Array.isArray(t.firingTriggerId) ? t.firingTriggerId : [],
    tagFiringOption: t.tagFiringOption
  }));

  const triggers: GtmTriggerSummary[] = (triggersRes.data?.trigger || []).map((tr) => ({
    triggerId: String(tr.triggerId || ''),
    name: tr.name || 'Untitled Trigger',
    type: tr.type || 'unknown'
  }));

  const variables: GtmVariableSummary[] = (varsRes.data?.variable || []).map((v) => ({
    variableId: String(v.variableId || ''),
    name: v.name || 'Untitled Variable',
    type: v.type || 'unknown'
  }));

  let note: string | undefined;
  if (!tagsRes.ok && !triggersRes.ok && !varsRes.ok) {
    note = `Unable to inspect workspace items (HTTP ${tagsRes.status || 'network'}). Verify tagmanager.readonly consent.`;
  }

  return {
    accountId: container.accountId,
    accountName: container.accountName,
    containerId: container.containerId,
    publicId: container.publicId,
    containerName: container.name,
    workspaceId: container.workspaceId,
    workspaceName: container.workspaceName,
    syncedAt: new Date().toISOString(),
    tags,
    triggers,
    variables,
    note
  };
}

export async function signInWithGoogleTagManagerPopup(preferredPublicId = 'GTM-MFP3W7MS'): Promise<{
  email: string;
  displayName: string;
  accessToken: string;
  containers: GtmContainerOption[];
  selectedContainer: GtmContainerOption | null;
  snapshot: GtmWorkspaceSnapshot | null;
  apiNote?: string;
}> {
  const result = await signInWithPopup(auth, gtmProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || '';
  if (!token) {
    throw new Error('Google OAuth did not return a Tag Manager API access token.');
  }
  cachedGtmAccessToken = token;

  const { containers, apiNote } = await discoverGtmContainers(token);
  const preferredClean = preferredPublicId.trim().toUpperCase();
  const selectedContainer =
    containers.find((c) => c.publicId === preferredClean) || containers[0] || null;

  let snapshot: GtmWorkspaceSnapshot | null = null;
  if (selectedContainer) {
    snapshot = await fetchGtmWorkspaceSnapshot(token, selectedContainer);
  }

  return {
    email: result.user.email || '',
    displayName: result.user.displayName || 'GTM Operator',
    accessToken: token,
    containers,
    selectedContainer,
    snapshot,
    apiNote
  };
}

export function clearGtmOAuthToken() {
  cachedGtmAccessToken = null;
}
