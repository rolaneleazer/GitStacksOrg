import type {
  AgentConversationEntry,
  AgentId,
  AgentOfficeProfile,
  AgentReport,
  AgentReportSettings,
  AgentSnapshotItem,
  AgentTask
} from './types.ts';

export interface OfficeRoomZone {
  id: string;
  label: string;
  agentIds: AgentId[];
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export const OFFICE_LOUNGE_POSITION = { x: 2.1, y: 5.0 };

export const OFFICE_ROOMS: OfficeRoomZone[] = [
  {
    id: 'lounge',
    label: 'PANTRY & LOUNGE',
    agentIds: [],
    x: 0.5,
    y: 3.3,
    w: 3.3,
    h: 3.6,
    color: '#F59E0B'
  },
  {
    id: 'command',
    label: 'CEO COMMAND CENTER',
    agentIds: ['ceo'],
    x: 4.3,
    y: 0.6,
    w: 3.2,
    h: 2.8,
    color: '#3B82F6'
  },
  {
    id: 'marketing',
    label: 'GROWTH & MARKETING',
    agentIds: ['marketing', 'traffic'],
    x: 4.3,
    y: 3.9,
    w: 3.2,
    h: 3.0,
    color: '#10B981'
  },
  {
    id: 'security',
    label: 'CYBER & CLOUD LAB',
    agentIds: ['cybersecurity', 'qa'],
    x: 8.1,
    y: 0.6,
    w: 3.3,
    h: 3.0,
    color: '#06B6D4'
  },
  {
    id: 'studio',
    label: 'ADSENSE & BOOKING BAY',
    agentIds: ['adsense', 'booking'],
    x: 8.1,
    y: 4.1,
    w: 3.3,
    h: 3.0,
    color: '#8B5CF6'
  }
];

export const DEFAULT_AGENT_OFFICE_PROFILES: AgentOfficeProfile[] = [
  {
    agent_id: 'ceo',
    display_name: 'Atlas (CEO)',
    custom_role: 'Executive Scorecard & Cross-Module Director',
    avatar_icon: 'crown',
    accent_color: '#2563EB',
    desk_label: 'CEO Command Center',
    desk_x: 5.8,
    desk_y: 1.9,
    work_status: 'working',
    current_mission: 'Monitor cross-agent health, SLA queues, and PostgreSQL stability',
    updated_at: '2026-11-15T00:00:00Z'
  },
  {
    agent_id: 'marketing',
    display_name: 'Aria (Marketing)',
    custom_role: 'Positioning, AI/ML Messaging & Lead Capture',
    avatar_icon: 'megaphone',
    accent_color: '#10B981',
    desk_label: 'Growth & Marketing',
    desk_x: 5.2,
    desk_y: 5.1,
    work_status: 'working',
    current_mission: 'Audit homepage AI/ML positioning, CTA clarity, and subscriber capture',
    updated_at: '2026-11-15T00:00:00Z'
  },
  {
    agent_id: 'traffic',
    display_name: 'Pulse (Traffic)',
    custom_role: 'Organic SEO, GEO Visibility & GA4 Telemetry',
    avatar_icon: 'trending',
    accent_color: '#059669',
    desk_label: 'Growth & Marketing',
    desk_x: 6.7,
    desk_y: 5.8,
    work_status: 'idle',
    current_mission: 'Evaluate llms.txt indexing, GA4 signals, and conversion funnel velocity',
    updated_at: '2026-11-15T00:00:00Z'
  },
  {
    agent_id: 'cybersecurity',
    display_name: 'Bantay (Cyber)',
    custom_role: 'Access Boundaries, Consent & Token Hygiene',
    avatar_icon: 'shield',
    accent_color: '#0891B2',
    desk_label: 'Cyber & Cloud Lab',
    desk_x: 9.2,
    desk_y: 1.8,
    work_status: 'working',
    current_mission: 'Verify /obama RBAC auth, consent gating, and comment spam quarantine',
    updated_at: '2026-11-15T00:00:00Z'
  },
  {
    agent_id: 'qa',
    display_name: 'Vero (QA)',
    custom_role: 'Content Integrity, Media Alt & Schema Verification',
    avatar_icon: 'check',
    accent_color: '#0284C7',
    desk_label: 'Cyber & Cloud Lab',
    desk_x: 10.4,
    desk_y: 2.7,
    work_status: 'idle',
    current_mission: 'Validate FAQPage JSON-LD, 800+ word floor, and zero broken media assets',
    updated_at: '2026-11-15T00:00:00Z'
  },
  {
    agent_id: 'adsense',
    display_name: 'Nova (AdSense)',
    custom_role: 'Monetization Policy & Thin-Content Gatekeeper',
    avatar_icon: 'badge',
    accent_color: '#7C3AED',
    desk_label: 'AdSense & Booking Bay',
    desk_x: 9.1,
    desk_y: 5.1,
    work_status: 'idle',
    current_mission: 'Enforce legal trust pages, E-E-A-T citations, and ads.txt readiness',
    updated_at: '2026-11-15T00:00:00Z'
  },
  {
    agent_id: 'booking',
    display_name: 'Mira (Booking)',
    custom_role: 'Discovery Call Triage & Inquiry SLA',
    avatar_icon: 'calendar',
    accent_color: '#D97706',
    desk_label: 'AdSense & Booking Bay',
    desk_x: 10.3,
    desk_y: 6.1,
    work_status: 'working',
    current_mission: 'Track <24h client inquiry triage SLA and Gmail consultation invites',
    updated_at: '2026-11-15T00:00:00Z'
  }
];

export const AGENT_COLLABORATION_MAP: Record<AgentId, AgentId[]> = {
  ceo: ['adsense', 'booking', 'cybersecurity', 'traffic'],
  marketing: ['traffic', 'booking', 'qa'],
  booking: ['ceo', 'marketing', 'cybersecurity'],
  cybersecurity: ['ceo', 'qa', 'adsense'],
  qa: ['adsense', 'marketing', 'cybersecurity'],
  adsense: ['qa', 'ceo', 'traffic'],
  traffic: ['marketing', 'adsense', 'ceo']
};

export const SEED_AGENT_CONVERSATIONS: AgentConversationEntry[] = [
  {
    id: 'ac-seed-1',
    agent_id: 'ceo',
    peer_agent_id: 'adsense',
    sender_type: 'handoff',
    sender_name: 'Atlas (CEO)',
    message:
      'Morning shift active. Requesting AdSense & QA confirmation that all published insights pass 800+ words and primary HTTPS citations.',
    finding_status: 'nominal',
    created_at: '2026-11-15T01:10:00Z'
  },
  {
    id: 'ac-seed-2',
    agent_id: 'adsense',
    peer_agent_id: 'ceo',
    sender_type: 'agent',
    sender_name: 'Nova (AdSense)',
    message:
      'Legal & Trust suite is complete across all 7 required routes. Checking ads.txt Publisher ID status for domain verification.',
    finding_status: 'attention',
    created_at: '2026-11-15T01:12:00Z'
  },
  {
    id: 'ac-seed-3',
    agent_id: 'cybersecurity',
    peer_agent_id: null,
    sender_type: 'agent',
    sender_name: 'Bantay (Cyber)',
    message:
      'Verified /obama noindex headers, Bearer auth enforcement across all admin APIs, and in-memory Gmail OAuth isolation.',
    finding_status: 'nominal',
    created_at: '2026-11-15T01:14:00Z'
  },
  {
    id: 'ac-seed-4',
    agent_id: 'marketing',
    peer_agent_id: 'traffic',
    sender_type: 'handoff',
    sender_name: 'Aria (Marketing)',
    message:
      'Hero AI Integration & MLOps positioning verified. Passing conversion funnel telemetry check to Pulse (Traffic).',
    finding_status: 'nominal',
    created_at: '2026-11-15T01:16:00Z'
  },
  {
    id: 'ac-seed-5',
    agent_id: 'booking',
    peer_agent_id: null,
    sender_type: 'agent',
    sender_name: 'Mira (Booking)',
    message:
      'Monitoring incoming consultation briefs and Gmail discovery invitations against the 24-hour SLA.',
    finding_status: 'info',
    created_at: '2026-11-15T01:18:00Z'
  },
  {
    id: 'ac-seed-6',
    agent_id: 'qa',
    peer_agent_id: null,
    sender_type: 'agent',
    sender_name: 'Vero (QA)',
    message:
      'All customized page blocks and mirrored static assets verified with zero broken images.',
    finding_status: 'nominal',
    created_at: '2026-11-15T01:20:00Z'
  },
  {
    id: 'ac-seed-7',
    agent_id: 'traffic',
    peer_agent_id: 'marketing',
    sender_type: 'agent',
    sender_name: 'Pulse (Traffic)',
    message:
      'llms.txt, llms-full.txt, and sitemap.xml are live and returning HTTP 200. Watching GA4 consent activation.',
    finding_status: 'info',
    created_at: '2026-11-15T01:22:00Z'
  }
];

export const DEFAULT_AGENT_REPORT_SETTINGS: AgentReportSettings = {
  id: 'default',
  enabled: true,
  recipient_email: 'gitstackitsolution@gmail.com',
  send_hour_utc: 8,
  preferred_channel: 'gmail',
  include_agents: ['ceo', 'marketing', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic'],
  last_sent_at: null,
  updated_at: '2026-11-15T00:00:00Z'
};

export function composeDailyAgentDigest(params: {
  agents: AgentReport[];
  tasks: AgentTask[];
  profiles: AgentOfficeProfile[];
  includeAgents: AgentId[];
  recipientEmail: string;
  generatedAt?: string;
}): {
  subject: string;
  bodyText: string;
  overallScore: number;
  snapshots: AgentSnapshotItem[];
} {
  const nowIso = params.generatedAt || new Date().toISOString();
  const dateLabel = nowIso.slice(0, 10);
  const selectedAgents = params.agents.filter((a) =>
    params.includeAgents.length > 0 ? params.includeAgents.includes(a.id) : true
  );

  const snapshots: AgentSnapshotItem[] = selectedAgents.map((agent) => {
    const prof = params.profiles.find((p) => p.agent_id === agent.id);
    const openTasks = params.tasks.filter((t) => t.agent_id === agent.id && !t.completed).length;
    const attentionCheck =
      agent.checks.find((c) => c.status === 'fail') ||
      agent.checks.find((c) => c.status === 'warning') ||
      agent.checks[0];
    return {
      agent_id: agent.id,
      name: agent.name,
      display_name: prof?.display_name || agent.name,
      score: agent.score,
      status: agent.status,
      open_tasks: openTasks,
      work_status: prof?.work_status || 'working',
      top_finding: attentionCheck
        ? `${attentionCheck.label} (${attentionCheck.metric})`
        : agent.summary
    };
  });

  const overallScore =
    snapshots.length > 0
      ? Math.round(snapshots.reduce((sum, s) => sum + s.score, 0) / snapshots.length)
      : 100;

  const totalOpenTasks = snapshots.reduce((sum, s) => sum + s.open_tasks, 0);
  const attentionCount = snapshots.filter((s) => s.status !== 'healthy').length;

  const subject = `[GitStack Daily Agent Report · ${dateLabel}] Fleet Score ${overallScore}% · ${attentionCount} Attention Item(s)`;

  const lines: string[] = [
    `GITSTACK AUTONOMOUS OPERATIONS — DAILY AGENT REPORT`,
    `Generated: ${nowIso}`,
    `Recipient: ${params.recipientEmail}`,
    `Overall Fleet Health: ${overallScore}% (${snapshots.length} Agents Audited · ${totalOpenTasks} Open Task(s))`,
    '',
    '============================================================',
    'AGENT-BY-AGENT AUDIT & WORKFLOW SUMMARY',
    '============================================================',
    ''
  ];

  for (const snap of snapshots) {
    const report = selectedAgents.find((a) => a.id === snap.agent_id);
    const agentTasks = params.tasks.filter((t) => t.agent_id === snap.agent_id && !t.completed);
    lines.push(
      `• ${snap.display_name} [${snap.status.toUpperCase()} · ${snap.score}% · Station: ${snap.work_status.toUpperCase()}]`
    );
    lines.push(`  Primary Finding: ${snap.top_finding}`);
    if (report) {
      const flagged = report.checks.filter((c) => c.status !== 'pass');
      if (flagged.length > 0) {
        for (const f of flagged) {
          lines.push(`  - [${f.status.toUpperCase()}] ${f.label}: ${f.detail}`);
        }
      } else {
        lines.push(`  - All ${report.checks.length} deterministic checks passed.`);
      }
    }
    if (agentTasks.length > 0) {
      lines.push(
        `  - Open Tasks (${agentTasks.length}): ${agentTasks.map((t) => `[${t.priority}] ${t.title}`).join('; ')}`
      );
    }
    lines.push('');
  }

  lines.push('------------------------------------------------------------');
  lines.push('Inspect live Virtual Office HQ & Proof Log in /obama -> Overview & 7 Agents.');

  return {
    subject,
    bodyText: lines.join('\n'),
    overallScore,
    snapshots
  };
}
