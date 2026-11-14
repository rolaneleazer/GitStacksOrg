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
