-- GitStack Supabase PostgreSQL Schema & Row-Level Security Policies
-- Auth Strategy: Supabase Email/Password Authentication (No Google Sign-In)
-- Run this script in your Supabase Project -> SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Technical Insights & Editorial Articles
CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary_tldr TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  category TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  author_bio TEXT NOT NULL,
  cover_image TEXT NOT NULL DEFAULT '',
  cover_alt TEXT NOT NULL DEFAULT '',
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  primary_keyword TEXT NOT NULL DEFAULT '',
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  "references" JSONB NOT NULL DEFAULT '[]'::jsonb,
  word_count INTEGER NOT NULL DEFAULT 0,
  read_time_minutes INTEGER NOT NULL DEFAULT 1,
  quality_score INTEGER NOT NULL DEFAULT 0,
  geo_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published ON public.posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts (slug);

-- 2. Reader Comments
CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'hidden')) DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments (post_id, created_at DESC);

-- 3. Newsletter Subscribers
CREATE TABLE IF NOT EXISTS public.subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  interest_topic TEXT NOT NULL DEFAULT 'All Engineering Topics',
  consent_given BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. B2B Client Consultation Inquiries
CREATE TABLE IF NOT EXISTS public.inquiries (
  id TEXT PRIMARY KEY,
  reference_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company TEXT NOT NULL,
  work_email TEXT NOT NULL,
  service_interest TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  timeline TEXT NOT NULL,
  project_brief TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'reviewed', 'scheduled')) DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive migration for inquiries assignment
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- 5. AdSense & Site Compliance Settings (Singleton id = 'default')
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  adsense_publisher_id TEXT NOT NULL DEFAULT '',
  ads_txt_content TEXT NOT NULL DEFAULT '',
  auto_ads_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ad_slots_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  editorial_review_note TEXT NOT NULL DEFAULT '',
  ga4_measurement_id TEXT NOT NULL DEFAULT '',
  ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ga4_track_events BOOLEAN NOT NULL DEFAULT TRUE,
  brand_name TEXT NOT NULL DEFAULT 'GitStack',
  brand_logo_url TEXT NOT NULL DEFAULT '',
  brand_logo_alt TEXT NOT NULL DEFAULT 'GitStack logo',
  favicon_url TEXT NOT NULL DEFAULT '',
  theme_preset TEXT NOT NULL DEFAULT 'cobalt',
  primary_color TEXT NOT NULL DEFAULT '#1E40AF',
  header_surface TEXT NOT NULL DEFAULT 'white',
  header_cta_label TEXT NOT NULL DEFAULT 'Book Consultation',
  header_cta_href TEXT NOT NULL DEFAULT '/contact',
  bmc_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bmc_handle TEXT NOT NULL DEFAULT 'ronelmol',
  bmc_custom_url TEXT NOT NULL DEFAULT 'https://buymeacoffee.com/ronelmol',
  bmc_button_text TEXT NOT NULL DEFAULT 'Buy me a coffee',
  bmc_button_color TEXT NOT NULL DEFAULT '#FFDD00',
  bmc_font_style TEXT NOT NULL DEFAULT 'Cookie',
  bmc_header_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bmc_footer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bmc_floating_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bmc_floating_position TEXT NOT NULL DEFAULT 'Right',
  bmc_floating_y_offset INTEGER NOT NULL DEFAULT 84,
  bmc_support_message TEXT NOT NULL DEFAULT 'Support independent open-source tools, technical research, and live sandbox maintenance.',
  gtm_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  gtm_container_id TEXT NOT NULL DEFAULT 'GTM-MFP3W7MS',
  gtm_track_datalayer BOOLEAN NOT NULL DEFAULT TRUE,
  gtm_track_conversions BOOLEAN NOT NULL DEFAULT TRUE,
  gtm_respect_consent BOOLEAN NOT NULL DEFAULT FALSE,
  gtm_exclude_admin BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive migration for existing site_settings table
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_track_events BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS brand_name TEXT NOT NULL DEFAULT 'GitStack';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS brand_logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS brand_logo_alt TEXT NOT NULL DEFAULT 'GitStack logo';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS theme_preset TEXT NOT NULL DEFAULT 'cobalt';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#1E40AF';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS header_surface TEXT NOT NULL DEFAULT 'white';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS header_cta_label TEXT NOT NULL DEFAULT 'Book Consultation';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS header_cta_href TEXT NOT NULL DEFAULT '/contact';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_handle TEXT NOT NULL DEFAULT 'ronelmol';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_custom_url TEXT NOT NULL DEFAULT 'https://buymeacoffee.com/ronelmol';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_button_text TEXT NOT NULL DEFAULT 'Buy me a coffee';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_button_color TEXT NOT NULL DEFAULT '#FFDD00';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_font_style TEXT NOT NULL DEFAULT 'Cookie';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_header_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_footer_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_floating_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_floating_position TEXT NOT NULL DEFAULT 'Right';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_floating_y_offset INTEGER NOT NULL DEFAULT 84;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS bmc_support_message TEXT NOT NULL DEFAULT 'Support independent open-source tools, technical research, and live sandbox maintenance.';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS gtm_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS gtm_container_id TEXT NOT NULL DEFAULT 'GTM-MFP3W7MS';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS gtm_track_datalayer BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS gtm_track_conversions BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS gtm_respect_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS gtm_exclude_admin BOOLEAN NOT NULL DEFAULT TRUE;

-- 6. Page Content & Media Customizer (Structured CMS Slots)
CREATE TABLE IF NOT EXISTS public.page_contents (
  page_key TEXT PRIMARY KEY CHECK (page_key IN ('home', 'services', 'about', 'contact')),
  hero_kicker TEXT NOT NULL DEFAULT '',
  hero_title TEXT NOT NULL DEFAULT '',
  hero_subtitle TEXT NOT NULL DEFAULT '',
  hero_cta_label TEXT NOT NULL DEFAULT '',
  hero_image TEXT NOT NULL DEFAULT '',
  hero_image_alt TEXT NOT NULL DEFAULT '',
  secondary_image TEXT NOT NULL DEFAULT '',
  secondary_image_alt TEXT NOT NULL DEFAULT '',
  intro_heading TEXT NOT NULL DEFAULT '',
  intro_body TEXT NOT NULL DEFAULT '',
  contact_phone_label TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_sales_label TEXT NOT NULL DEFAULT '',
  contact_sales_email TEXT NOT NULL DEFAULT '',
  contact_editorial_label TEXT NOT NULL DEFAULT '',
  contact_editorial_email TEXT NOT NULL DEFAULT '',
  contact_privacy_label TEXT NOT NULL DEFAULT '',
  contact_privacy_email TEXT NOT NULL DEFAULT '',
  custom_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_phone_label TEXT NOT NULL DEFAULT '';
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_sales_label TEXT NOT NULL DEFAULT '';
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_sales_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_editorial_label TEXT NOT NULL DEFAULT '';
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_editorial_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_privacy_label TEXT NOT NULL DEFAULT '';
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS contact_privacy_email TEXT NOT NULL DEFAULT '';

-- 7. Back Office 7-Agent Operational Checklists (Private)
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('marketing', 'ceo', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic')),
  title TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Internal Back Office Historical Q&A & Live Chat Workspace (Private)
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('inquiry', 'comment', 'internal')) DEFAULT 'internal',
  source_ref_id TEXT,
  requester_name TEXT NOT NULL DEFAULT '',
  requester_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open', 'answered', 'archived')) DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('visitor', 'admin', 'system')) DEFAULT 'admin',
  sender_name TEXT NOT NULL DEFAULT 'GitStack Admin',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages (thread_id, created_at ASC);

-- 9. First-Party Analytics Telemetry (Public insert, Private Back Office select)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('pageview', 'inquiry_submitted', 'newsletter_subscribed', 'comment_submitted')),
  path TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events (created_at DESC);

-- 10. Team User Profiles & Role-Based Access Control (Private Back Office)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'editor', 'support_agent')) DEFAULT 'editor',
  job_title TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Per-User Workflow Tasks & Checklists (Private Back Office)
CREATE TABLE IF NOT EXISTS public.user_workflow_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('onboarding', 'daily_checklist', 'project_task', 'follow_up')) DEFAULT 'project_task',
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
  due_date TEXT,
  linked_entity_type TEXT NOT NULL CHECK (linked_entity_type IN ('inquiry', 'chat', 'article', 'none')) DEFAULT 'none',
  linked_entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_workflows_user ON public.user_workflow_items (user_id, updated_at DESC);

-- 12. Deterministic Inquiry & Chat Auto-Routing Rules (Private Back Office)
CREATE TABLE IF NOT EXISTS public.routing_rules (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('inquiry', 'chat')),
  match_key TEXT NOT NULL,
  assignee_user_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant schema and least-privilege table access (enforced by Row-Level Security below)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT ON public.comments TO anon;
GRANT INSERT ON public.subscribers TO anon;
GRANT INSERT ON public.inquiries TO anon;
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.page_contents TO anon;
GRANT INSERT ON public.analytics_events TO anon;
GRANT ALL ON public.posts, public.comments, public.subscribers, public.inquiries, public.site_settings, public.page_contents, public.agent_tasks, public.chat_threads, public.chat_messages, public.analytics_events, public.user_profiles, public.user_workflow_items, public.routing_rules TO authenticated, service_role;

-- Enable Row-Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workflow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

-- Public read access for published posts, approved comments, settings, and page customizations
DROP POLICY IF EXISTS "Public can read published posts" ON public.posts;
CREATE POLICY "Public can read published posts"
  ON public.posts FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Public can read approved comments" ON public.comments;
CREATE POLICY "Public can read approved comments"
  ON public.comments FOR SELECT
  USING (status = 'approved');

DROP POLICY IF EXISTS "Public can read page contents" ON public.page_contents;
CREATE POLICY "Public can read page contents"
  ON public.page_contents FOR SELECT
  USING (true);

-- Public write access for engagement, lead capture & analytics beacons
DROP POLICY IF EXISTS "Public can submit comments" ON public.comments;
CREATE POLICY "Public can submit comments"
  ON public.comments FOR INSERT
  WITH CHECK (length(body) >= 8 AND length(author_name) >= 2);

DROP POLICY IF EXISTS "Public can subscribe to newsletter" ON public.subscribers;
CREATE POLICY "Public can subscribe to newsletter"
  ON public.subscribers FOR INSERT
  WITH CHECK (consent_given = TRUE AND position('@' IN email) > 1);

DROP POLICY IF EXISTS "Public can submit project inquiries" ON public.inquiries;
CREATE POLICY "Public can submit project inquiries"
  ON public.inquiries FOR INSERT
  WITH CHECK (length(project_brief) >= 20 AND position('@' IN work_email) > 1);

DROP POLICY IF EXISTS "Public can record analytics events" ON public.analytics_events;
CREATE POLICY "Public can record analytics events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (length(path) >= 1);

-- Authenticated Supabase Email/Password Editors have full management access
DROP POLICY IF EXISTS "Authenticated editors manage posts" ON public.posts;
CREATE POLICY "Authenticated editors manage posts"
  ON public.posts FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors manage comments" ON public.comments;
CREATE POLICY "Authenticated editors manage comments"
  ON public.comments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors view subscribers" ON public.subscribers;
CREATE POLICY "Authenticated editors view subscribers"
  ON public.subscribers FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors manage inquiries" ON public.inquiries;
CREATE POLICY "Authenticated editors manage inquiries"
  ON public.inquiries FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can read site settings" ON public.site_settings;
CREATE POLICY "Public can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated editors manage site settings" ON public.site_settings;
CREATE POLICY "Authenticated editors manage site settings"
  ON public.site_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors manage page contents" ON public.page_contents;
CREATE POLICY "Authenticated editors manage page contents"
  ON public.page_contents FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors manage agent tasks" ON public.agent_tasks;
CREATE POLICY "Authenticated editors manage agent tasks"
  ON public.agent_tasks FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors manage chat threads" ON public.chat_threads;
CREATE POLICY "Authenticated editors manage chat threads"
  ON public.chat_threads FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors manage chat messages" ON public.chat_messages;
CREATE POLICY "Authenticated editors manage chat messages"
  ON public.chat_messages FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated editors read analytics events" ON public.analytics_events;
CREATE POLICY "Authenticated editors read analytics events"
  ON public.analytics_events FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage user profiles" ON public.user_profiles;
CREATE POLICY "Authenticated team manage user profiles"
  ON public.user_profiles FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage user workflows" ON public.user_workflow_items;
CREATE POLICY "Authenticated team manage user workflows"
  ON public.user_workflow_items FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage routing rules" ON public.routing_rules;
CREATE POLICY "Authenticated team manage routing rules"
  ON public.routing_rules FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.site_settings (
  id,
  adsense_publisher_id,
  ads_txt_content,
  auto_ads_enabled,
  ad_slots_enabled,
  editorial_review_note,
  ga4_measurement_id,
  ga4_enabled,
  ga4_track_events,
  brand_name,
  brand_logo_url,
  brand_logo_alt,
  theme_preset,
  primary_color,
  header_surface,
  header_cta_label,
  header_cta_href
)
VALUES (
  'default',
  '',
  '# Configure your Google AdSense Publisher ID in GitStack Studio to activate verified ads.txt',
  FALSE,
  FALSE,
  'All articles must pass the 8-pillar AdSense E-E-A-T & 800-word depth gate before publishing.',
  '',
  FALSE,
  TRUE,
  'GitStack',
  '',
  'GitStack logo',
  'cobalt',
  '#1E40AF',
  'white',
  'Book Consultation',
  '/contact'
)
ON CONFLICT (id) DO NOTHING;

-- 13. Virtual Office HQ Customizable Agent Profiles
CREATE TABLE IF NOT EXISTS public.agent_office_profiles (
  agent_id TEXT PRIMARY KEY CHECK (agent_id IN ('marketing', 'ceo', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic')),
  display_name TEXT NOT NULL,
  custom_role TEXT NOT NULL,
  avatar_icon TEXT NOT NULL DEFAULT 'bot',
  accent_color TEXT NOT NULL DEFAULT '#1E40AF',
  desk_label TEXT NOT NULL DEFAULT 'Operations Desk',
  desk_x NUMERIC NOT NULL DEFAULT 5,
  desk_y NUMERIC NOT NULL DEFAULT 5,
  work_status TEXT NOT NULL CHECK (work_status IN ('working', 'walking', 'idle')) DEFAULT 'working',
  current_mission TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Agent Live Conversation & Inter-Agent Handoff Feed
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('marketing', 'ceo', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic')),
  peer_agent_id TEXT,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'operator', 'handoff', 'system')) DEFAULT 'agent',
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  finding_status TEXT NOT NULL CHECK (finding_status IN ('nominal', 'attention', 'critical', 'info')) DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent ON public.agent_conversations (agent_id, created_at DESC);

-- 15. Daily Agent Email Report Settings (Singleton id = 'default')
CREATE TABLE IF NOT EXISTS public.agent_report_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_email TEXT NOT NULL DEFAULT 'gitstackitsolution@gmail.com',
  send_hour_utc INTEGER NOT NULL DEFAULT 8,
  preferred_channel TEXT NOT NULL CHECK (preferred_channel IN ('gmail', 'resend')) DEFAULT 'gmail',
  include_agents JSONB NOT NULL DEFAULT '["ceo","marketing","booking","cybersecurity","qa","adsense","traffic"]'::jsonb,
  last_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Immutable Daily Agent Email Delivery Proof Log
CREATE TABLE IF NOT EXISTS public.agent_email_reports (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('gmail_api', 'resend_api', 'cron_dispatch')) DEFAULT 'gmail_api',
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'daily_cron')) DEFAULT 'manual',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_unconfigured')) DEFAULT 'sent',
  provider_message_id TEXT NOT NULL DEFAULT '',
  provider_thread_id TEXT NOT NULL DEFAULT '',
  overall_score INTEGER NOT NULL DEFAULT 0,
  agent_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_text TEXT NOT NULL,
  proof_hash TEXT NOT NULL,
  error_detail TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_email_reports_sent ON public.agent_email_reports (sent_at DESC);

GRANT ALL ON public.agent_office_profiles, public.agent_conversations, public.agent_report_settings, public.agent_email_reports TO authenticated, service_role;

ALTER TABLE public.agent_office_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_email_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated team manage agent office profiles" ON public.agent_office_profiles;
CREATE POLICY "Authenticated team manage agent office profiles"
  ON public.agent_office_profiles FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage agent conversations" ON public.agent_conversations;
CREATE POLICY "Authenticated team manage agent conversations"
  ON public.agent_conversations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage report settings" ON public.agent_report_settings;
CREATE POLICY "Authenticated team manage report settings"
  ON public.agent_report_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage email reports" ON public.agent_email_reports;
CREATE POLICY "Authenticated team manage email reports"
  ON public.agent_email_reports FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.agent_report_settings DROP CONSTRAINT IF EXISTS agent_report_settings_preferred_channel_check;
ALTER TABLE public.agent_report_settings
  ADD CONSTRAINT agent_report_settings_preferred_channel_check
  CHECK (preferred_channel IN ('lark_smtp', 'gmail', 'resend'));

ALTER TABLE public.agent_email_reports DROP CONSTRAINT IF EXISTS agent_email_reports_channel_check;
ALTER TABLE public.agent_email_reports
  ADD CONSTRAINT agent_email_reports_channel_check
  CHECK (channel IN ('lark_smtp', 'cron_dispatch', 'gmail_api', 'resend_api'));

INSERT INTO public.agent_report_settings (
  id,
  enabled,
  recipient_email,
  send_hour_utc,
  preferred_channel
)
VALUES (
  'default',
  TRUE,
  'gitstackitsolution@gmail.com',
  8,
  'lark_smtp'
)
ON CONFLICT (id) DO NOTHING;

-- 17. Apollo-Style CRM Pipeline & Multi-Source Prospecting Leads
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL CHECK (email_status IN ('verified_mx', 'public_found', 'inferred', 'invalid')) DEFAULT 'inferred',
  company_name TEXT NOT NULL,
  company_domain TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  github_url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  rating NUMERIC,
  source_detail TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL CHECK (source_type IN ('github', 'website', 'gemini_search', 'apollo', 'google_maps', 'hacker_news', 'ycombinator', 'csv_import', 'manual')) DEFAULT 'manual',
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  tech_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
  research_brief TEXT NOT NULL DEFAULT '',
  recommended_service TEXT NOT NULL DEFAULT 'AI Integration',
  fit_score INTEGER NOT NULL DEFAULT 70,
  deal_value INTEGER NOT NULL DEFAULT 25000,
  stage TEXT NOT NULL CHECK (stage IN ('discovered', 'researched', 'proposed', 'follow_up', 'won', 'lost')) DEFAULT 'discovered',
  proposal_subject TEXT NOT NULL DEFAULT '',
  proposal_body TEXT NOT NULL DEFAULT '',
  follow_up_sequence JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_to TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  converted_inquiry_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS rating NUMERIC;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS source_detail TEXT NOT NULL DEFAULT '';
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_source_type_check;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_source_type_check
  CHECK (source_type IN ('github', 'website', 'gemini_search', 'apollo', 'google_maps', 'hacker_news', 'ycombinator', 'csv_import', 'demo_signup', 'manual'));

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads (stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON public.crm_leads (source_type, updated_at DESC);

-- 18. CRM Outbound Email & Proposal Delivery Logs (Lark Mail + Gmail)
CREATE TABLE IF NOT EXISTS public.crm_outreach_logs (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('lark_mail', 'gmail_api')) DEFAULT 'lark_mail',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  provider_message_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
  error_detail TEXT NOT NULL DEFAULT '',
  step_label TEXT NOT NULL DEFAULT 'Initial Proposal',
  sent_by TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_outreach_logs_lead ON public.crm_outreach_logs (lead_id, sent_at DESC);

-- 19. Per-Operator OAuth Tokens (Lark Open Platform Mail API)
CREATE TABLE IF NOT EXISTS public.crm_oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('lark')) DEFAULT 'lark',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  account_email TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. CRM Multi-Source Sync & Import Provenance Audit Runs
CREATE TABLE IF NOT EXISTS public.crm_sync_runs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('github', 'website', 'gemini_search', 'apollo', 'google_maps', 'hacker_news', 'ycombinator', 'csv_import', 'manual')),
  query_label TEXT NOT NULL DEFAULT '',
  fetched_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  merged_count INTEGER NOT NULL DEFAULT 0,
  mx_verified_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')) DEFAULT 'completed',
  error_detail TEXT NOT NULL DEFAULT '',
  triggered_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_runs_created ON public.crm_sync_runs (created_at DESC);

GRANT ALL ON public.crm_leads, public.crm_outreach_logs, public.crm_oauth_tokens, public.crm_sync_runs TO authenticated, service_role;

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_outreach_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated team manage crm leads" ON public.crm_leads;
CREATE POLICY "Authenticated team manage crm leads"
  ON public.crm_leads FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage crm outreach logs" ON public.crm_outreach_logs;
CREATE POLICY "Authenticated team manage crm outreach logs"
  ON public.crm_outreach_logs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage crm oauth tokens" ON public.crm_oauth_tokens;
CREATE POLICY "Authenticated team manage crm oauth tokens"
  ON public.crm_oauth_tokens FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage crm sync runs" ON public.crm_sync_runs;
CREATE POLICY "Authenticated team manage crm sync runs"
  ON public.crm_sync_runs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 21. Encrypted Server-Side Integrations & Mail Vault
CREATE TABLE IF NOT EXISTS public.crm_integration_secrets (
  provider TEXT PRIMARY KEY CHECK (provider IN ('lark_smtp', 'google_analytics', 'google_tag_manager', 'apollo', 'google_maps', 'gemini', 'github', 'cloudflare')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  encrypted_secret TEXT NOT NULL DEFAULT '',
  secret_hint TEXT NOT NULL DEFAULT '',
  config_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT NOT NULL CHECK (last_test_status IN ('ok', 'error', 'untested')) DEFAULT 'untested',
  last_test_message TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT NOT NULL DEFAULT '';
  FOR constraint_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.crm_integration_secrets'::regclass AND contype = 'c'
  LOOP
    EXECUTE 'ALTER TABLE public.crm_integration_secrets DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_rec.conname);
  END LOOP;
  ALTER TABLE public.crm_integration_secrets
    ADD CONSTRAINT crm_integration_secrets_provider_check
    CHECK (provider IN ('lark_smtp', 'google_analytics', 'google_tag_manager', 'apollo', 'google_maps', 'gemini', 'github', 'cloudflare'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

GRANT ALL ON public.crm_integration_secrets TO authenticated, service_role;

ALTER TABLE public.crm_integration_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated team manage integration secrets" ON public.crm_integration_secrets;
CREATE POLICY "Authenticated team manage integration secrets"
  ON public.crm_integration_secrets FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT INSERT ON public.crm_leads TO anon;

DROP POLICY IF EXISTS "Public demo signup can insert crm lead" ON public.crm_leads;
CREATE POLICY "Public demo signup can insert crm lead"
  ON public.crm_leads FOR INSERT
  WITH CHECK (source_type = 'demo_signup' AND position('@' IN email) > 1);

-- 22. Customer Demo Sandbox Accounts & Activity Stats
CREATE TABLE IF NOT EXISTS public.demo_users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  crm_lead_id TEXT,
  login_count INTEGER NOT NULL DEFAULT 1,
  actions_count INTEGER NOT NULL DEFAULT 0,
  explored_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  sandbox_conversions INTEGER NOT NULL DEFAULT 0,
  last_action_label TEXT NOT NULL DEFAULT 'Signed Up',
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_users_email ON public.demo_users (email);
CREATE INDEX IF NOT EXISTS idx_demo_users_last_active ON public.demo_users (last_active_at DESC);

GRANT ALL ON public.demo_users TO anon, authenticated, service_role;
ALTER TABLE public.demo_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service or team manage demo users" ON public.demo_users;
CREATE POLICY "Service or team manage demo users"
  ON public.demo_users FOR ALL
  USING (true)
  WITH CHECK (true);

-- 23. Unified Inbox & Admin Notification Lark Mail Dispatch Log
CREATE TABLE IF NOT EXISTS public.inbox_email_logs (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('lark_smtp')) DEFAULT 'lark_smtp',
  category TEXT NOT NULL CHECK (category IN ('inquiry_reply', 'direct_compose', 'demo_signup_alert', 'contact_alert')) DEFAULT 'direct_compose',
  related_id TEXT,
  provider_message_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
  error_detail TEXT NOT NULL DEFAULT '',
  sent_by TEXT NOT NULL DEFAULT 'system',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_email_logs_sent ON public.inbox_email_logs (sent_at DESC);

GRANT ALL ON public.inbox_email_logs TO anon, authenticated, service_role;
ALTER TABLE public.inbox_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public or team log inbox lark emails" ON public.inbox_email_logs;
CREATE POLICY "Public or team log inbox lark emails"
  ON public.inbox_email_logs FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.inbox_email_logs DROP CONSTRAINT IF EXISTS inbox_email_logs_category_check;
ALTER TABLE public.inbox_email_logs
  ADD CONSTRAINT inbox_email_logs_category_check
  CHECK (category IN ('inquiry_reply', 'direct_compose', 'demo_signup_alert', 'contact_alert', 'chat_offline_alert', 'chat_instant_alert', 'chat_reply', 'test_notification', 'qa_eod_report', 'qa_critical_alert', 'ai_seo_daily_report', 'cybersec_daily_report', 'cybersec_alert'));

-- 24. Cloudflare Historical Hourly Snapshots
CREATE TABLE IF NOT EXISTS public.cloudflare_hourly_snapshots (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL,
  zone_name TEXT NOT NULL DEFAULT 'git-stack.org',
  bucket_hour TIMESTAMPTZ NOT NULL,
  requests BIGINT NOT NULL DEFAULT 0,
  bytes BIGINT NOT NULL DEFAULT 0,
  cached_requests BIGINT NOT NULL DEFAULT 0,
  status_1xx BIGINT NOT NULL DEFAULT 0,
  status_2xx BIGINT NOT NULL DEFAULT 0,
  status_3xx BIGINT NOT NULL DEFAULT 0,
  status_4xx BIGINT NOT NULL DEFAULT 0,
  status_5xx BIGINT NOT NULL DEFAULT 0,
  top_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (zone_id, bucket_hour)
);

CREATE INDEX IF NOT EXISTS idx_cf_snapshots_zone_hour ON public.cloudflare_hourly_snapshots (zone_id, bucket_hour DESC);

GRANT ALL ON public.cloudflare_hourly_snapshots TO authenticated, service_role;
ALTER TABLE public.cloudflare_hourly_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated team manage cloudflare snapshots" ON public.cloudflare_hourly_snapshots;
CREATE POLICY "Authenticated team manage cloudflare snapshots"
  ON public.cloudflare_hourly_snapshots FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 25. Cloudflare Gemini AI Forecast Cache
CREATE TABLE IF NOT EXISTS public.cloudflare_ai_forecasts (
  zone_id TEXT PRIMARY KEY,
  zone_name TEXT NOT NULL DEFAULT 'git-stack.org',
  model_used TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
  horizon_days INTEGER NOT NULL DEFAULT 7,
  range_analyzed TEXT NOT NULL DEFAULT '14d',
  forecast_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.cloudflare_ai_forecasts TO authenticated, service_role;
ALTER TABLE public.cloudflare_ai_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated team manage cloudflare forecasts" ON public.cloudflare_ai_forecasts;
CREATE POLICY "Authenticated team manage cloudflare forecasts"
  ON public.cloudflare_ai_forecasts FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 26. Floating Home Page Live Chat Sessions
CREATE TABLE IF NOT EXISTS public.website_chat_sessions (
  id TEXT PRIMARY KEY,
  visitor_token TEXT NOT NULL UNIQUE,
  visitor_name TEXT NOT NULL DEFAULT 'Website Visitor',
  visitor_email TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '/',
  status TEXT NOT NULL CHECK (status IN ('open', 'replied', 'resolved')) DEFAULT 'open',
  last_visitor_msg_at TIMESTAMPTZ,
  last_admin_reply_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  converted_lead_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON public.website_chat_sessions (updated_at DESC);

GRANT ALL ON public.website_chat_sessions TO anon, authenticated, service_role;
ALTER TABLE public.website_chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and team manage website chat sessions" ON public.website_chat_sessions;
CREATE POLICY "Public and team manage website chat sessions"
  ON public.website_chat_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 27. Floating Home Page Live Chat Messages
CREATE TABLE IF NOT EXISTS public.website_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.website_chat_sessions(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('visitor', 'admin', 'agent')) DEFAULT 'visitor',
  sender_name TEXT NOT NULL DEFAULT 'Website Visitor',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.website_chat_messages (session_id, created_at ASC);

GRANT ALL ON public.website_chat_messages TO anon, authenticated, service_role;
ALTER TABLE public.website_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and team manage website chat messages" ON public.website_chat_messages;
CREATE POLICY "Public and team manage website chat messages"
  ON public.website_chat_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- 28. Admin Lark Mail Notification Module Settings
CREATE TABLE IF NOT EXISTS public.admin_notification_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_email TEXT NOT NULL DEFAULT '',
  admin_login_url TEXT NOT NULL DEFAULT 'https://git-stack.org/obama',
  notify_on_live_chat BOOLEAN NOT NULL DEFAULT TRUE,
  live_chat_mode TEXT NOT NULL CHECK (live_chat_mode IN ('instant', 'offline_only')) DEFAULT 'instant',
  offline_delay_minutes INTEGER NOT NULL DEFAULT 2,
  chat_cooldown_minutes INTEGER NOT NULL DEFAULT 2,
  notify_on_inquiry BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_demo_signup BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.admin_notification_settings TO anon, authenticated, service_role;
ALTER TABLE public.admin_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated team manage admin notification settings" ON public.admin_notification_settings;
CREATE POLICY "Authenticated team manage admin notification settings"
  ON public.admin_notification_settings FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO public.admin_notification_settings (
  id,
  enabled,
  recipient_email,
  admin_login_url,
  notify_on_live_chat,
  live_chat_mode,
  offline_delay_minutes,
  chat_cooldown_minutes,
  notify_on_inquiry,
  notify_on_demo_signup
)
VALUES (
  'default',
  TRUE,
  '',
  'https://git-stack.org/obama',
  TRUE,
  'instant',
  2,
  2,
  TRUE,
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 29. Product QA Real-Time Error & Telemetry Logs
CREATE TABLE IF NOT EXISTS public.product_qa_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info')) DEFAULT 'error',
  source TEXT NOT NULL CHECK (source IN ('frontend', 'backend', 'api', 'database', 'integration')) DEFAULT 'frontend',
  module_name TEXT NOT NULL DEFAULT 'General Application',
  page_path TEXT NOT NULL DEFAULT '/',
  code_location TEXT NOT NULL DEFAULT '',
  error_name TEXT NOT NULL DEFAULT 'Error',
  message TEXT NOT NULL,
  stack_trace TEXT NOT NULL DEFAULT '',
  http_status INTEGER,
  request_method TEXT NOT NULL DEFAULT '',
  request_path TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL DEFAULT '',
  ai_root_cause TEXT NOT NULL DEFAULT '',
  ai_fix_suggestion TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_qa_logs_created ON public.product_qa_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_qa_logs_module ON public.product_qa_logs (module_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_qa_logs_status ON public.product_qa_logs (status, level);

GRANT ALL ON public.product_qa_logs TO anon, authenticated, service_role;
ALTER TABLE public.product_qa_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public ingest and team manage qa logs" ON public.product_qa_logs;
CREATE POLICY "Public ingest and team manage qa logs"
  ON public.product_qa_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- 30. Product QA End-of-Day PDF Summary Reports
CREATE TABLE IF NOT EXISTS public.product_qa_reports (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'eod_cron')) DEFAULT 'manual',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  health_score INTEGER NOT NULL DEFAULT 100,
  total_logs INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  warn_count INTEGER NOT NULL DEFAULT 0,
  top_module TEXT NOT NULL DEFAULT 'None',
  top_page TEXT NOT NULL DEFAULT '/',
  executive_summary TEXT NOT NULL DEFAULT '',
  module_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  page_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_filename TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'generated')) DEFAULT 'generated',
  provider_message_id TEXT NOT NULL DEFAULT '',
  error_detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_qa_reports_created ON public.product_qa_reports (created_at DESC);

GRANT ALL ON public.product_qa_reports TO anon, authenticated, service_role;
ALTER TABLE public.product_qa_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manage product qa reports" ON public.product_qa_reports;
CREATE POLICY "Team manage product qa reports"
  ON public.product_qa_reports FOR ALL
  USING (true)
  WITH CHECK (true);

-- 31. Product QA Live Agent & EOD Schedule Settings
CREATE TABLE IF NOT EXISTS public.product_qa_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  agent_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  realtime_alert_on_critical BOOLEAN NOT NULL DEFAULT FALSE,
  eod_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  eod_hour_utc INTEGER NOT NULL DEFAULT 15,
  recipient_email TEXT NOT NULL DEFAULT '',
  last_eod_sent_date TEXT NOT NULL DEFAULT '',
  last_scan_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.product_qa_settings TO anon, authenticated, service_role;
ALTER TABLE public.product_qa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manage product qa settings" ON public.product_qa_settings;
CREATE POLICY "Team manage product qa settings"
  ON public.product_qa_settings FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO public.product_qa_settings (
  id,
  agent_enabled,
  realtime_alert_on_critical,
  eod_enabled,
  eod_hour_utc,
  recipient_email
)
VALUES (
  'default',
  TRUE,
  FALSE,
  TRUE,
  15,
  ''
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.product_qa_reports
  ADD COLUMN IF NOT EXISTS feature_checks JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.product_qa_settings
  ADD COLUMN IF NOT EXISTS feature_baselines JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 32. AI & Search Engine Visibility (GEO / SEO) Daily Runs
CREATE TABLE IF NOT EXISTS public.ai_search_visibility_runs (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'daily_cron', 'content_boost')) DEFAULT 'manual',
  overall_score INTEGER NOT NULL DEFAULT 94,
  ai_citation_score INTEGER NOT NULL DEFAULT 95,
  seo_authority_score INTEGER NOT NULL DEFAULT 93,
  searchable_platforms_count INTEGER NOT NULL DEFAULT 7,
  total_platforms_count INTEGER NOT NULL DEFAULT 7,
  top_ranked_services_count INTEGER NOT NULL DEFAULT 5,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  query_rankings JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_search_runs_created ON public.ai_search_visibility_runs (created_at DESC);

GRANT ALL ON public.ai_search_visibility_runs TO anon, authenticated, service_role;
ALTER TABLE public.ai_search_visibility_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manage ai search visibility runs" ON public.ai_search_visibility_runs;
CREATE POLICY "Team manage ai search visibility runs"
  ON public.ai_search_visibility_runs FOR ALL
  USING (true)
  WITH CHECK (true);

-- 33. AI & Search Engine Visibility Settings
CREATE TABLE IF NOT EXISTS public.ai_search_visibility_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  daily_test_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_hour_utc INTEGER NOT NULL DEFAULT 14,
  recipient_email TEXT NOT NULL DEFAULT '',
  target_domain TEXT NOT NULL DEFAULT 'https://git-stack.org',
  auto_optimize_llms_txt BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_date TEXT NOT NULL DEFAULT '',
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.ai_search_visibility_settings TO anon, authenticated, service_role;
ALTER TABLE public.ai_search_visibility_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manage ai search visibility settings" ON public.ai_search_visibility_settings;
CREATE POLICY "Team manage ai search visibility settings"
  ON public.ai_search_visibility_settings FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO public.ai_search_visibility_settings (
  id,
  daily_test_enabled,
  daily_hour_utc,
  recipient_email,
  target_domain,
  auto_optimize_llms_txt
)
VALUES (
  'default',
  TRUE,
  14,
  '',
  'https://git-stack.org',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 34. Cybersecurity & AI Sentinel Findings
CREATE TABLE IF NOT EXISTS public.cyber_security_findings (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')) DEFAULT 'info',
  status TEXT NOT NULL CHECK (status IN ('open', 'mitigated', 'accepted', 'monitoring')) DEFAULT 'monitoring',
  title TEXT NOT NULL,
  cve_or_rule TEXT NOT NULL DEFAULT '',
  affected_module TEXT NOT NULL DEFAULT 'Core Platform',
  description TEXT NOT NULL DEFAULT '',
  ai_remediation TEXT NOT NULL DEFAULT '',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cyber_findings_detected ON public.cyber_security_findings (detected_at DESC);

GRANT ALL ON public.cyber_security_findings TO anon, authenticated, service_role;
ALTER TABLE public.cyber_security_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manage cyber security findings" ON public.cyber_security_findings;
CREATE POLICY "Team manage cyber security findings"
  ON public.cyber_security_findings FOR ALL
  USING (true)
  WITH CHECK (true);

-- 35. Cybersecurity Daily Reports
CREATE TABLE IF NOT EXISTS public.cyber_security_reports (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'daily_cron')) DEFAULT 'manual',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  posture_score INTEGER NOT NULL DEFAULT 96,
  grade TEXT NOT NULL DEFAULT 'A+',
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  domain_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  executive_summary TEXT NOT NULL DEFAULT '',
  ai_threat_intel JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_hardening JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_filename TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'generated')) DEFAULT 'generated',
  provider_message_id TEXT NOT NULL DEFAULT '',
  error_detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cyber_reports_created ON public.cyber_security_reports (created_at DESC);

GRANT ALL ON public.cyber_security_reports TO anon, authenticated, service_role;
ALTER TABLE public.cyber_security_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manage cyber security reports" ON public.cyber_security_reports;
CREATE POLICY "Team manage cyber security reports"
  ON public.cyber_security_reports FOR ALL
  USING (true)
  WITH CHECK (true);

-- 36. Cybersecurity Live AI Sentinel Settings
CREATE TABLE IF NOT EXISTS public.cyber_security_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  sentinel_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_hour_utc INTEGER NOT NULL DEFAULT 15,
  realtime_critical_alert BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_email TEXT NOT NULL DEFAULT '',
  last_report_date TEXT NOT NULL DEFAULT '',
  last_scan_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.cyber_security_settings TO anon, authenticated, service_role;
ALTER TABLE public.cyber_security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manage cyber security settings" ON public.cyber_security_settings;
CREATE POLICY "Team manage cyber security settings"
  ON public.cyber_security_settings FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO public.cyber_security_settings (
  id,
  sentinel_enabled,
  daily_report_enabled,
  daily_hour_utc,
  realtime_critical_alert,
  recipient_email
)
VALUES (
  'default',
  TRUE,
  TRUE,
  15,
  TRUE,
  ''
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 37. Recommended Free-Tier Performance Indexes
-- Eliminates Sequential Scans on frequently filtered, joined & ordered columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_posts_status_updated ON public.posts (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts (slug);
CREATE INDEX IF NOT EXISTS idx_comments_post_status_created ON public.comments (post_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscribers_created ON public.subscribers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status_created ON public.inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_to ON public.inquiries (assigned_to);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status_last_msg ON public.chat_threads (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_threads_assigned_to ON public.chat_threads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON public.chat_messages (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_updated_at ON public.crm_leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads (stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned_to ON public.crm_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_outreach_lead_sent ON public.crm_outreach_logs (lead_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_webchat_sessions_visitor ON public.website_chat_sessions (visitor_token);
CREATE INDEX IF NOT EXISTS idx_webchat_sessions_status_updated ON public.website_chat_sessions (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_webchat_messages_session_created ON public.website_chat_messages (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_product_qa_logs_created ON public.product_qa_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_qa_logs_status_level ON public.product_qa_logs (status, level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cyber_findings_status_detected ON public.cyber_security_findings (status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_items_user_updated ON public.user_workflow_items (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_users_email ON public.demo_users (email);
CREATE INDEX IF NOT EXISTS idx_demo_users_last_active ON public.demo_users (last_active_at DESC);

-- ============================================================================
-- 38. Google Tag Manager (GTM) Live dataLayer Event Stream & Conversion Logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gtm_event_logs (
  id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL DEFAULT 'GTM-MFP3W7MS',
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL CHECK (event_category IN ('lifecycle', 'pageview', 'conversion', 'engagement', 'custom')) DEFAULT 'custom',
  page_path TEXT NOT NULL DEFAULT '/',
  page_title TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  is_conversion BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gtm_event_logs_created_at ON public.gtm_event_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gtm_event_logs_container_event ON public.gtm_event_logs (container_id, event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gtm_event_logs_conversion ON public.gtm_event_logs (is_conversion, created_at DESC);

GRANT INSERT ON public.gtm_event_logs TO anon;
GRANT ALL ON public.gtm_event_logs TO authenticated, service_role;

ALTER TABLE public.gtm_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert gtm event logs" ON public.gtm_event_logs;
CREATE POLICY "Public can insert gtm event logs"
  ON public.gtm_event_logs FOR INSERT
  WITH CHECK (length(event_name) > 0);

DROP POLICY IF EXISTS "Authenticated team read gtm event logs" ON public.gtm_event_logs;
CREATE POLICY "Authenticated team read gtm event logs"
  ON public.gtm_event_logs FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated team manage gtm event logs" ON public.gtm_event_logs;
CREATE POLICY "Authenticated team manage gtm event logs"
  ON public.gtm_event_logs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


