import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GMAIL_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'select_account' });

// Strictly in-memory OAuth token caching per Workspace Integration rules
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface GmailHeaderSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  bodyText: string;
  unread: boolean;
}

export function initGmailAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) cachedAccessToken = null;
      if (!cachedAccessToken) onAuthFailure?.();
    }
  });
}

export async function connectGmailWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google sign-in completed, but no Gmail access token was returned.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function disconnectGmail(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export function getCachedGmailToken(): string | null {
  return cachedAccessToken;
}

function decodeBase64Url(input: string): string {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(normalized);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
  headers?: { name: string; value: string }[];
}

function extractBodyText(payload?: GmailPayloadPart): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const found = extractBodyText(part);
      if (found) return found;
    }
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

export async function listGmailMessages(
  accessToken: string,
  query = '',
  maxResults = 15
): Promise<GmailHeaderSummary[]> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query.trim()) params.set('q', query.trim());

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (listRes.status === 401) {
    cachedAccessToken = null;
    throw new Error('Gmail session expired. Please reconnect with Google.');
  }
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to load Gmail messages (${listRes.status})`);
  }

  const listData = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  const ids = (listData.messages || []).slice(0, maxResults);
  if (ids.length === 0) return [];

  const details = await Promise.all(
    ids.map(async (item) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = (await msgRes.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        labelIds?: string[];
        payload?: GmailPayloadPart;
      };
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From') || 'Unknown Sender',
        to: getHeader('To') || '',
        date: getHeader('Date') || '',
        snippet: msg.snippet || '',
        bodyText: extractBodyText(msg.payload) || msg.snippet || '',
        unread: Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD')
      } satisfies GmailHeaderSummary;
    })
  );

  return details.filter((d): d is GmailHeaderSummary => d !== null);
}

export async function sendGmailMessage(
  accessToken: string,
  payload: { to: string; subject: string; body: string; threadId?: string }
): Promise<{ id: string }> {
  const cleanTo = payload.to.replace(/[\r\n]/g, '').trim();
  const cleanSubject = payload.subject.replace(/[\r\n]/g, '').trim();
  const rawMime = [
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    payload.body
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodeBase64Url(rawMime),
      ...(payload.threadId ? { threadId: payload.threadId } : {})
    })
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('Gmail authorization expired. Please reconnect your Google account.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to send Gmail message (${res.status})`);
  }
  return (await res.json()) as { id: string };
}
