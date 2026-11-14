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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive migration for existing site_settings table
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ga4_track_events BOOLEAN NOT NULL DEFAULT TRUE;

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

-- Grant schema and least-privilege table access (enforced by Row-Level Security below)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT ON public.comments TO anon;
GRANT INSERT ON public.subscribers TO anon;
GRANT INSERT ON public.inquiries TO anon;
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.page_contents TO anon;
GRANT INSERT ON public.analytics_events TO anon;
GRANT ALL ON public.posts, public.comments, public.subscribers, public.inquiries, public.site_settings, public.page_contents, public.agent_tasks, public.chat_threads, public.chat_messages, public.analytics_events TO authenticated, service_role;

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

INSERT INTO public.site_settings (id, adsense_publisher_id, ads_txt_content, auto_ads_enabled, ad_slots_enabled, editorial_review_note, ga4_measurement_id, ga4_enabled, ga4_track_events)
VALUES (
  'default',
  '',
  '# Configure your Google AdSense Publisher ID in GitStack Studio to activate verified ads.txt',
  FALSE,
  FALSE,
  'All articles must pass the 8-pillar AdSense E-E-A-T & 800-word depth gate before publishing.',
  '',
  FALSE,
  TRUE
)
ON CONFLICT (id) DO NOTHING;
