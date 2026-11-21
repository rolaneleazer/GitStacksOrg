import type { PageContentConfig, PageKey } from './types.ts';

export const STUDIO_IMAGE_LIBRARY = [
  {
    label: 'GitStack Architecture Studio',
    url: '/src/assets/images/hero_gitstack_architecture_1794645171609.jpg',
    defaultAlt:
      'GitStack engineers collaborating on AI systems architecture in a sunlit glass engineering studio'
  },
  {
    label: 'Modular AI & MLOps Pipeline',
    url: '/src/assets/images/ai_ml_pipeline_visual_1794645170877.jpg',
    defaultAlt:
      'Modular AI integration and machine learning automation pipeline architecture diagram'
  },
  {
    label: 'Cloud Infrastructure Desk',
    url: '/src/assets/images/cloud_infra_architecture_1794645172181.jpg',
    defaultAlt: 'Cloud infrastructure systems architect workstation'
  },
  {
    label: 'Optical Prism (AI & Systems)',
    url: '/src/assets/images/insight_cover_ai_agents_1794645171607.jpg',
    defaultAlt:
      'Geometric optical glass prisms refracting cobalt blue light on a white studio surface'
  }
];

export const DEFAULT_PAGE_CONTENTS: Record<PageKey, PageContentConfig> = {
  home: {
    page_key: 'home',
    hero_kicker: 'Software · Cloud · AI Integration · ML Automation',
    hero_title: 'Production AI, Machine Learning, and Cloud Systems Built for Scale',
    hero_subtitle:
      'GitStack engineers custom software, resilient cloud infrastructure, and technical architecture—now expanded with deterministic AI integration and automated MLOps pipelines that turn enterprise data into measurable operational speed.',
    hero_cta_label: 'Schedule Discovery Call',
    hero_image: '/src/assets/images/hero_gitstack_architecture_1794645171609.jpg',
    hero_image_alt:
      'GitStack engineers collaborating on AI systems architecture in a sunlit glass engineering studio',
    secondary_image: '/src/assets/images/ai_ml_pipeline_visual_1794645170877.jpg',
    secondary_image_alt:
      'Modular AI integration and machine learning automation pipeline architecture diagram',
    intro_heading: 'Five Integrated Engineering Practices Under One Roof',
    intro_body:
      'Explore how GitStack connects AI integration, MLOps automation, custom TypeScript systems, cloud governance, and principal technical advisory.',
    custom_blocks: [],
    updated_at: '2026-11-14T00:00:00Z'
  },
  services: {
    page_key: 'services',
    hero_kicker: 'Capabilities & Engagement Models',
    hero_title: 'Engineering Systems Designed for Reliability, Intelligence, and Scale',
    hero_subtitle:
      'GitStack pairs senior software and cloud platform engineering with production AI integration and automated machine learning operations.',
    hero_cta_label: 'Request a Technical Proposal',
    hero_image: '',
    hero_image_alt: '',
    secondary_image: '',
    secondary_image_alt: '',
    intro_heading: 'Want to inspect our engineering architecture standards first?',
    intro_body: 'Read our deep-dive implementation blueprints in the Technical Insights Journal.',
    custom_blocks: [],
    updated_at: '2026-11-14T00:00:00Z'
  },
  about: {
    page_key: 'about',
    hero_kicker: 'Company & Engineering Credentials',
    hero_title: 'About GitStack',
    hero_subtitle:
      'GitStack Technologies Inc. is an independent software engineering, cloud infrastructure management, and AI/ML solutions consultancy headquartered in San Francisco with distributed engineering teams across North America, Europe, and Asia-Pacific.',
    hero_cta_label: 'Contact Our Engineering Team',
    hero_image: '',
    hero_image_alt: '',
    secondary_image: '',
    secondary_image_alt: '',
    intro_heading: 'From Core Software & Cloud Foundations to Production AI',
    intro_body:
      'Founded by systems architects and cloud reliability engineers, GitStack originally focused on custom software development, enterprise system modernization, and multi-region cloud infrastructure governance. As enterprise demand shifted from isolated AI prototypes to production-hardened intelligence, we expanded our practice with dedicated AI Integration and Machine Learning Automation (MLOps) capabilities.',
    custom_blocks: [],
    updated_at: '2026-11-14T00:00:00Z'
  },
  contact: {
    page_key: 'contact',
    hero_kicker: 'Direct Contact',
    hero_title: 'Speak With a GitStack Principal Architect',
    hero_subtitle:
      'Whether you are scoping an enterprise AI integration, automating MLOps pipelines, or modernizing cloud infrastructure, our engineering leads respond within one business day.',
    hero_cta_label: 'Submit Project Brief',
    hero_image: '',
    hero_image_alt: '',
    secondary_image: '',
    secondary_image_alt: '',
    intro_heading: 'New Project Inquiries & Consultation Hours',
    intro_body:
      '548 Market Street, Suite 42010, San Francisco, CA 94104 · Mon–Fri 08:00–18:00 PT · Direct response within one business day.',
    contact_phone_label: 'Direct Phone & Consultation Line',
    contact_phone: '+1 (415) 890-4210',
    contact_sales_label: 'New Project Inquiries',
    contact_sales_email: 'contact@git-stack.org',
    contact_editorial_label: 'Editorial & Press',
    contact_editorial_email: 'editorial@git-stack.org',
    contact_privacy_label: 'Privacy & Compliance',
    contact_privacy_email: 'privacy@git-stack.org',
    custom_blocks: [],
    updated_at: '2026-11-14T00:00:00Z'
  }
};

export interface PageIntegrityResult {
  valid: boolean;
  issues: string[];
  wordCount: number;
}

export function validatePageContentForAdSense(config: PageContentConfig): PageIntegrityResult {
  const issues: string[] = [];

  if (config.hero_title.trim().length < 10) {
    issues.push('Primary H1 headline must be at least 10 characters for SEO clarity.');
  }
  if (config.hero_subtitle.trim().length < 40) {
    issues.push('Hero overview copy must be at least 40 characters to avoid thin-content signals.');
  }
  if (config.hero_image.trim() && config.hero_image_alt.trim().length < 8) {
    issues.push('Primary image requires descriptive alt text (at least 8 characters).');
  }
  if (config.secondary_image.trim() && config.secondary_image_alt.trim().length < 8) {
    issues.push('Secondary image requires descriptive alt text (at least 8 characters).');
  }

  for (let i = 0; i < config.custom_blocks.length; i++) {
    const block = config.custom_blocks[i];
    if (!block.visible) continue;
    if (block.heading.trim().length < 4) {
      issues.push(`Added section #${i + 1} needs a clear heading (min 4 characters).`);
    }
    if (block.body.trim().length < 30) {
      issues.push(
        `Added section "${block.heading || `#${i + 1}`}" needs at least 30 characters of substantive copy to protect AdSense content quality.`
      );
    }
    if (block.image_url.trim() && block.image_alt.trim().length < 8) {
      issues.push(
        `Added section "${block.heading || `#${i + 1}`}" image requires descriptive alt text (min 8 characters).`
      );
    }
  }

  const combinedText = [
    config.hero_title,
    config.hero_subtitle,
    config.intro_heading,
    config.intro_body,
    config.contact_phone_label || '',
    config.contact_phone || '',
    config.contact_sales_label || '',
    config.contact_sales_email || '',
    config.contact_editorial_label || '',
    config.contact_editorial_email || '',
    config.contact_privacy_label || '',
    config.contact_privacy_email || '',
    ...config.custom_blocks.filter((b) => b.visible).map((b) => `${b.heading} ${b.body}`)
  ]
    .join(' ')
    .trim();

  const wordCount = combinedText ? combinedText.split(/\s+/).length : 0;
  if (wordCount < 25) {
    issues.push('Total visible copy across this page must be at least 25 words.');
  }

  return {
    valid: issues.length === 0,
    issues,
    wordCount
  };
}
