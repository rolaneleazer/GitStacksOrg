import crypto from 'node:crypto';
import type { Request } from 'express';

const STATE_SECRET =
  process.env.STUDIO_SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + '_gitstack_lark_oauth_v1').digest('hex');

const LARK_SCOPES = [
  'email',
  'profile',
  'mail:user_mailbox.message:send',
  'mail:user_mailbox.message:readonly'
].join(' ');

export function getLarkEnvStatus() {
  const appId = process.env.LARK_APP_ID?.trim() || '';
  const appSecret = process.env.LARK_APP_SECRET?.trim() || '';
  const missing: string[] = [];
  if (!appId) missing.push('LARK_APP_ID');
  if (!appSecret) missing.push('LARK_APP_SECRET');
  return {
    configured: Boolean(appId && appSecret),
    appId,
    appSecret,
    missing
  };
}

export function getLarkBaseOrigin(req?: Request): string {
  const configuredRedirect = process.env.LARK_REDIRECT_URI?.trim();
  if (configuredRedirect) {
    try {
      return new URL(configuredRedirect).origin;
    } catch {
      // ignore invalid override
    }
  }
  if (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

export function getLarkRedirectUri(req?: Request): string {
  const configured = process.env.LARK_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${getLarkBaseOrigin(req)}/api/lark/callback`;
}

export function signLarkOAuthState(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, ts: Date.now() })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyLarkOAuthState(state: string): { userId: string } | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId: string;
      ts: number;
    };
    // 15 minute OAuth state window
    if (!parsed.userId || Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

export function buildLarkAuthorizeUrl(userId: string, req: Request): string {
  const { appId } = getLarkEnvStatus();
  const redirectUri = getLarkRedirectUri(req);
  const state = signLarkOAuthState(userId);
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: LARK_SCOPES,
    state
  });
  return `https://accounts.larksuite.com/open-apis/authen/v1/authorize?${params.toString()}`;
}

export async function exchangeLarkCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { appId, appSecret } = getLarkEnvStatus();
  const res = await fetch('https://open.larksuite.com/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri
    })
  });

  const data = (await res.json().catch(() => ({}))) as {
    code?: number;
    error?: string;
    error_description?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    data?: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
  };

  const token = data.access_token || data.data?.access_token;
  if (!res.ok || !token) {
    throw new Error(
      data.error_description ||
        data.error ||
        `Lark token exchange failed (HTTP ${res.status}, code ${data.code ?? 'n/a'}).`
    );
  }

  return {
    access_token: token,
    refresh_token: data.refresh_token || data.data?.refresh_token || '',
    expires_in: Number(data.expires_in || data.data?.expires_in || 7200)
  };
}

export async function refreshLarkUserToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { appId, appSecret } = getLarkEnvStatus();
  const res = await fetch('https://open.larksuite.com/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: appId,
      client_secret: appSecret,
      refresh_token: refreshToken
    })
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    data?: { access_token?: string; refresh_token?: string; expires_in?: number };
  };

  const token = data.access_token || data.data?.access_token;
  if (!res.ok || !token) {
    throw new Error(data.error_description || 'Failed to refresh Lark user access token.');
  }

  return {
    access_token: token,
    refresh_token: data.refresh_token || data.data?.refresh_token || refreshToken,
    expires_in: Number(data.expires_in || data.data?.expires_in || 7200)
  };
}

export async function fetchLarkUserInfo(accessToken: string): Promise<{
  name: string;
  email: string;
}> {
  const res = await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: {
      name?: string;
      en_name?: string;
      email?: string;
      enterprise_email?: string;
    };
  };
  return {
    name: data.data?.name || data.data?.en_name || 'Lark Operator',
    email: data.data?.enterprise_email || data.data?.email || ''
  };
}

export async function sendLarkMailMessage(
  accessToken: string,
  payload: {
    toEmail: string;
    toName?: string;
    subject: string;
    bodyText: string;
  }
): Promise<{ messageId: string }> {
  const cleanTo = payload.toEmail.replace(/[\r\n]/g, '').trim();
  const cleanSubject = payload.subject.replace(/[\r\n]/g, '').trim();

  const res = await fetch(
    'https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        subject: cleanSubject,
        to: [
          {
            mail_address: cleanTo,
            ...(payload.toName ? { name: payload.toName.trim() } : {})
          }
        ],
        body_plain_text: payload.bodyText
      })
    }
  );

  const data = (await res.json().catch(() => ({}))) as {
    code?: number;
    msg?: string;
    data?: { message_id?: string };
  };

  if (!res.ok || (data.code !== undefined && data.code !== 0)) {
    throw new Error(data.msg || `Lark Mail send failed (HTTP ${res.status}, code ${data.code ?? 'n/a'}).`);
  }

  return {
    messageId: data.data?.message_id || `lark-${Date.now()}`
  };
}
