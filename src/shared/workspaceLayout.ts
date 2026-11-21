import type { WorkspaceCategoryConfig, WorkspaceLayoutConfig, WorkspaceModuleId } from './types.ts';

export const ALL_WORKSPACE_MODULE_IDS: WorkspaceModuleId[] = [
  'agents',
  'workflows',
  'notifications',
  'search_console',
  'marketing',
  'google_trends',
  'ai_visibility',
  'articles',
  'crm',
  'inbox',
  'chat',
  'demo_users',
  'buymeacoffee',
  'analytics',
  'tag_manager',
  'cloudflare',
  'pages',
  'contact_registry',
  'branding',
  'resources',
  'qa',
  'cybersecurity',
  'demo_guard',
  'data_explorer',
  'users',
  'adsense',
  'profile'
];

export const DEFAULT_MODULE_LABELS: Record<WorkspaceModuleId, string> = {
  agents: 'Overview & 7 Agents',
  workflows: 'Team Workflows',
  notifications: 'Notifications & Alerts',
  search_console: 'Search Console & SEO',
  marketing: 'Marketing & Social',
  google_trends: 'Google Trends Agent',
  ai_visibility: 'AI & Search Visibility',
  articles: 'Articles & Gatekeeper',
  crm: 'CRM & Prospecting',
  inbox: 'Lark Mail & Lead Inbox',
  chat: 'Live Q&A Chat Box',
  demo_users: 'Demo Users & Leads',
  buymeacoffee: 'Buy Me a Coffee Hub',
  analytics: 'Google Analytics',
  tag_manager: 'Tag Manager (GTM)',
  cloudflare: 'Cloudflare Analytics',
  pages: 'Page Content Editor',
  contact_registry: 'Emails, Phones & Names',
  branding: 'Branding & Theme',
  resources: 'Vercel & Supabase Monitor',
  qa: 'Product QA & Logs',
  cybersecurity: 'Cybersecurity & AI Sentinel',
  demo_guard: 'Demo Guard & Alerts',
  data_explorer: 'Data & Tables',
  users: 'User Access',
  adsense: 'Settings & Integrations',
  profile: 'My Profile'
};

export function createDefaultWorkspaceCategories(): WorkspaceCategoryConfig[] {
  return [
    {
      id: 'cat-command',
      name: 'Command & Agents',
      collapsed: false,
      moduleIds: ['agents', 'workflows', 'notifications']
    },
    {
      id: 'cat-growth',
      name: 'Growth, SEO & Social',
      collapsed: false,
      moduleIds: ['search_console', 'marketing', 'google_trends', 'ai_visibility', 'articles']
    },
    {
      id: 'cat-clients',
      name: 'Revenue, CRM & Clients',
      collapsed: false,
      moduleIds: ['crm', 'inbox', 'chat', 'demo_users', 'buymeacoffee']
    },
    {
      id: 'cat-analytics',
      name: 'Analytics & Telemetry',
      collapsed: false,
      moduleIds: ['analytics', 'tag_manager', 'cloudflare']
    },
    {
      id: 'cat-content',
      name: 'Content & Appearance',
      collapsed: false,
      moduleIds: ['pages', 'contact_registry', 'branding']
    },
    {
      id: 'cat-system',
      name: 'Platform, Security & Admin',
      collapsed: false,
      moduleIds: ['resources', 'qa', 'cybersecurity', 'demo_guard', 'data_explorer', 'users', 'adsense', 'profile']
    }
  ];
}

export function createDefaultWorkspaceLayout(): WorkspaceLayoutConfig {
  return {
    version: 1,
    sidebarCollapsed: false,
    categories: createDefaultWorkspaceCategories(),
    moduleAliases: {},
    updatedAt: new Date().toISOString()
  };
}

const VALID_MODULE_SET = new Set<string>(ALL_WORKSPACE_MODULE_IDS);

export function sanitizeWorkspaceLayout(
  raw: Partial<WorkspaceLayoutConfig> | null | undefined
): WorkspaceLayoutConfig {
  const defaults = createDefaultWorkspaceCategories();
  if (!raw || typeof raw !== 'object') {
    return createDefaultWorkspaceLayout();
  }

  const seenModules = new Set<WorkspaceModuleId>();
  const categories: WorkspaceCategoryConfig[] = [];

  if (Array.isArray(raw.categories)) {
    for (let i = 0; i < raw.categories.length; i += 1) {
      const cat = raw.categories[i];
      if (!cat || typeof cat !== 'object') continue;
      const cleanId =
        typeof cat.id === 'string' && cat.id.trim()
          ? cat.id.trim().slice(0, 48)
          : `cat-${i + 1}`;
      const cleanName =
        typeof cat.name === 'string' && cat.name.trim()
          ? cat.name.trim().slice(0, 60)
          : `Category ${i + 1}`;
      const moduleIds: WorkspaceModuleId[] = [];
      if (Array.isArray(cat.moduleIds)) {
        for (const m of cat.moduleIds) {
          if (typeof m === 'string' && VALID_MODULE_SET.has(m)) {
            const modId = m as WorkspaceModuleId;
            if (!seenModules.has(modId)) {
              seenModules.add(modId);
              moduleIds.push(modId);
            }
          }
        }
      }
      categories.push({
        id: cleanId,
        name: cleanName,
        collapsed: Boolean(cat.collapsed),
        moduleIds
      });
    }
  }

  if (categories.length === 0) {
    for (const defCat of defaults) {
      categories.push({ ...defCat, moduleIds: [...defCat.moduleIds] });
      for (const m of defCat.moduleIds) seenModules.add(m);
    }
  } else {
    // Ensure any modules introduced after user saved their layout are placed cleanly in their default category
    for (const defCat of defaults) {
      const missingForCat = defCat.moduleIds.filter((m) => !seenModules.has(m));
      if (missingForCat.length === 0) continue;
      for (const m of missingForCat) seenModules.add(m);
      const matching = categories.find((c) => c.id === defCat.id) || categories[0];
      matching.moduleIds.push(...missingForCat);
    }
  }

  const moduleAliases: Record<string, string> = {};
  if (raw.moduleAliases && typeof raw.moduleAliases === 'object') {
    for (const [k, v] of Object.entries(raw.moduleAliases)) {
      if (VALID_MODULE_SET.has(k) && typeof v === 'string') {
        const trimmed = v.trim().slice(0, 60);
        if (trimmed && trimmed !== DEFAULT_MODULE_LABELS[k as WorkspaceModuleId]) {
          moduleAliases[k] = trimmed;
        }
      }
    }
  }

  return {
    version: 1,
    sidebarCollapsed: Boolean(raw.sidebarCollapsed),
    categories,
    moduleAliases,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : new Date().toISOString()
  };
}
