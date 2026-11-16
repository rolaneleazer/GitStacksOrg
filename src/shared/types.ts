export type ServiceCategory =
  | 'AI Integration'
  | 'ML Automation'
  | 'Cloud Infrastructure'
  | 'Custom Software'
  | 'Technical Consulting';

export type ArticleStatus = 'draft' | 'published';

export interface ArticleFAQ {
  question: string;
  answer: string;
}

export interface ArticleReference {
  title: string;
  url: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary_tldr: string;
  content_markdown: string;
  category: ServiceCategory;
  author_name: string;
  author_role: string;
  author_bio: string;
  cover_image: string;
  cover_alt: string;
  meta_title: string;
  meta_description: string;
  primary_keyword: string;
  faqs: ArticleFAQ[];
  references: ArticleReference[];
  word_count: number;
  read_time_minutes: number;
  quality_score: number;
  geo_score: number;
  status: ArticleStatus;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

export type CommentStatus = 'approved' | 'pending' | 'hidden';

export interface ArticleComment {
  id: string;
  post_id: string;
  author_name: string;
  author_email: string;
  body: string;
  status: CommentStatus;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  interest_topic: string;
  consent_given: boolean;
  created_at: string;
}

export type ThemePresetId = 'cobalt' | 'emerald' | 'indigo' | 'slate' | 'amber' | 'custom';
export type HeaderSurface = 'white' | 'tinted';

export type InquiryStatus = 'new' | 'reviewed' | 'scheduled';

export interface ClientInquiry {
  id: string;
  reference_code: string;
  full_name: string;
  company: string;
  work_email: string;
  service_interest: ServiceCategory | 'Full-Stack Transformation';
  budget_range: string;
  timeline: string;
  project_brief: string;
  status: InquiryStatus;
  assigned_to?: string | null;
  assigned_at?: string | null;
  created_at: string;
}

export interface AdSenseSettings {
  adsense_publisher_id: string;
  ads_txt_content: string;
  auto_ads_enabled: boolean;
  ad_slots_enabled: boolean;
  editorial_review_note: string;
  ga4_measurement_id?: string;
  ga4_enabled?: boolean;
  ga4_track_events?: boolean;
  brand_name?: string;
  brand_logo_url?: string;
  brand_logo_alt?: string;
  favicon_url?: string;
  theme_preset?: ThemePresetId;
  primary_color?: string;
  header_surface?: HeaderSurface;
  header_cta_label?: string;
  header_cta_href?: string;
  updated_at: string;
}

export interface QualityCheckItem {
  id: string;
  pillar: 'AdSense Policy' | 'E-E-A-T Trust' | 'AI Search (GEO)' | 'On-Page SEO';
  label: string;
  passed: boolean;
  requiredForPublish: boolean;
  measuredValue: string;
  targetValue: string;
  remediation: string;
}

export interface QualityGateReport {
  wordCount: number;
  readTimeMinutes: number;
  h2Count: number;
  keywordDensityPercent: number;
  qualityScore: number;
  geoScore: number;
  publishEligible: boolean;
  blockingIssues: string[];
  checks: QualityCheckItem[];
}

export interface SiteAuditCheck {
  id: string;
  category: 'Legal & Trust' | 'Content Depth' | 'Crawler & AI Discovery' | 'AdSense Policy';
  label: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}

export interface SiteAuditReport {
  readyForAdSense: boolean;
  passedCount: number;
  totalChecks: number;
  publishedArticleCount: number;
  thinArticleCount: number;
  averageWordCount: number;
  checks: SiteAuditCheck[];
}

// --- Back Office CMS, 7 Agents, Internal Chat & Analytics Types ---

export type PageKey = 'home' | 'services' | 'about' | 'contact';

export interface CustomContentBlock {
  id: string;
  heading: string;
  body: string;
  image_url: string;
  image_alt: string;
  cta_label: string;
  cta_href: string;
  visible: boolean;
}

export interface PageContentConfig {
  page_key: PageKey;
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_label: string;
  hero_image: string;
  hero_image_alt: string;
  secondary_image: string;
  secondary_image_alt: string;
  intro_heading: string;
  intro_body: string;
  custom_blocks: CustomContentBlock[];
  updated_at: string;
}

export type AgentId =
  | 'marketing'
  | 'ceo'
  | 'booking'
  | 'cybersecurity'
  | 'qa'
  | 'adsense'
  | 'traffic';

export interface AgentRuleCheck {
  id: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  metric: string;
  detail: string;
  targetTab?: string;
  actionLabel?: string;
}

export interface AgentReport {
  id: AgentId;
  name: string;
  role: string;
  summary: string;
  score: number;
  status: 'healthy' | 'attention' | 'critical';
  checks: AgentRuleCheck[];
}

export type TaskPriority = 'high' | 'medium' | 'low';

export interface AgentTask {
  id: string;
  agent_id: AgentId;
  title: string;
  priority: TaskPriority;
  completed: boolean;
  notes: string;
  updated_at: string;
}

export type ChatThreadSource = 'inquiry' | 'comment' | 'internal';
export type ChatThreadStatus = 'open' | 'answered' | 'archived';

export interface ChatThread {
  id: string;
  subject: string;
  source_type: ChatThreadSource;
  source_ref_id: string | null;
  requester_name: string;
  requester_email: string;
  status: ChatThreadStatus;
  assigned_to?: string | null;
  assigned_at?: string | null;
  last_message_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_role: 'visitor' | 'admin' | 'system';
  sender_name: string;
  body: string;
  created_at: string;
}

export type AnalyticsEventType =
  | 'pageview'
  | 'inquiry_submitted'
  | 'newsletter_subscribed'
  | 'comment_submitted';

export interface AnalyticsEvent {
  id: string;
  event_type: AnalyticsEventType;
  path: string;
  referrer: string;
  session_id: string;
  meta: Record<string, string>;
  created_at: string;
}

export interface AnalyticsSummary {
  days: number;
  totalPageviews: number;
  uniqueSessions: number;
  inquiryConversions: number;
  newsletterConversions: number;
  commentSubmissions: number;
  conversionRatePercent: number;
  dailySeries: { date: string; pageviews: number; conversions: number }[];
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; visits: number }[];
}

// --- Team RBAC, Profiles & Per-User Workflows ---

export type UserRole = 'super_admin' | 'editor' | 'support_agent';
export type UserStatus = 'active' | 'suspended';

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  job_title: string;
  bio: string;
  avatar_url: string;
  phone: string;
  timezone: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type DirectoryUser = Pick<
  UserProfile,
  'user_id' | 'email' | 'full_name' | 'role' | 'job_title' | 'avatar_url' | 'status'
>;

export type WorkflowCategory = 'onboarding' | 'daily_checklist' | 'project_task' | 'follow_up';
export type WorkflowStatus = 'todo' | 'in_progress' | 'done';
export type LinkedEntityType = 'inquiry' | 'chat' | 'article' | 'none';

export interface UserWorkflowItem {
  id: string;
  user_id: string;
  assigned_by: string;
  title: string;
  description: string;
  category: WorkflowCategory;
  priority: TaskPriority;
  status: WorkflowStatus;
  due_date: string | null;
  linked_entity_type: LinkedEntityType;
  linked_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoutingRule {
  id: string;
  source_type: 'inquiry' | 'chat';
  match_key: string;
  assignee_user_id: string | null;
  enabled: boolean;
  updated_at: string;
}

// --- Vercel & Supabase Infrastructure Resource Telemetry ---

export interface InfrastructureTableMetric {
  tableName: string;
  totalMb: number;
  dataMb: number;
  indexMb: number;
  rowEstimate: number;
}

export interface InfrastructureAlert {
  id: string;
  provider: 'vercel' | 'supabase' | 'runtime';
  severity: 'nominal' | 'warning' | 'critical';
  title: string;
  detail: string;
}

export interface InfrastructureSamplePoint {
  timestamp: string;
  cpuPercent: number;
  eventLoopLagMs: number;
  rssMb: number;
  heapUsedMb: number;
  dbSizeMb: number;
  apiLatencyMs: number;
}

export interface InfrastructureMetricsResponse {
  sampledAt: string;
  environment: 'vercel' | 'local';
  region: string;
  nodeVersion: string;
  uptimeSeconds: number;
  coldStart: boolean;
  vercel: {
    cpuPercent: number;
    eventLoopLagMs: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
    ramLimitMb: number;
    ramUsedPercent: number;
    functionMaxDurationSec: number;
    bandwidthLimitGb: number;
    sourceMode: 'runtime+api' | 'runtime-only';
    apiConfigured: boolean;
    projectName: string | null;
    framework: string | null;
    latestDeploymentState: string | null;
    latestDeploymentUrl: string | null;
    latestDeploymentCreatedAt: string | null;
  };
  supabase: {
    databaseSizeMb: number;
    storageLimitMb: number;
    storageUsedPercent: number;
    activeConnections: number;
    maxConnections: number;
    cacheHitRatioPercent: number;
    totalRowsEstimate: number;
    tables: InfrastructureTableMetric[];
    sourceMode: 'postgres+api' | 'postgres' | 'supabase-rest-estimate';
    postgresDirectConnected: boolean;
    apiConfigured: boolean;
    projectRef: string | null;
    projectName: string | null;
    projectRegion: string | null;
    projectStatus: string | null;
  };
  history: InfrastructureSamplePoint[];
  alerts: InfrastructureAlert[];
}

// --- Virtual Office HQ & Daily Agent Email Reports ---

export type AgentWorkStatus = 'working' | 'walking' | 'idle';
export type AgentAvatarIcon =
  | 'megaphone'
  | 'crown'
  | 'calendar'
  | 'shield'
  | 'check'
  | 'badge'
  | 'trending'
  | 'bot'
  | 'cpu';

export interface AgentOfficeProfile {
  agent_id: AgentId;
  display_name: string;
  custom_role: string;
  avatar_icon: AgentAvatarIcon;
  accent_color: string;
  desk_label: string;
  desk_x: number;
  desk_y: number;
  work_status: AgentWorkStatus;
  current_mission: string;
  updated_at: string;
}

export interface AgentConversationEntry {
  id: string;
  agent_id: AgentId;
  peer_agent_id: AgentId | null;
  sender_type: 'agent' | 'operator' | 'handoff' | 'system';
  sender_name: string;
  message: string;
  finding_status: 'nominal' | 'attention' | 'critical' | 'info';
  created_at: string;
}

export interface AgentReportSettings {
  id: string;
  enabled: boolean;
  recipient_email: string;
  send_hour_utc: number;
  preferred_channel: 'lark_smtp' | 'gmail' | 'resend';
  include_agents: AgentId[];
  last_sent_at: string | null;
  updated_at: string;
}

export interface AgentSnapshotItem {
  agent_id: AgentId;
  name: string;
  display_name: string;
  score: number;
  status: 'healthy' | 'attention' | 'critical';
  open_tasks: number;
  work_status: AgentWorkStatus;
  top_finding: string;
}

export interface AgentEmailReport {
  id: string;
  recipient_email: string;
  subject: string;
  channel: 'lark_smtp' | 'cron_dispatch' | 'gmail_api' | 'resend_api';
  trigger_type: 'manual' | 'daily_cron';
  status: 'sent' | 'failed' | 'skipped_unconfigured';
  provider_message_id: string;
  provider_thread_id: string;
  overall_score: number;
  agent_snapshots: AgentSnapshotItem[];
  body_text: string;
  proof_hash: string;
  error_detail: string;
  sent_at: string;
}

// --- Apollo-Style Open-Source Prospecting, CRM Pipeline & Lark Mail Integration ---

export type CrmLeadStage =
  | 'discovered'
  | 'researched'
  | 'proposed'
  | 'follow_up'
  | 'won'
  | 'lost';

export type EmailVerificationStatus =
  | 'verified_mx'
  | 'public_found'
  | 'inferred'
  | 'invalid';

export type LeadSourceType =
  | 'github'
  | 'website'
  | 'gemini_search'
  | 'apollo'
  | 'google_maps'
  | 'hacker_news'
  | 'ycombinator'
  | 'csv_import'
  | 'demo_signup'
  | 'manual';

export interface CrmFollowUpStep {
  step_number: number;
  delay_days: number;
  subject: string;
  body: string;
  sent_at: string | null;
}

export interface CrmLead {
  id: string;
  contact_name: string;
  role_title: string;
  email: string;
  email_status: EmailVerificationStatus;
  company_name: string;
  company_domain: string;
  website_url: string;
  github_url: string;
  phone?: string;
  location?: string;
  rating?: number | null;
  source_detail?: string;
  source_type: LeadSourceType;
  source_urls: string[];
  tech_stack: string[];
  research_brief: string;
  recommended_service: ServiceCategory;
  fit_score: number;
  deal_value: number;
  stage: CrmLeadStage;
  proposal_subject: string;
  proposal_body: string;
  follow_up_sequence: CrmFollowUpStep[];
  assigned_to: string | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  converted_inquiry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmOutreachLog {
  id: string;
  lead_id: string;
  channel: 'lark_mail' | 'gmail_api';
  recipient_email: string;
  subject: string;
  body: string;
  provider_message_id: string;
  status: 'sent' | 'failed';
  error_detail: string;
  step_label: string;
  sent_by: string;
  sent_at: string;
}

export interface DiscoveredProspectCandidate {
  id: string;
  contact_name: string;
  role_title: string;
  email: string;
  email_status: EmailVerificationStatus;
  company_name: string;
  company_domain: string;
  website_url: string;
  github_url: string;
  phone?: string;
  location?: string;
  rating?: number | null;
  source_detail?: string;
  source_type: LeadSourceType;
  source_urls: string[];
  tech_stack: string[];
  fit_score: number;
  snippet: string;
  external_id?: string;
}

export interface CrmOAuthTokenRecord {
  id: string;
  user_id: string;
  provider: 'lark';
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_email: string;
  account_name: string;
  updated_at: string;
}

export interface LarkConnectionStatus {
  configured: boolean;
  connected: boolean;
  lark_email: string;
  lark_name: string;
  expires_at: string | null;
  mode?: 'smtp' | 'oauth';
  smtp_host?: string;
  smtp_port?: number;
  source?: 'vault' | 'env' | 'disconnected';
  redirect_uris: {
    development: string;
    shared: string;
  };
  missing_env: string[];
}

export type OpenSourceSyncTrack = 'all' | 'ai' | 'cloud' | 'devtools';

export interface OpenSourceSyncResult {
  track: OpenSourceSyncTrack;
  reposScanned: number;
  insertedCount: number;
  mergedCount: number;
  mxVerifiedCount: number;
  sourcesSynced: string[];
  leads: CrmLead[];
}

export interface CrmSyncRun {
  id: string;
  source_type: LeadSourceType;
  query_label: string;
  fetched_count: number;
  inserted_count: number;
  merged_count: number;
  mx_verified_count: number;
  status: 'completed' | 'partial' | 'failed';
  error_detail: string;
  triggered_by: string;
  created_at: string;
}

export interface SourceBreakdownMetric {
  source_type: LeadSourceType;
  label: string;
  leadCount: number;
  verifiedMxCount: number;
  mxRatePercent: number;
  avgFitScore: number;
  totalDealValue: number;
  wonCount: number;
  outreachSentCount: number;
  lastSyncedAt: string | null;
}

export interface CrmSourcesAnalyticsResponse {
  totals: {
    totalLeads: number;
    verifiedMxCount: number;
    verifiedMxPercent: number;
    totalPipelineValue: number;
    wonDeals: number;
    activeSourcesCount: number;
    totalSyncRuns: number;
  };
  bySource: SourceBreakdownMetric[];
  syncRuns: CrmSyncRun[];
}

export type ApolloCapabilityMode = 'full_search' | 'trial_or_scoped' | 'unknown';

export interface ApolloStatusResponse {
  configured: boolean;
  envVarName: 'APOLLO_API_KEY';
  endpointMode: 'mixed_people/api_search + people/bulk_match';
  capabilityMode?: ApolloCapabilityMode;
  capabilityMessage?: string;
}

export interface ApolloSearchFilters {
  personTitles?: string[];
  qKeywords?: string;
  personLocations?: string[];
  organizationDomains?: string[];
  perPage?: number;
  page?: number;
}

export interface ApolloCandidate {
  id: string;
  apollo_person_id: string;
  contact_name: string;
  role_title: string;
  email: string;
  has_email: boolean;
  company_name: string;
  company_domain: string;
  website_url: string;
  linkedin_url: string;
  location: string;
  industry: string;
  tech_stack: string[];
  snippet: string;
}

export interface GoogleMapsPlaceCandidate {
  place_id: string;
  name: string;
  primary_type: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  phone: string;
  website_url: string;
  google_maps_uri: string;
  rating: number | null;
  user_rating_count: number | null;
}

export interface GoogleMapsConfigResponse {
  configured: boolean;
  apiKey: string;
}

export interface CsvImportLeadInput {
  contact_name?: string;
  role_title?: string;
  email?: string;
  company_name: string;
  website_url?: string;
  company_domain?: string;
  phone?: string;
  location?: string;
  tech_stack?: string[];
  recommended_service?: ServiceCategory;
  deal_value?: number;
}

export type IntegrationProviderId =
  | 'lark_smtp'
  | 'apollo'
  | 'google_maps'
  | 'gemini'
  | 'github'
  | 'cloudflare';

export interface IntegrationConfigMeta {
  email?: string;
  sender_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_ssl?: boolean;
  imap_host?: string;
  imap_port?: number;
  imap_ssl?: boolean;
  apollo_capability?: ApolloCapabilityMode;
  zone_id?: string;
  zone_name?: string;
}

export interface IntegrationSecretRecord {
  provider: IntegrationProviderId;
  enabled: boolean;
  encrypted_secret: string;
  secret_hint: string;
  config_meta: IntegrationConfigMeta;
  last_tested_at: string | null;
  last_test_status: 'ok' | 'error' | 'untested';
  last_test_message: string;
  updated_by: string;
  updated_at: string;
}

export interface IntegrationStatusItem {
  provider: IntegrationProviderId;
  label: string;
  category:
    | 'Email Outreach'
    | 'Lead Prospecting'
    | 'AI & Grounding'
    | 'Open-Source Scraping'
    | 'Cloud & Edge';
  description: string;
  connected: boolean;
  enabled: boolean;
  source: 'vault' | 'env' | 'disconnected';
  envFallbackAvailable: boolean;
  maskedHint: string;
  configMeta: IntegrationConfigMeta;
  lastTestedAt: string | null;
  lastTestStatus: 'ok' | 'error' | 'untested';
  lastTestMessage: string;
  updatedAt: string | null;
  docsHint: string;
}

// --- Customer Demo Auth, Activity Stats & Unified Lark Inbox Logs ---

export interface DemoUser {
  id: string;
  full_name: string;
  email: string;
  company: string;
  phone: string;
  password_hash: string;
  crm_lead_id: string | null;
  login_count: number;
  actions_count: number;
  explored_modules: string[];
  sandbox_conversions: number;
  last_action_label: string;
  last_active_at: string;
  created_at: string;
}

export type PublicDemoUser = Omit<DemoUser, 'password_hash'> & {
  expires_at?: string;
  is_expired?: boolean;
};

export interface DemoUsersSummaryStats {
  totalUsers: number;
  activeLast7Days: number;
  totalActions: number;
  totalLogins: number;
  totalConversions: number;
  linkedCrmLeads: number;
}

export interface InboxEmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  channel: 'lark_smtp';
  category:
    | 'inquiry_reply'
    | 'direct_compose'
    | 'demo_signup_alert'
    | 'contact_alert'
    | 'chat_offline_alert'
    | 'chat_instant_alert'
    | 'chat_reply'
    | 'test_notification';
  related_id?: string | null;
  provider_message_id: string;
  status: 'sent' | 'failed';
  error_detail: string;
  sent_by: string;
  sent_at: string;
}

export type CloudflareWindowPreset = '1h' | '6h' | '24h' | '7d';

export interface CloudflareTimeSeriesPoint {
  timestamp: string;
  label: string;
  requests: number;
  bytes: number;
  visits: number;
  status1xx: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  cacheDynamic: number;
  cacheNone: number;
  cacheExpired: number;
  cacheMiss: number;
  cacheHit: number;
}

export interface CloudflareTopItem {
  label: string;
  count: number;
  bytes?: number;
}

export interface CloudflareAnalyticsResponse {
  connected: boolean;
  source: 'vault' | 'env' | 'disconnected';
  zoneId: string;
  zoneName: string;
  planName?: string;
  window: CloudflareWindowPreset;
  fetchedAt: string;
  notice?: string;
  summary: {
    totalRequests: number;
    requestsDeltaPct: number | null;
    totalBytes: number;
    bytesDeltaPct: number | null;
    totalVisits: number;
    cacheHitRate: number;
    cacheHitRateDeltaPct: number | null;
    error5xxRate: number;
    error5xxDeltaPct: number | null;
    statusTotals: {
      s1xx: number;
      s2xx: number;
      s3xx: number;
      s4xx: number;
      s5xx: number;
    };
    cacheTotals: {
      dynamic: number;
      none: number;
      expired: number;
      miss: number;
      hit: number;
    };
  };
  series: CloudflareTimeSeriesPoint[];
  breakdowns: {
    topPaths: CloudflareTopItem[];
    topCountries: CloudflareTopItem[];
    topClientIps: CloudflareTopItem[];
    topHosts: CloudflareTopItem[];
    topBrowsers: CloudflareTopItem[];
    topOperatingSystems: CloudflareTopItem[];
    topDeviceTypes: CloudflareTopItem[];
    topUserAgents: CloudflareTopItem[];
    topHttpVersions: CloudflareTopItem[];
    topStatusCodes: CloudflareTopItem[];
    topDataCenters: CloudflareTopItem[];
  };
}

// --- Cloudflare Historical Snapshots & Gemini AI Forecasting ---

export type CloudflareHistoryRange = '7d' | '14d' | '30d' | 'all';

export interface CloudflareHourlySnapshot {
  id: string;
  zone_id: string;
  zone_name: string;
  bucket_hour: string;
  requests: number;
  bytes: number;
  cached_requests: number;
  status_1xx: number;
  status_2xx: number;
  status_3xx: number;
  status_4xx: number;
  status_5xx: number;
  top_paths: CloudflareTopItem[];
  top_countries: CloudflareTopItem[];
  created_at: string;
  updated_at: string;
}

export interface CloudflareDailyHistoryPoint {
  date: string;
  label: string;
  requests: number;
  bytes: number;
  cachedRequests: number;
  cacheHitRate: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  error5xxRate: number;
}

export interface CloudflareDailyForecastPoint {
  date: string;
  label: string;
  predictedRequests: number;
  lowRequests: number;
  highRequests: number;
  predictedBytes: number;
  rationale: string;
}

export interface CloudflareTrafficAnomaly {
  bucketLabel: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
}

export interface CloudflareAiForecast {
  zoneId: string;
  zoneName: string;
  modelUsed: string;
  usedGemini: boolean;
  generatedAt: string;
  horizonDays: number;
  rangeAnalyzed: CloudflareHistoryRange;
  trendDirection: 'up' | 'steady' | 'down';
  growthRatePct: number;
  confidencePct: number;
  expectedRequests7d: number;
  expectedBandwidth7dBytes: number;
  executiveSummary: string;
  trafficDrivers: string[];
  recommendations: string[];
  anomalies: CloudflareTrafficAnomaly[];
  dailyForecast: CloudflareDailyForecastPoint[];
  fallbackNotice?: string;
}

export interface CloudflareHistoryAnalysisResponse {
  connected: boolean;
  zoneId: string;
  zoneName: string;
  range: CloudflareHistoryRange;
  snapshotCount: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  summary: {
    totalRequests: number;
    totalBytes: number;
    avgDailyRequests: number;
    peakDayLabel: string;
    peakDayRequests: number;
    peakHourUtc: number;
    avgCacheHitRate: number;
    avgError5xxRate: number;
    requestTrendPct: number | null;
  };
  dailyHistory: CloudflareDailyHistoryPoint[];
  hourlyDistribution: { hourUtc: number; label: string; avgRequests: number }[];
  weekdayDistribution: { weekday: string; avgRequests: number }[];
  statisticalBaselineForecast: CloudflareDailyForecastPoint[];
  anomalies: CloudflareTrafficAnomaly[];
  aiForecast: CloudflareAiForecast | null;
}

// --- Virtual Office Live Website Visitors & Site Operations HUD ---

export interface LiveWebsiteVisitor {
  session_id: string;
  current_path: string;
  zone_id: string;
  zone_label: string;
  device_type: 'desktop' | 'tablet' | 'mobile';
  referrer: string;
  started_at: string;
  last_seen_at: string;
  target_x: number;
  target_y: number;
}

export interface OfficeLiveHudSummary {
  activeVisitorsCount: number;
  visitors: LiveWebsiteVisitor[];
  adminOnline: boolean;
  lastAdminSeenAt: string | null;
  unansweredChatsCount: number;
  openChatsCount: number;
  escalatedChatsCount: number;
  activeDemoUsersCount: number;
  cloudflare24hRequests: number | null;
  cloudflare5xxRate: number | null;
  cloudflareCacheRate: number | null;
  larkSmtpConnected: boolean;
  watcherLastRunAt: string | null;
}

// --- Floating Home Page Live Chat & Offline Lark Escalation ---

export type WebsiteChatStatus = 'open' | 'replied' | 'resolved';
export type WebsiteChatSenderRole = 'visitor' | 'admin' | 'agent';

export interface WebsiteChatSession {
  id: string;
  visitor_token: string;
  visitor_name: string;
  visitor_email: string;
  page_path: string;
  status: WebsiteChatStatus;
  last_visitor_msg_at: string | null;
  last_admin_reply_at: string | null;
  escalated_at: string | null;
  converted_lead_id: string | null;
  created_at: string;
  updated_at: string;
  unread_for_admin?: boolean;
  last_message_preview?: string;
}

export interface WebsiteChatMessage {
  id: string;
  session_id: string;
  sender_role: WebsiteChatSenderRole;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface WebsiteChatThreadResponse {
  session: WebsiteChatSession;
  messages: WebsiteChatMessage[];
  adminOnline: boolean;
}

export type LiveChatNotifyMode = 'instant' | 'offline_only';

export interface AdminNotificationSettings {
  id: string;
  enabled: boolean;
  recipient_email: string;
  admin_login_url: string;
  notify_on_live_chat: boolean;
  live_chat_mode: LiveChatNotifyMode;
  offline_delay_minutes: number;
  chat_cooldown_minutes: number;
  notify_on_inquiry: boolean;
  notify_on_demo_signup: boolean;
  updated_by: string;
  updated_at: string;
}


