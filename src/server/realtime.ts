import type http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { LiveWebsiteVisitor } from '../shared/types.ts';

interface StoredVisitor extends LiveWebsiteVisitor {
  lastSeenMs: number;
}

const VISITOR_TTL_MS = 65_000;
const VISITOR_30M_TTL_MS = 30 * 60_000;
const ADMIN_ONLINE_TTL_MS = 95_000;

const visitorPresenceMap = new Map<string, StoredVisitor>();
const recent30mVisitorMap = new Map<string, StoredVisitor>();
const adminSockets = new Set<WebSocket>();
const visitorChatSockets = new Map<string, Set<WebSocket>>();

let lastAdminSeenMs: number | null = null;

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function mapRouteToOfficeZone(
  rawPath: string,
  sessionId: string
): {
  zone_id: string;
  zone_label: string;
  target_x: number;
  target_y: number;
} {
  const path = (rawPath || '/').split('?')[0].toLowerCase();
  const seed = hashString(sessionId);
  const dx = ((seed % 7) - 3) * 0.16;
  const dy = (((seed >> 3) % 7) - 3) * 0.16;

  if (path.startsWith('/services')) {
    return {
      zone_id: 'marketing',
      zone_label: 'Services Showcase',
      target_x: Number((5.8 + dx).toFixed(2)),
      target_y: Number((5.4 + dy).toFixed(2))
    };
  }
  if (path.startsWith('/demo')) {
    return {
      zone_id: 'security',
      zone_label: 'Live Demo Lab',
      target_x: Number((9.7 + dx).toFixed(2)),
      target_y: Number((2.2 + dy).toFixed(2))
    };
  }
  if (path.startsWith('/insights')) {
    return {
      zone_id: 'command',
      zone_label: 'Insights Library',
      target_x: Number((5.9 + dx).toFixed(2)),
      target_y: Number((2.0 + dy).toFixed(2))
    };
  }
  if (path.startsWith('/contact')) {
    return {
      zone_id: 'studio',
      zone_label: 'Booking & Inquiry Desk',
      target_x: Number((9.6 + dx).toFixed(2)),
      target_y: Number((5.6 + dy).toFixed(2))
    };
  }
  if (path.startsWith('/about')) {
    return {
      zone_id: 'command',
      zone_label: 'Executive Suite',
      target_x: Number((5.1 + dx).toFixed(2)),
      target_y: Number((2.4 + dy).toFixed(2))
    };
  }
  return {
    zone_id: 'lounge',
    zone_label: 'Home Lobby',
    target_x: Number((2.1 + dx).toFixed(2)),
    target_y: Number((5.0 + dy).toFixed(2))
  };
}

export function pruneStaleVisitors(): void {
  const now = Date.now();
  const cutoff = now - VISITOR_TTL_MS;
  const cutoff30m = now - VISITOR_30M_TTL_MS;
  for (const [id, v] of visitorPresenceMap.entries()) {
    if (v.lastSeenMs < cutoff) {
      visitorPresenceMap.delete(id);
    }
  }
  for (const [id, v] of recent30mVisitorMap.entries()) {
    if (v.lastSeenMs < cutoff30m) {
      recent30mVisitorMap.delete(id);
    }
  }
}

export function recordVisitorPresence(input: {
  session_id: string;
  visitor_id?: string;
  path: string;
  page_title?: string;
  device_type?: string;
  referrer?: string;
  channel_group?: string;
  country?: string;
  country_code?: string;
  city?: string;
  is_returning?: boolean;
  engagement_seconds?: number;
}): LiveWebsiteVisitor[] {
  pruneStaleVisitors();
  const cleanId = (input.session_id || '').trim().slice(0, 80);
  if (!cleanId) return listLiveVisitors();

  const existing = visitorPresenceMap.get(cleanId) || recent30mVisitorMap.get(cleanId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const zone = mapRouteToOfficeZone(input.path, cleanId);
  const dev: LiveWebsiteVisitor['device_type'] =
    input.device_type === 'mobile'
      ? 'mobile'
      : input.device_type === 'tablet'
        ? 'tablet'
        : existing?.device_type || 'desktop';

  const next: StoredVisitor = {
    session_id: cleanId,
    visitor_id: (input.visitor_id || existing?.visitor_id || cleanId).slice(0, 80),
    current_path: (input.path || '/').slice(0, 140),
    page_title: (input.page_title || existing?.page_title || '').slice(0, 160),
    zone_id: zone.zone_id,
    zone_label: zone.zone_label,
    device_type: dev,
    referrer: (input.referrer || existing?.referrer || 'direct').slice(0, 180),
    channel_group: (input.channel_group || existing?.channel_group || 'Direct').slice(0, 60),
    country: (input.country || existing?.country || 'Local Development').slice(0, 80),
    country_code: (input.country_code || existing?.country_code || 'LOCAL').slice(0, 12),
    city: (input.city || existing?.city || 'Localhost').slice(0, 80),
    is_returning:
      input.is_returning !== undefined ? Boolean(input.is_returning) : existing?.is_returning,
    engagement_seconds:
      input.engagement_seconds !== undefined
        ? Number(input.engagement_seconds) || 0
        : existing?.engagement_seconds,
    started_at: existing?.started_at || nowIso,
    last_seen_at: nowIso,
    target_x: zone.target_x,
    target_y: zone.target_y,
    lastSeenMs: nowMs
  };
  visitorPresenceMap.set(cleanId, next);
  recent30mVisitorMap.set(cleanId, next);

  const list = listLiveVisitors();
  broadcastToAdmins('office:visitors', { visitors: list });
  return list;
}

export function listLiveVisitors(): LiveWebsiteVisitor[] {
  pruneStaleVisitors();
  return Array.from(visitorPresenceMap.values())
    .sort((a, b) => b.lastSeenMs - a.lastSeenMs)
    .map(({ lastSeenMs: _ignored, ...rest }) => rest);
}

export function listRecent30mVisitors(): LiveWebsiteVisitor[] {
  pruneStaleVisitors();
  return Array.from(recent30mVisitorMap.values())
    .sort((a, b) => b.lastSeenMs - a.lastSeenMs)
    .map(({ lastSeenMs: _ignored, ...rest }) => rest);
}

export function markAdminPresence(): string {
  lastAdminSeenMs = Date.now();
  return new Date(lastAdminSeenMs).toISOString();
}

export function isAdminOnline(): boolean {
  if (adminSockets.size > 0) return true;
  if (!lastAdminSeenMs) return false;
  return Date.now() - lastAdminSeenMs <= ADMIN_ONLINE_TTL_MS;
}

export function getLastAdminSeenAt(): string | null {
  return lastAdminSeenMs ? new Date(lastAdminSeenMs).toISOString() : null;
}

export function broadcastToAdmins(type: string, payload: unknown): void {
  const msg = JSON.stringify({ type, payload, ts: new Date().toISOString() });
  for (const ws of adminSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function broadcastToVisitor(visitorToken: string, type: string, payload: unknown): void {
  const set = visitorChatSockets.get(visitorToken);
  if (!set) return;
  const msg = JSON.stringify({ type, payload, ts: new Date().toISOString() });
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function attachRealtimeHub(
  httpServer: http.Server,
  verifyAdminToken: (token: string) => Promise<unknown>
): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const reqUrl = req.url || '';
    const pathname = reqUrl.split('?')[0];
    if (pathname !== '/ws') {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    let isAdmin = false;
    let joinedVisitorToken: string | null = null;

    ws.on('message', async (raw) => {
      try {
        const parsed = JSON.parse(String(raw)) as {
          type?: string;
          token?: string;
          visitor_token?: string;
          session_id?: string;
          path?: string;
          device_type?: string;
          referrer?: string;
        };

        if (parsed.type === 'admin:join' && parsed.token) {
          const session = await verifyAdminToken(parsed.token);
          if (session) {
            isAdmin = true;
            adminSockets.add(ws);
            markAdminPresence();
            ws.send(
              JSON.stringify({
                type: 'office:visitors',
                payload: { visitors: listLiveVisitors() }
              })
            );
          }
          return;
        }

        if (parsed.type === 'admin:ping' && isAdmin) {
          markAdminPresence();
          return;
        }

        if (parsed.type === 'chat:join' && parsed.visitor_token) {
          const vt = parsed.visitor_token.trim().slice(0, 120);
          if (vt) {
            joinedVisitorToken = vt;
            let set = visitorChatSockets.get(vt);
            if (!set) {
              set = new Set();
              visitorChatSockets.set(vt, set);
            }
            set.add(ws);
          }
          return;
        }

        if (parsed.type === 'presence:ping' && parsed.session_id) {
          recordVisitorPresence({
            session_id: parsed.session_id,
            path: parsed.path || '/',
            device_type: parsed.device_type,
            referrer: parsed.referrer
          });
        }
      } catch {
        // ignore malformed websocket payloads
      }
    });

    ws.on('close', () => {
      if (isAdmin) {
        adminSockets.delete(ws);
      }
      if (joinedVisitorToken) {
        const set = visitorChatSockets.get(joinedVisitorToken);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            visitorChatSockets.delete(joinedVisitorToken);
          }
        }
      }
    });
  });
}
