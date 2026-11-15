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
  theme_preset TEXT NOT NULL DEFAULT 'cobalt',
  primary_color TEXT NOT NULL DEFAULT '#1E40AF',
  header_surface TEXT NOT NULL DEFAULT 'white',
  header_cta_label TEXT NOT NULL DEFAULT 'Book Consultation',
  header_cta_href TEXT NOT NULL DEFAULT '/contact',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive migration for existing site_settings table
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_track_events BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS brand_name TEXT NOT NULL DEFAULT 'GitStack';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS brand_logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS brand_logo_alt TEXT NOT NULL DEFAULT 'GitStack logo';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS theme_preset TEXT NOT NULL DEFAULT 'cobalt';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#1E40AF';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS header_surface TEXT NOT NULL DEFAULT 'white';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS header_cta_label TEXT NOT NULL DEFAULT 'Book Consultation';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS header_cta_href TEXT NOT NULL DEFAULT '/contact';

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
  custom_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  'gmail'
)
ON CONFLICT (id) DO NOTHING;
