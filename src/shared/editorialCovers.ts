import type { ServiceCategory } from './types.ts';

export interface EditorialCoverPreset {
  id: string;
  label: string;
  url: string;
  altTemplate: string;
  categories: ServiceCategory[];
  tags: string[];
}

export const EDITORIAL_COVER_POOL: EditorialCoverPreset[] = [
  {
    id: 'ai-agents-prism',
    label: 'Optical Prism (AI & Systems)',
    url: '/src/assets/images/insight_cover_ai_agents_1794645171607.jpg',
    altTemplate: 'Optical glass prisms refracting cobalt light beams representing enterprise AI retrieval architecture',
    categories: ['AI Integration'],
    tags: ['ai', 'rag', 'llm', 'agent', 'copilot', 'vector']
  },
  {
    id: 'ml-pipeline-iso',
    label: 'Isometric ML Pipeline',
    url: '/src/assets/images/ai_ml_pipeline_visual_1794645170877.jpg',
    altTemplate: 'Isometric machine learning inference pipeline and automated data orchestration topology',
    categories: ['ML Automation', 'AI Integration'],
    tags: ['ml', 'mlops', 'training', 'model', 'pipeline', 'gpu', 'inference']
  },
  {
    id: 'cloud-infra-desk',
    label: 'Cloud Engineering Architecture',
    url: '/src/assets/images/cloud_infra_architecture_1794645172181.jpg',
    altTemplate: 'Modern cloud infrastructure monitoring studio with distributed telemetry diagrams',
    categories: ['Cloud Infrastructure'],
    tags: ['cloud', 'aws', 'kubernetes', 'supabase', 'postgres', 'terraform', 'finops']
  },
  {
    id: 'gitstack-studio',
    label: 'GitStack Architecture Studio',
    url: '/src/assets/images/hero_gitstack_architecture_1794645171609.jpg',
    altTemplate: 'Clean architectural software engineering desk and distributed systems planning workspace',
    categories: ['Custom Software', 'Technical Consulting'],
    tags: ['architecture', 'system', 'enterprise', 'software']
  },
  {
    id: 'custom-software-blueprints',
    label: 'Microservice System Blueprints',
    url: '/src/assets/images/cover_custom_software_1795220240531.jpg',
    altTemplate: 'Minimalist software engineering desk featuring microservice topology blueprints and laptop workspace',
    categories: ['Custom Software'],
    tags: ['api', 'erp', 'invoice', 'bir', 'eis', 'typescript', 'node', 'react', 'migration']
  },
  {
    id: 'technical-consulting-stone',
    label: 'Executive Systems Governance',
    url: '/src/assets/images/cover_technical_consulting_1795220239502.jpg',
    altTemplate: 'Translucent architectural glass topology model on stone studio table representing enterprise advisory',
    categories: ['Technical Consulting'],
    tags: ['strategy', 'compliance', 'soc2', 'audit', 'governance', 'roadmap', 'consulting']
  },
  {
    id: 'security-devops-nodes',
    label: 'Zero-Trust Gateway Topology',
    url: '/src/assets/images/cover_security_devops_1795220240902.jpg',
    altTemplate: 'Modular encrypted gateway nodes and glass security cubes representing zero-trust API infrastructure',
    categories: ['Cloud Infrastructure', 'Technical Consulting', 'Custom Software'],
    tags: ['security', 'rbac', 'zero-trust', 'waf', 'vault', 'auth', 'ssl', 'tls', 'cloudflare']
  },
  {
    id: 'data-telemetry-planes',
    label: 'Search & Telemetry Refractors',
    url: '/src/assets/images/cover_data_analytics_1795220240573.jpg',
    altTemplate: 'Layered optical acrylic planes refracting telemetry beams representing real-time analytics and SEO pipelines',
    categories: ['ML Automation', 'AI Integration', 'Cloud Infrastructure'],
    tags: ['analytics', 'seo', 'geo', 'search', 'ga4', 'gtm', 'telemetry', 'observability', 'metrics']
  },
  {
    id: 'growth-trends-workspace',
    label: 'Growth & Product Launch Studio',
    url: '/src/assets/images/cover_trend_social_1795220240530.jpg',
    altTemplate: 'Clean product launch and analytics workstation in morning daylight for growth engineering workflows',
    categories: ['Custom Software', 'AI Integration', 'Technical Consulting'],
    tags: ['trends', 'growth', 'marketing', 'demo', 'conversion', 'saas', 'social']
  }
];

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks a topic-aligned, non-repeating cover visual so newly generated or drafted
 * articles and insights never default to the exact same cover picture.
 */
export function pickUniqueCoverForArticle(params: {
  title: string;
  category?: ServiceCategory | string;
  keyword?: string;
  usedCovers?: string[];
  excludeUrls?: string[];
}): { url: string; alt: string; label: string } {
  const combined = `${params.title} ${params.keyword || ''} ${params.category || ''}`.toLowerCase();
  const excluded = new Set([...(params.excludeUrls || [])]);

  const usageCount = new Map<string, number>();
  for (const preset of EDITORIAL_COVER_POOL) {
    usageCount.set(preset.url, 0);
  }
  for (const used of params.usedCovers || []) {
    if (usageCount.has(used)) {
      usageCount.set(used, (usageCount.get(used) || 0) + 1);
    }
  }

  const scored = EDITORIAL_COVER_POOL.filter((p) => !excluded.has(p.url)).map((preset) => {
    let score = 0;
    if (params.category && preset.categories.includes(params.category as ServiceCategory)) {
      score += 40;
    }
    for (const tag of preset.tags) {
      if (combined.includes(tag)) score += 15;
    }
    const uses = usageCount.get(preset.url) || 0;
    score -= uses * 55;
    // Small deterministic tie-breaker per article title so distinct titles spread naturally
    const tie = stableHash(`${params.title}|${preset.id}`) % 11;
    return { preset, score: score + tie };
  });

  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0]?.preset || EDITORIAL_COVER_POOL[0];
  const cleanTitle = params.title.trim();
  return {
    url: chosen.url,
    alt: cleanTitle ? `${cleanTitle} — ${chosen.label}` : chosen.altTemplate,
    label: chosen.label
  };
}

export function pickDistinctSocialCover(
  channel: 'facebook' | 'tiktok',
  topicTitle: string,
  excludeUrls: string[] = []
): string {
  const picked = pickUniqueCoverForArticle({
    title: `${channel}:${topicTitle}`,
    keyword: channel === 'facebook' ? 'growth social saas' : 'trends ai automation',
    excludeUrls
  });
  return picked.url;
}
