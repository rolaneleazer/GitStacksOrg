import type {
  AgentReport,
  AgentTask,
  CrmLead,
  CrmOutreachLog,
  DiscoveredProspectCandidate,
  ServiceCategory
} from './types.ts';

export function createInitialDemoLeads(): CrmLead[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-lead-1',
      contact_name: 'Maya Lin',
      role_title: 'VP of Engineering',
      email: 'maya.lin@vectortrace.io',
      email_status: 'verified_mx',
      company_name: 'VectorTrace Cloud',
      company_domain: 'vectortrace.io',
      website_url: 'https://vectortrace.io',
      github_url: 'https://github.com/vectortrace-io',
      phone: '+1 (415) 555-0148',
      location: 'San Francisco, CA',
      rating: null,
      source_detail: 'GitHub Trending · AI Infrastructure',
      source_type: 'github',
      source_urls: ['https://github.com/vectortrace-io', 'https://vectortrace.io'],
      tech_stack: ['TypeScript', 'Rust', 'Kubernetes', 'pgvector', 'OpenAI'],
      research_brief:
        'VectorTrace maintains an open-source distributed tracing collector with 6.4k GitHub stars. Recent release notes show growing enterprise demand for multi-tenant RBAC RAG pipelines and AWS EKS cost optimization.',
      recommended_service: 'AI Integration',
      fit_score: 94,
      deal_value: 68000,
      stage: 'proposed',
      proposal_subject: 'Multi-Tenant RAG Guardrails & EKS FinOps Architecture for VectorTrace',
      proposal_body:
        'Hi Maya,\n\nWe reviewed VectorTrace’s recent Kubernetes collector roadmap and multi-tenant enterprise backlog. GitStack can help your team ship pre-retrieval RBAC isolation and cut inference latency under 320ms p95 in a focused 6-week sprint.\n\nHappy to share a 2-page technical blueprint with your platform leads this week.\n\nBest,\nGitStack Principal Architecture Team',
      follow_up_sequence: [
        {
          step_number: 1,
          delay_days: 3,
          subject: 'Re: Multi-Tenant RAG Guardrails — benchmark notes',
          body: 'Hi Maya — sharing our reference RBAC query filter benchmarks for pgvector clusters.',
          sent_at: null
        },
        {
          step_number: 2,
          delay_days: 7,
          subject: '2-week Architecture Sprint outline for VectorTrace',
          body: 'Hi Maya — attached a sample sprint scope covering SOC2-aligned LLM audit logs.',
          sent_at: null
        },
        {
          step_number: 3,
          delay_days: 14,
          subject: 'Closing the loop on VectorTrace Q2 AI roadmap',
          body: 'Hi Maya — let me know if your team would like to revisit this next quarter.',
          sent_at: null
        }
      ],
      assigned_to: 'demo-architect',
      last_contacted_at: now,
      next_followup_at: now,
      converted_inquiry_id: null,
      created_at: now,
      updated_at: now
    },
    {
      id: 'demo-lead-2',
      contact_name: 'David Alvarez',
      role_title: 'Chief Technology Officer',
      email: 'david@meridianfreight.com',
      email_status: 'verified_mx',
      company_name: 'Meridian Freight Logistics',
      company_domain: 'meridianfreight.com',
      website_url: 'https://meridianfreight.com',
      github_url: '',
      phone: '+1 (312) 555-0194',
      location: 'Chicago, IL',
      rating: 4.8,
      source_detail: 'Google Maps · Freight & Logistics',
      source_type: 'google_maps',
      source_urls: ['https://meridianfreight.com'],
      tech_stack: ['SQL Server', 'Node.js', 'AWS', 'EDI Workflows'],
      research_brief:
        'Regional freight brokerage with 4.8★ rating and 140+ commercial reviews. Public career postings highlight manual bill-of-lading triage and customs exception bottlenecks suitable for document AI automation.',
      recommended_service: 'ML Automation',
      fit_score: 89,
      deal_value: 52000,
      stage: 'researched',
      proposal_subject: 'Automated Bill-of-Lading Extraction & Exception Triage for Meridian Freight',
      proposal_body:
        'Hi David,\n\nLooking at Meridian Freight’s Midwest expansion, manual customs and BOL triage often stalls dispatch SLAs. We help logistics operators automate document extraction and exception routing into existing ERPs with human-in-the-loop QA.\n\nOpen to a 20-minute architecture walkthrough?\n\nBest,\nGitStack Solutions',
      follow_up_sequence: [
        {
          step_number: 1,
          delay_days: 3,
          subject: 'Re: Meridian Freight BOL Automation',
          body: 'Hi David — following up with a 1-page accuracy benchmark on customs manifest parsing.',
          sent_at: null
        }
      ],
      assigned_to: 'demo-architect',
      last_contacted_at: null,
      next_followup_at: null,
      converted_inquiry_id: null,
      created_at: now,
      updated_at: now
    },
    {
      id: 'demo-lead-3',
      contact_name: 'Hannah Brooks',
      role_title: 'Head of Platform',
      email: 'hannah@kestrelbio.ai',
      email_status: 'verified_mx',
      company_name: 'Kestrel BioCompute',
      company_domain: 'kestrelbio.ai',
      website_url: 'https://kestrelbio.ai',
      github_url: 'https://github.com/kestrel-biocompute',
      phone: '',
      location: 'Boston, MA',
      rating: null,
      source_detail: 'Y Combinator · Biotech & AI',
      source_type: 'ycombinator',
      source_urls: ['https://kestrelbio.ai'],
      tech_stack: ['Python', 'PyTorch', 'Terraform', 'AWS Batch'],
      research_brief:
        'Series A computational biology startup scaling GPU batch inference clusters. Evaluating automated drift monitoring and spot-instance orchestration to cut monthly cloud compute overhead.',
      recommended_service: 'Cloud Infrastructure',
      fit_score: 91,
      deal_value: 75000,
      stage: 'follow_up',
      proposal_subject: 'GPU Spot Orchestration & MLOps Drift Pipelines for Kestrel BioCompute',
      proposal_body:
        'Hi Hannah,\n\nWe noticed Kestrel’s growth across AWS Batch workloads. GitStack builds Terraform-governed GPU autoscaling and automated model drift gates that typically trim compute spend by 30–40%.\n\nLet us know if we can share an architecture review.\n\nBest,\nGitStack Cloud Team',
      follow_up_sequence: [
        {
          step_number: 1,
          delay_days: 3,
          subject: 'AWS GPU Spot Fallback Blueprint — Kestrel BioCompute',
          body: 'Hi Hannah — sharing how we structure zero-interruption checkpointing on EKS.',
          sent_at: now
        },
        {
          step_number: 2,
          delay_days: 7,
          subject: 'Quick check-in on Kestrel infra sprint',
          body: 'Hi Hannah — happy to run a complimentary 30-min FinOps diagnostic next week.',
          sent_at: null
        }
      ],
      assigned_to: 'demo-architect',
      last_contacted_at: now,
      next_followup_at: now,
      converted_inquiry_id: null,
      created_at: now,
      updated_at: now
    },
    {
      id: 'demo-lead-4',
      contact_name: 'Marcus Chen',
      role_title: 'Founder & CEO',
      email: 'marcus@ledgerpulse.dev',
      email_status: 'verified_mx',
      company_name: 'LedgerPulse Systems',
      company_domain: 'ledgerpulse.dev',
      website_url: 'https://ledgerpulse.dev',
      github_url: '',
      phone: '+1 (212) 555-0177',
      location: 'New York, NY',
      rating: null,
      source_detail: 'Apollo.io CSV Export',
      source_type: 'apollo',
      source_urls: ['https://ledgerpulse.dev'],
      tech_stack: ['React', 'Next.js', 'PostgreSQL', 'Stripe'],
      research_brief:
        'B2B treasury reconciliation platform onboarding mid-market CFO teams. Needs real-time anomaly detection and enterprise SSO portal hardening.',
      recommended_service: 'Custom Software',
      fit_score: 86,
      deal_value: 44000,
      stage: 'discovered',
      proposal_subject: '',
      proposal_body: '',
      follow_up_sequence: [],
      assigned_to: null,
      last_contacted_at: null,
      next_followup_at: null,
      converted_inquiry_id: null,
      created_at: now,
      updated_at: now
    },
    {
      id: 'demo-lead-5',
      contact_name: 'Priya Nair',
      role_title: 'Director of Infrastructure',
      email: 'priya@stratosgrid.io',
      email_status: 'public_found',
      company_name: 'StratosGrid Telemetry',
      company_domain: 'stratosgrid.io',
      website_url: 'https://stratosgrid.io',
      github_url: 'https://github.com/stratosgrid',
      phone: '',
      location: 'Austin, TX',
      rating: null,
      source_detail: 'Hacker News · Who is Hiring',
      source_type: 'hacker_news',
      source_urls: ['https://stratosgrid.io'],
      tech_stack: ['Go', 'Kafka', 'ClickHouse', 'Kubernetes'],
      research_brief:
        'Hiring senior distributed systems engineers in HN monthly thread to handle 4B+ daily IoT telemetry events and multi-region failover.',
      recommended_service: 'Technical Consulting',
      fit_score: 83,
      deal_value: 38000,
      stage: 'discovered',
      proposal_subject: '',
      proposal_body: '',
      follow_up_sequence: [],
      assigned_to: null,
      last_contacted_at: null,
      next_followup_at: null,
      converted_inquiry_id: null,
      created_at: now,
      updated_at: now
    },
    {
      id: 'demo-lead-6',
      contact_name: 'Claire Vance',
      role_title: 'COO',
      email: 'claire@pacificmedgroup.org',
      email_status: 'verified_mx',
      company_name: 'PacificMed Clinics',
      company_domain: 'pacificmedgroup.org',
      website_url: 'https://pacificmedgroup.org',
      github_url: '',
      phone: '+1 (206) 555-0131',
      location: 'Seattle, WA',
      rating: 4.9,
      source_detail: 'Google Maps · Healthcare',
      source_type: 'google_maps',
      source_urls: ['https://pacificmedgroup.org'],
      tech_stack: ['TypeScript', 'PostgreSQL', 'HL7 FHIR', 'AWS'],
      research_brief:
        'Multi-location outpatient group completing patient intake automation and HIPAA-compliant RAG search across clinical protocols.',
      recommended_service: 'AI Integration',
      fit_score: 96,
      deal_value: 84000,
      stage: 'won',
      proposal_subject: 'HIPAA-Aligned Clinical Intake Copilot — Signed SOW',
      proposal_body: 'Kickoff sprint scheduled for Phase 1 patient intake portal & RBAC document retrieval.',
      follow_up_sequence: [],
      assigned_to: 'demo-architect',
      last_contacted_at: now,
      next_followup_at: null,
      converted_inquiry_id: 'demo-inq-won',
      created_at: now,
      updated_at: now
    }
  ];
}

export function createInitialDemoLogs(): CrmOutreachLog[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-log-1',
      lead_id: 'demo-lead-1',
      channel: 'lark_mail',
      recipient_email: 'maya.lin@vectortrace.io',
      subject: 'Multi-Tenant RAG Guardrails & EKS FinOps Architecture for VectorTrace',
      body: 'Delivered 6-week RBAC RAG architecture blueprint.',
      provider_message_id: 'smtp-sim-94f2a8c1',
      status: 'sent',
      error_detail: '',
      step_label: 'Initial Proposal',
      sent_by: 'sandbox-demo@git-stack.org',
      sent_at: now
    },
    {
      id: 'demo-log-2',
      lead_id: 'demo-lead-3',
      channel: 'lark_mail',
      recipient_email: 'hannah@kestrelbio.ai',
      subject: 'AWS GPU Spot Fallback Blueprint — Kestrel BioCompute',
      body: 'Delivered Step 1 GPU spot orchestration follow-up.',
      provider_message_id: 'smtp-sim-77b10d3e',
      status: 'sent',
      error_detail: '',
      step_label: 'Follow-Up Step 1',
      sent_by: 'sandbox-demo@git-stack.org',
      sent_at: now
    }
  ];
}

export function createInitialDemoAgents(): AgentReport[] {
  return [
    {
      id: 'traffic',
      name: 'Traffic & GEO Strategist',
      role: 'Search indexing, schema markup & AI crawler readiness',
      status: 'healthy',
      score: 96,
      summary: 'All public routes expose structured JSON-LD, XML sitemap, and llms.txt manifests.',
      checks: [
        {
          id: 'seo-1',
          label: 'Structured JSON-LD Graph',
          status: 'pass',
          metric: '100%',
          detail: 'Article, FAQPage, and WebSite schema validated across routes.'
        },
        {
          id: 'seo-2',
          label: 'AI Crawler Manifests (/llms.txt)',
          status: 'pass',
          metric: '200 OK',
          detail: 'Summary and full ingestion corpus accessible.'
        }
      ]
    },
    {
      id: 'marketing',
      name: 'Marketing & Growth Intelligence',
      role: 'Multi-source prospecting yield, editorial depth & MX deliverability',
      status: 'healthy',
      score: 94,
      summary: 'DNS MX verification passing on 83% of discovered decision-maker emails.',
      checks: [
        {
          id: 'mkt-1',
          label: 'MX Deliverability Guard',
          status: 'pass',
          metric: '83% MX',
          detail: 'Domain MX checks verified before outreach queue entry.'
        }
      ]
    },
    {
      id: 'booking',
      name: 'Booking & Funnel Strategist',
      role: 'CTA placement, inquiry capture & pipeline velocity',
      status: 'healthy',
      score: 92,
      summary: 'Interactive consultation forms and demo sandbox paths wired to intake API.',
      checks: [
        {
          id: 'fnl-1',
          label: 'Pipeline Conversion Paths',
          status: 'pass',
          metric: '4.2% est.',
          detail: 'Hero CTA, Service specs, and Demo conversion flow active.'
        }
      ]
    },
    {
      id: 'adsense',
      name: 'AdSense & Compliance Guard',
      role: 'AdSense readiness, legal trust pages & cookie consent',
      status: 'healthy',
      score: 98,
      summary: 'GDPR consent banner, ads.txt, privacy, and editorial disclosures active.',
      checks: [
        {
          id: 'cmp-1',
          label: 'Policy & Legal Coverage',
          status: 'pass',
          metric: '5/5 pages',
          detail: 'Privacy, Terms, Cookie, Disclaimer, and Editorial policies live.'
        }
      ]
    },
    {
      id: 'qa',
      name: 'Platform QA Monitor',
      role: 'Endpoint latency, link integrity & build stability',
      status: 'healthy',
      score: 95,
      summary: 'Core routes, database queries, and static assets responding within SLO.',
      checks: [
        {
          id: 'qa-1',
          label: 'API Response Latency (p95)',
          status: 'pass',
          metric: '118ms',
          detail: 'Public endpoints operating well below 350ms target.'
        }
      ]
    },
    {
      id: 'ceo',
      name: 'CEO & Operations Triage',
      role: 'Executive pipeline triage, proposal SLAs & workflow queues',
      status: 'attention',
      score: 88,
      summary: '2 discovered leads awaiting AI research brief and proposal generation.',
      checks: [
        {
          id: 'ceo-1',
          label: 'Unresearched CRM Backlog',
          status: 'warning',
          metric: '2 leads',
          detail: 'Run AI Research in the CRM tab to draft executive proposals.'
        }
      ]
    },
    {
      id: 'cybersecurity',
      name: 'Cybersecurity & Vault Auditor',
      role: 'Encrypted API secret vault, SSL/TLS handshakes & RBAC guardrails',
      status: 'healthy',
      score: 97,
      summary: 'AES-256-GCM integration vault sealed and public sandbox isolated from live data.',
      checks: [
        {
          id: 'sec-1',
          label: 'Sandbox Isolation & Vault Encryption',
          status: 'pass',
          metric: 'AES-256',
          detail: 'Zero live tokens or production CRM rows exposed in public routes.'
        }
      ]
    }
  ];
}

export function createInitialDemoTasks(): AgentTask[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-task-1',
      agent_id: 'ceo',
      title: 'Generate AI proposal brief for LedgerPulse Systems',
      priority: 'high',
      completed: false,
      notes: 'System recommendation from pipeline triage.',
      updated_at: now
    },
    {
      id: 'demo-task-2',
      agent_id: 'marketing',
      title: 'Verify MX records on newly discovered Hacker News leads',
      priority: 'medium',
      completed: false,
      notes: 'Automated outreach deliverability check.',
      updated_at: now
    },
    {
      id: 'demo-task-3',
      agent_id: 'qa',
      title: 'Confirm Lark SMTP SSL port 465 handshake before outbound sprint',
      priority: 'low',
      completed: true,
      notes: 'Verified by operator checklist.',
      updated_at: now
    }
  ];
}

export interface DemoDiscoveryItem {
  candidate: DiscoveredProspectCandidate;
  category: 'google_maps' | 'github' | 'hacker_news';
  coordinates?: { lat: number; lng: number };
  address?: string;
  ratingLabel?: string;
}

export const DEMO_DISCOVERY_ITEMS: DemoDiscoveryItem[] = [
  {
    category: 'google_maps',
    address: '540 Howard St, San Francisco, CA',
    ratingLabel: '4.9★ (218 reviews)',
    coordinates: { lat: 37.7873, lng: -122.3968 },
    candidate: {
      id: 'demo-disc-maps-1',
      contact_name: 'BayBridge Dental Partners',
      role_title: 'Healthcare Operations · 4.9★',
      email: 'ops@baybridgedental.com',
      email_status: 'verified_mx',
      company_name: 'BayBridge Dental Partners',
      company_domain: 'baybridgedental.com',
      website_url: 'https://baybridgedental.com',
      github_url: '',
      phone: '+1 (415) 555-0182',
      location: 'San Francisco, CA',
      rating: 4.9,
      source_detail: 'Google Maps · Healthcare Clinic',
      source_type: 'google_maps',
      source_urls: ['https://baybridgedental.com'],
      tech_stack: ['Patient Intake AI', 'TypeScript', 'PostgreSQL'],
      fit_score: 88,
      snippet: 'Multi-clinic dental group seeking automated patient scheduling & insurance verification.',
      external_id: 'demo-place-1'
    }
  },
  {
    category: 'google_maps',
    address: '801 Congress Ave, Austin, TX',
    ratingLabel: '4.7★ (94 reviews)',
    coordinates: { lat: 30.2701, lng: -97.7429 },
    candidate: {
      id: 'demo-disc-maps-2',
      contact_name: 'LoneStar ColdChain Logistics',
      role_title: 'Fleet & Warehousing · 4.7★',
      email: 'dispatch@lonestarcoldchain.io',
      email_status: 'verified_mx',
      company_name: 'LoneStar ColdChain Logistics',
      company_domain: 'lonestarcoldchain.io',
      website_url: 'https://lonestarcoldchain.io',
      github_url: '',
      phone: '+1 (512) 555-0166',
      location: 'Austin, TX',
      rating: 4.7,
      source_detail: 'Google Maps · Cold Storage Fleet',
      source_type: 'google_maps',
      source_urls: ['https://lonestarcoldchain.io'],
      tech_stack: ['IoT Telemetry', 'AWS', 'Node.js'],
      fit_score: 90,
      snippet: 'Refrigerated freight operator needing real-time IoT temperature alerting & route SLA analytics.',
      external_id: 'demo-place-2'
    }
  },
  {
    category: 'github',
    candidate: {
      id: 'demo-disc-gh-1',
      contact_name: 'Liam Gallagher',
      role_title: 'Core Maintainer · 8.2k GitHub Stars',
      email: 'liam@meshgateway.dev',
      email_status: 'verified_mx',
      company_name: 'MeshGateway OSS',
      company_domain: 'meshgateway.dev',
      website_url: 'https://meshgateway.dev',
      github_url: 'https://github.com/meshgateway',
      location: 'Seattle, WA',
      source_detail: 'GitHub Trending · Cloud & DevTools',
      source_type: 'github',
      source_urls: ['https://github.com/meshgateway', 'https://meshgateway.dev'],
      tech_stack: ['Go', 'Kubernetes', 'Terraform', 'Envoy'],
      fit_score: 93,
      snippet: 'Open-source API gateway project adding enterprise zero-trust control plane.',
      external_id: 'demo-gh-1'
    }
  },
  {
    category: 'github',
    candidate: {
      id: 'demo-disc-gh-2',
      contact_name: 'Sora Takahashi',
      role_title: 'Principal Maintainer · 5.1k Stars',
      email: 'sora@evalforge.ai',
      email_status: 'public_found',
      company_name: 'EvalForge Labs',
      company_domain: 'evalforge.ai',
      website_url: 'https://evalforge.ai',
      github_url: 'https://github.com/evalforge-ai',
      location: 'Remote / US',
      source_detail: 'GitHub Trending · AI & LLM',
      source_type: 'github',
      source_urls: ['https://github.com/evalforge-ai', 'https://evalforge.ai'],
      tech_stack: ['TypeScript', 'Python', 'Gemini API', 'Docker'],
      fit_score: 91,
      snippet: 'LLM groundedness regression framework expanding into hosted CI pipelines.',
      external_id: 'demo-gh-2'
    }
  },
  {
    category: 'hacker_news',
    candidate: {
      id: 'demo-disc-hn-1',
      contact_name: 'Rachel Meyer',
      role_title: 'VP Engineering · HN Who is Hiring',
      email: 'engineering@harborfintech.com',
      email_status: 'verified_mx',
      company_name: 'Harbor FinTech',
      company_domain: 'harborfintech.com',
      website_url: 'https://harborfintech.com',
      github_url: '',
      location: 'New York, NY',
      source_detail: 'Hacker News Hiring Thread',
      source_type: 'hacker_news',
      source_urls: ['https://harborfintech.com'],
      tech_stack: ['TypeScript', 'React', 'PostgreSQL', 'AWS'],
      fit_score: 87,
      snippet: 'Hiring platform engineers to modernize legacy settlement APIs into typed microservices.',
      external_id: 'demo-hn-1'
    }
  }
];

export function simulateDemoAiResearch(lead: CrmLead): CrmLead {
  const stackText = lead.tech_stack.join(' ').toLowerCase();
  let recommended: ServiceCategory = lead.recommended_service || 'AI Integration';
  if (/kubernetes|terraform|aws|go/.test(stackText)) recommended = 'Cloud Infrastructure';
  else if (/react|next\.js|stripe|postgres/.test(stackText)) recommended = 'Custom Software';
  else if (/ai|llm|pytorch|rag|gemini/.test(stackText)) recommended = 'AI Integration';

  const now = new Date().toISOString();
  const nextFit = Math.max(lead.fit_score, 90);
  const nextVal = Math.max(lead.deal_value, 48000);

  return {
    ...lead,
    fit_score: nextFit,
    deal_value: nextVal,
    recommended_service: recommended,
    stage: lead.stage === 'discovered' ? 'researched' : lead.stage,
    research_brief: `${lead.research_brief}\n\n[Sandbox AI Qualification]: Verified ${
      lead.tech_stack.length ? lead.tech_stack.join(', ') : 'cloud-native'
    } stack alignment. Recommended 6-week ${recommended} engagement focusing on reliability, automated QA gates, and measurable operational ROI.`,
    proposal_subject:
      lead.proposal_subject ||
      `${recommended} Architecture & 6-Week Delivery Plan for ${lead.company_name}`,
    proposal_body:
      lead.proposal_body ||
      `Hi ${lead.contact_name.split(' ')[0] || 'Team'},\n\nWe analyzed ${
        lead.company_name
      }’s engineering footprint (${
        lead.tech_stack.join(', ') || 'modern cloud stack'
      }) and mapped a focused ${recommended} sprint.\n\nKey milestones:\n1. Week 1–2: Architecture & Security Baseline Audit\n2. Week 3–5: Production Pilot Integration & Automated Regression QA\n3. Week 6: Load Hardening & Team Handoff\n\nWould you like to review the 2-page technical scope on a brief call?\n\nBest regards,\nGitStack Engineering`,
    follow_up_sequence:
      lead.follow_up_sequence.length > 0
        ? lead.follow_up_sequence
        : [
            {
              step_number: 1,
              delay_days: 3,
              subject: `Re: ${recommended} Architecture Plan for ${lead.company_name}`,
              body: `Hi ${
                lead.contact_name.split(' ')[0] || 'there'
              } — sharing our implementation checklist and reference SLO metrics.`,
              sent_at: null
            },
            {
              step_number: 2,
              delay_days: 7,
              subject: `Sample 6-week sprint timeline for ${lead.company_name}`,
              body: `Hi ${
                lead.contact_name.split(' ')[0] || 'there'
              } — happy to tailor this scope around your current quarter priorities.`,
              sent_at: null
            }
          ],
    updated_at: now
  };
}

export interface DemoBackOfficeSearchUrl {
  url: string;
  title: string;
  metaDescription: string;
  primaryKeyword: string;
  seoScore: number;
  googleIndexed: boolean;
  bingIndexed: boolean;
  aiSearchReady: boolean;
  monthlyClicks: number;
  avgPosition: number;
  aiSuggestions: string[];
}

export interface DemoBackOfficeSocialPost {
  id: string;
  dayLabel: string;
  platform: 'facebook' | 'tiktok';
  headline: string;
  caption: string;
  hashtags: string[];
  ctaUrl: string;
  status: 'scheduled' | 'simulated_published';
  coverImage: string;
}

export interface DemoBackOfficeTrendBundle {
  id: string;
  trendTitle: string;
  region: string;
  trafficLabel: string;
  status: 'pending_approval' | 'approved_simulated' | 'rejected_simulated';
  articleTitle: string;
  articleCategory: ServiceCategory;
  wordCount: number;
  qualityScore: number;
  fbHeadline: string;
  ttHook: string;
  coverImage: string;
}

export interface DemoBackOfficeContactEntry {
  id: string;
  scope: 'page' | 'article' | 'module';
  scopeTitle: string;
  kind: 'email' | 'phone' | 'name';
  fieldLabel: string;
  value: string;
}

export function createInitialDemoBackOfficeState() {
  return {
    brandName: 'GitStack Sandbox Corp',
    brandColor: '#4338CA',
    homeHeroTitle: 'Enterprise AI Integration & Cloud Systems Built for Scale',
    homeHeroSubtitle:
      'Production-hardened RAG copilots, automated BIR EIS compliance, and cloud FinOps infrastructure delivered in 14-day sprints.',
    searchUrls: [
      {
        url: 'https://sandbox.git-stack.org/',
        title: 'GitStack | Enterprise AI Integration & Custom Cloud Engineering',
        metaDescription:
          'Turnkey AI RAG pipelines, MLOps automation, BIR EIS invoicing, and dedicated AWS/PostgreSQL systems.',
        primaryKeyword: 'enterprise AI integration',
        seoScore: 96,
        googleIndexed: true,
        bingIndexed: true,
        aiSearchReady: true,
        monthlyClicks: 1840,
        avgPosition: 2.4,
        aiSuggestions: [
          'Add concrete ROI case study metrics (e.g., 42% faster invoice settlement) above the fold.',
          'Keep SoftwareApplication JSON-LD linked to /demo for direct rich snippet eligibility.'
        ]
      },
      {
        url: 'https://sandbox.git-stack.org/insights/enterprise-rag-pipelines',
        title: 'Architecting Production RAG Pipelines with Zero-Trust RBAC | GitStack',
        metaDescription:
          'Blueprint for hybrid BM25 + vector retrieval, tenant ACL filtering, and sub-350ms p95 citation checks.',
        primaryKeyword: 'production RAG pipelines',
        seoScore: 94,
        googleIndexed: true,
        bingIndexed: true,
        aiSearchReady: true,
        monthlyClicks: 1120,
        avgPosition: 3.1,
        aiSuggestions: [
          'Expand benchmark table with cross-encoder latency numbers for 100k chunks.',
          'Link internally to /demo interactive AI Concierge sandbox for conversion uplift.'
        ]
      },
      {
        url: 'https://sandbox.git-stack.org/demo',
        title: 'Live B2B SaaS Product Demos & Interactive Back Office | GitStack',
        metaDescription:
          'Test-drive Inventory Sync, BIR E-Invoicing, AI Support Concierge, FlowCRM, and Back Office OS.',
        primaryKeyword: 'B2B SaaS interactive demo',
        seoScore: 91,
        googleIndexed: true,
        bingIndexed: false,
        aiSearchReady: true,
        monthlyClicks: 640,
        avgPosition: 5.8,
        aiSuggestions: [
          'Submit updated /sitemap.xml to Bing Webmaster Tools to accelerate demo URL indexing.',
          'Include explicit FAQPage JSON-LD covering 24-hour sandbox security guarantees.'
        ]
      }
    ] as DemoBackOfficeSearchUrl[],
    socialSchedule: [
      {
        id: 'demo-soc-1',
        dayLabel: 'Mon · Day 1',
        platform: 'facebook',
        headline: 'Stop Overselling Across Shopee, Lazada & TikTok Shop',
        caption:
          'See how real-time webhook inventory locking prevents negative stockouts during 11.11 & payday flash sales. Try the interactive demo free.',
        hashtags: ['#OmnichannelERP', '#PhilippinesSME', '#GitStack'],
        ctaUrl: 'https://sandbox.git-stack.org/demo#inventory_sync',
        status: 'scheduled',
        coverImage: '/src/assets/images/cover_custom_software_1795220240531.jpg'
      },
      {
        id: 'demo-soc-2',
        dayLabel: 'Tue · Day 2',
        platform: 'tiktok',
        headline: '60-Second BIR EIS JSON Signing Breakdown',
        caption:
          'Automated 12% VAT validation + JWS cryptographic signing straight from your POS/ERP without manual spreadsheet uploads.',
        hashtags: ['#BIREIS', '#FinTechPH', '#SoftwareEngineering'],
        ctaUrl: 'https://sandbox.git-stack.org/demo#einvoice',
        status: 'scheduled',
        coverImage: '/src/assets/images/cover_trend_social_1795220240530.jpg'
      },
      {
        id: 'demo-soc-3',
        dayLabel: 'Wed · Day 3',
        platform: 'facebook',
        headline: 'Cut LLM API Spend by 55% With Tiered Semantic Caching',
        caption:
          'Why routing simple support queries to smaller models before calling frontier reasoning models protects SaaS margins.',
        hashtags: ['#AIEngineering', '#LLMOps', '#CloudFinOps'],
        ctaUrl: 'https://sandbox.git-stack.org/demo#ai_concierge',
        status: 'simulated_published',
        coverImage: '/src/assets/images/cover_data_analytics_1795220240573.jpg'
      }
    ] as DemoBackOfficeSocialPost[],
    trendQueue: [
      {
        id: 'demo-trb-1',
        trendTitle: 'BIR EIS 2026 Automated Electronic Invoicing API',
        region: 'PH',
        trafficLabel: 'Breakout · +420%',
        status: 'pending_approval',
        articleTitle: 'Implementing Compliant BIR EIS JWS Signing Pipelines in Node.js',
        articleCategory: 'Custom Software',
        wordCount: 1180,
        qualityScore: 95,
        fbHeadline: 'Ready for BIR Electronic Invoicing Audits?',
        ttHook: '3 bugs that break BIR EIS JSON transmission before launch',
        coverImage: '/src/assets/images/cover_technical_consulting_1795220239502.jpg'
      },
      {
        id: 'demo-trb-2',
        trendTitle: 'Zero-Trust Row-Level Security for Enterprise AI Agents',
        region: 'GLOBAL',
        trafficLabel: 'Surging · +210%',
        status: 'pending_approval',
        articleTitle: 'Pre-Retrieval Tenant ACLs for Multi-Department AI Copilots',
        articleCategory: 'AI Integration',
        wordCount: 1340,
        qualityScore: 97,
        fbHeadline: 'Stop AI Copilots From Leaking Restricted Payroll Files',
        ttHook: 'How enterprise teams lock down RAG vector search in 4 lines',
        coverImage: '/src/assets/images/cover_security_devops_1795220240902.jpg'
      }
    ] as DemoBackOfficeTrendBundle[],
    contactRegistry: [
      {
        id: 'demo-cnt-1',
        scope: 'page',
        scopeTitle: 'Public Contact & Legal Pages',
        kind: 'email',
        fieldLabel: 'Sandbox Sales Inquiries',
        value: 'sandbox-demo@git-stack.org'
      },
      {
        id: 'demo-cnt-2',
        scope: 'page',
        scopeTitle: 'Public Contact & Legal Pages',
        kind: 'phone',
        fieldLabel: 'Simulated Hotline',
        value: '+1 (555) 019-2834'
      },
      {
        id: 'demo-cnt-3',
        scope: 'article',
        scopeTitle: 'Technical Insights Authors',
        kind: 'name',
        fieldLabel: 'Sample Principal Architect',
        value: 'Alex Rivera (Demo Author)'
      },
      {
        id: 'demo-cnt-4',
        scope: 'module',
        scopeTitle: 'Alert Notification Target',
        kind: 'email',
        fieldLabel: 'Demo Notification Target',
        value: 'alerts-sandbox@git-stack.org'
      }
    ] as DemoBackOfficeContactEntry[],
    analyticsMetrics: {
      periodLabel: 'Last 30 Days (Synthetic Sample)',
      pageviews: 18420,
      uniqueVisitors: 6290,
      conversionRate: '4.6%',
      cloudflareRequests24h: 48210,
      cloudflareCacheHit: '89.4%',
      gtmEventsLogged: 3140
    },
    chatMessages: [
      {
        id: 'demo-msg-1',
        sender: 'visitor',
        author: 'Carla Mendoza (Retail Ops)',
        text: 'Can your Inventory Sync handle 40+ SKUs across two Shopee stores cleanly?',
        time: '10:14 AM'
      },
      {
        id: 'demo-msg-2',
        sender: 'operator',
        author: 'Sandbox Operator',
        text: 'Yes—multi-store OAuth tokens isolate per-shop inventory pools with sub-second lock reconciliation.',
        time: '10:16 AM'
      }
    ],
    guardStatus: {
      isolationVerified: true,
      adminCallsBlocked: 0,
      baselineHash: 'sha256:9f84b2...sandbox',
      message: 'Live Demo Back Office running strictly inside browser memory. Zero live database writes.'
    }
  };
}

