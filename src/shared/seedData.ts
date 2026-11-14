import type { AdSenseSettings, AnalyticsEvent, Article, ArticleComment, ClientInquiry, NewsletterSubscriber } from './types.ts';
import { evaluateArticleQuality } from './qualityGate.ts';

const HERO_IMG = '/src/assets/images/hero_gitstack_architecture_1794645171609.jpg';
const AI_PIPELINE_IMG = '/src/assets/images/ai_ml_pipeline_visual_1794645170877.jpg';
const CLOUD_IMG = '/src/assets/images/cloud_infra_architecture_1794645172181.jpg';
const PRISM_IMG = '/src/assets/images/insight_cover_ai_agents_1794645171607.jpg';

const rawSeedArticles: Omit<Article, 'word_count' | 'read_time_minutes' | 'quality_score' | 'geo_score'>[] = [
  {
    id: 'art-rag-enterprise-2026',
    slug: 'architecting-production-rag-pipelines-for-enterprise-knowledge-bases',
    title: 'Architecting Production RAG Pipelines for Enterprise Knowledge Bases',
    summary_tldr:
      'Production Retrieval-Augmented Generation requires hybrid lexical-vector indexing, document-level access control enforcement prior to context assembly, and continuous groundedness evaluation to eliminate hallucinations in enterprise deployments.',
    category: 'AI Integration',
    author_name: 'Elena Vance',
    author_role: 'Principal AI Systems Architect, GitStack',
    author_bio:
      'Elena leads AI Integration architecture at GitStack, designing retrieval pipelines and LLM governance layers for regulated financial and logistics enterprises.',
    cover_image: PRISM_IMG,
    cover_alt: 'Optical glass prisms refracting cobalt blue light on a white surface representing structured AI retrieval',
    meta_title: 'Architecting Production RAG Pipelines for Enterprise AI | GitStack',
    meta_description:
      'Learn how GitStack builds enterprise RAG pipelines with hybrid search, RBAC permissions, reranking, and deterministic citation evaluation.',
    primary_keyword: 'enterprise RAG pipelines',
    faqs: [
      {
        question: 'Why do prototype RAG pipelines fail when moved into enterprise production?',
        answer:
          'Prototype RAG systems usually rely on naive fixed-size chunking and cosine similarity alone, which breaks down on multi-column tables, acronyms, and permission-restricted internal documents. Production systems require hybrid retrieval, cross-encoder reranking, and strict access-control filtering.'
      },
      {
        question: 'How does GitStack enforce document permissions inside an AI assistant?',
        answer:
          'GitStack attaches user group and tenant metadata attributes to every indexed chunk and applies pre-retrieval metadata filters derived from the caller identity token, ensuring restricted records never enter the language model context window.'
      },
      {
        question: 'Which metrics matter most when evaluating enterprise RAG quality?',
        answer:
          'Teams should track context recall, citation faithfulness (whether every generated claim maps to a retrieved source), p95 retrieval latency under 350 milliseconds, and cost per resolved query.'
      }
    ],
    references: [
      {
        title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (Lewis et al.)',
        url: 'https://arxiv.org/abs/2005.11401'
      },
      {
        title: 'NIST AI Risk Management Framework (AI RMF 1.0)',
        url: 'https://www.nist.gov/itl/ai-risk-management-framework'
      },
      {
        title: 'Google Search Central: Creating Helpful, Reliable, People-First Content',
        url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content'
      }
    ],
    status: 'published',
    published_at: '2026-10-18T09:00:00Z',
    updated_at: '2026-11-02T14:30:00Z',
    created_at: '2026-10-15T11:00:00Z',
    content_markdown: `## Why Prototype Retrieval Fails Under Enterprise Load

Most organizations start their generative AI journey by wiring a document loader to an off-the-shelf vector database and prompting a frontier model with the top five nearest neighbors. In a twenty-document demo, that pattern looks promising. Across two million internal engineering specifications, policy PDFs, support tickets, and SQL reports, naive vector search degrades rapidly. Exact part numbers, compliance codes, and multi-page financial tables lose semantic fidelity when sliced into arbitrary 500-token windows.

At GitStack, our AI Integration engagements begin by treating retrieval as a deterministic information-engineering problem rather than a prompt-engineering experiment. Before writing an orchestration loop, teams must establish clear boundaries for ingestion freshness, permission inheritance, and verifiable grounding.

## Designing a Structure-Aware Ingestion Pipeline

Reliable enterprise RAG pipelines depend on preserving document hierarchy during parsing. Stripping headings, table headers, and section numbers removes the exact context an LLM needs to interpret numbers accurately.

Instead of uniform sliding windows, GitStack recommends semantic-structural chunking:

- **Layout-aware PDF and Office extraction**: Parse tables into clean Markdown or JSON structures and keep table captions bound to every row group.
- **Hierarchical parent-child indexing**: Embed small, focused child passages (180–260 tokens) for precise retrieval while fetching the enclosing parent section (800–1,200 tokens) so the model receives complete reasoning context.
- **Metadata enrichment at write time**: Stamp every record with source system, canonical URL, effective date, owner team, and Access Control List (ACL) identifiers.
- **Incremental change-data capture**: Use content hashing and webhook listeners from SharePoint, Confluence, Notion, or S3 so deleted or superseded policies are purged within minutes rather than lingering in vector indexes.

\`\`\`typescript
interface IndexedChunk {
  chunkId: string;
  parentDocumentId: string;
  sectionPath: string[];
  aclGroups: string[];
  contentHash: string;
  denseVector: number[];
  lexicalTokens: string;
  updatedAt: string;
}
\`\`\`

## Hybrid Search and Cross-Encoder Reranking

Dense embeddings excel at capturing conceptual synonyms, such as matching "employee onboarding delays" with "new hire provisioning bottlenecks." However, dense vectors notoriously struggle with exact SKU codes, error identifiers like \`ERR_SSL_VERSION_OR_CIPHER_MISMATCH\`, and proper nouns.

Combining sparse BM25 lexical scoring with dense vector similarity via Reciprocal Rank Fusion (RRF) resolves both failure modes simultaneously. Once the hybrid stage retrieves the top 40 to 60 candidate passages within 80 milliseconds, a lightweight cross-encoder reranker scores each query-passage pair jointly and trims the context to the highest-signal 6 to 8 passages. Across GitStack client benchmarks, introducing hybrid search plus reranking routinely improves answer faithfulness by 28% to 37% while reducing prompt token volume by nearly 40%.

## Enforcing Zero-Trust Access Control Before Prompt Assembly

Security breaches in internal AI copilots rarely stem from model weights; they happen when retrieval layers ignore document permissions. If an HR salary spreadsheet is embedded into a shared vector index without tenant and group filtering, any employee asking a clever question can surface restricted figures.

GitStack enforces **pre-retrieval ACL filtering** at the database query boundary. Every request carries a verified identity token whose group claims are passed directly into the vector and lexical search predicates. If a user lacks read access to a source document, that chunk is excluded before similarity ranking ever runs—making unauthorized leakage structurally impossible inside the model prompt.

## Continuous Groundedness Evaluation and Observability

Shipping an AI integration without automated regression testing turns every prompt tweak or model upgrade into a blind deployment. Engineering teams should maintain a golden evaluation dataset of 150 to 300 real domain queries paired with expected source documents and unacceptable failure patterns.

| Evaluation Dimension | Target Threshold | Measurement Mechanism |
| :--- | :--- | :--- |
| Context Recall@8 | >= 90% | Automated benchmark against golden document IDs |
| Citation Faithfulness | >= 96% | Claim-by-claim entailment verification against retrieved text |
| Retrieval p95 Latency | <= 350 ms | Distributed tracing across embedding, search, and rerank |
| Hallucinated Citation Rate | < 0.5% | Deterministic regex and chunk-ID verification on output |

Every production response should emit structured telemetry capturing retrieved chunk IDs, reranker scores, token consumption, latency breakdowns, and user feedback signals. When a model cannot find high-confidence evidence above the calibrated reranker threshold, the system must explicitly abstain and point the user to the nearest verified human owner rather than fabricating a plausible paragraph.

## Deployment Checklist for Engineering Leaders

Organizations preparing to move enterprise RAG pipelines from pilot to production should validate five operational requirements before opening access company-wide:

1. **Data freshness SLA**: Define maximum acceptable lag between source edits and index updates.
2. **Abstention fallback**: Configure confidence thresholds so low-evidence queries return transparent "not found in verified records" responses.
3. **Citation UI verification**: Render clickable inline footnotes linking directly to the exact paragraph or revision timestamp in the system of record.
4. **Prompt injection isolation**: Treat retrieved external text strictly as untrusted data blocks rather than executable system instructions.
5. **Cost circuit breakers**: Apply semantic caching for recurring high-frequency operational questions and enforce per-tenant token quotas.`
  },
  {
    id: 'art-mlops-automation-2026',
    slug: 'automated-mlops-zero-downtime-model-retraining-and-drift-detection',
    title: 'Automated MLOps: Zero-Downtime Model Retraining and Drift Detection on Kubernetes',
    summary_tldr:
      'Automated MLOps pipelines replace fragile manual notebook deployments with event-driven drift monitoring, reproducible feature stores, shadow canary rollouts, and automated rollback gates on Kubernetes.',
    category: 'ML Automation',
    author_name: 'Marcus Chen',
    author_role: 'Head of Machine Learning Engineering, GitStack',
    author_bio:
      'Marcus architects machine learning automation systems and high-throughput inference clusters at GitStack across predictive maintenance and fintech scoring.',
    cover_image: AI_PIPELINE_IMG,
    cover_alt: 'Isometric technical architecture rendering of modular AI integration and ML automation pipeline blocks',
    meta_title: 'Automated MLOps & Zero-Downtime Drift Detection | GitStack',
    meta_description:
      'Discover how GitStack engineers automated MLOps pipelines with statistical drift detection, reproducible training, and canary Kubernetes deployments.',
    primary_keyword: 'automated MLOps',
    faqs: [
      {
        question: 'When does a company need automated MLOps instead of scheduled weekly retraining?',
        answer:
          'Event-driven MLOps becomes essential whenever customer behavior, pricing regimes, or sensor distributions shift unpredictably, or when silent model degradation directly impacts revenue, fraud losses, or operational safety.'
      },
      {
        question: 'How do you deploy a retrained machine learning model without downtime?',
        answer:
          'GitStack uses shadow traffic mirroring followed by progressive canary routing on Kubernetes, promoting the candidate model only after real-time latency, error rates, and prediction distribution checks pass.'
      }
    ],
    references: [
      {
        title: 'Hidden Technical Debt in Machine Learning Systems (Sculley et al.)',
        url: 'https://proceedings.neurips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html'
      },
      {
        title: 'Kubernetes Horizontal Pod Autoscaling Documentation',
        url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/'
      }
    ],
    status: 'published',
    published_at: '2026-10-25T10:15:00Z',
    updated_at: '2026-11-05T09:20:00Z',
    created_at: '2026-10-22T08:00:00Z',
    content_markdown: `## Moving Beyond Notebook-Driven Machine Learning

Across dozens of enterprise assessments, GitStack encounters the same operational bottleneck: data science teams build accurate predictive models in isolated notebooks, yet moving a single model update into production takes six weeks of manual handoffs, container rebuilds, and brittle Python environment fixes. Worse, once deployed, nobody notices when real-world data shifts until business KPIs drop weeks later.

Automated MLOps solves this reliability gap by applying the same continuous integration, automated testing, and immutable artifact promotion discipline that transformed web software delivery—adapted specifically for datasets, feature transformations, and probabilistic model weights.

## Closing the Training-Serving Skew Gap

The single most common source of silent accuracy collapse in production machine learning is training-serving skew: the feature calculation logic run inside a batch SQL training notebook diverges subtly from the real-time TypeScript or Python microservice preparing inference payloads.

To eliminate skew permanently, GitStack standardizes on declarative feature definitions backed by a unified offline-online feature store:

- **Single transformation graph**: Time-window aggregations, categorical encodings, and missing-value imputations are versioned in Git alongside model code.
- **Point-in-time joins**: Historical training snapshots reconstruct exact feature values as they existed prior to each label event, preventing subtle target leakage.
- **Schema contracts at ingestion**: Incoming event streams are validated with strict schema checks so upstream API changes fail loudly before corrupting downstream predictions.

## Continuous Statistical Drift Detection

Models do not fail like web servers with obvious HTTP 500 errors; they fail quietly while returning HTTP 200 JSON responses with steadily worsening calibration. Automated MLOps pipelines monitor three distinct drift layers continuously:

1. **Covariate (Feature) Drift**: Tracks Population Stability Index (PSI) and Kolmogorov-Smirnov or Wasserstein distances on critical input features against the training baseline.
2. **Prediction Drift**: Measures shifts in output probability distributions—such as a fraud classifier suddenly flagging 9% of transactions instead of its historical 1.4% baseline.
3. **Delayed Ground-Truth Performance**: Joins predictions against confirmed outcomes (conversions, equipment failures, chargebacks) as soon as labels arrive to compute rolling precision, recall, and calibration error.

| Drift Signal | Warning Threshold | Automated System Action |
| :--- | :--- | :--- |
| Feature PSI >= 0.20 | Sustained for 6 hours | Trigger shadow retraining DAG and alert ML owner |
| Inference p99 Latency > 120ms | 5-minute window | Scale GPU/CPU inference replicas via KEDA metrics |
| Calibration Error > +15% | Rolling 24-hour labels | Freeze automated promotion and require human sign-off |

## Event-Driven Retraining and Validation Gates

Rather than blindly overwriting production models on a calendar schedule, GitStack orchestrates retraining workflows as immutable DAGs triggered either by confirmed drift thresholds or significant new labeled data volume. Every candidate model must pass an automated quality gate before touching live traffic:

- **Holdout parity check**: Candidate beats or matches the active production champion on recent stratified evaluation slices, not just global averages.
- **Bias and subgroup guardrails**: Accuracy and false-positive rates remain within policy bounds across regional or customer-tier cohorts.
- **Inference resource benchmark**: Serialized ONNX or TensorRT artifact meets strict memory ceilings and cold-start limits inside a reproducible container image.

## Shadow Mirroring and Canary Promotion on Kubernetes

Once a candidate model clears offline validation, Kubernetes progressive delivery controllers roll it out in two low-risk stages. First, **shadow mirroring** duplicates live production inference payloads asynchronously to the candidate pod without exposing its response to callers. Engineering teams compare live latency, CPU/GPU saturation, and prediction divergence for 24 hours at zero user risk.

Next, **canary traffic shifting** routes 5%, then 25%, then 100% of requests to the new revision while watching Prometheus SLO alerts. If error rates spike or latency crosses budget, the ingress controller reverts 100% of traffic to the previous immutable digest in under three seconds—delivering true zero-downtime machine learning automation.`
  },
  {
    id: 'art-cloud-terraform-governance-2026',
    slug: 'multi-region-cloud-infrastructure-governance-with-terraform-and-policy-as-code',
    title: 'Multi-Region Cloud Infrastructure Governance with Terraform and Policy-as-Code',
    summary_tldr:
      'Managing multi-region cloud environments safely at scale requires modular Terraform stacks, remote state locking, automated OPA policy-as-code checks in CI, and standardized FinOps cost guardrails.',
    category: 'Cloud Infrastructure',
    author_name: 'David Morales',
    author_role: 'Director of Cloud Engineering, GitStack',
    author_bio:
      'David directs cloud infrastructure management and DevSecOps transformations at GitStack, specializing in resilient multi-region Kubernetes and FinOps governance.',
    cover_image: CLOUD_IMG,
    cover_alt: 'Cloud systems engineer reviewing infrastructure topology diagrams in a sunlit architectural office',
    meta_title: 'Multi-Region Cloud Governance with Terraform & OPA | GitStack',
    meta_description:
      'Explore GitStack patterns for multi-region cloud infrastructure management using Terraform modules, OPA policy-as-code, and automated FinOps controls.',
    primary_keyword: 'cloud infrastructure management',
    faqs: [
      {
        question: 'How does policy-as-code prevent cloud security misconfigurations?',
        answer:
          'Policy-as-code engines like Open Policy Agent inspect Terraform execution plans in CI before resources are provisioned, automatically blocking unencrypted storage buckets, public database ports, or overly permissive IAM roles.'
      },
      {
        question: 'Why should teams split monolithic Terraform state files?',
        answer:
          'Monolithic state files slow down CI plans, widen blast radius during mistakes, and create lock contention across teams. Splitting state by lifecycle and region isolates networking, data stores, and application compute cleanly.'
      }
    ],
    references: [
      {
        title: 'Open Policy Agent (OPA) Terraform Plan Evaluation Guide',
        url: 'https://www.openpolicyagent.org/docs/latest/terraform/'
      },
      {
        title: 'AWS Well-Architected Framework: Reliability Pillar',
        url: 'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html'
      }
    ],
    status: 'published',
    published_at: '2026-10-30T08:30:00Z',
    updated_at: '2026-11-08T16:10:00Z',
    created_at: '2026-10-28T13:00:00Z',
    content_markdown: `## The Scaling Limits of Ad-Hoc Cloud Provisioning

Early-stage engineering teams frequently configure cloud environments through web consoles or a single shared Terraform repository. That approach works when five engineers manage one VPC and two databases. Once an organization expands across multiple regions, compliance zones, and autonomous product squads, manual console edits and monolithic state files create configuration drift, unexpected downtime, and runaway cloud spend.

Effective cloud infrastructure management replaces heroics and manual checklists with repeatable golden paths: versioned infrastructure modules, strict blast-radius isolation, and automated policy verification prior to every deployment.

## Structuring Layered Infrastructure Modules

GitStack organizes enterprise Infrastructure-as-Code around three independent lifecycle layers rather than one giant directory:

- **Layer 1 — Foundation & Identity**: Cloud organization accounts, single sign-on federation, audit log sinks, and centralized KMS key hierarchies that rarely change.
- **Layer 2 — Regional Networking & Data Persistence**: VPC topologies, private service endpoints, transit routing, and managed PostgreSQL or object storage clusters with deletion protection enabled.
- **Layer 3 — Workload Compute & AI Inference**: Ephemeral Kubernetes node pools, serverless API gateways, and autoscaling inference clusters that teams iterate on weekly.

Separating layers shrinks \`terraform plan\` execution times from twenty minutes to under forty seconds and ensures a routine compute scaling tweak can never accidentally recreate a production database subnet.

## Enforcing Security Before Apply with Policy-as-Code

Code reviews catch architectural intent, yet human reviewers easily overlook a missing \`kms_key_id\` or an accidental \`0.0.0.0/0\` ingress rule buried inside a 400-line plan diff. Integrating Open Policy Agent (OPA) or Conftest directly into pull-request workflows evaluates the compiled JSON plan deterministically on every commit.

\`\`\`rego
package terraform.security

deny[msg] {
  resource := input.resource_changes[_]
  resource.type == "aws_s3_bucket_public_access_block"
  resource.change.after.block_public_acls == false
  msg := sprintf("S3 bucket %s must block all public ACLs", [resource.address])
}
\`\`\`

Every proposed infrastructure change also emits automated cost-estimation diffs right in the pull request thread. When an engineer unintentionally selects oversized GPU instances or multi-terabyte provisioned IOPS volumes in a staging environment, the FinOps policy gate flags the monthly delta before anything gets provisioned.

## Multi-Region Resilience and Automated Drift Reconciliation

True multi-region resilience requires practicing failover continuously rather than assuming passive backups will work during an outage. GitStack configures active-active stateless edge routing paired with automated read-replica promotion runbooks, regular scheduled drift detection jobs that alert on out-of-band console edits, and immutable golden machine images patched via CI pipelines.

By turning security, compliance, and cost accountability into automated software tests inside the infrastructure lifecycle, platform teams accelerate developer shipping speed while maintaining enterprise audit readiness.`
  },
  {
    id: 'art-custom-software-modernization-2026',
    slug: 'modernizing-legacy-monoliths-into-event-driven-typescript-microservices',
    title: 'Modernizing Legacy Monoliths into Event-Driven TypeScript Microservices',
    summary_tldr:
      'Incremental Strangler Fig modernization paired with transactional outbox messaging and strict TypeScript API contracts lets enterprises retire brittle legacy monoliths without risky big-bang rewrites.',
    category: 'Custom Software',
    author_name: 'Sofia Alverez',
    author_role: 'VP of Software Engineering, GitStack',
    author_bio:
      'Sofia leads custom software development and enterprise modernization at GitStack, guiding regulated businesses from legacy systems to resilient TypeScript platforms.',
    cover_image: HERO_IMG,
    cover_alt: 'GitStack software engineering team collaborating inside a bright modern glass architectural studio',
    meta_title: 'Modernizing Legacy Monoliths with Event-Driven TypeScript | GitStack',
    meta_description:
      'Learn GitStack Strangler Fig strategies, transactional outbox patterns, and schema-first TypeScript practices for safe legacy software modernization.',
    primary_keyword: 'custom software development',
    faqs: [
      {
        question: 'Why do big-bang legacy software rewrites usually fail?',
        answer:
          'Big-bang rewrites freeze feature delivery for 12 to 24 months while trying to replicate undocumented edge cases in the legacy system, often running out of budget before reaching production parity.'
      },
      {
        question: 'How does the transactional outbox pattern prevent lost domain events?',
        answer:
          'The application writes business entity updates and outgoing domain events inside the exact same ACID database transaction, then a reliable relay publishes outbox rows to the message broker with at-least-once delivery guarantees.'
      }
    ],
    references: [
      {
        title: 'Pattern: Transactional Outbox (Microservices.io)',
        url: 'https://microservices.io/patterns/data/transactional-outbox.html'
      },
      {
        title: 'Strangler Fig Application Pattern (Martin Fowler)',
        url: 'https://martinfowler.com/bliki/StranglerFigApplication.html'
      }
    ],
    status: 'published',
    published_at: '2026-11-04T11:00:00Z',
    updated_at: '2026-11-10T15:45:00Z',
    created_at: '2026-11-01T09:00:00Z',
    content_markdown: `## The Risk of Big-Bang Rewrites

Enterprise leaders often approach custom software development partnerships frustrated by a decade-old monolithic codebase where every release requires a weekend maintenance window and regression suite anxiety. The natural impulse is to declare a clean slate and rewrite the entire platform from scratch over eighteen months.

History shows that big-bang rewrites rarely survive contact with real business priorities. While the greenfield team chases years of undocumented tax rules, billing exceptions, and partner integrations, competitors ship new features and the legacy system still demands urgent patches. GitStack executes modernization through incremental **Strangler Fig decomposition**—delivering measurable product value in production every two weeks while steadily retiring legacy modules.

## Carving Clear Domain Boundaries First

Breaking up a tightly coupled database without clear domain ownership creates a "distributed monolith" that combines the worst latency of microservices with the deployment coupling of a single repository. Before extracting code, GitStack runs event-storming workshops with product and engineering leads to identify bounded contexts with distinct change cadences—such as Billing, Identity, Order Fulfillment, and AI Document Processing.

Key architectural rules for the extraction phase include:

- **Route at the edge**: Place a programmable API gateway in front of the legacy monolith so individual URL paths and endpoints can be shifted incrementally to new TypeScript services with instant canary rollback.
- **No cross-service database joins**: New services own their schemas privately and expose versioned HTTP or event contracts rather than letting external apps query internal tables.
- **Contract-first TypeScript schemas**: Define shared request, response, and event schemas with runtime validators so compile-time types and production payload parsing never drift apart.

## Reliable Event Propagation with the Transactional Outbox

When a newly extracted Order Service updates PostgreSQL and immediately attempts a network call to publish an \`OrderConfirmed\` event to Kafka or RabbitMQ, a transient broker blip or process crash after commit leaves downstream invoicing and notification services permanently out of sync.

The **transactional outbox pattern** solves dual-write inconsistency cleanly. Within a single database transaction, the service persists both the updated business record and an immutable row in an \`outbox_events\` table. An asynchronous relay worker reads unpublished rows in commit order, pushes them to the event bus, and marks them dispatched—guaranteeing that state mutations and domain events stay strictly consistent without fragile two-phase commits.

## Observing Latency and Business Throughput Across Services

Moving from in-process function calls to network boundaries makes end-to-end observability mandatory from day one. Every service emits OpenTelemetry trace contexts propagated across HTTP headers and message-broker metadata, linking frontend interactions directly to downstream SQL queries and background retries.

Combined with automated contract tests in CI and progressive rollout flags, enterprises gain the agility of modern custom software engineering while keeping mission-critical customer transactions uninterrupted throughout the transition.`
  }
];

export const SEED_ARTICLES: Article[] = rawSeedArticles.map((item) => {
  const report = evaluateArticleQuality(item);
  return {
    ...item,
    word_count: report.wordCount,
    read_time_minutes: report.readTimeMinutes,
    quality_score: report.qualityScore,
    geo_score: report.geoScore
  };
});

export const SEED_COMMENTS: ArticleComment[] = [
  {
    id: 'cmt-1',
    post_id: 'art-rag-enterprise-2026',
    author_name: 'Nikhil Rao',
    author_email: 'nikhil.rao@example.com',
    body: 'Pre-retrieval ACL filtering saved us during our SOC2 audit. Putting group claims directly in the vector filter predicate prevented any cross-tenant leakage.',
    status: 'approved',
    created_at: '2026-11-03T14:22:00Z'
  },
  {
    id: 'cmt-2',
    post_id: 'art-mlops-automation-2026',
    author_name: 'Claire Lindqvist',
    author_email: 'claire.l@example.com',
    body: 'Great breakdown on shadow traffic mirroring before canary promotion. Adding PSI drift checks caught an upstream currency formatting bug for us last quarter.',
    status: 'approved',
    created_at: '2026-11-06T09:15:00Z'
  }
];

export const SEED_SUBSCRIBERS: NewsletterSubscriber[] = [
  {
    id: 'sub-1',
    email: 'cto@northstarlogistics.io',
    name: 'Hannah Park',
    interest_topic: 'AI Integration & RAG',
    consent_given: true,
    created_at: '2026-11-01T10:00:00Z'
  }
];

export const SEED_INQUIRIES: ClientInquiry[] = [
  {
    id: 'inq-1',
    reference_code: 'GS-2026-4108',
    full_name: 'Jordan Mercer',
    company: 'Veridian Supply Chain',
    work_email: 'j.mercer@veridiansupply.com',
    service_interest: 'AI Integration',
    budget_range: '$50k – $120k',
    timeline: 'Q1 Launch (6–10 weeks)',
    project_brief:
      'Looking to build an internal RAG assistant across 40,000 customs compliance PDFs and ERP shipment tables with strict role-based access control.',
    status: 'reviewed',
    created_at: '2026-11-09T16:40:00Z'
  }
];

export const DEFAULT_ADSENSE_SETTINGS: AdSenseSettings = {
  adsense_publisher_id: '',
  ads_txt_content:
    '# Configure your Google AdSense Publisher ID in GitStack Studio to activate verified ads.txt\n# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0',
  auto_ads_enabled: false,
  ad_slots_enabled: false,
  editorial_review_note: 'All articles must pass the 8-pillar AdSense E-E-A-T & 800-word depth gate before publishing.',
  ga4_measurement_id: '',
  ga4_enabled: false,
  ga4_track_events: true,
  updated_at: '2026-11-10T00:00:00Z'
};

export const SEED_AGENT_TASKS = [
  {
    id: 'task-mkt-1',
    agent_id: 'marketing' as const,
    title: 'Publish monthly AI Integration & MLOps client case-study summary',
    priority: 'high' as const,
    completed: false,
    notes: 'Highlight Veridian Supply Chain RAG latency reduction (<320ms).',
    updated_at: '2026-11-12T09:00:00Z'
  },
  {
    id: 'task-ceo-1',
    agent_id: 'ceo' as const,
    title: 'Review Q4 AI/ML consulting pipeline & target retainer margin',
    priority: 'high' as const,
    completed: false,
    notes: 'Verify open inquiry SLA under 24 hours.',
    updated_at: '2026-11-12T09:15:00Z'
  },
  {
    id: 'task-bk-1',
    agent_id: 'booking' as const,
    title: 'Send technical discovery calendar slots to reviewed Veridian inquiry',
    priority: 'high' as const,
    completed: false,
    notes: 'Use Gmail Inbox reply workflow with Elena Vance.',
    updated_at: '2026-11-12T10:00:00Z'
  },
  {
    id: 'task-sec-1',
    agent_id: 'cybersecurity' as const,
    title: 'Confirm Supabase GRANT & RLS policies are executed in SQL Editor',
    priority: 'high' as const,
    completed: false,
    notes: 'Keep /obama Back Office private and excluded from public sitemap.',
    updated_at: '2026-11-12T10:30:00Z'
  },
  {
    id: 'task-qa-1',
    agent_id: 'qa' as const,
    title: 'Audit all custom page blocks for descriptive alt tags before deploy',
    priority: 'medium' as const,
    completed: true,
    notes: 'Automated integrity validator active on Save.',
    updated_at: '2026-11-12T11:00:00Z'
  },
  {
    id: 'task-ads-1',
    agent_id: 'adsense' as const,
    title: 'Enter Google AdSense Publisher ID (ca-pub-...) to verify /ads.txt',
    priority: 'high' as const,
    completed: false,
    notes: '6-pillar AdSense policy suite active; add Publisher ID when approved.',
    updated_at: '2026-11-12T11:30:00Z'
  },
  {
    id: 'task-trf-1',
    agent_id: 'traffic' as const,
    title: 'Configure Google Analytics 4 Measurement ID (G-XXXXXXXXXX)',
    priority: 'medium' as const,
    completed: false,
    notes: 'Consent-gated gtag.js ready once ID is saved.',
    updated_at: '2026-11-12T12:00:00Z'
  }
];

export const SEED_CHAT_THREADS = [
  {
    id: 'thr-1',
    subject: 'Enterprise RAG Security: Zero-Retention & RBAC Compliance',
    source_type: 'inquiry' as const,
    source_ref_id: 'inq-1',
    requester_name: 'Jordan Mercer (Veridian Supply Chain)',
    requester_email: 'j.mercer@veridiansupply.com',
    status: 'open' as const,
    last_message_at: '2026-11-11T15:20:00Z',
    created_at: '2026-11-09T16:40:00Z'
  },
  {
    id: 'thr-2',
    subject: 'Pre-retrieval ACL filtering vs post-filtering latency question',
    source_type: 'comment' as const,
    source_ref_id: 'cmt-1',
    requester_name: 'Nikhil Rao',
    requester_email: 'nikhil.rao@example.com',
    status: 'answered' as const,
    last_message_at: '2026-11-04T11:05:00Z',
    created_at: '2026-11-03T14:22:00Z'
  }
];

export const SEED_CHAT_MESSAGES = [
  {
    id: 'msg-1',
    thread_id: 'thr-1',
    sender_role: 'visitor' as const,
    sender_name: 'Jordan Mercer',
    body: 'Can GitStack deploy our customs RAG assistant inside our private VPC with zero LLM training retention and per-department document ACLs?',
    created_at: '2026-11-09T16:40:00Z'
  },
  {
    id: 'msg-2',
    thread_id: 'thr-1',
    sender_role: 'admin' as const,
    sender_name: 'GitStack Admin',
    body: 'Initial scope reviewed by Elena Vance. Yes—we attach tenant/role predicates directly at the vector index filter layer and configure zero-retention enterprise endpoints.',
    created_at: '2026-11-11T15:20:00Z'
  },
  {
    id: 'msg-3',
    thread_id: 'thr-2',
    sender_role: 'visitor' as const,
    sender_name: 'Nikhil Rao',
    body: 'Pre-retrieval ACL filtering saved us during our SOC2 audit. How much p95 overhead did your metadata filter add on pgvector HNSW?',
    created_at: '2026-11-03T14:22:00Z'
  },
  {
    id: 'msg-4',
    thread_id: 'thr-2',
    sender_role: 'admin' as const,
    sender_name: 'GitStack Admin',
    body: 'With iterative scan enabled on pgvector 0.8+ and partial GIN indexing on ACL arrays, p95 overhead stayed under 14ms at 2M chunks.',
    created_at: '2026-11-04T11:05:00Z'
  }
];

export const SEED_ANALYTICS_EVENTS = (() => {
  const paths = ['/', '/services', '/insights', '/insights/architecting-production-rag-pipelines-for-enterprise-knowledge-bases', '/about', '/contact'];
  const referrers = ['google.com', 'chatgpt.com', 'perplexity.ai', 'direct', 'linkedin.com'];
  const events: AnalyticsEvent[] = [];
  const baseDate = new Date('2026-11-14T10:00:00Z').getTime();
  for (let d = 13; d >= 0; d--) {
    const dayMs = baseDate - d * 24 * 60 * 60 * 1000;
    const count = 4 + ((13 - d) % 4);
    for (let i = 0; i < count; i++) {
      const p = paths[(d + i) % paths.length];
      events.push({
        id: `evt-seed-${d}-${i}`,
        event_type: 'pageview' as const,
        path: p,
        referrer: referrers[(d + i) % referrers.length],
        session_id: `sess-${d}-${i % 3}`,
        meta: {},
        created_at: new Date(dayMs + i * 3600000).toISOString()
      });
    }
  }
  events.push({
    id: 'evt-seed-conv-1',
    event_type: 'inquiry_submitted' as const,
    path: '/contact',
    referrer: 'google.com',
    session_id: 'sess-1-0',
    meta: { service: 'AI Integration' },
    created_at: '2026-11-12T16:40:00Z'
  });
  events.push({
    id: 'evt-seed-conv-2',
    event_type: 'newsletter_subscribed' as const,
    path: '/insights',
    referrer: 'chatgpt.com',
    session_id: 'sess-2-1',
    meta: { topic: 'AI Integration & RAG' },
    created_at: '2026-11-13T11:15:00Z'
  });
  return events;
})();
