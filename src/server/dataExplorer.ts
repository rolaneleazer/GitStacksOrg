import crypto from 'node:crypto';
import { Client as PgClient } from 'pg';
import type {
  DataAuditLogEntry,
  DataAuditLogsResponse,
  DataAuditOperation,
  DataAuditSource,
  DataColumnType,
  DataDomainGroup,
  DataExplorerStatus,
  DataTableColumnDescriptor,
  DataTableDescriptor,
  DataTableRowsResponse
} from '../shared/types.ts';
import { broadcastToAdmins } from './realtime.ts';
import {
  autoMigrateSupabaseSchema,
  getSupabaseAutomationMode,
  getSupabaseClient,
  isSupabaseConfigured,
  normalizePostgresUrl,
  readLocalDb,
  writeLocalDb
} from './repository.ts';

const SENSITIVE_COLUMNS = new Set([
  'encrypted_secret',
  'password_hash',
  'access_token',
  'refresh_token',
  'secret_hint'
]);

const READONLY_SYSTEM_COLUMNS = new Set(['created_at', 'updated_at', 'detected_at', 'sent_at']);

interface TableSeedSpec {
  tableName: string;
  label: string;
  domainGroup: DataDomainGroup;
  primaryKey: string;
  defaultSortColumn: string;
  readOnlyTable?: boolean;
  localCollectionKey?: string;
  localSingletonKey?: string;
  localMapKey?: string;
  columns: {
    name: string;
    dataType: DataColumnType;
    pgType?: string;
    nullable?: boolean;
    enumValues?: string[];
    defaultValue?: unknown;
  }[];
}

const TABLE_CATALOG_SPECS: TableSeedSpec[] = [
  // Content & SEO
  {
    tableName: 'posts',
    label: 'Technical Articles & Guides',
    domainGroup: 'Content & SEO',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'posts',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'slug', dataType: 'text' },
      { name: 'title', dataType: 'text' },
      { name: 'summary_tldr', dataType: 'longtext' },
      { name: 'content_markdown', dataType: 'longtext' },
      { name: 'category', dataType: 'text', defaultValue: 'AI Integration' },
      { name: 'author_name', dataType: 'text', defaultValue: 'Ronel Molina' },
      { name: 'author_role', dataType: 'text', defaultValue: 'Principal Cloud Architect' },
      { name: 'author_bio', dataType: 'longtext' },
      { name: 'cover_image', dataType: 'text' },
      { name: 'cover_alt', dataType: 'text' },
      { name: 'meta_title', dataType: 'text' },
      { name: 'meta_description', dataType: 'longtext' },
      { name: 'primary_keyword', dataType: 'text' },
      { name: 'faqs', dataType: 'json', defaultValue: [] },
      { name: 'references', dataType: 'json', defaultValue: [] },
      { name: 'word_count', dataType: 'number', defaultValue: 0 },
      { name: 'read_time_minutes', dataType: 'number', defaultValue: 1 },
      { name: 'quality_score', dataType: 'number', defaultValue: 0 },
      { name: 'geo_score', dataType: 'number', defaultValue: 0 },
      { name: 'status', dataType: 'enum', enumValues: ['draft', 'published'], defaultValue: 'draft' },
      { name: 'published_at', dataType: 'timestamp', nullable: true },
      { name: 'updated_at', dataType: 'timestamp' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'comments',
    label: 'Article Comments',
    domainGroup: 'Content & SEO',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'comments',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'post_id', dataType: 'text' },
      { name: 'author_name', dataType: 'text' },
      { name: 'author_email', dataType: 'text' },
      { name: 'body', dataType: 'longtext' },
      { name: 'status', dataType: 'enum', enumValues: ['approved', 'pending', 'hidden'], defaultValue: 'approved' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'page_contents',
    label: 'CMS Page Contents',
    domainGroup: 'Content & SEO',
    primaryKey: 'page_key',
    defaultSortColumn: 'page_key',
    localMapKey: 'page_contents',
    columns: [
      { name: 'page_key', dataType: 'enum', enumValues: ['home', 'services', 'about', 'contact'] },
      { name: 'hero_kicker', dataType: 'text' },
      { name: 'hero_title', dataType: 'text' },
      { name: 'hero_subtitle', dataType: 'longtext' },
      { name: 'hero_cta_label', dataType: 'text' },
      { name: 'hero_image', dataType: 'text' },
      { name: 'hero_image_alt', dataType: 'text' },
      { name: 'secondary_image', dataType: 'text' },
      { name: 'secondary_image_alt', dataType: 'text' },
      { name: 'intro_heading', dataType: 'text' },
      { name: 'intro_body', dataType: 'longtext' },
      { name: 'contact_phone_label', dataType: 'text' },
      { name: 'contact_phone', dataType: 'text' },
      { name: 'contact_sales_label', dataType: 'text' },
      { name: 'contact_sales_email', dataType: 'text' },
      { name: 'contact_editorial_label', dataType: 'text' },
      { name: 'contact_editorial_email', dataType: 'text' },
      { name: 'contact_privacy_label', dataType: 'text' },
      { name: 'contact_privacy_email', dataType: 'text' },
      { name: 'custom_blocks', dataType: 'json', defaultValue: [] },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'ai_search_visibility_runs',
    label: 'AI & Search Visibility Runs',
    domainGroup: 'Content & SEO',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'run_date', dataType: 'text' },
      { name: 'trigger_type', dataType: 'enum', enumValues: ['manual', 'daily_cron', 'content_boost'], defaultValue: 'manual' },
      { name: 'overall_score', dataType: 'number', defaultValue: 94 },
      { name: 'ai_citation_score', dataType: 'number', defaultValue: 95 },
      { name: 'seo_authority_score', dataType: 'number', defaultValue: 93 },
      { name: 'searchable_platforms_count', dataType: 'number', defaultValue: 7 },
      { name: 'total_platforms_count', dataType: 'number', defaultValue: 7 },
      { name: 'top_ranked_services_count', dataType: 'number', defaultValue: 5 },
      { name: 'platforms', dataType: 'json', defaultValue: [] },
      { name: 'query_rankings', dataType: 'json', defaultValue: [] },
      { name: 'content_recommendations', dataType: 'json', defaultValue: [] },
      { name: 'summary', dataType: 'longtext' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'ai_search_visibility_settings',
    label: 'AI Visibility Settings',
    domainGroup: 'Content & SEO',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    columns: [
      { name: 'id', dataType: 'text', defaultValue: 'default' },
      { name: 'daily_test_enabled', dataType: 'boolean', defaultValue: true },
      { name: 'daily_hour_utc', dataType: 'number', defaultValue: 14 },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'target_domain', dataType: 'text', defaultValue: 'https://git-stack.org' },
      { name: 'auto_optimize_llms_txt', dataType: 'boolean', defaultValue: true },
      { name: 'last_run_date', dataType: 'text' },
      { name: 'last_run_at', dataType: 'timestamp', nullable: true },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },

  // CRM & Leads
  {
    tableName: 'crm_leads',
    label: 'CRM Prospecting Leads',
    domainGroup: 'CRM & Leads',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'crm_leads',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'contact_name', dataType: 'text' },
      { name: 'role_title', dataType: 'text' },
      { name: 'email', dataType: 'text' },
      { name: 'email_status', dataType: 'enum', enumValues: ['verified_mx', 'public_found', 'inferred', 'invalid'], defaultValue: 'inferred' },
      { name: 'company_name', dataType: 'text' },
      { name: 'company_domain', dataType: 'text' },
      { name: 'website_url', dataType: 'text' },
      { name: 'github_url', dataType: 'text' },
      { name: 'phone', dataType: 'text' },
      { name: 'location', dataType: 'text' },
      { name: 'rating', dataType: 'number', nullable: true },
      { name: 'source_detail', dataType: 'text' },
      {
        name: 'source_type',
        dataType: 'enum',
        enumValues: ['github', 'website', 'gemini_search', 'apollo', 'google_maps', 'hacker_news', 'ycombinator', 'csv_import', 'demo_signup', 'manual'],
        defaultValue: 'manual'
      },
      { name: 'source_urls', dataType: 'json', defaultValue: [] },
      { name: 'tech_stack', dataType: 'json', defaultValue: [] },
      { name: 'research_brief', dataType: 'longtext' },
      { name: 'recommended_service', dataType: 'text', defaultValue: 'AI Integration' },
      { name: 'fit_score', dataType: 'number', defaultValue: 70 },
      { name: 'deal_value', dataType: 'number', defaultValue: 25000 },
      { name: 'stage', dataType: 'enum', enumValues: ['discovered', 'researched', 'proposed', 'follow_up', 'won', 'lost'], defaultValue: 'discovered' },
      { name: 'proposal_subject', dataType: 'text' },
      { name: 'proposal_body', dataType: 'longtext' },
      { name: 'follow_up_sequence', dataType: 'json', defaultValue: [] },
      { name: 'assigned_to', dataType: 'text', nullable: true },
      { name: 'last_contacted_at', dataType: 'timestamp', nullable: true },
      { name: 'next_followup_at', dataType: 'timestamp', nullable: true },
      { name: 'converted_inquiry_id', dataType: 'text', nullable: true },
      { name: 'created_at', dataType: 'timestamp' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'inquiries',
    label: 'Client Consultation Inquiries',
    domainGroup: 'CRM & Leads',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'inquiries',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'reference_code', dataType: 'text' },
      { name: 'full_name', dataType: 'text' },
      { name: 'company', dataType: 'text' },
      { name: 'work_email', dataType: 'text' },
      { name: 'service_interest', dataType: 'text' },
      { name: 'budget_range', dataType: 'text' },
      { name: 'timeline', dataType: 'text' },
      { name: 'project_brief', dataType: 'longtext' },
      { name: 'status', dataType: 'enum', enumValues: ['new', 'reviewed', 'scheduled'], defaultValue: 'new' },
      { name: 'assigned_to', dataType: 'text', nullable: true },
      { name: 'assigned_at', dataType: 'timestamp', nullable: true },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'subscribers',
    label: 'Newsletter Subscribers',
    domainGroup: 'CRM & Leads',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'subscribers',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'email', dataType: 'text' },
      { name: 'name', dataType: 'text' },
      { name: 'interest_topic', dataType: 'text', defaultValue: 'All Engineering Topics' },
      { name: 'consent_given', dataType: 'boolean', defaultValue: true },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'demo_users',
    label: 'Demo Sandbox Users',
    domainGroup: 'CRM & Leads',
    primaryKey: 'id',
    defaultSortColumn: 'last_active_at',
    localCollectionKey: 'demo_users',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'full_name', dataType: 'text' },
      { name: 'email', dataType: 'text' },
      { name: 'company', dataType: 'text' },
      { name: 'phone', dataType: 'text' },
      { name: 'password_hash', dataType: 'text' },
      { name: 'crm_lead_id', dataType: 'text', nullable: true },
      { name: 'login_count', dataType: 'number', defaultValue: 1 },
      { name: 'actions_count', dataType: 'number', defaultValue: 0 },
      { name: 'explored_modules', dataType: 'json', defaultValue: [] },
      { name: 'sandbox_conversions', dataType: 'number', defaultValue: 0 },
      { name: 'last_action_label', dataType: 'text', defaultValue: 'Signed Up' },
      { name: 'last_active_at', dataType: 'timestamp' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'crm_outreach_logs',
    label: 'CRM Outreach Logs',
    domainGroup: 'CRM & Leads',
    primaryKey: 'id',
    defaultSortColumn: 'sent_at',
    localCollectionKey: 'crm_outreach_logs',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'lead_id', dataType: 'text' },
      { name: 'channel', dataType: 'enum', enumValues: ['lark_mail', 'gmail_api'], defaultValue: 'lark_mail' },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'subject', dataType: 'text' },
      { name: 'body', dataType: 'longtext' },
      { name: 'provider_message_id', dataType: 'text' },
      { name: 'status', dataType: 'enum', enumValues: ['sent', 'failed'], defaultValue: 'sent' },
      { name: 'error_detail', dataType: 'text' },
      { name: 'step_label', dataType: 'text', defaultValue: 'Initial Proposal' },
      { name: 'sent_by', dataType: 'text' },
      { name: 'sent_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'crm_sync_runs',
    label: 'CRM Source Sync Runs',
    domainGroup: 'CRM & Leads',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'crm_sync_runs',
    columns: [
      { name: 'id', dataType: 'text' },
      {
        name: 'source_type',
        dataType: 'enum',
        enumValues: ['github', 'website', 'gemini_search', 'apollo', 'google_maps', 'hacker_news', 'ycombinator', 'csv_import', 'manual']
      },
      { name: 'query_label', dataType: 'text' },
      { name: 'fetched_count', dataType: 'number', defaultValue: 0 },
      { name: 'inserted_count', dataType: 'number', defaultValue: 0 },
      { name: 'merged_count', dataType: 'number', defaultValue: 0 },
      { name: 'mx_verified_count', dataType: 'number', defaultValue: 0 },
      { name: 'status', dataType: 'enum', enumValues: ['completed', 'partial', 'failed'], defaultValue: 'completed' },
      { name: 'error_detail', dataType: 'text' },
      { name: 'triggered_by', dataType: 'text' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },

  // Communications
  {
    tableName: 'website_chat_sessions',
    label: 'Website Live Chat Sessions',
    domainGroup: 'Communications',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'website_chat_sessions',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'visitor_token', dataType: 'text' },
      { name: 'visitor_name', dataType: 'text', defaultValue: 'Website Visitor' },
      { name: 'visitor_email', dataType: 'text' },
      { name: 'page_path', dataType: 'text', defaultValue: '/' },
      { name: 'status', dataType: 'enum', enumValues: ['open', 'replied', 'resolved'], defaultValue: 'open' },
      { name: 'last_visitor_msg_at', dataType: 'timestamp', nullable: true },
      { name: 'last_admin_reply_at', dataType: 'timestamp', nullable: true },
      { name: 'escalated_at', dataType: 'timestamp', nullable: true },
      { name: 'converted_lead_id', dataType: 'text', nullable: true },
      { name: 'created_at', dataType: 'timestamp' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'website_chat_messages',
    label: 'Website Live Chat Messages',
    domainGroup: 'Communications',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'website_chat_messages',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'session_id', dataType: 'text' },
      { name: 'sender_role', dataType: 'enum', enumValues: ['visitor', 'admin', 'agent'], defaultValue: 'visitor' },
      { name: 'sender_name', dataType: 'text', defaultValue: 'Website Visitor' },
      { name: 'body', dataType: 'longtext' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'chat_threads',
    label: 'Internal Q&A Threads',
    domainGroup: 'Communications',
    primaryKey: 'id',
    defaultSortColumn: 'last_message_at',
    localCollectionKey: 'chat_threads',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'subject', dataType: 'text' },
      { name: 'source_type', dataType: 'enum', enumValues: ['inquiry', 'comment', 'internal'], defaultValue: 'internal' },
      { name: 'source_ref_id', dataType: 'text', nullable: true },
      { name: 'requester_name', dataType: 'text' },
      { name: 'requester_email', dataType: 'text' },
      { name: 'status', dataType: 'enum', enumValues: ['open', 'answered', 'archived'], defaultValue: 'open' },
      { name: 'assigned_to', dataType: 'text', nullable: true },
      { name: 'assigned_at', dataType: 'timestamp', nullable: true },
      { name: 'last_message_at', dataType: 'timestamp' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'chat_messages',
    label: 'Internal Q&A Messages',
    domainGroup: 'Communications',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'chat_messages',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'thread_id', dataType: 'text' },
      { name: 'sender_role', dataType: 'enum', enumValues: ['visitor', 'admin', 'system'], defaultValue: 'admin' },
      { name: 'sender_name', dataType: 'text', defaultValue: 'GitStack Admin' },
      { name: 'body', dataType: 'longtext' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'inbox_email_logs',
    label: 'Inbox Email Dispatch Logs',
    domainGroup: 'Communications',
    primaryKey: 'id',
    defaultSortColumn: 'sent_at',
    localCollectionKey: 'inbox_email_logs',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'subject', dataType: 'text' },
      { name: 'body', dataType: 'longtext' },
      { name: 'channel', dataType: 'enum', enumValues: ['lark_smtp'], defaultValue: 'lark_smtp' },
      {
        name: 'category',
        dataType: 'enum',
        enumValues: [
          'inquiry_reply',
          'direct_compose',
          'demo_signup_alert',
          'contact_alert',
          'chat_offline_alert',
          'chat_instant_alert',
          'chat_reply',
          'test_notification',
          'qa_eod_report',
          'qa_critical_alert',
          'ai_seo_daily_report',
          'cybersec_daily_report',
          'cybersec_alert'
        ],
        defaultValue: 'direct_compose'
      },
      { name: 'related_id', dataType: 'text', nullable: true },
      { name: 'provider_message_id', dataType: 'text' },
      { name: 'status', dataType: 'enum', enumValues: ['sent', 'failed'], defaultValue: 'sent' },
      { name: 'error_detail', dataType: 'text' },
      { name: 'sent_by', dataType: 'text', defaultValue: 'system' },
      { name: 'sent_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'admin_notification_settings',
    label: 'Admin Notification Settings',
    domainGroup: 'Communications',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localSingletonKey: 'admin_notification_settings',
    columns: [
      { name: 'id', dataType: 'text', defaultValue: 'default' },
      { name: 'enabled', dataType: 'boolean', defaultValue: true },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'admin_login_url', dataType: 'text', defaultValue: 'https://git-stack.org/obama' },
      { name: 'notify_on_live_chat', dataType: 'boolean', defaultValue: true },
      { name: 'live_chat_mode', dataType: 'enum', enumValues: ['instant', 'offline_only'], defaultValue: 'instant' },
      { name: 'offline_delay_minutes', dataType: 'number', defaultValue: 2 },
      { name: 'chat_cooldown_minutes', dataType: 'number', defaultValue: 2 },
      { name: 'notify_on_inquiry', dataType: 'boolean', defaultValue: true },
      { name: 'notify_on_demo_signup', dataType: 'boolean', defaultValue: true },
      { name: 'updated_by', dataType: 'text', defaultValue: 'system' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },

  // Analytics & Telemetry
  {
    tableName: 'analytics_events',
    label: 'First-Party Analytics Events',
    domainGroup: 'Analytics & Telemetry',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'analytics_events',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'event_type', dataType: 'enum', enumValues: ['pageview', 'inquiry_submitted', 'newsletter_subscribed', 'comment_submitted'], defaultValue: 'pageview' },
      { name: 'path', dataType: 'text', defaultValue: '/' },
      { name: 'referrer', dataType: 'text' },
      { name: 'session_id', dataType: 'text' },
      { name: 'meta', dataType: 'json', defaultValue: {} },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'gtm_event_logs',
    label: 'GTM dataLayer Event Logs',
    domainGroup: 'Analytics & Telemetry',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'gtm_event_logs',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'container_id', dataType: 'text', defaultValue: 'GTM-MFP3W7MS' },
      { name: 'event_name', dataType: 'text' },
      { name: 'event_category', dataType: 'enum', enumValues: ['lifecycle', 'pageview', 'conversion', 'engagement', 'custom'], defaultValue: 'custom' },
      { name: 'page_path', dataType: 'text', defaultValue: '/' },
      { name: 'page_title', dataType: 'text' },
      { name: 'session_id', dataType: 'text' },
      { name: 'is_conversion', dataType: 'boolean', defaultValue: false },
      { name: 'payload', dataType: 'json', defaultValue: {} },
      { name: 'user_agent', dataType: 'text' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'cloudflare_hourly_snapshots',
    label: 'Cloudflare Hourly Snapshots',
    domainGroup: 'Analytics & Telemetry',
    primaryKey: 'id',
    defaultSortColumn: 'bucket_hour',
    localCollectionKey: 'cloudflare_hourly_snapshots',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'zone_id', dataType: 'text' },
      { name: 'zone_name', dataType: 'text', defaultValue: 'git-stack.org' },
      { name: 'bucket_hour', dataType: 'timestamp' },
      { name: 'requests', dataType: 'number', defaultValue: 0 },
      { name: 'bytes', dataType: 'number', defaultValue: 0 },
      { name: 'cached_requests', dataType: 'number', defaultValue: 0 },
      { name: 'status_1xx', dataType: 'number', defaultValue: 0 },
      { name: 'status_2xx', dataType: 'number', defaultValue: 0 },
      { name: 'status_3xx', dataType: 'number', defaultValue: 0 },
      { name: 'status_4xx', dataType: 'number', defaultValue: 0 },
      { name: 'status_5xx', dataType: 'number', defaultValue: 0 },
      { name: 'top_paths', dataType: 'json', defaultValue: [] },
      { name: 'top_countries', dataType: 'json', defaultValue: [] },
      { name: 'created_at', dataType: 'timestamp' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'cloudflare_ai_forecasts',
    label: 'Cloudflare AI Forecasts',
    domainGroup: 'Analytics & Telemetry',
    primaryKey: 'zone_id',
    defaultSortColumn: 'generated_at',
    localCollectionKey: 'cloudflare_ai_forecasts',
    columns: [
      { name: 'zone_id', dataType: 'text' },
      { name: 'zone_name', dataType: 'text', defaultValue: 'git-stack.org' },
      { name: 'model_used', dataType: 'text', defaultValue: 'gemini-4-hydrogen' },
      { name: 'horizon_days', dataType: 'number', defaultValue: 7 },
      { name: 'range_analyzed', dataType: 'text', defaultValue: '14d' },
      { name: 'forecast_payload', dataType: 'json', defaultValue: {} },
      { name: 'generated_at', dataType: 'timestamp' }
    ]
  },

  // Operations & Settings
  {
    tableName: 'site_settings',
    label: 'Site & AdSense Settings',
    domainGroup: 'Operations & Settings',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localSingletonKey: 'site_settings',
    columns: [
      { name: 'id', dataType: 'text', defaultValue: 'default' },
      { name: 'brand_name', dataType: 'text', defaultValue: 'GitStack' },
      { name: 'theme_preset', dataType: 'text', defaultValue: 'cobalt' },
      { name: 'primary_color', dataType: 'text', defaultValue: '#1E40AF' },
      { name: 'header_surface', dataType: 'text', defaultValue: 'white' },
      { name: 'header_cta_label', dataType: 'text', defaultValue: 'Book Consultation' },
      { name: 'header_cta_href', dataType: 'text', defaultValue: '/contact' },
      { name: 'adsense_publisher_id', dataType: 'text' },
      { name: 'auto_ads_enabled', dataType: 'boolean', defaultValue: false },
      { name: 'ad_slots_enabled', dataType: 'boolean', defaultValue: false },
      { name: 'ads_txt_content', dataType: 'longtext' },
      { name: 'editorial_review_note', dataType: 'longtext' },
      { name: 'ga4_measurement_id', dataType: 'text' },
      { name: 'ga4_enabled', dataType: 'boolean', defaultValue: false },
      { name: 'ga4_track_events', dataType: 'boolean', defaultValue: true },
      { name: 'gtm_enabled', dataType: 'boolean', defaultValue: true },
      { name: 'gtm_container_id', dataType: 'text', defaultValue: 'GTM-MFP3W7MS' },
      { name: 'gtm_track_datalayer', dataType: 'boolean', defaultValue: true },
      { name: 'gtm_track_conversions', dataType: 'boolean', defaultValue: true },
      { name: 'gtm_respect_consent', dataType: 'boolean', defaultValue: false },
      { name: 'gtm_exclude_admin', dataType: 'boolean', defaultValue: true },
      { name: 'bmc_enabled', dataType: 'boolean', defaultValue: true },
      { name: 'bmc_handle', dataType: 'text', defaultValue: 'ronelmol' },
      { name: 'bmc_custom_url', dataType: 'text' },
      { name: 'bmc_button_text', dataType: 'text', defaultValue: 'Buy me a coffee' },
      { name: 'bmc_button_color', dataType: 'text', defaultValue: '#FFDD00' },
      { name: 'brand_logo_url', dataType: 'text' },
      { name: 'brand_logo_alt', dataType: 'text' },
      { name: 'favicon_url', dataType: 'text' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'user_profiles',
    label: 'Team User Profiles',
    domainGroup: 'Operations & Settings',
    primaryKey: 'user_id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'user_profiles',
    columns: [
      { name: 'user_id', dataType: 'text' },
      { name: 'email', dataType: 'text' },
      { name: 'full_name', dataType: 'text' },
      { name: 'role', dataType: 'enum', enumValues: ['super_admin', 'editor', 'support_agent'], defaultValue: 'editor' },
      { name: 'job_title', dataType: 'text' },
      { name: 'bio', dataType: 'longtext' },
      { name: 'avatar_url', dataType: 'text' },
      { name: 'phone', dataType: 'text' },
      { name: 'timezone', dataType: 'text', defaultValue: 'UTC' },
      { name: 'status', dataType: 'enum', enumValues: ['active', 'suspended'], defaultValue: 'active' },
      { name: 'created_at', dataType: 'timestamp' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'user_workflow_items',
    label: 'Team Workflow Tasks',
    domainGroup: 'Operations & Settings',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'user_workflow_items',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'user_id', dataType: 'text' },
      { name: 'assigned_by', dataType: 'text' },
      { name: 'title', dataType: 'text' },
      { name: 'description', dataType: 'longtext' },
      { name: 'category', dataType: 'enum', enumValues: ['onboarding', 'daily_checklist', 'project_task', 'follow_up'], defaultValue: 'project_task' },
      { name: 'priority', dataType: 'enum', enumValues: ['high', 'medium', 'low'], defaultValue: 'medium' },
      { name: 'status', dataType: 'enum', enumValues: ['todo', 'in_progress', 'done'], defaultValue: 'todo' },
      { name: 'due_date', dataType: 'text', nullable: true },
      { name: 'linked_entity_type', dataType: 'enum', enumValues: ['inquiry', 'chat', 'article', 'none'], defaultValue: 'none' },
      { name: 'linked_entity_id', dataType: 'text', nullable: true },
      { name: 'created_at', dataType: 'timestamp' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'routing_rules',
    label: 'Auto-Routing Rules',
    domainGroup: 'Operations & Settings',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'routing_rules',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'source_type', dataType: 'enum', enumValues: ['inquiry', 'chat'], defaultValue: 'inquiry' },
      { name: 'match_key', dataType: 'text' },
      { name: 'assignee_user_id', dataType: 'text', nullable: true },
      { name: 'enabled', dataType: 'boolean', defaultValue: true },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'agent_tasks',
    label: '7-Agent Checklist Tasks',
    domainGroup: 'Operations & Settings',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'agent_tasks',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'agent_id', dataType: 'enum', enumValues: ['marketing', 'ceo', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic'], defaultValue: 'ceo' },
      { name: 'title', dataType: 'text' },
      { name: 'priority', dataType: 'enum', enumValues: ['high', 'medium', 'low'], defaultValue: 'medium' },
      { name: 'completed', dataType: 'boolean', defaultValue: false },
      { name: 'notes', dataType: 'longtext' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'agent_office_profiles',
    label: 'Virtual Office Agent Profiles',
    domainGroup: 'Operations & Settings',
    primaryKey: 'agent_id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'agent_office_profiles',
    columns: [
      { name: 'agent_id', dataType: 'enum', enumValues: ['marketing', 'ceo', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic'] },
      { name: 'display_name', dataType: 'text' },
      { name: 'custom_role', dataType: 'text' },
      { name: 'avatar_icon', dataType: 'text', defaultValue: 'bot' },
      { name: 'accent_color', dataType: 'text', defaultValue: '#1E40AF' },
      { name: 'desk_label', dataType: 'text' },
      { name: 'desk_x', dataType: 'number', defaultValue: 5 },
      { name: 'desk_y', dataType: 'number', defaultValue: 5 },
      { name: 'work_status', dataType: 'enum', enumValues: ['working', 'walking', 'idle'], defaultValue: 'working' },
      { name: 'current_mission', dataType: 'longtext' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'agent_conversations',
    label: 'Agent Handoff Feed',
    domainGroup: 'Operations & Settings',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    localCollectionKey: 'agent_conversations',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'agent_id', dataType: 'enum', enumValues: ['marketing', 'ceo', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic'] },
      { name: 'peer_agent_id', dataType: 'text', nullable: true },
      { name: 'sender_type', dataType: 'enum', enumValues: ['agent', 'operator', 'handoff', 'system'], defaultValue: 'agent' },
      { name: 'sender_name', dataType: 'text' },
      { name: 'message', dataType: 'longtext' },
      { name: 'finding_status', dataType: 'enum', enumValues: ['nominal', 'attention', 'critical', 'info'], defaultValue: 'info' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'agent_report_settings',
    label: 'Daily Agent Report Settings',
    domainGroup: 'Operations & Settings',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localSingletonKey: 'agent_report_settings',
    columns: [
      { name: 'id', dataType: 'text', defaultValue: 'default' },
      { name: 'enabled', dataType: 'boolean', defaultValue: true },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'send_hour_utc', dataType: 'number', defaultValue: 8 },
      { name: 'preferred_channel', dataType: 'enum', enumValues: ['lark_smtp', 'gmail', 'resend'], defaultValue: 'lark_smtp' },
      { name: 'include_agents', dataType: 'json', defaultValue: ['ceo', 'marketing', 'booking', 'cybersecurity', 'qa', 'adsense', 'traffic'] },
      { name: 'last_sent_at', dataType: 'timestamp', nullable: true },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'agent_email_reports',
    label: 'Agent Daily Report Proof Logs',
    domainGroup: 'Operations & Settings',
    primaryKey: 'id',
    defaultSortColumn: 'sent_at',
    localCollectionKey: 'agent_email_reports',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'subject', dataType: 'text' },
      { name: 'channel', dataType: 'enum', enumValues: ['lark_smtp', 'cron_dispatch', 'gmail_api', 'resend_api'], defaultValue: 'lark_smtp' },
      { name: 'trigger_type', dataType: 'enum', enumValues: ['manual', 'daily_cron'], defaultValue: 'manual' },
      { name: 'status', dataType: 'enum', enumValues: ['sent', 'failed', 'skipped_unconfigured'], defaultValue: 'sent' },
      { name: 'provider_message_id', dataType: 'text' },
      { name: 'overall_score', dataType: 'number', defaultValue: 0 },
      { name: 'body_text', dataType: 'longtext' },
      { name: 'proof_hash', dataType: 'text' },
      { name: 'error_detail', dataType: 'text' },
      { name: 'sent_at', dataType: 'timestamp' }
    ]
  },

  // Security & Audit
  {
    tableName: 'data_audit_logs',
    label: 'Data Change Audit Logs',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    readOnlyTable: true,
    localCollectionKey: 'data_audit_logs',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'table_name', dataType: 'text' },
      { name: 'operation', dataType: 'enum', enumValues: ['INSERT', 'UPDATE', 'DELETE'] },
      { name: 'record_pk', dataType: 'text' },
      { name: 'source', dataType: 'enum', enumValues: ['app_studio', 'supabase_dashboard', 'api_backend'] },
      { name: 'actor_email', dataType: 'text' },
      { name: 'changed_columns', dataType: 'json', defaultValue: [] },
      { name: 'before_data', dataType: 'json', nullable: true },
      { name: 'after_data', dataType: 'json', nullable: true },
      { name: 'summary', dataType: 'text' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'crm_integration_secrets',
    label: 'Integration Secrets Vault (Masked)',
    domainGroup: 'Security & Audit',
    primaryKey: 'provider',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'crm_integration_secrets',
    columns: [
      {
        name: 'provider',
        dataType: 'enum',
        enumValues: ['lark_smtp', 'google_analytics', 'google_tag_manager', 'apollo', 'google_maps', 'gemini', 'github', 'cloudflare']
      },
      { name: 'enabled', dataType: 'boolean', defaultValue: true },
      { name: 'encrypted_secret', dataType: 'text' },
      { name: 'secret_hint', dataType: 'text' },
      { name: 'config_meta', dataType: 'json', defaultValue: {} },
      { name: 'last_tested_at', dataType: 'timestamp', nullable: true },
      { name: 'last_test_status', dataType: 'enum', enumValues: ['ok', 'error', 'untested'], defaultValue: 'untested' },
      { name: 'last_test_message', dataType: 'text' },
      { name: 'updated_by', dataType: 'text' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'crm_oauth_tokens',
    label: 'OAuth Tokens (Masked)',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    localCollectionKey: 'crm_oauth_tokens',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'user_id', dataType: 'text' },
      { name: 'provider', dataType: 'text', defaultValue: 'lark' },
      { name: 'access_token', dataType: 'text' },
      { name: 'refresh_token', dataType: 'text' },
      { name: 'expires_at', dataType: 'timestamp' },
      { name: 'account_email', dataType: 'text' },
      { name: 'account_name', dataType: 'text' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'product_qa_logs',
    label: 'Product QA Error Logs',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'level', dataType: 'enum', enumValues: ['error', 'warn', 'info'], defaultValue: 'error' },
      { name: 'source', dataType: 'enum', enumValues: ['frontend', 'backend', 'api', 'database', 'integration'], defaultValue: 'frontend' },
      { name: 'module_name', dataType: 'text' },
      { name: 'page_path', dataType: 'text', defaultValue: '/' },
      { name: 'code_location', dataType: 'text' },
      { name: 'error_name', dataType: 'text' },
      { name: 'message', dataType: 'longtext' },
      { name: 'http_status', dataType: 'number', nullable: true },
      { name: 'status', dataType: 'enum', enumValues: ['open', 'investigating', 'resolved', 'ignored'], defaultValue: 'open' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'product_qa_reports',
    label: 'Product QA EOD Reports',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'report_date', dataType: 'text' },
      { name: 'trigger_type', dataType: 'enum', enumValues: ['manual', 'eod_cron'], defaultValue: 'manual' },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'subject', dataType: 'text' },
      { name: 'health_score', dataType: 'number', defaultValue: 100 },
      { name: 'total_logs', dataType: 'number', defaultValue: 0 },
      { name: 'error_count', dataType: 'number', defaultValue: 0 },
      { name: 'status', dataType: 'enum', enumValues: ['sent', 'failed', 'generated'], defaultValue: 'generated' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'product_qa_settings',
    label: 'Product QA Agent Settings',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    columns: [
      { name: 'id', dataType: 'text', defaultValue: 'default' },
      { name: 'agent_enabled', dataType: 'boolean', defaultValue: true },
      { name: 'realtime_alert_on_critical', dataType: 'boolean', defaultValue: false },
      { name: 'eod_enabled', dataType: 'boolean', defaultValue: true },
      { name: 'eod_hour_utc', dataType: 'number', defaultValue: 15 },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'last_eod_sent_date', dataType: 'text' },
      { name: 'last_scan_at', dataType: 'timestamp', nullable: true },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'cyber_security_findings',
    label: 'CyberSecurity Sentinel Findings',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'detected_at',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'domain', dataType: 'text' },
      { name: 'severity', dataType: 'enum', enumValues: ['critical', 'high', 'medium', 'low', 'info'], defaultValue: 'info' },
      { name: 'status', dataType: 'enum', enumValues: ['open', 'mitigated', 'accepted', 'monitoring'], defaultValue: 'monitoring' },
      { name: 'title', dataType: 'text' },
      { name: 'cve_or_rule', dataType: 'text' },
      { name: 'affected_module', dataType: 'text' },
      { name: 'description', dataType: 'longtext' },
      { name: 'ai_remediation', dataType: 'longtext' },
      { name: 'detected_at', dataType: 'timestamp' },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'cyber_security_reports',
    label: 'CyberSecurity Daily Reports',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'created_at',
    columns: [
      { name: 'id', dataType: 'text' },
      { name: 'report_date', dataType: 'text' },
      { name: 'trigger_type', dataType: 'enum', enumValues: ['manual', 'daily_cron'], defaultValue: 'manual' },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'subject', dataType: 'text' },
      { name: 'posture_score', dataType: 'number', defaultValue: 96 },
      { name: 'grade', dataType: 'text', defaultValue: 'A+' },
      { name: 'status', dataType: 'enum', enumValues: ['sent', 'failed', 'generated'], defaultValue: 'generated' },
      { name: 'created_at', dataType: 'timestamp' }
    ]
  },
  {
    tableName: 'cyber_security_settings',
    label: 'CyberSecurity Sentinel Settings',
    domainGroup: 'Security & Audit',
    primaryKey: 'id',
    defaultSortColumn: 'updated_at',
    columns: [
      { name: 'id', dataType: 'text', defaultValue: 'default' },
      { name: 'sentinel_enabled', dataType: 'boolean', defaultValue: true },
      { name: 'daily_report_enabled', dataType: 'boolean', defaultValue: true },
      { name: 'daily_hour_utc', dataType: 'number', defaultValue: 15 },
      { name: 'realtime_critical_alert', dataType: 'boolean', defaultValue: true },
      { name: 'recipient_email', dataType: 'text' },
      { name: 'last_report_date', dataType: 'text' },
      { name: 'last_scan_at', dataType: 'timestamp', nullable: true },
      { name: 'updated_at', dataType: 'timestamp' }
    ]
  }
];

function buildDescriptorFromSpec(spec: TableSeedSpec, rowCount = 0): DataTableDescriptor {
  return {
    tableName: spec.tableName,
    label: spec.label,
    domainGroup: spec.domainGroup,
    primaryKey: spec.primaryKey,
    defaultSortColumn: spec.defaultSortColumn,
    rowCount,
    readOnlyTable: spec.readOnlyTable,
    columns: spec.columns.map((c) => {
      const masked = SENSITIVE_COLUMNS.has(c.name);
      const isPrimaryKey = c.name === spec.primaryKey;
      const readOnly =
        Boolean(spec.readOnlyTable) ||
        masked ||
        isPrimaryKey ||
        READONLY_SYSTEM_COLUMNS.has(c.name);
      return {
        name: c.name,
        dataType: c.dataType,
        pgType: c.pgType || c.dataType,
        nullable: Boolean(c.nullable),
        readOnly,
        masked,
        isPrimaryKey,
        enumValues: c.enumValues,
        defaultValue: c.defaultValue
      };
    })
  };
}

function getSpecMap(): Map<string, TableSeedSpec> {
  return new Map(TABLE_CATALOG_SPECS.map((s) => [s.tableName, s]));
}

function quoteIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`Invalid SQL identifier: ${ident}`);
  }
  return `"${ident}"`;
}

function maskRowForClient(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SENSITIVE_COLUMNS.has(k)) {
      const str = v === null || v === undefined ? '' : String(v);
      out[k] = str.length > 0 ? '••••••••' : '';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function redactPayloadForAudit(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (SENSITIVE_COLUMNS.has(k)) {
      const str = v === null || v === undefined ? '' : String(v);
      out[k] = str.length > 0 ? '[REDACTED]' : '';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function coerceCellValue(col: DataTableColumnDescriptor, rawValue: unknown): unknown {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    if (col.nullable) return null;
    if (col.dataType === 'boolean') return false;
    if (col.dataType === 'number') return 0;
    if (col.dataType === 'json') return Array.isArray(col.defaultValue) ? [] : {};
    return '';
  }

  switch (col.dataType) {
    case 'boolean': {
      if (typeof rawValue === 'boolean') return rawValue;
      const lower = String(rawValue).trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
      throw new Error(`Column "${col.name}" requires a boolean (true or false).`);
    }
    case 'number': {
      const num = typeof rawValue === 'number' ? rawValue : Number(String(rawValue).trim());
      if (!Number.isFinite(num)) {
        throw new Error(`Column "${col.name}" requires a valid numeric value.`);
      }
      return num;
    }
    case 'json': {
      if (typeof rawValue === 'object') return rawValue;
      try {
        return JSON.parse(String(rawValue));
      } catch {
        throw new Error(`Column "${col.name}" requires valid JSON syntax.`);
      }
    }
    case 'enum': {
      const val = String(rawValue);
      if (col.enumValues && col.enumValues.length > 0 && !col.enumValues.includes(val)) {
        throw new Error(
          `Column "${col.name}" must be one of: ${col.enumValues.join(', ')}.`
        );
      }
      return val;
    }
    case 'timestamp': {
      const parsed = new Date(String(rawValue));
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Column "${col.name}" requires a valid ISO date/timestamp.`);
      }
      return parsed.toISOString();
    }
    default:
      return String(rawValue);
  }
}

async function withPgClient<T>(fn: (pg: PgClient) => Promise<T>): Promise<T | null> {
  const rawDbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!rawDbUrl) return null;

  const { url: dbUrl } = normalizePostgresUrl(rawDbUrl);
  const pg = new PgClient({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
    query_timeout: 8000,
    statement_timeout: 8000
  });
  try {
    await pg.connect();
    return await fn(pg);
  } finally {
    await pg.end().catch(() => {});
  }
}

function mapPgDataType(pgType: string, colName: string): DataColumnType {
  const lower = pgType.toLowerCase();
  if (lower.includes('bool')) return 'boolean';
  if (lower.includes('int') || lower.includes('numeric') || lower.includes('double') || lower.includes('real')) {
    return 'number';
  }
  if (lower.includes('json')) return 'json';
  if (lower.includes('timestamp') || lower === 'date') return 'timestamp';
  if (colName.includes('markdown') || colName.includes('body') || colName.includes('description') || colName.includes('brief')) {
    return 'longtext';
  }
  return 'text';
}

function humanizeTableName(name: string): string {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function discoverDynamicPgTables(pg: PgClient): Promise<DataTableDescriptor[]> {
  const specMap = getSpecMap();
  const tablesRes = await pg.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);

  const colsRes = await pg.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const pkRes = await pg.query<{ table_name: string; column_name: string }>(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
  `);

  const pkByTable = new Map<string, string>();
  for (const r of pkRes.rows) {
    if (!pkByTable.has(r.table_name)) pkByTable.set(r.table_name, r.column_name);
  }

  const colsByTable = new Map<string, typeof colsRes.rows>();
  for (const c of colsRes.rows) {
    const arr = colsByTable.get(c.table_name) || [];
    arr.push(c);
    colsByTable.set(c.table_name, arr);
  }

  const countMap = new Map<string, number>();
  for (const t of tablesRes.rows) {
    try {
      const cnt = await pg.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM public.${quoteIdent(t.table_name)}`
      );
      countMap.set(t.table_name, Number(cnt.rows[0]?.c || 0));
    } catch {
      countMap.set(t.table_name, 0);
    }
  }

  const result: DataTableDescriptor[] = [];
  for (const t of tablesRes.rows) {
    const spec = specMap.get(t.table_name);
    const liveCols = colsByTable.get(t.table_name) || [];
    if (spec) {
      const base = buildDescriptorFromSpec(spec, countMap.get(t.table_name) || 0);
      // Merge any columns added dynamically in Postgres beyond static spec
      const known = new Set(base.columns.map((c) => c.name));
      for (const lc of liveCols) {
        if (!known.has(lc.column_name)) {
          const masked = SENSITIVE_COLUMNS.has(lc.column_name);
          base.columns.push({
            name: lc.column_name,
            dataType: mapPgDataType(lc.data_type, lc.column_name),
            pgType: lc.data_type,
            nullable: lc.is_nullable === 'YES',
            readOnly: masked || READONLY_SYSTEM_COLUMNS.has(lc.column_name),
            masked,
            isPrimaryKey: pkByTable.get(t.table_name) === lc.column_name
          });
        }
      }
      result.push(base);
    } else {
      const pk = pkByTable.get(t.table_name) || liveCols[0]?.column_name || 'id';
      const defaultSort =
        liveCols.find((c) => c.column_name === 'updated_at')?.column_name ||
        liveCols.find((c) => c.column_name === 'created_at')?.column_name ||
        pk;
      result.push({
        tableName: t.table_name,
        label: humanizeTableName(t.table_name),
        domainGroup: 'Operations & Settings',
        primaryKey: pk,
        defaultSortColumn: defaultSort,
        rowCount: countMap.get(t.table_name) || 0,
        readOnlyTable: t.table_name === 'data_audit_logs',
        columns: liveCols.map((lc) => {
          const masked = SENSITIVE_COLUMNS.has(lc.column_name);
          const isPk = lc.column_name === pk;
          return {
            name: lc.column_name,
            dataType: mapPgDataType(lc.data_type, lc.column_name),
            pgType: lc.data_type,
            nullable: lc.is_nullable === 'YES',
            readOnly: masked || isPk || READONLY_SYSTEM_COLUMNS.has(lc.column_name),
            masked,
            isPrimaryKey: isPk
          };
        })
      });
    }
  }
  return result;
}

async function resolveTableDescriptor(
  tableName: string,
  userToken?: string
): Promise<DataTableDescriptor> {
  const clean = tableName.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(clean)) {
    throw new Error('Invalid table name.');
  }

  const pgTables = await withPgClient((pg) => discoverDynamicPgTables(pg)).catch(() => null);
  if (pgTables) {
    const found = pgTables.find((t) => t.tableName === clean);
    if (found) return found;
  }

  const spec = getSpecMap().get(clean);
  if (!spec) {
    throw new Error(`Unknown table "${clean}".`);
  }

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient(userToken);
    const { count } = await client.from(clean).select('*', { count: 'exact', head: true });
    return buildDescriptorFromSpec(spec, count || 0);
  }

  const localRows = await getLocalRowsForSpec(spec);
  return buildDescriptorFromSpec(spec, localRows.length);
}

async function getLocalRowsForSpec(spec: TableSeedSpec): Promise<Record<string, unknown>[]> {
  const db = await readLocalDb();
  const rawDb = db as unknown as Record<string, unknown>;
  if (spec.localCollectionKey && Array.isArray(rawDb[spec.localCollectionKey])) {
    return rawDb[spec.localCollectionKey] as Record<string, unknown>[];
  }
  if (spec.localSingletonKey && rawDb[spec.localSingletonKey]) {
    return [rawDb[spec.localSingletonKey] as Record<string, unknown>];
  }
  if (spec.localMapKey && rawDb[spec.localMapKey] && typeof rawDb[spec.localMapKey] === 'object') {
    return Object.values(rawDb[spec.localMapKey] as Record<string, Record<string, unknown>>);
  }
  return [];
}

async function saveLocalRowsForSpec(
  spec: TableSeedSpec,
  rows: Record<string, unknown>[]
): Promise<void> {
  const db = await readLocalDb();
  const rawDb = db as unknown as Record<string, unknown>;
  if (spec.localCollectionKey) {
    rawDb[spec.localCollectionKey] = rows;
  } else if (spec.localSingletonKey && rows[0]) {
    rawDb[spec.localSingletonKey] = rows[0];
  } else if (spec.localMapKey) {
    const nextMap: Record<string, Record<string, unknown>> = {};
    for (const r of rows) {
      const key = String(r[spec.primaryKey] || '');
      if (key) nextMap[key] = r;
    }
    rawDb[spec.localMapKey] = nextMap;
  }
  await writeLocalDb(db);
}

async function recordAppAuditLog(entry: {
  tableName: string;
  operation: DataAuditOperation;
  recordPk: string;
  actorEmail: string;
  changedColumns: string[];
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  userToken?: string;
}): Promise<DataAuditLogEntry> {
  const now = new Date().toISOString();
  const auditRow: DataAuditLogEntry = {
    id: `aud_${crypto.randomBytes(10).toString('hex')}`,
    table_name: entry.tableName,
    operation: entry.operation,
    record_pk: entry.recordPk,
    source: 'app_studio',
    actor_email: entry.actorEmail,
    changed_columns: entry.changedColumns,
    before_data: redactPayloadForAudit(entry.beforeData),
    after_data: redactPayloadForAudit(entry.afterData),
    summary: `${entry.operation} on ${entry.tableName}${entry.recordPk ? ` (${entry.recordPk})` : ''}`,
    created_at: now
  };

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient(entry.userToken);
      // If Postgres trigger already inserted a row within the last 5 seconds for this exact write,
      // enrich that trigger row cleanly instead of creating a duplicate!
      const recentCutoff = new Date(Date.now() - 5000).toISOString();
      const { data: recentRows } = await client
        .from('data_audit_logs')
        .select('*')
        .eq('table_name', entry.tableName)
        .eq('operation', entry.operation)
        .eq('record_pk', entry.recordPk)
        .gte('created_at', recentCutoff)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentRows && recentRows.length > 0) {
        const existing = recentRows[0] as DataAuditLogEntry;
        const { data: updated } = await client
          .from('data_audit_logs')
          .update({
            source: 'app_studio',
            actor_email: entry.actorEmail
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (updated) return updated as DataAuditLogEntry;
      }

      const { data: inserted } = await client
        .from('data_audit_logs')
        .insert(auditRow)
        .select('*')
        .single();
      if (inserted) return inserted as DataAuditLogEntry;
    } catch {
      // Fall through silently if audit table isn't created yet
    }
    return auditRow;
  }

  const db = await readLocalDb();
  const existingLogs = db.data_audit_logs || [];
  db.data_audit_logs = [auditRow, ...existingLogs].slice(0, 500);
  await writeLocalDb(db);
  return auditRow;
}

export async function getDataExplorerOverview(userToken?: string): Promise<{
  tables: DataTableDescriptor[];
  status: DataExplorerStatus;
}> {
  const configured = isSupabaseConfigured();
  const automationMode = getSupabaseAutomationMode();
  let triggersReady = false;
  let realtimeReady = false;
  let totalAuditLogs = 0;

  // Path 1: Direct Postgres introspection if SUPABASE_DB_URL exists
  const pgResult = await withPgClient(async (pg) => {
    const tables = await discoverDynamicPgTables(pg);
    const trigRes = await pg.query<{ c: string }>(`
      SELECT COUNT(*)::text AS c
      FROM information_schema.triggers
      WHERE trigger_schema = 'public' AND trigger_name = 'trg_gitstack_audit'
    `);
    const pubRes = await pg.query<{ c: string }>(`
      SELECT COUNT(*)::text AS c
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    `);
    let auditCount = 0;
    try {
      const aRes = await pg.query<{ c: string }>('SELECT COUNT(*)::text AS c FROM public.data_audit_logs');
      auditCount = Number(aRes.rows[0]?.c || 0);
    } catch {
      auditCount = 0;
    }
    return {
      tables,
      triggersReady: Number(trigRes.rows[0]?.c || 0) > 0,
      realtimeReady: Number(pubRes.rows[0]?.c || 0) > 0,
      auditCount
    };
  }).catch(() => null);

  if (pgResult) {
    return {
      tables: pgResult.tables,
      status: {
        supabaseConfigured: configured,
        storageBackend: configured ? 'supabase' : 'local-json',
        triggersReady: pgResult.triggersReady,
        realtimeReady: pgResult.realtimeReady,
        automationMode,
        totalTables: pgResult.tables.length,
        totalAuditLogs: pgResult.auditCount
      }
    };
  }

  // Path 2: Supabase PostgREST counts
  if (configured) {
    const client = getSupabaseClient(userToken);
    const tables = await Promise.all(
      TABLE_CATALOG_SPECS.map(async (spec) => {
        try {
          const { count } = await client
            .from(spec.tableName)
            .select('*', { count: 'exact', head: true });
          return buildDescriptorFromSpec(spec, count || 0);
        } catch {
          return buildDescriptorFromSpec(spec, 0);
        }
      })
    );

    const { count: auditCount, error: auditErr } = await client
      .from('data_audit_logs')
      .select('*', { count: 'exact', head: true });
    if (!auditErr) {
      triggersReady = true;
      realtimeReady = true;
      totalAuditLogs = auditCount || 0;
    }

    return {
      tables,
      status: {
        supabaseConfigured: true,
        storageBackend: 'supabase',
        triggersReady,
        realtimeReady,
        automationMode,
        totalTables: tables.length,
        totalAuditLogs
      }
    };
  }

  // Path 3: Local JSON Fallback Store
  const db = await readLocalDb();
  const tables = await Promise.all(
    TABLE_CATALOG_SPECS.map(async (spec) => {
      const rows = await getLocalRowsForSpec(spec);
      return buildDescriptorFromSpec(spec, rows.length);
    })
  );

  return {
    tables,
    status: {
      supabaseConfigured: false,
      storageBackend: 'local-json',
      triggersReady: true,
      realtimeReady: true,
      automationMode,
      totalTables: tables.length,
      totalAuditLogs: (db.data_audit_logs || []).length
    }
  };
}

export async function getDataTableRows(input: {
  tableName: string;
  limit?: number;
  offset?: number;
  search?: string;
  sortColumn?: string;
  sortDir?: 'asc' | 'desc';
  userToken?: string;
}): Promise<DataTableRowsResponse> {
  const table = await resolveTableDescriptor(input.tableName, input.userToken);
  const limit = Math.min(100, Math.max(10, Number(input.limit || 50)));
  const offset = Math.max(0, Number(input.offset || 0));
  const search = (input.search || '').trim();
  const validCols = new Set(table.columns.map((c) => c.name));
  const sortColumn =
    input.sortColumn && validCols.has(input.sortColumn)
      ? input.sortColumn
      : validCols.has(table.defaultSortColumn)
        ? table.defaultSortColumn
        : table.primaryKey;
  const sortDir = input.sortDir === 'asc' ? 'asc' : 'desc';

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient(input.userToken);
    let query = client
      .from(table.tableName)
      .select('*', { count: 'exact' })
      .order(sortColumn, { ascending: sortDir === 'asc' })
      .range(offset, offset + limit - 1);

    if (search) {
      const searchableCols = table.columns
        .filter((c) => !c.masked && (c.dataType === 'text' || c.dataType === 'longtext' || c.dataType === 'enum'))
        .slice(0, 6)
        .map((c) => `${c.name}.ilike.%${search.replace(/[,%()]/g, '')}%`);
      if (searchableCols.length > 0) {
        query = query.or(searchableCols.join(','));
      }
    }

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed loading "${table.tableName}": ${error.message}`);
    }

    return {
      table: { ...table, rowCount: count ?? (data?.length || 0) },
      rows: (data || []).map((r) => maskRowForClient(r as Record<string, unknown>)),
      totalCount: count ?? (data?.length || 0),
      limit,
      offset
    };
  }

  // Local JSON fallback
  const spec = getSpecMap().get(table.tableName);
  let rows = spec ? await getLocalRowsForSpec(spec) : [];
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((row) =>
      table.columns.some(
        (c) => !c.masked && String(row[c.name] ?? '').toLowerCase().includes(q)
      )
    );
  }
  rows = [...rows].sort((a, b) => {
    const av = String(a[sortColumn] ?? '');
    const bv = String(b[sortColumn] ?? '');
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const paged = rows.slice(offset, offset + limit).map(maskRowForClient);
  return {
    table: { ...table, rowCount: rows.length },
    rows: paged,
    totalCount: rows.length,
    limit,
    offset
  };
}

export async function updateDataTableCell(input: {
  tableName: string;
  primaryKeyValue: string;
  column: string;
  value: unknown;
  actorEmail: string;
  userToken?: string;
}): Promise<{ row: Record<string, unknown>; auditLog: DataAuditLogEntry }> {
  const table = await resolveTableDescriptor(input.tableName, input.userToken);
  if (table.readOnlyTable) {
    throw new Error(`Table "${table.tableName}" is an immutable audit log and cannot be modified.`);
  }

  const col = table.columns.find((c) => c.name === input.column);
  if (!col) {
    throw new Error(`Column "${input.column}" does not exist on "${table.tableName}".`);
  }
  if (col.masked) {
    throw new Error(`Column "${col.name}" is a protected secret and cannot be inline-edited.`);
  }
  if (col.isPrimaryKey || col.readOnly) {
    throw new Error(`Column "${col.name}" is read-only.`);
  }

  const coercedVal = coerceCellValue(col, input.value);
  const pkCol = table.primaryKey;
  const pkVal = input.primaryKeyValue;
  const hasUpdatedAt = table.columns.some((c) => c.name === 'updated_at');
  const nowIso = new Date().toISOString();

  // Path 1: Direct PostgreSQL transaction with session audit attribution
  const pgOutcome = await withPgClient(async (pg) => {
    await pg.query('BEGIN');
    try {
      await pg.query(`SELECT set_config('app.edit_source', 'app_studio', true)`);
      await pg.query(`SELECT set_config('app.actor_email', $1, true)`, [input.actorEmail]);

      const beforeRes = await pg.query(
        `SELECT * FROM public.${quoteIdent(table.tableName)} WHERE ${quoteIdent(pkCol)}::text = $1 LIMIT 1`,
        [pkVal]
      );
      if (beforeRes.rows.length === 0) {
        throw new Error(`Record ${pkCol}="${pkVal}" not found in "${table.tableName}".`);
      }
      const beforeRow = beforeRes.rows[0] as Record<string, unknown>;

      const setClauses = [`${quoteIdent(col.name)} = $1`];
      const params: unknown[] = [
        col.dataType === 'json' ? JSON.stringify(coercedVal) : coercedVal
      ];
      if (hasUpdatedAt) {
        setClauses.push(`${quoteIdent('updated_at')} = $2`);
        params.push(nowIso);
      }
      params.push(pkVal);

      const updateSql = `
        UPDATE public.${quoteIdent(table.tableName)}
        SET ${setClauses.join(', ')}
        WHERE ${quoteIdent(pkCol)}::text = $${params.length}
        RETURNING *
      `;
      const afterRes = await pg.query(updateSql, params);
      const afterRow = afterRes.rows[0] as Record<string, unknown>;

      // Check if trigger wrote an audit row in this transaction; if not, insert one cleanly
      const auditRes = await pg.query<DataAuditLogEntry>(
        `SELECT * FROM public.data_audit_logs
         WHERE table_name = $1 AND operation = 'UPDATE' AND record_pk = $2
         ORDER BY created_at DESC LIMIT 1`,
        [table.tableName, pkVal]
      );

      let auditLog: DataAuditLogEntry | undefined = auditRes.rows[0];
      if (!auditLog || Date.now() - new Date(auditLog.created_at).getTime() > 5000) {
        const manualId = `aud_${crypto.randomBytes(10).toString('hex')}`;
        const ins = await pg.query<DataAuditLogEntry>(
          `INSERT INTO public.data_audit_logs
            (id, table_name, operation, record_pk, source, actor_email, changed_columns, before_data, after_data, summary)
           VALUES ($1, $2, 'UPDATE', $3, 'app_studio', $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
           RETURNING *`,
          [
            manualId,
            table.tableName,
            pkVal,
            input.actorEmail,
            JSON.stringify([col.name]),
            JSON.stringify(redactPayloadForAudit(beforeRow)),
            JSON.stringify(redactPayloadForAudit(afterRow)),
            `UPDATE on ${table.tableName} (${pkVal})`
          ]
        );
        auditLog = ins.rows[0];
      }

      await pg.query('COMMIT');
      return {
        row: maskRowForClient(afterRow),
        auditLog
      };
    } catch (err) {
      await pg.query('ROLLBACK').catch(() => {});
      throw err;
    }
  });

  if (pgOutcome) {
    broadcastToAdmins('data:sync', {
      tableName: table.tableName,
      operation: 'UPDATE',
      recordPk: pkVal,
      row: pgOutcome.row,
      auditLog: pgOutcome.auditLog
    });
    return pgOutcome;
  }

  // Path 2: Supabase PostgREST
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient(input.userToken);
    const { data: beforeRow, error: beforeErr } = await client
      .from(table.tableName)
      .select('*')
      .eq(pkCol, pkVal)
      .single();

    if (beforeErr || !beforeRow) {
      throw new Error(beforeErr?.message || `Record ${pkCol}="${pkVal}" not found.`);
    }

    const patch: Record<string, unknown> = { [col.name]: coercedVal };
    if (hasUpdatedAt) patch.updated_at = nowIso;

    const { data: afterRow, error: updateErr } = await client
      .from(table.tableName)
      .update(patch)
      .eq(pkCol, pkVal)
      .select('*')
      .single();

    if (updateErr || !afterRow) {
      throw new Error(updateErr?.message || `Failed updating "${col.name}".`);
    }

    const auditLog = await recordAppAuditLog({
      tableName: table.tableName,
      operation: 'UPDATE',
      recordPk: pkVal,
      actorEmail: input.actorEmail,
      changedColumns: [col.name],
      beforeData: beforeRow as Record<string, unknown>,
      afterData: afterRow as Record<string, unknown>,
      userToken: input.userToken
    });

    const maskedRow = maskRowForClient(afterRow as Record<string, unknown>);
    broadcastToAdmins('data:sync', {
      tableName: table.tableName,
      operation: 'UPDATE',
      recordPk: pkVal,
      row: maskedRow,
      auditLog
    });
    return { row: maskedRow, auditLog };
  }

  // Path 3: Local JSON Fallback
  const spec = getSpecMap().get(table.tableName);
  if (!spec) throw new Error(`Local fallback does not support "${table.tableName}".`);
  const rows = await getLocalRowsForSpec(spec);
  const idx = rows.findIndex((r) => String(r[pkCol] ?? '') === String(pkVal));
  if (idx === -1) throw new Error(`Record ${pkCol}="${pkVal}" not found.`);

  const beforeRow = { ...rows[idx] };
  const afterRow: Record<string, unknown> = {
    ...beforeRow,
    [col.name]: coercedVal,
    ...(hasUpdatedAt ? { updated_at: nowIso } : {})
  };
  rows[idx] = afterRow;
  await saveLocalRowsForSpec(spec, rows);

  const auditLog = await recordAppAuditLog({
    tableName: table.tableName,
    operation: 'UPDATE',
    recordPk: pkVal,
    actorEmail: input.actorEmail,
    changedColumns: [col.name],
    beforeData: beforeRow,
    afterData: afterRow
  });

  const maskedRow = maskRowForClient(afterRow);
  broadcastToAdmins('data:sync', {
    tableName: table.tableName,
    operation: 'UPDATE',
    recordPk: pkVal,
    row: maskedRow,
    auditLog
  });
  return { row: maskedRow, auditLog };
}

export async function insertDataTableRow(input: {
  tableName: string;
  values: Record<string, unknown>;
  actorEmail: string;
  userToken?: string;
}): Promise<{ row: Record<string, unknown>; auditLog: DataAuditLogEntry }> {
  const table = await resolveTableDescriptor(input.tableName, input.userToken);
  if (table.readOnlyTable) {
    throw new Error(`Table "${table.tableName}" is read-only.`);
  }

  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {};

  for (const col of table.columns) {
    if (col.masked) continue;
    const rawVal = input.values[col.name];
    if (col.isPrimaryKey) {
      if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
        payload[col.name] = String(rawVal).trim();
      } else if (col.name === 'id') {
        payload[col.name] = `${table.tableName.slice(0, 4)}_${crypto.randomBytes(6).toString('hex')}`;
      } else if (col.defaultValue !== undefined) {
        payload[col.name] = col.defaultValue;
      } else {
        throw new Error(`Primary key "${col.name}" is required.`);
      }
      continue;
    }

    if (col.name === 'created_at' || col.name === 'updated_at' || col.name === 'detected_at' || col.name === 'sent_at') {
      payload[col.name] = nowIso;
      continue;
    }

    if (rawVal === undefined) {
      if (col.defaultValue !== undefined) {
        payload[col.name] = col.defaultValue;
      } else if (col.nullable) {
        payload[col.name] = null;
      } else if (col.dataType === 'boolean') {
        payload[col.name] = false;
      } else if (col.dataType === 'number') {
        payload[col.name] = 0;
      } else if (col.dataType === 'json') {
        payload[col.name] = [];
      } else {
        payload[col.name] = '';
      }
    } else {
      payload[col.name] = coerceCellValue(col, rawVal);
    }
  }

  const pkVal = String(payload[table.primaryKey] || '');

  const pgOutcome = await withPgClient(async (pg) => {
    await pg.query('BEGIN');
    try {
      await pg.query(`SELECT set_config('app.edit_source', 'app_studio', true)`);
      await pg.query(`SELECT set_config('app.actor_email', $1, true)`, [input.actorEmail]);

      const cols = Object.keys(payload);
      const colSql = cols.map((c) => quoteIdent(c)).join(', ');
      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
      const vals = cols.map((c) => {
        const colDef = table.columns.find((d) => d.name === c);
        if (colDef?.dataType === 'json' && payload[c] !== null) {
          return JSON.stringify(payload[c]);
        }
        return payload[c];
      });

      const insRes = await pg.query(
        `INSERT INTO public.${quoteIdent(table.tableName)} (${colSql}) VALUES (${placeholders}) RETURNING *`,
        vals
      );
      const inserted = insRes.rows[0] as Record<string, unknown>;

      const auditRes = await pg.query<DataAuditLogEntry>(
        `SELECT * FROM public.data_audit_logs
         WHERE table_name = $1 AND operation = 'INSERT' AND record_pk = $2
         ORDER BY created_at DESC LIMIT 1`,
        [table.tableName, pkVal]
      );
      let auditLog: DataAuditLogEntry | undefined = auditRes.rows[0];
      if (!auditLog || Date.now() - new Date(auditLog.created_at).getTime() > 5000) {
        const manualId = `aud_${crypto.randomBytes(10).toString('hex')}`;
        const aIns = await pg.query<DataAuditLogEntry>(
          `INSERT INTO public.data_audit_logs
            (id, table_name, operation, record_pk, source, actor_email, changed_columns, before_data, after_data, summary)
           VALUES ($1, $2, 'INSERT', $3, 'app_studio', $4, $5::jsonb, NULL, $6::jsonb, $7)
           RETURNING *`,
          [
            manualId,
            table.tableName,
            pkVal,
            input.actorEmail,
            JSON.stringify(cols),
            JSON.stringify(redactPayloadForAudit(inserted)),
            `INSERT on ${table.tableName} (${pkVal})`
          ]
        );
        auditLog = aIns.rows[0];
      }

      await pg.query('COMMIT');
      return {
        row: maskRowForClient(inserted),
        auditLog
      };
    } catch (err) {
      await pg.query('ROLLBACK').catch(() => {});
      throw err;
    }
  });

  if (pgOutcome) {
    broadcastToAdmins('data:sync', {
      tableName: table.tableName,
      operation: 'INSERT',
      recordPk: pkVal,
      row: pgOutcome.row,
      auditLog: pgOutcome.auditLog
    });
    return pgOutcome;
  }

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient(input.userToken);
    const { data: inserted, error } = await client
      .from(table.tableName)
      .insert(payload)
      .select('*')
      .single();

    if (error || !inserted) {
      throw new Error(error?.message || `Failed inserting row into "${table.tableName}".`);
    }

    const auditLog = await recordAppAuditLog({
      tableName: table.tableName,
      operation: 'INSERT',
      recordPk: pkVal,
      actorEmail: input.actorEmail,
      changedColumns: Object.keys(payload),
      beforeData: null,
      afterData: inserted as Record<string, unknown>,
      userToken: input.userToken
    });

    const maskedRow = maskRowForClient(inserted as Record<string, unknown>);
    broadcastToAdmins('data:sync', {
      tableName: table.tableName,
      operation: 'INSERT',
      recordPk: pkVal,
      row: maskedRow,
      auditLog
    });
    return { row: maskedRow, auditLog };
  }

  // Local JSON Fallback
  const spec = getSpecMap().get(table.tableName);
  if (!spec) throw new Error(`Local fallback does not support "${table.tableName}".`);
  const rows = await getLocalRowsForSpec(spec);
  if (rows.some((r) => String(r[table.primaryKey] ?? '') === pkVal)) {
    throw new Error(`Row with ${table.primaryKey}="${pkVal}" already exists.`);
  }
  await saveLocalRowsForSpec(spec, [payload, ...rows]);

  const auditLog = await recordAppAuditLog({
    tableName: table.tableName,
    operation: 'INSERT',
    recordPk: pkVal,
    actorEmail: input.actorEmail,
    changedColumns: Object.keys(payload),
    beforeData: null,
    afterData: payload
  });

  const maskedRow = maskRowForClient(payload);
  broadcastToAdmins('data:sync', {
    tableName: table.tableName,
    operation: 'INSERT',
    recordPk: pkVal,
    row: maskedRow,
    auditLog
  });
  return { row: maskedRow, auditLog };
}

export async function deleteDataTableRow(input: {
  tableName: string;
  primaryKeyValue: string;
  actorEmail: string;
  userToken?: string;
}): Promise<{ ok: true; auditLog: DataAuditLogEntry }> {
  const table = await resolveTableDescriptor(input.tableName, input.userToken);
  if (table.readOnlyTable) {
    throw new Error(`Table "${table.tableName}" is read-only.`);
  }
  const pkCol = table.primaryKey;
  const pkVal = input.primaryKeyValue;

  const pgOutcome = await withPgClient(async (pg) => {
    await pg.query('BEGIN');
    try {
      await pg.query(`SELECT set_config('app.edit_source', 'app_studio', true)`);
      await pg.query(`SELECT set_config('app.actor_email', $1, true)`, [input.actorEmail]);

      const delRes = await pg.query(
        `DELETE FROM public.${quoteIdent(table.tableName)} WHERE ${quoteIdent(pkCol)}::text = $1 RETURNING *`,
        [pkVal]
      );
      if (delRes.rows.length === 0) {
        throw new Error(`Record ${pkCol}="${pkVal}" not found.`);
      }
      const deleted = delRes.rows[0] as Record<string, unknown>;

      const auditRes = await pg.query<DataAuditLogEntry>(
        `SELECT * FROM public.data_audit_logs
         WHERE table_name = $1 AND operation = 'DELETE' AND record_pk = $2
         ORDER BY created_at DESC LIMIT 1`,
        [table.tableName, pkVal]
      );
      let auditLog: DataAuditLogEntry | undefined = auditRes.rows[0];
      if (!auditLog || Date.now() - new Date(auditLog.created_at).getTime() > 5000) {
        const manualId = `aud_${crypto.randomBytes(10).toString('hex')}`;
        const aIns = await pg.query<DataAuditLogEntry>(
          `INSERT INTO public.data_audit_logs
            (id, table_name, operation, record_pk, source, actor_email, changed_columns, before_data, after_data, summary)
           VALUES ($1, $2, 'DELETE', $3, 'app_studio', $4, $5::jsonb, $6::jsonb, NULL, $7)
           RETURNING *`,
          [
            manualId,
            table.tableName,
            pkVal,
            input.actorEmail,
            JSON.stringify(Object.keys(deleted)),
            JSON.stringify(redactPayloadForAudit(deleted)),
            `DELETE on ${table.tableName} (${pkVal})`
          ]
        );
        auditLog = aIns.rows[0];
      }

      await pg.query('COMMIT');
      return { ok: true as const, auditLog };
    } catch (err) {
      await pg.query('ROLLBACK').catch(() => {});
      throw err;
    }
  });

  if (pgOutcome) {
    broadcastToAdmins('data:sync', {
      tableName: table.tableName,
      operation: 'DELETE',
      recordPk: pkVal,
      auditLog: pgOutcome.auditLog
    });
    return pgOutcome;
  }

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient(input.userToken);
    const { data: beforeRow } = await client
      .from(table.tableName)
      .select('*')
      .eq(pkCol, pkVal)
      .single();

    if (!beforeRow) {
      throw new Error(`Record ${pkCol}="${pkVal}" not found.`);
    }

    const { error } = await client
      .from(table.tableName)
      .delete()
      .eq(pkCol, pkVal);

    if (error) {
      throw new Error(error.message || `Failed deleting record "${pkVal}".`);
    }

    const auditLog = await recordAppAuditLog({
      tableName: table.tableName,
      operation: 'DELETE',
      recordPk: pkVal,
      actorEmail: input.actorEmail,
      changedColumns: Object.keys(beforeRow as Record<string, unknown>),
      beforeData: beforeRow as Record<string, unknown>,
      afterData: null,
      userToken: input.userToken
    });

    broadcastToAdmins('data:sync', {
      tableName: table.tableName,
      operation: 'DELETE',
      recordPk: pkVal,
      auditLog
    });
    return { ok: true, auditLog };
  }

  const spec = getSpecMap().get(table.tableName);
  if (!spec) throw new Error(`Local fallback does not support "${table.tableName}".`);
  const rows = await getLocalRowsForSpec(spec);
  const target = rows.find((r) => String(r[pkCol] ?? '') === String(pkVal));
  if (!target) throw new Error(`Record ${pkCol}="${pkVal}" not found.`);
  await saveLocalRowsForSpec(
    spec,
    rows.filter((r) => String(r[pkCol] ?? '') !== String(pkVal))
  );

  const auditLog = await recordAppAuditLog({
    tableName: table.tableName,
    operation: 'DELETE',
    recordPk: pkVal,
    actorEmail: input.actorEmail,
    changedColumns: Object.keys(target),
    beforeData: target,
    afterData: null
  });

  broadcastToAdmins('data:sync', {
    tableName: table.tableName,
    operation: 'DELETE',
    recordPk: pkVal,
    auditLog
  });
  return { ok: true, auditLog };
}

export async function listDataAuditLogs(input: {
  tableName?: string;
  source?: 'all' | DataAuditSource;
  operation?: 'all' | DataAuditOperation;
  search?: string;
  limit?: number;
  offset?: number;
  userToken?: string;
}): Promise<DataAuditLogsResponse> {
  const limit = Math.min(150, Math.max(10, Number(input.limit || 60)));
  const offset = Math.max(0, Number(input.offset || 0));
  const search = (input.search || '').trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient(input.userToken);
    let query = client
      .from('data_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (input.tableName && input.tableName !== 'all') {
      query = query.eq('table_name', input.tableName);
    }
    if (input.source && input.source !== 'all') {
      query = query.eq('source', input.source);
    }
    if (input.operation && input.operation !== 'all') {
      query = query.eq('operation', input.operation);
    }
    if (search) {
      const clean = search.replace(/[,%()]/g, '');
      query = query.or(
        `table_name.ilike.%${clean}%,record_pk.ilike.%${clean}%,actor_email.ilike.%${clean}%,summary.ilike.%${clean}%`
      );
    }

    const { data, count, error } = await query;
    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01' || error.code === 'PGRST205') {
        return {
          logs: [],
          totalCount: 0,
          countsBySource: { all: 0, app_studio: 0, supabase_dashboard: 0, api_backend: 0 }
        };
      }
      throw new Error(`Failed loading audit logs: ${error.message}`);
    }

    const [allCnt, appCnt, supaCnt, apiCnt] = await Promise.all([
      client.from('data_audit_logs').select('*', { count: 'exact', head: true }),
      client.from('data_audit_logs').select('*', { count: 'exact', head: true }).eq('source', 'app_studio'),
      client.from('data_audit_logs').select('*', { count: 'exact', head: true }).eq('source', 'supabase_dashboard'),
      client.from('data_audit_logs').select('*', { count: 'exact', head: true }).eq('source', 'api_backend')
    ]);

    const logs = ((data || []) as DataAuditLogEntry[]).map((row) => ({
      ...row,
      before_data: redactPayloadForAudit(row.before_data),
      after_data: redactPayloadForAudit(row.after_data)
    }));

    return {
      logs,
      totalCount: count ?? logs.length,
      countsBySource: {
        all: allCnt.count || 0,
        app_studio: appCnt.count || 0,
        supabase_dashboard: supaCnt.count || 0,
        api_backend: apiCnt.count || 0
      }
    };
  }

  // Local JSON Fallback
  const db = await readLocalDb();
  const all = (db.data_audit_logs || []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const filtered = all.filter((item) => {
    if (input.tableName && input.tableName !== 'all' && item.table_name !== input.tableName) return false;
    if (input.source && input.source !== 'all' && item.source !== input.source) return false;
    if (input.operation && input.operation !== 'all' && item.operation !== input.operation) return false;
    if (search) {
      const hay = `${item.table_name} ${item.record_pk} ${item.actor_email} ${item.summary}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return {
    logs: filtered.slice(offset, offset + limit),
    totalCount: filtered.length,
    countsBySource: {
      all: all.length,
      app_studio: all.filter((l) => l.source === 'app_studio').length,
      supabase_dashboard: all.filter((l) => l.source === 'supabase_dashboard').length,
      api_backend: all.filter((l) => l.source === 'api_backend').length
    }
  };
}

export async function setupDataAuditTriggers(): Promise<{
  executed: boolean;
  triggersReady: boolean;
  message: string;
}> {
  const migration = await autoMigrateSupabaseSchema();
  const overview = await getDataExplorerOverview();
  return {
    executed: migration.executed,
    triggersReady: overview.status.triggersReady,
    message: migration.message
  };
}
