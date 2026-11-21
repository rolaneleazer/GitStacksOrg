import React from 'react';
import { OFFICE_LOUNGE_POSITION, OFFICE_ROOMS } from '../../shared/agentOfficeDefaults.ts';
import type {
  AgentAvatarIcon,
  AgentId,
  AgentOfficeProfile,
  AgentReport,
  LiveWebsiteVisitor
} from '../../shared/types.ts';

interface VirtualOfficeMapProps {
  profiles: AgentOfficeProfile[];
  reports: AgentReport[];
  selectedAgentId: AgentId;
  onSelectAgent: (agentId: AgentId) => void;
  speechTick: number;
  walkTick: number;
  continuousWalk: boolean;
  visitors: LiveWebsiteVisitor[];
  selectedVisitorId: string | null;
  onSelectVisitor: (sessionId: string | null) => void;
}

const ORIGIN_X = 315;
const ORIGIN_Y = 48;
const SCALE_X = 29;
const SCALE_Y = 18.5;

function iso(gx: number, gy: number): { x: number; y: number } {
  return {
    x: ORIGIN_X + (gx - gy) * SCALE_X,
    y: ORIGIN_Y + (gx + gy) * SCALE_Y
  };
}

function isoRectPoints(x: number, y: number, w: number, h: number): string {
  const p1 = iso(x, y);
  const p2 = iso(x + w, y);
  const p3 = iso(x + w, y + h);
  const p4 = iso(x, y + h);
  return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
}

function renderAvatarGlyph(icon: AgentAvatarIcon): React.ReactNode {
  switch (icon) {
    case 'crown':
      return (
        <path
          d="M-5 3 L-6 -3 L-2 0 L0 -5 L2 0 L6 -3 L5 3 Z"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      );
    case 'shield':
      return (
        <path
          d="M0 -5 L4.5 -3 V1 C4.5 3.6 2.5 5.2 0 6 C-2.5 5.2 -4.5 3.6 -4.5 1 V-3 Z"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      );
    case 'megaphone':
      return (
        <path
          d="M-5 -1 L3 -4.5 V4.5 L-5 1 Z M3 -2 C5 -2 5 2 3 2"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      );
    case 'calendar':
      return (
        <g fill="none" stroke="white" strokeWidth="1.4">
          <rect x="-4.5" y="-3.5" width="9" height="8" rx="1.2" />
          <line x1="-4.5" y1="-1" x2="4.5" y2="-1" />
          <line x1="-2" y1="-5" x2="-2" y2="-2.5" />
          <line x1="2" y1="-5" x2="2" y2="-2.5" />
        </g>
      );
    case 'check':
      return (
        <path
          d="M-4.5 0.5 L-1.5 3.5 L4.5 -3.5"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'badge':
      return (
        <g fill="none" stroke="white" strokeWidth="1.4">
          <circle cx="0" cy="-1" r="3.8" />
          <path d="M-2 2.5 L-3 6 L0 4.5 L3 6 L2 2.5" strokeLinejoin="round" />
        </g>
      );
    case 'trending':
      return (
        <path
          d="M-5 3.5 L-1.5 0 L1 2 L5 -3.5 M2 -3.5 H5 V-0.5"
          fill="none"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'cpu':
      return (
        <g fill="none" stroke="white" strokeWidth="1.3">
          <rect x="-3.5" y="-3.5" width="7" height="7" rx="1" />
          <path d="M-1.5 -5.5 V-3.5 M1.5 -5.5 V-3.5 M-1.5 3.5 V5.5 M1.5 3.5 V5.5" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke="white" strokeWidth="1.4">
          <rect x="-4.5" y="-3" width="9" height="6.5" rx="2" />
          <circle cx="-1.8" cy="0.2" r="0.8" fill="white" />
          <circle cx="1.8" cy="0.2" r="0.8" fill="white" />
          <line x1="0" y1="-3" x2="0" y2="-5.2" />
        </g>
      );
  }
}

const LOUNGE_SLOTS: { dx: number; dy: number }[] = [
  { dx: -0.9, dy: -0.7 },
  { dx: 0.4, dy: -0.8 },
  { dx: -1.0, dy: 0.4 },
  { dx: 0.3, dy: 0.5 },
  { dx: -0.3, dy: 1.1 },
  { dx: 0.9, dy: -0.1 },
  { dx: -0.2, dy: -1.1 },
  { dx: 0.9, dy: 0.9 }
];

// Continuous multi-waypoint patrol paths for 1-second live walking across the HQ floor
const AGENT_PATROL_CIRCUITS: Record<AgentId, { x: number; y: number }[]> = {
  ceo: [
    { x: 5.8, y: 1.9 },
    { x: 6.5, y: 2.2 },
    { x: 7.4, y: 2.2 },
    { x: 7.8, y: 2.8 },
    { x: 7.8, y: 3.6 },
    { x: 7.8, y: 2.2 },
    { x: 6.8, y: 1.5 },
    { x: 5.2, y: 1.5 }
  ],
  marketing: [
    { x: 5.2, y: 5.1 },
    { x: 4.7, y: 4.7 },
    { x: 4.3, y: 5.0 },
    { x: 5.4, y: 5.9 },
    { x: 6.3, y: 5.4 },
    { x: 6.9, y: 4.9 },
    { x: 6.1, y: 4.4 },
    { x: 5.0, y: 4.6 }
  ],
  traffic: [
    { x: 6.7, y: 5.8 },
    { x: 7.5, y: 5.4 },
    { x: 7.8, y: 4.7 },
    { x: 7.8, y: 3.7 },
    { x: 7.2, y: 4.3 },
    { x: 6.0, y: 4.9 },
    { x: 5.6, y: 6.0 },
    { x: 6.4, y: 6.3 }
  ],
  cybersecurity: [
    { x: 9.2, y: 1.8 },
    { x: 8.4, y: 2.2 },
    { x: 7.8, y: 2.2 },
    { x: 7.8, y: 1.6 },
    { x: 8.8, y: 1.2 },
    { x: 10.1, y: 1.4 },
    { x: 10.5, y: 2.1 },
    { x: 9.7, y: 2.5 }
  ],
  qa: [
    { x: 10.4, y: 2.7 },
    { x: 9.7, y: 3.0 },
    { x: 8.6, y: 2.8 },
    { x: 8.3, y: 2.1 },
    { x: 9.1, y: 1.4 },
    { x: 10.2, y: 1.6 },
    { x: 10.8, y: 2.3 },
    { x: 10.0, y: 2.9 }
  ],
  adsense: [
    { x: 9.1, y: 5.1 },
    { x: 8.3, y: 5.2 },
    { x: 7.8, y: 4.9 },
    { x: 8.4, y: 4.5 },
    { x: 9.6, y: 4.6 },
    { x: 10.6, y: 5.0 },
    { x: 9.9, y: 5.8 },
    { x: 8.8, y: 6.1 }
  ],
  booking: [
    { x: 10.3, y: 6.1 },
    { x: 9.4, y: 6.2 },
    { x: 8.3, y: 5.6 },
    { x: 7.8, y: 5.0 },
    { x: 6.7, y: 5.0 },
    { x: 7.8, y: 5.0 },
    { x: 8.9, y: 4.9 },
    { x: 10.4, y: 5.3 }
  ],
  demo_guard: [
    { x: 8.5, y: 2.9 },
    { x: 9.4, y: 2.8 },
    { x: 10.2, y: 2.2 },
    { x: 9.5, y: 1.5 },
    { x: 8.4, y: 1.7 },
    { x: 7.9, y: 2.4 },
    { x: 8.1, y: 3.1 },
    { x: 8.5, y: 2.9 }
  ]
};

const ENTRANCE_POS = { x: 0.45, y: 1.65 };

export function VirtualOfficeMap({
  profiles,
  reports,
  selectedAgentId,
  onSelectAgent,
  speechTick,
  walkTick,
  continuousWalk,
  visitors,
  selectedVisitorId,
  onSelectVisitor
}: VirtualOfficeMapProps) {
  const idleProfiles = profiles.filter((p) => p.work_status === 'idle');
  const selectedVisitor = visitors.find((v) => v.session_id === selectedVisitorId) || null;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-3 sm:p-4 text-slate-100 shadow-xs space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-slate-800/80 bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.16),_transparent_65%)]">
        <svg
          viewBox="0 0 760 450"
          className="h-auto w-full select-none"
          role="img"
          aria-label="Interactive Isometric Virtual Office Floor Map"
        >
          <defs>
            <pattern id="office-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path
                d="M 28 0 L 0 0 0 28"
                fill="none"
                stroke="rgba(148,163,184,0.06)"
                strokeWidth="1"
              />
            </pattern>
            <filter id="agent-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.9" />
            </filter>
          </defs>

          <rect x="0" y="0" width="760" height="450" fill="url(#office-grid)" />

          {/* Outer office boundary */}
          <polygon
            points={isoRectPoints(0.1, 0.2, 11.7, 7.2)}
            fill="rgba(15, 23, 42, 0.55)"
            stroke="rgba(148, 163, 184, 0.18)"
            strokeWidth="1.2"
          />

          {/* Hallway path connecting Entrance, Lounge & Work Rooms */}
          {(() => {
            const ent = iso(ENTRANCE_POS.x, ENTRANCE_POS.y);
            const entJoin = iso(4.3, 2.2);
            const pA = iso(3.8, 5.0);
            const pB = iso(4.3, 5.0);
            const pC = iso(7.8, 5.0);
            const pD = iso(7.8, 2.2);
            const pE = iso(4.3, 2.2);
            const pF = iso(8.1, 2.2);
            const pG = iso(8.1, 5.3);
            return (
              <g stroke="rgba(148,163,184,0.22)" strokeWidth="1.5" strokeDasharray="4 4" fill="none">
                <line x1={ent.x} y1={ent.y} x2={entJoin.x} y2={entJoin.y} stroke="rgba(56,189,248,0.35)" />
                <polyline points={`${pA.x},${pA.y} ${pB.x},${pB.y} ${pC.x},${pC.y} ${pD.x},${pD.y} ${pE.x},${pE.y}`} />
                <line x1={pD.x} y1={pD.y} x2={pF.x} y2={pF.y} />
                <line x1={pC.x} y1={pC.y} x2={pG.x} y2={pG.y} />
              </g>
            );
          })()}

          {/* Website Visitor Entrance Gate */}
          {(() => {
            const entPos = iso(ENTRANCE_POS.x, ENTRANCE_POS.y);
            return (
              <g transform={`translate(${entPos.x}, ${entPos.y})`}>
                <polygon
                  points="0,-10 18,0 0,10 -18,0"
                  fill="#0C4A6E"
                  stroke="#38BDF8"
                  strokeWidth="1.4"
                />
                <rect
                  x="-38"
                  y="-24"
                  width="76"
                  height="14"
                  rx="3"
                  fill="#0F172A"
                  stroke="#38BDF8"
                  strokeWidth="0.9"
                />
                <text
                  x="0"
                  y="-14.5"
                  textAnchor="middle"
                  fill="#BAE6FD"
                  fontSize="7.8"
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  SITE ENTRANCE
                </text>
              </g>
            );
          })()}

          {/* Room Zones */}
          {OFFICE_ROOMS.map((room) => {
            const labelPos = iso(room.x + room.w * 0.48, room.y + 0.35);
            return (
              <g key={room.id}>
                <polygon
                  points={isoRectPoints(room.x, room.y, room.w, room.h)}
                  fill={`${room.color}16`}
                  stroke={room.color}
                  strokeWidth="1.6"
                  strokeOpacity="0.75"
                />
                <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
                  <rect
                    x="-62"
                    y="-10"
                    width="124"
                    height="16"
                    rx="3"
                    fill="#0F172A"
                    stroke={room.color}
                    strokeOpacity="0.6"
                    strokeWidth="0.9"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="8.2"
                    fontWeight="700"
                    letterSpacing="0.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {room.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Pantry Coffee & Table Prop */}
          {(() => {
            const loungeCenter = iso(OFFICE_LOUNGE_POSITION.x, OFFICE_LOUNGE_POSITION.y);
            return (
              <g transform={`translate(${loungeCenter.x}, ${loungeCenter.y})`} opacity="0.75">
                <ellipse cx="0" cy="4" rx="18" ry="10" fill="#1E293B" stroke="#F59E0B" strokeOpacity="0.45" />
                <rect x="-4" y="-1" width="8" height="5" rx="1" fill="#F59E0B" opacity="0.6" />
              </g>
            );
          })()}

          {/* Desk Workstation Markers */}
          {profiles.map((prof) => {
            const deskPt = iso(prof.desk_x, prof.desk_y);
            const activeAtDesk = prof.work_status === 'working';
            return (
              <g key={`desk-${prof.agent_id}`} transform={`translate(${deskPt.x}, ${deskPt.y})`}>
                <polygon
                  points="0,-10 18,0 0,10 -18,0"
                  fill="#1E293B"
                  stroke={activeAtDesk ? prof.accent_color : '#475569'}
                  strokeWidth={activeAtDesk ? '1.4' : '1'}
                />
                <rect
                  x="-6"
                  y="-6"
                  width="12"
                  height="7"
                  rx="1.2"
                  fill={activeAtDesk ? prof.accent_color : '#334155'}
                  opacity={activeAtDesk ? 0.9 : 0.6}
                />
              </g>
            );
          })}

          {/* Live Website Visitors Walking Inside Office Zones */}
          {visitors.map((visitor, idx) => {
            const strideX = continuousWalk ? Math.sin((walkTick + idx * 2) * 0.85) * 0.28 : 0;
            const strideY = continuousWalk ? Math.cos((walkTick + idx * 3) * 0.85) * 0.22 : 0;
            const gx = Math.max(0.5, Math.min(11.3, visitor.target_x + strideX));
            const gy = Math.max(0.6, Math.min(7.0, visitor.target_y + strideY));
            const vPos = iso(gx, gy);
            const isSelected = selectedVisitorId === visitor.session_id;
            const shortRoute = visitor.current_path === '/' ? 'Home' : visitor.current_path.slice(0, 12);

            return (
              <g
                key={visitor.session_id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectVisitor(isSelected ? null : visitor.session_id);
                }}
                className="cursor-pointer"
                style={{
                  transform: `translate(${vPos.x}px, ${vPos.y}px)`,
                  transition: 'transform 0.96s linear'
                }}
              >
                {isSelected && (
                  <ellipse
                    cx="0"
                    cy="2"
                    rx="18"
                    ry="11"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                )}
                <g transform="translate(0, -25)">
                  <rect
                    x="-30"
                    y="-11"
                    width="60"
                    height="13"
                    rx="4"
                    fill="#082F49"
                    stroke="#38BDF8"
                    strokeWidth="0.9"
                  />
                  <text
                    x="0"
                    y="-2"
                    textAnchor="middle"
                    fill="#E0F2FE"
                    fontSize="7.4"
                    fontWeight="700"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {shortRoute}
                  </text>
                </g>
                <circle
                  cx="0"
                  cy="-7"
                  r="9.5"
                  fill="#0284C7"
                  stroke={isSelected ? '#FFFFFF' : '#7DD3FC'}
                  strokeWidth={isSelected ? '2' : '1.5'}
                />
                {/* Visitor silhouette icon */}
                <circle cx="0" cy="-9.5" r="2.5" fill="white" />
                <path
                  d="M-4 -3.2 C-3.6 -5.5 3.6 -5.5 4 -3.2"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle
                  cx="7.5"
                  cy="-13"
                  r="3"
                  fill="#22D3EE"
                  stroke="#0F172A"
                  strokeWidth="1.2"
                />
              </g>
            );
          })}

          {/* 7 Animated Continuously Walking Agents */}
          {profiles.map((prof, idx) => {
            const report = reports.find((r) => r.id === prof.agent_id);
            const isSelected = prof.agent_id === selectedAgentId;

            let targetGrid = { x: prof.desk_x, y: prof.desk_y };

            if (continuousWalk) {
              if (prof.work_status === 'idle') {
                // Gentle pacing inside the Lounge
                const baseSlot = LOUNGE_SLOTS[idx % LOUNGE_SLOTS.length];
                const stepOffsetX = Math.sin((walkTick + idx) * 0.9) * 0.35;
                const stepOffsetY = Math.cos((walkTick + idx * 2) * 0.9) * 0.3;
                targetGrid = {
                  x: OFFICE_LOUNGE_POSITION.x + baseSlot.dx + stepOffsetX,
                  y: OFFICE_LOUNGE_POSITION.y + baseSlot.dy + stepOffsetY
                };
              } else {
                const circuit = AGENT_PATROL_CIRCUITS[prof.agent_id] || [
                  { x: prof.desk_x, y: prof.desk_y }
                ];
                const waypoint = circuit[(walkTick + idx * 2) % circuit.length];
                targetGrid = { x: waypoint.x, y: waypoint.y };
              }
            } else if (prof.work_status === 'idle') {
              const slotIdx = Math.max(
                0,
                idleProfiles.findIndex((p) => p.agent_id === prof.agent_id)
              );
              const slot = LOUNGE_SLOTS[slotIdx % LOUNGE_SLOTS.length];
              targetGrid = {
                x: OFFICE_LOUNGE_POSITION.x + slot.dx,
                y: OFFICE_LOUNGE_POSITION.y + slot.dy
              };
            } else if (prof.work_status === 'walking') {
              targetGrid = {
                x: OFFICE_LOUNGE_POSITION.x + (prof.desk_x - OFFICE_LOUNGE_POSITION.x) * 0.54,
                y: OFFICE_LOUNGE_POSITION.y + (prof.desk_y - OFFICE_LOUNGE_POSITION.y) * 0.54
              };
            }

            const pos = iso(targetGrid.x, targetGrid.y);
            const showBubble =
              isSelected ||
              prof.work_status === 'walking' ||
              (continuousWalk && (speechTick + idx) % 3 === 0);

            const bubbleText =
              prof.work_status === 'idle'
                ? 'Lounge Break'
                : continuousWalk && prof.work_status === 'working'
                  ? report && report.status !== 'healthy'
                    ? `Patrol · ${report.score}%`
                    : `${report ? report.score : 100}% Active`
                  : prof.work_status === 'walking'
                    ? 'On my way!'
                    : report && report.status !== 'healthy'
                      ? `${report.score}% · Review`
                      : `${report ? report.score : 100}% Nominal`;

            const statusDotColor =
              prof.work_status === 'working'
                ? '#22C55E'
                : prof.work_status === 'walking'
                  ? '#F59E0B'
                  : '#94A3B8';

            return (
              <g
                key={prof.agent_id}
                onClick={() => onSelectAgent(prof.agent_id)}
                className="cursor-pointer"
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  transition: continuousWalk
                    ? 'transform 0.96s linear'
                    : 'transform 1.15s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                {/* Selection ring */}
                {isSelected && (
                  <ellipse
                    cx="0"
                    cy="2"
                    rx="23"
                    ry="14"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.6"
                    strokeDasharray="3 2"
                  />
                )}

                {/* Floating Speech / Telemetry Bubble */}
                {showBubble && (
                  <g transform="translate(0, -33)">
                    <rect
                      x="-44"
                      y="-14"
                      width="88"
                      height="17"
                      rx="5"
                      fill="#FFFFFF"
                      stroke={prof.accent_color}
                      strokeWidth="1.2"
                    />
                    <path d="M-4 3 L0 8 L4 3 Z" fill="#FFFFFF" />
                    <text
                      x="0"
                      y="-2.5"
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="8.5"
                      fontWeight="700"
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {bubbleText}
                    </text>
                  </g>
                )}

                {/* Avatar Token Circle */}
                <g filter="url(#agent-glow)">
                  <circle
                    cx="0"
                    cy="-10"
                    r="13"
                    fill={prof.accent_color}
                    stroke={isSelected ? '#FFFFFF' : '#0F172A'}
                    strokeWidth={isSelected ? '2.2' : '2'}
                  />
                  <g transform="translate(0, -10)">{renderAvatarGlyph(prof.avatar_icon)}</g>
                </g>

                {/* Status Indicator */}
                <circle
                  cx="10"
                  cy="-19"
                  r="4"
                  fill={statusDotColor}
                  stroke="#0F172A"
                  strokeWidth="1.5"
                />

                {/* Name Plate */}
                <g transform="translate(0, 14)">
                  <rect
                    x="-46"
                    y="-7"
                    width="92"
                    height="15"
                    rx="4"
                    fill="#0F172A"
                    fillOpacity="0.92"
                    stroke={isSelected ? prof.accent_color : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fill="#F8FAFC"
                    fontSize="8.5"
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {prof.display_name.length > 15
                      ? `${prof.display_name.slice(0, 14)}…`
                      : prof.display_name}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Website Visitor Quick Inspector */}
      {selectedVisitor && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-500/40 bg-sky-950/50 px-3.5 py-2.5 text-xs text-sky-100">
          <div className="space-y-0.5 min-w-0">
            <div className="font-mono font-bold text-sky-300">
              Live Visitor · {selectedVisitor.zone_label} ({selectedVisitor.current_path})
            </div>
            <div className="font-mono text-[11px] text-slate-300 tabular-nums">
              Device: {selectedVisitor.device_type} · Entered{' '}
              {new Date(selectedVisitor.started_at).toLocaleTimeString()} · Active{' '}
              {new Date(selectedVisitor.last_seen_at).toLocaleTimeString()}
              {selectedVisitor.referrer ? ` · Ref: ${selectedVisitor.referrer}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectVisitor(null)}
            className="rounded border border-sky-400/40 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-900/50"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
        <span>
          Click any agent or cyan website visitor token on the floor map to inspect live activity.
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Patrolling / Active
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Hallway Shift
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8]" />
            Live Website Visitor ({visitors.length})
          </span>
        </div>
      </div>
    </div>
  );
}
