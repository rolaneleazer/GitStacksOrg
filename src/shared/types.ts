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
  // Google Tag Manager (GTM) Container & dataLayer Settings
  gtm_enabled?: boolean;
  gtm_container_id?: string;
  gtm_track_datalayer?: boolean;
  gtm_track_conversions?: boolean;
  gtm_respect_consent?: boolean;
  gtm_exclude_admin?: boolean;
  brand_name?: string;
  brand_logo_url?: string;
  brand_logo_alt?: string;
  favicon_url?: string;
  theme_preset?: ThemePresetId;
  primary_color?: string;
  header_surface?: HeaderSurface;
  header_cta_label?: string;
  header_cta_href?: string;
  // Buy Me a Coffee Customizable Settings
  bmc_enabled?: boolean;
  bmc_handle?: string;
  bmc_custom_url?: string;
  bmc_button_text?: string;
  bmc_button_color?: string;
  bmc_font_style?: 'Cookie' | 'Inter' | 'Plus Jakarta Sans';
  bmc_header_enabled?: boolean;
  bmc_footer_enabled?: boolean;
  bmc_floating_enabled?: boolean;
  bmc_floating_position?: 'Right' | 'Left';
  bmc_floating_y_offset?: number;
  bmc_support_message?: string;
  updated_at: string;
}

export interface BmcClickEvent {
  id: string;
  placement: 'header' | 'footer' | 'floating' | 'other';
  timestamp: string;
}

export interface BmcAnalyticsData {
  totalClicks: number;
  headerClicks: number;
  footerClicks: number;
  floatingClicks: number;
  lastClickedAt: string | null;
  history: BmcClickEvent[];
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
  kind?: 'block' | 'showcase_slide';
  category_label?: string;
  module_id?: string;
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
  contact_phone_label?: string;
  contact_phone?: string;
  contact_sales_label?: string;
  contact_sales_email?: string;
  contact_editorial_label?: string;
  contact_editorial_email?: string;
  contact_privacy_label?: string;
  contact_privacy_email?: string;
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
  | 'traffic'
  | 'demo_guard';

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

export type AnalyticsDatePreset =
  | 'realtime'
  | 'today'
  | 'yesterday'
  | '7d'
  | '14d'
  | '28d'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export interface AnalyticsGeoCountryItem {
  country: string;
  countryCode?: string;
  activeUsers: number;
  sessions: number;
}

export interface AnalyticsGeoCityItem {
  city: string;
  country: string;
  activeUsers: number;
}

export interface AnalyticsChannelItem {
  channel: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
}

export interface AnalyticsLandingPageItem {
  landingPage: string;
  sessions: number;
  activeUsers: number;
  newUsers: number;
  avgEngagementSeconds: number;
  keyEvents: number;
  keyEventRatePercent: number;
}

export interface AnalyticsPageTitleItem {
  title: string;
  path: string;
  views: number;
  activeUsers: number;
}

export interface AnalyticsEventCountItem {
  eventName: string;
  count: number;
  conversions: number;
}

export interface AnalyticsDevicePlatformItem {
  device: string;
  platform: string;
  users: number;
  percent: number;
}

export interface AnalyticsCohortRow {
  cohortLabel: string;
  cohortSize: number;
  retentionByWeek: number[]; // Week 0 .. Week 5 percentages
}

export interface RealtimeActiveVisitorSummary {
  activeUsers30m: number;
  activeUsers5m: number;
  events30m: number;
  conversions30m: number;
  perMinute: { minuteLabel: string; activeUsers: number; events: number }[];
  activePages: { path: string; title: string; activeUsers: number; views: number }[];
  activeCountries: { country: string; countryCode?: string; activeUsers: number }[];
  activeCities: { city: string; country: string; activeUsers: number }[];
  activeChannels: { channel: string; activeUsers: number }[];
  recentVisitors: LiveWebsiteVisitor[];
  sampledAt: string;
}

export interface AnalyticsSummary {
  days: number;
  preset?: AnalyticsDatePreset;
  startDate?: string;
  endDate?: string;
  bucketMode?: 'minute' | 'hour' | 'day' | 'month';
  totalPageviews: number;
  uniqueSessions: number;
  activeUsers?: number;
  newUsers?: number;
  returningUsers?: number;
  avgEngagementSeconds?: number;
  qualifiedLeads?: number;
  inquiryConversions: number;
  newsletterConversions: number;
  commentSubmissions: number;
  conversionRatePercent: number;
  dailySeries: {
    date: string;
    label?: string;
    pageviews: number;
    conversions: number;
    activeUsers?: number;
    newUsers?: number;
    avgEngagementSeconds?: number;
  }[];
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; visits: number }[];
  countries?: AnalyticsGeoCountryItem[];
  cities?: AnalyticsGeoCityItem[];
  channels?: AnalyticsChannelItem[];
  landingPages?: AnalyticsLandingPageItem[];
  pageTitles?: AnalyticsPageTitleItem[];
  eventCounts?: AnalyticsEventCountItem[];
  devices?: AnalyticsDevicePlatformItem[];
  cohorts?: AnalyticsCohortRow[];
  realtime?: RealtimeActiveVisitorSummary;
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

export type QuotaShieldLoopId =
  | 'qa_monitor'
  | 'demo_guard'
  | 'cyber_security'
  | 'ai_visibility'
  | 'chat_watcher'
  | 'cloudflare_snapshot';

export interface QuotaShieldLoopState {
  id: QuotaShieldLoopId;
  label: string;
  description: string;
  enabled: boolean;
  effectiveActive: boolean;
  intervalSeconds: number;
  defaultIntervalSeconds: number;
  lastRunAt: string | null;
  lastOutcome: 'idle' | 'executed' | 'skipped_idle' | 'paused' | 'serverless_disabled' | 'error';
  runsCount: number;
  skippedCount: number;
}

export interface QuotaShieldStatusResponse {
  lowQuotaMode: boolean;
  cacheTtlMultiplier: number;
  serverlessLoopsSuppressed: boolean;
  cacheStats: {
    hits: number;
    misses: number;
    entries: number;
    hitRatePercent: number;
    avoidedQueriesEstimate: number;
    lastFlushedAt: string | null;
  };
  loops: QuotaShieldLoopState[];
  auditTriggerSql: string;
  updatedAt: string;
}

export interface QuotaShieldUpdatePayload {
  lowQuotaMode?: boolean;
  cacheTtlMultiplier?: number;
  loops?: Partial<
    Record<
      QuotaShieldLoopId,
      {
        enabled?: boolean;
        intervalSeconds?: number;
      }
    >
  >;
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
  | 'google_analytics'
  | 'google_tag_manager'
  | 'google_search_console'
  | 'facebook_page'
  | 'tiktok'
  | 'apollo'
  | 'google_maps'
  | 'gemini'
  | 'github'
  | 'cloudflare';

export interface Ga4PropertyOption {
  property_id: string;
  property_name: string;
  account_name: string;
  measurement_id: string;
  stream_uri: string;
}

export interface Ga4LiveReportSummary {
  property_id: string;
  property_name: string;
  measurement_id: string;
  days: number;
  preset?: AnalyticsDatePreset;
  startDate?: string;
  endDate?: string;
  authMode?: 'service_account' | 'oauth' | 'first_party';
  synced_at: string;
  activeUsers: number;
  newUsers?: number;
  returningUsers?: number;
  totalSessions: number;
  screenPageViews: number;
  conversions: number;
  avgEngagementSeconds?: number;
  dailySeries: {
    date: string;
    label?: string;
    pageviews: number;
    conversions: number;
    activeUsers?: number;
    newUsers?: number;
    avgEngagementSeconds?: number;
  }[];
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; visits: number }[];
  countries?: AnalyticsGeoCountryItem[];
  cities?: AnalyticsGeoCityItem[];
  channels?: AnalyticsChannelItem[];
  landingPages?: AnalyticsLandingPageItem[];
  pageTitles?: AnalyticsPageTitleItem[];
  eventCounts?: AnalyticsEventCountItem[];
  devices?: AnalyticsDevicePlatformItem[];
  realtime?: RealtimeActiveVisitorSummary;
}

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
  ga4_account_email?: string;
  ga4_account_name?: string;
  ga4_auth_mode?: 'service_account' | 'oauth';
  ga4_service_account_email?: string;
  ga4_property_id?: string;
  ga4_property_name?: string;
  ga4_measurement_id?: string;
  ga4_stream_uri?: string;
  ga4_properties_list?: Ga4PropertyOption[];
  ga4_cached_report?: Ga4LiveReportSummary | null;
  gtm_account_email?: string;
  gtm_account_name?: string;
  gtm_account_id?: string;
  gtm_container_id?: string;
  gtm_container_public_id?: string;
  gtm_container_name?: string;
  gtm_workspace_id?: string;
  gtm_workspace_name?: string;
  gtm_containers_list?: GtmContainerOption[];
  gtm_snapshot?: GtmWorkspaceSnapshot | null;
  gsc_site_url?: string;
  gsc_service_account_email?: string;
  fb_page_id?: string;
  fb_page_name?: string;
  fb_page_url?: string;
  fb_app_id?: string;
  tiktok_open_id?: string;
  tiktok_handle?: string;
  tiktok_display_name?: string;
  tiktok_client_key?: string;
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
    | 'Web Analytics'
    | 'Search & Social'
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
    | 'test_notification'
    | 'qa_eod_report'
    | 'qa_critical_alert'
    | 'ai_seo_daily_report'
    | 'cybersec_daily_report'
    | 'cybersec_alert'
    | 'demo_guard_alert';
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
  visitor_id?: string;
  current_path: string;
  page_title?: string;
  zone_id: string;
  zone_label: string;
  device_type: 'desktop' | 'tablet' | 'mobile';
  referrer: string;
  channel_group?: string;
  country?: string;
  country_code?: string;
  city?: string;
  is_returning?: boolean;
  engagement_seconds?: number;
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
  visitor_phone: string;
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

export interface ChatAutoResponseTemplate {
  id: string;
  question_label: string;
  answer_body: string;
  keywords: string[];
  category: string;
  sort_order: number;
  is_active: boolean;
  show_as_quick_chip: boolean;
  escalate_prompt_enabled: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatAutoResponseSettings {
  id: string;
  require_intake_before_chat: boolean;
  intake_headline: string;
  intake_subheadline: string;
  welcome_message_after_intake: string;
  auto_reply_on_keyword_match: boolean;
  escalation_button_label: string;
  updated_by: string;
  updated_at: string;
}

export interface ChatAutoResponseDashboardResponse {
  templates: ChatAutoResponseTemplate[];
  settings: ChatAutoResponseSettings;
}

export interface WebsiteChatThreadResponse {
  session: WebsiteChatSession | null;
  messages: WebsiteChatMessage[];
  adminOnline: boolean;
  autoResponses?: ChatAutoResponseTemplate[];
  chatSettings?: ChatAutoResponseSettings;
}

export interface PublicChatStartResponse {
  session: WebsiteChatSession;
  messages: WebsiteChatMessage[];
  adminOnline: boolean;
  autoResponses: ChatAutoResponseTemplate[];
  chatSettings: ChatAutoResponseSettings;
}

export interface PurgeEmptyChatSessionsResponse {
  purgedCount: number;
  remainingCount: number;
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

// --- Product QA Monitor, Telemetry Logs & EOD PDF Report Agent ---

export type QaLogLevel = 'error' | 'warn' | 'info';
export type QaLogSource = 'frontend' | 'backend' | 'api' | 'database' | 'integration';
export type QaLogStatus = 'open' | 'investigating' | 'resolved' | 'ignored';

export interface ProductQaLog {
  id: string;
  level: QaLogLevel;
  source: QaLogSource;
  module_name: string;
  page_path: string;
  code_location: string;
  error_name: string;
  message: string;
  stack_trace: string;
  http_status: number | null;
  request_method: string;
  request_path: string;
  session_id: string;
  user_agent: string;
  fingerprint: string;
  ai_root_cause: string;
  ai_fix_suggestion: string;
  status: QaLogStatus;
  created_at: string;
}

export interface QaModuleBreakdownItem {
  module_name: string;
  total_count: number;
  error_count: number;
  warn_count: number;
  top_error: string;
  top_code_location: string;
}

export interface QaPageBreakdownItem {
  page_path: string;
  total_count: number;
  error_count: number;
  top_module: string;
  top_error: string;
}

export interface QaCodeHotspotItem {
  code_location: string;
  module_name: string;
  count: number;
  latest_message: string;
  latest_at: string;
}

export type QaFeatureDriftStatus = 'identical' | 'modified' | 'major_update';
export type QaFeatureTestStatus = 'passing' | 'degraded' | 'failing';

export interface QaFeatureCheckItem {
  id: string;
  module_name: string;
  feature_name: string;
  planned_spec: string;
  route_or_endpoint: string;
  baseline_fingerprint: string;
  current_fingerprint: string;
  drift_status: QaFeatureDriftStatus;
  change_summary: string;
  test_status: QaFeatureTestStatus;
  test_detail: string;
  last_tested_at: string;
  last_modified_at: string | null;
}

export interface ProductQaReport {
  id: string;
  report_date: string;
  trigger_type: 'manual' | 'eod_cron';
  recipient_email: string;
  subject: string;
  health_score: number;
  total_logs: number;
  error_count: number;
  warn_count: number;
  top_module: string;
  top_page: string;
  executive_summary: string;
  module_breakdown: QaModuleBreakdownItem[];
  page_breakdown: QaPageBreakdownItem[];
  feature_checks?: QaFeatureCheckItem[];
  recommended_actions: string[];
  pdf_filename: string;
  status: 'sent' | 'failed' | 'generated';
  provider_message_id: string;
  error_detail: string;
  created_at: string;
}

export interface ProductQaSettings {
  id: string;
  agent_enabled: boolean;
  realtime_alert_on_critical: boolean;
  eod_enabled: boolean;
  eod_hour_utc: number;
  recipient_email: string;
  last_eod_sent_date: string;
  last_scan_at: string | null;
  feature_baselines?: Record<
    string,
    {
      fingerprint: string;
      accepted_at: string;
      spec_summary: string;
    }
  >;
  updated_at: string;
}

export interface ProductQaDashboardResponse {
  settings: ProductQaSettings;
  resolvedRecipientEmail: string;
  larkConnected: boolean;
  summary: {
    healthScore: number;
    totalLogs24h: number;
    openErrorsCount: number;
    openWarnsCount: number;
    resolvedCount: number;
    topFailingModule: string;
    topFailingPage: string;
    topCodeHotspot: string;
    totalFeaturesCount?: number;
    passingFeaturesCount?: number;
    identicalFeaturesCount?: number;
    modifiedFeaturesCount?: number;
  };
  moduleBreakdown: QaModuleBreakdownItem[];
  pageBreakdown: QaPageBreakdownItem[];
  codeHotspots: QaCodeHotspotItem[];
  featureChecks: QaFeatureCheckItem[];
  logs: ProductQaLog[];
  reports: ProductQaReport[];
}

// --- AI & Search Engine Visibility (GEO / SEO) Daily Monitor ---

export type AiSearchPlatformId =
  | 'chatgpt_search'
  | 'gemini_ai_overview'
  | 'perplexity_ai'
  | 'claude_search'
  | 'copilot_bing_ai'
  | 'google_organic'
  | 'bing_organic';

export interface AiSearchPlatformResult {
  platform_id: AiSearchPlatformId;
  platform_name: string;
  category: 'ai_engine' | 'search_engine';
  crawler_agent: string;
  searchable: boolean;
  citation_rank: string;
  visibility_score: number;
  indexed_signals: string[];
  sample_ai_answer: string;
  status_note: string;
}

export interface AiSearchQueryRankItem {
  query: string;
  service_pillar: string;
  ai_rank_status: string;
  seo_rank_status: string;
  target_route: string;
  citation_snippet: string;
}

export interface AiSearchVisibilityRun {
  id: string;
  run_date: string;
  trigger_type: 'manual' | 'daily_cron' | 'content_boost';
  overall_score: number;
  ai_citation_score: number;
  seo_authority_score: number;
  searchable_platforms_count: number;
  total_platforms_count: number;
  top_ranked_services_count: number;
  platforms: AiSearchPlatformResult[];
  query_rankings: AiSearchQueryRankItem[];
  content_recommendations: string[];
  summary: string;
  created_at: string;
}

export interface AiSearchVisibilitySettings {
  id: string;
  daily_test_enabled: boolean;
  daily_hour_utc: number;
  recipient_email: string;
  target_domain: string;
  auto_optimize_llms_txt: boolean;
  last_run_date: string;
  last_run_at: string | null;
  updated_at: string;
}

export interface AiSearchVisibilityDashboardResponse {
  settings: AiSearchVisibilitySettings;
  resolvedRecipientEmail: string;
  larkConnected: boolean;
  latestRun: AiSearchVisibilityRun;
  history: AiSearchVisibilityRun[];
  seoComplianceChecklist: {
    id: string;
    label: string;
    status: 'compliant' | 'action_needed';
    detail: string;
    endpoint_or_tag: string;
  }[];
}

// --- Cybersecurity Posture, Live AI CyberSec Sentinel & Daily Report ---

export type CyberSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type CyberFindingStatus = 'open' | 'monitoring' | 'mitigated' | 'accepted';

export interface CyberSecurityFinding {
  id: string;
  domain: string;
  severity: CyberSeverity;
  status: CyberFindingStatus;
  title: string;
  cve_or_rule: string;
  affected_module: string;
  description: string;
  ai_remediation: string;
  detected_at: string;
  updated_at: string;
}

export interface CyberDomainCheck {
  domain_id: string;
  domain_name: string;
  status: 'protected' | 'warning' | 'critical';
  score: number;
  summary: string;
  controls_verified: string[];
}

export interface CyberSecurityReport {
  id: string;
  report_date: string;
  trigger_type: 'manual' | 'daily_cron';
  recipient_email: string;
  subject: string;
  posture_score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  domain_checks: CyberDomainCheck[];
  executive_summary: string;
  ai_threat_intel: string[];
  recommended_hardening: string[];
  pdf_filename: string;
  status: 'sent' | 'failed' | 'generated';
  provider_message_id: string;
  error_detail: string;
  created_at: string;
}

export interface CyberSecuritySettings {
  id: string;
  sentinel_enabled: boolean;
  daily_report_enabled: boolean;
  daily_hour_utc: number;
  realtime_critical_alert: boolean;
  recipient_email: string;
  last_report_date: string;
  last_scan_at: string | null;
  updated_at: string;
}

export interface CyberSecurityDashboardResponse {
  settings: CyberSecuritySettings;
  resolvedRecipientEmail: string;
  larkConnected: boolean;
  posture: {
    score: number;
    grade: 'A+' | 'A' | 'B' | 'C' | 'D';
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    protectedDomainsCount: number;
    totalDomainsCount: number;
    lastScanAt: string;
  };
  domainChecks: CyberDomainCheck[];
  findings: CyberSecurityFinding[];
  reports: CyberSecurityReport[];
  aiThreatIntel: string[];
}

// --- Google Tag Manager (GTM) Container, Telemetry & OAuth Sync ---

export type GtmEventCategory =
  | 'lifecycle'
  | 'pageview'
  | 'conversion'
  | 'engagement'
  | 'custom';

export interface GtmEventLog {
  id: string;
  container_id: string;
  event_name: string;
  event_category: GtmEventCategory;
  page_path: string;
  page_title: string;
  session_id: string;
  is_conversion: boolean;
  payload: Record<string, unknown>;
  user_agent: string;
  created_at: string;
}

export interface GtmTagSummary {
  tagId: string;
  name: string;
  type: string;
  paused: boolean;
  firingTriggerId: string[];
  tagFiringOption?: string;
}

export interface GtmTriggerSummary {
  triggerId: string;
  name: string;
  type: string;
}

export interface GtmVariableSummary {
  variableId: string;
  name: string;
  type: string;
}

export interface GtmContainerOption {
  accountId: string;
  accountName: string;
  containerId: string;
  publicId: string;
  name: string;
  usageContext: string[];
  workspaceId: string;
  workspaceName: string;
}

export interface GtmWorkspaceSnapshot {
  accountId: string;
  accountName: string;
  containerId: string;
  publicId: string;
  containerName: string;
  workspaceId: string;
  workspaceName: string;
  syncedAt: string;
  tags: GtmTagSummary[];
  triggers: GtmTriggerSummary[];
  variables: GtmVariableSummary[];
  note?: string;
}

export interface GtmSettingsConfig {
  gtm_enabled: boolean;
  gtm_container_id: string;
  gtm_track_datalayer: boolean;
  gtm_track_conversions: boolean;
  gtm_respect_consent: boolean;
  gtm_exclude_admin: boolean;
}

export interface GtmDashboardResponse {
  days: number;
  preset?: AnalyticsDatePreset;
  startDate?: string;
  endDate?: string;
  bucketMode?: 'minute' | 'hour' | 'day' | 'month';
  settings: GtmSettingsConfig;
  summary: {
    totalEvents: number;
    conversionEvents: number;
    pageViews: number;
    uniqueSessions: number;
    activeUsers?: number;
    newUsers?: number;
    returningUsers?: number;
    avgEngagementSeconds?: number;
    uniqueEventNames: number;
    conversionRatePercent: number;
    lastEventAt: string | null;
  };
  series: {
    label: string;
    events: number;
    conversions: number;
    pageViews: number;
    activeUsers?: number;
    newUsers?: number;
  }[];
  topEvents: {
    event_name: string;
    category: GtmEventCategory;
    count: number;
    conversions: number;
  }[];
  topPages: {
    page_path: string;
    events: number;
    conversions: number;
  }[];
  countries?: AnalyticsGeoCountryItem[];
  cities?: AnalyticsGeoCityItem[];
  channels?: AnalyticsChannelItem[];
  landingPages?: AnalyticsLandingPageItem[];
  pageTitles?: AnalyticsPageTitleItem[];
  devices?: AnalyticsDevicePlatformItem[];
  cohorts?: AnalyticsCohortRow[];
  realtime?: RealtimeActiveVisitorSummary;
  recentEvents: GtmEventLog[];
}

// --- Super Admin Live Data Explorer & Audit Log Module ---

export type DataColumnType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'boolean'
  | 'json'
  | 'timestamp'
  | 'enum';

export type DataDomainGroup =
  | 'Content & SEO'
  | 'CRM & Leads'
  | 'Communications'
  | 'Analytics & Telemetry'
  | 'Operations & Settings'
  | 'Security & Audit';

export interface DataTableColumnDescriptor {
  name: string;
  dataType: DataColumnType;
  pgType: string;
  nullable: boolean;
  readOnly: boolean;
  masked: boolean;
  isPrimaryKey: boolean;
  enumValues?: string[];
  defaultValue?: unknown;
}

export interface DataTableDescriptor {
  tableName: string;
  label: string;
  domainGroup: DataDomainGroup;
  primaryKey: string;
  defaultSortColumn: string;
  rowCount: number;
  readOnlyTable?: boolean;
  columns: DataTableColumnDescriptor[];
}

export type DataAuditSource = 'app_studio' | 'supabase_dashboard' | 'api_backend';
export type DataAuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface DataAuditLogEntry {
  id: string;
  table_name: string;
  operation: DataAuditOperation;
  record_pk: string;
  source: DataAuditSource;
  actor_email: string;
  changed_columns: string[];
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  summary: string;
  created_at: string;
}

export interface DataExplorerStatus {
  supabaseConfigured: boolean;
  storageBackend: 'supabase' | 'local-json';
  triggersReady: boolean;
  realtimeReady: boolean;
  automationMode: 'db-url' | 'management-api' | 'manual';
  totalTables: number;
  totalAuditLogs: number;
}

export interface DataRealtimeConfigResponse {
  supabaseConfigured: boolean;
  supabaseUrl: string | null;
  supabasePublicKey: string | null;
  storageBackend: 'supabase' | 'local-json';
}

export interface DataTableRowsResponse {
  table: DataTableDescriptor;
  rows: Record<string, unknown>[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface DataAuditLogsResponse {
  logs: DataAuditLogEntry[];
  totalCount: number;
  countsBySource: {
    all: number;
    app_studio: number;
    supabase_dashboard: number;
    api_backend: number;
  };
}

// --- Growth Suite: Search Console, Organic Marketing & Google Trends ---

export type GrowthModuleKey = 'search_console' | 'marketing' | 'google_trends';

export interface GrowthModuleEmailConfig {
  module: GrowthModuleKey;
  enabled: boolean;
  recipient_email: string;
  frequency: 'daily' | 'weekly' | 'manual';
  send_hour_utc: number;
  last_sent_at: string | null;
  updated_at: string;
}

export interface GrowthModuleEmailLog {
  id: string;
  module: GrowthModuleKey;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'failed';
  provider_message_id: string;
  error_detail: string;
  sent_at: string;
}

export interface SearchConsoleEngineVerdict {
  engine: 'Google Search' | 'Bing & DuckDuckGo' | 'Yahoo Search' | 'AI Search (ChatGPT / Gemini / Perplexity)';
  searchable: boolean;
  statusLabel: string;
  reason: string;
}

export interface SearchConsoleKeywordMetric {
  keyword: string;
  occurrences: number;
  densityPercent: number;
  inTitle: boolean;
  inH1: boolean;
  inMeta: boolean;
  source: 'on_page' | 'gsc_live';
  clicks?: number;
  impressions?: number;
  ctrPercent?: number;
  position?: number;
}

export interface SearchConsoleAiRecommendation {
  path: string;
  analyzedAt: string;
  modelUsed: string;
  summary: string;
  recommendedTitle: string;
  recommendedMetaDescription: string;
  priorityKeywordsToAdd: string[];
  contentImprovements: string[];
  technicalFixes: string[];
  internalLinkSuggestions: string[];
  estimatedImpact: 'High' | 'Medium' | 'Foundational';
}

export interface SearchConsoleUrlAudit {
  id: string;
  path: string;
  fullUrl: string;
  pageType: 'core_page' | 'article' | 'legal_page';
  httpStatus: number;
  indexable: boolean;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  canonicalUrl: string;
  robotsDirective: string;
  h1: string;
  h2Headings: string[];
  wordCount: number;
  internalLinksCount: number;
  schemaTypes: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  primaryKeyword: string;
  keywords: SearchConsoleKeywordMetric[];
  engineVerdicts: SearchConsoleEngineVerdict[];
  seoScore: number;
  issues: string[];
  quickSuggestions: string[];
  gscMetrics?: {
    clicks: number;
    impressions: number;
    ctrPercent: number;
    avgPosition: number;
    topQueries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctrPercent: number;
      position: number;
    }>;
  } | null;
  aiAnalysis?: SearchConsoleAiRecommendation | null;
}

export interface SearchConsoleAuditRun {
  id: string;
  baseOrigin: string;
  scannedAt: string;
  gscApiConnected: boolean;
  gscSiteUrl: string;
  totalLinks: number;
  searchableLinks: number;
  avgSeoScore: number;
  issueCount: number;
  urls: SearchConsoleUrlAudit[];
}

export interface SearchConsoleDashboardResponse {
  latestRun: SearchConsoleAuditRun | null;
  historyCount: number;
  gscConnected: boolean;
  gscSiteUrl: string;
  gscServiceAccountEmail: string;
  emailConfig: GrowthModuleEmailConfig;
  emailLogs: GrowthModuleEmailLog[];
}

export type MarketingChannel = 'facebook_page' | 'tiktok' | 'website_organic';
export type MarketingPostStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'failed';

export interface SocialAccountConnection {
  provider: 'facebook_page' | 'tiktok';
  connected: boolean;
  source: 'vault' | 'env' | 'disconnected';
  accountLabel: string;
  accountId: string;
  profileUrl: string;
  oauthConfigured: boolean;
  callbackUrls: {
    development: string;
    shared: string;
  };
  lastTestedAt: string | null;
  lastTestStatus: 'ok' | 'error' | 'untested';
  lastTestMessage: string;
}

export interface MarketingScheduleItem {
  id: string;
  dayNumber: number;
  dayLabel: string;
  scheduledDate: string;
  scheduledTime: string;
  channel: MarketingChannel;
  contentFormat: string;
  servicePillar: string;
  headline: string;
  hook: string;
  caption: string;
  videoScript: string;
  hashtags: string[];
  ctaLabel: string;
  ctaUrl: string;
  coverImage: string;
  coverAlt: string;
  status: MarketingPostStatus;
  sourceTrendTitle?: string;
  remotePostId?: string;
  remotePostUrl?: string;
  publishedAt?: string;
  deliveryMessage?: string;
  updatedAt: string;
}

export interface MarketingPublishProof {
  id: string;
  scheduleItemId: string;
  channel: MarketingChannel;
  headline: string;
  captionPreview: string;
  ctaUrl: string;
  coverImage: string;
  status: 'published' | 'failed';
  mode: 'live_api' | 'organic_ready';
  remotePostId: string;
  remotePostUrl: string;
  responseNote: string;
  publishedAt: string;
}

export interface MarketingDashboardResponse {
  accounts: {
    facebook: SocialAccountConnection;
    tiktok: SocialAccountConnection;
  };
  schedule: MarketingScheduleItem[];
  proofs: MarketingPublishProof[];
  emailConfig: GrowthModuleEmailConfig;
  emailLogs: GrowthModuleEmailLog[];
  lastGeneratedAt: string | null;
}

export interface GoogleTrendMonitorItem {
  id: string;
  title: string;
  region: string;
  trafficLabel: string;
  sourceType: 'google_trends_rss' | 'google_search_grounding' | 'gitstack_trend_radar';
  servicePillar: string;
  whyItConverts: string;
  relatedQueries: string[];
  sources: { title: string; url: string }[];
  publishedAt: string;
  alreadyCovered: boolean;
}

export type TrendBundleStatus = 'pending_approval' | 'approved' | 'published' | 'rejected';

export interface TrendApprovalBundle {
  id: string;
  trendId: string;
  trendTitle: string;
  region: string;
  status: TrendBundleStatus;
  createdAt: string;
  reviewedAt: string | null;
  ctaLinks: {
    appUrl: string;
    signupDemoUrl: string;
    contactServiceUrl: string;
  };
  articleDraft: {
    title: string;
    slug: string;
    summary_tldr: string;
    content_markdown: string;
    category: ServiceCategory;
    meta_title: string;
    meta_description: string;
    primary_keyword: string;
    word_count: number;
    quality_score: number;
    geo_score: number;
    publish_eligible: boolean;
    cover_image?: string;
    faqs: ArticleFAQ[];
    references: ArticleReference[];
  };
  facebookPost: {
    headline: string;
    caption: string;
    hashtags: string[];
    ctaUrl: string;
    coverImage: string;
  };
  tiktokPost: {
    hook: string;
    videoScript: string;
    caption: string;
    hashtags: string[];
    ctaUrl: string;
    coverImage: string;
  };
  publishedArticleSlug?: string | null;
  queuedMarketingIds?: string[];
  socialPublishNotes?: string[];
  reviewNote?: string;
}

export interface GoogleTrendsDashboardResponse {
  region: string;
  lastScannedAt: string | null;
  feedSourceMode: 'google_trends_rss' | 'google_search_grounding' | 'gitstack_trend_radar';
  notice?: string;
  trends: GoogleTrendMonitorItem[];
  approvalQueue: TrendApprovalBundle[];
  stats: {
    monitoredCount: number;
    pendingApprovalCount: number;
    publishedBundlesCount: number;
    alreadyCoveredCount: number;
  };
  emailConfig: GrowthModuleEmailConfig;
  emailLogs: GrowthModuleEmailLog[];
}

// --- Customizable Back Office Module Categories & Layout ---

export type WorkspaceModuleId =
  | 'agents'
  | 'crm'
  | 'pages'
  | 'contact_registry'
  | 'branding'
  | 'buymeacoffee'
  | 'inbox'
  | 'chat_auto_response'
  | 'notifications'
  | 'chat'
  | 'workflows'
  | 'analytics'
  | 'tag_manager'
  | 'cloudflare'
  | 'ai_visibility'
  | 'search_console'
  | 'marketing'
  | 'google_trends'
  | 'resources'
  | 'qa'
  | 'cybersecurity'
  | 'demo_guard'
  | 'articles'
  | 'users'
  | 'demo_users'
  | 'data_explorer'
  | 'adsense'
  | 'profile';

export interface WorkspaceCategoryConfig {
  id: string;
  name: string;
  collapsed?: boolean;
  moduleIds: WorkspaceModuleId[];
}

export interface WorkspaceLayoutConfig {
  version: number;
  sidebarCollapsed: boolean;
  categories: WorkspaceCategoryConfig[];
  moduleAliases: Record<string, string>;
  updatedAt: string;
}

// --- Sitewide Email, Phone & Contact Name Scanner / Editor ---

export type ContactEntityKind = 'email' | 'phone' | 'name';
export type ContactRegistryScope = 'page' | 'article' | 'module';

export interface ContactRegistryEntry {
  id: string;
  scope: ContactRegistryScope;
  scopeId: string;
  scopeTitle: string;
  routeOrTab: string;
  jumpTab: WorkspaceModuleId;
  fieldPath: string;
  fieldLabel: string;
  kind: ContactEntityKind;
  value: string;
  contextSnippet: string;
  editable: boolean;
  editHint?: string;
  updatedAt: string;
}

export interface ContactScanSummary {
  scannedAt: string;
  totalEntries: number;
  emailsCount: number;
  phonesCount: number;
  namesCount: number;
  pagesScanned: number;
  articlesScanned: number;
  modulesScanned: number;
  uniqueEmails: Array<{ value: string; count: number; scopes: ContactRegistryScope[] }>;
  uniquePhones: Array<{ value: string; count: number; scopes: ContactRegistryScope[] }>;
  uniqueNames: Array<{ value: string; count: number; scopes: ContactRegistryScope[] }>;
  entries: ContactRegistryEntry[];
}

// --- Real-Time Demo Guard & Admin Parity Monitor Types ---

export type DemoGuardCheckStatus = 'pass' | 'warning' | 'fail';

export interface DemoGuardDriftItem {
  file: string;
  expectedHash: string;
  actualHash: string;
  status: 'matched' | 'modified' | 'missing';
}

export interface DemoGuardIsolationCheck {
  id: string;
  label: string;
  status: DemoGuardCheckStatus;
  detail: string;
  metric: string;
}

export interface DemoGuardAdminParityCheck {
  moduleId: WorkspaceModuleId;
  moduleLabel: string;
  endpoint: string;
  status: DemoGuardCheckStatus;
  httpStatus: number;
  durationMs: number;
  detail: string;
}

export interface DemoGuardAlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  kind:
    | 'code_drift'
    | 'isolation_leak'
    | 'admin_parity_fail'
    | 'baseline_sealed'
    | 'audit_passed';
  title: string;
  detail: string;
  affectedTarget: string;
  emailSent: boolean;
  emailRecipient: string;
  emailStatus: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface DemoGuardBaselineSnapshot {
  sealedAt: string;
  sealedBy: string;
  overallHash: string;
  fileHashes: Record<string, string>;
  isolationSignature: string;
}

export interface DemoGuardDashboardResponse {
  overallStatus: 'healthy' | 'warning' | 'critical';
  demoScore: number;
  adminParityScore: number;
  lastScanAt: string | null;
  baseline: DemoGuardBaselineSnapshot;
  driftItems: DemoGuardDriftItem[];
  isolationChecks: DemoGuardIsolationCheck[];
  adminParityChecks: DemoGuardAdminParityCheck[];
  alerts: DemoGuardAlertItem[];
  unacknowledgedCount: number;
  recipientEmail: string;
  autoWatchEnabled: boolean;
  autoEmailEnabled: boolean;
}

// --- Super Admin Gemini & MCP Command Hub Types ---

export type StudioModuleId = WorkspaceModuleId | 'mcp_hub';

export type McpToolAccessLevel = 'read' | 'write' | 'staged_edit';

export interface McpTokenSummary {
  id: string;
  label: string;
  tokenPrefix: string;
  scopes: string[];
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface McpCreateTokenResponse {
  token: McpTokenSummary;
  rawToken: string;
}

export type McpCodeProposalStatus = 'pending' | 'applied' | 'rejected';

export interface McpCodeProposal {
  id: string;
  filePath: string;
  summary: string;
  rationale: string;
  originalSha256: string;
  originalContent: string;
  proposedContent: string;
  diffPreview: string;
  requestedBy: string;
  source: 'gemini_chat' | 'external_mcp';
  status: McpCodeProposalStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  error?: string;
}

export interface McpAuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  transport: 'gemini_chat' | 'mcp_http' | 'mcp_sse' | 'admin_ui';
  toolName: string;
  status: 'ok' | 'blocked' | 'error';
  durationMs: number;
  summary: string;
  argsPreview: string;
}

export interface McpToolDescriptor {
  name: string;
  category: 'Source Code' | 'CMS & SEO' | 'CRM & Inbox' | 'Agents & Workflows' | 'Infra & Security';
  description: string;
  accessLevel: McpToolAccessLevel;
  parameters: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      description: string;
      required?: boolean;
      enumValues?: string[];
    }
  >;
}

export interface McpToolTrace {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'ok' | 'blocked' | 'error';
  durationMs: number;
  resultPreview: string;
}

export interface McpChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface McpChatResponse {
  reply: string;
  traces: McpToolTrace[];
  createdProposalIds: string[];
  modelUsed: string;
  thinkingLevel: 'MEDIUM' | 'XHIGH';
}

export interface McpDashboardResponse {
  tokens: McpTokenSummary[];
  proposals: McpCodeProposal[];
  auditLogs: McpAuditLogEntry[];
  tools: McpToolDescriptor[];
  mcpEndpointPath: string;
  sseEndpointPath: string;
  geminiConfigured: boolean;
}
