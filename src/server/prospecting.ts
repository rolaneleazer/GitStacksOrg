import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import type {
  CrmFollowUpStep,
  CrmLead,
  DiscoveredProspectCandidate,
  EmailVerificationStatus,
  OpenSourceSyncTrack,
  ServiceCategory
} from '../shared/types.ts';
import { resolveIntegrationSecret } from './vault.ts';

async function getGeminiClient(userToken?: string): Promise<GoogleGenAI | null> {
  const apiKey = await resolveIntegrationSecret('gemini', userToken);
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function normalizeDomain(input: string): string {
  const clean = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
  if (!clean.includes('.') || clean.includes(' ')) return '';
  return clean;
}

function extractDomainFromEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at === -1) return '';
  return email.slice(at + 1).trim().toLowerCase();
}

const mxCache = new Map<string, boolean>();

export async function verifyEmailMxDomain(email: string): Promise<boolean> {
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 2500))
    ]);
    const hasMx = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, hasMx);
    return hasMx;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

function isUsefulBusinessEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (
    lower.includes('noreply') ||
    lower.includes('no-reply') ||
    lower.includes('example.com') ||
    lower.includes('sentry.io') ||
    lower.includes('wixpress.com') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.css') ||
    lower.endsWith('.js')
  ) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,12}$/i.test(lower);
}

interface ScrapedWebsiteSignals {
  url: string;
  domain: string;
  title: string;
  description: string;
  emails: string[];
  techSignals: string[];
  sourceUrls: string[];
}

const TECH_PATTERNS: [RegExp, string][] = [
  [/kubernetes|k8s/i, 'Kubernetes'],
  [/terraform/i, 'Terraform'],
  [/pytorch|tensorflow|scikit/i, 'PyTorch / ML'],
  [/openai|llm|langchain|rag|vector/i, 'AI / LLM'],
  [/next\.js|react/i, 'React / Next.js'],
  [/typescript/i, 'TypeScript'],
  [/aws|amazon web services|cloudfront|lambda/i, 'AWS'],
  [/google cloud|gcp|bigquery/i, 'GCP'],
  [/postgres|supabase/i, 'PostgreSQL'],
  [/docker|container/i, 'Docker']
];

async function fetchTextSafe(url: string, timeoutMs = 4200): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GitStack-OpenSource-Researcher/1.0 (+https://gitstack.io)'
      }
    });
    if (!res.ok) return '';
    const text = await res.text();
    return text.slice(0, 120_000);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export async function scrapePublicWebsite(domainOrUrl: string): Promise<ScrapedWebsiteSignals> {
  const domain = normalizeDomain(domainOrUrl);
  if (!domain) {
    return {
      url: '',
      domain: '',
      title: '',
      description: '',
      emails: [],
      techSignals: [],
      sourceUrls: []
    };
  }

  const baseUrl = `https://${domain}`;
  const paths = ['', '/contact', '/about', '/team', '/.well-known/security.txt'];
  const emailSet = new Set<string>();
  const techSet = new Set<string>();
  const visited: string[] = [];
  let title = domain;
  let description = '';

  const pages = await Promise.all(
    paths.map(async (p) => {
      const target = `${baseUrl}${p}`;
      const html = await fetchTextSafe(target);
      return { target, html };
    })
  );

  for (const { target, html } of pages) {
    if (!html) continue;
    visited.push(target);

    if (target === baseUrl) {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch?.[1]) title = titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 120);
      const descMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      );
      if (descMatch?.[1]) description = descMatch[1].trim().slice(0, 300);
    }

    const mailtoMatches = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12})/gi) || [];
    for (const m of mailtoMatches) {
      const addr = m.replace(/^mailto:/i, '').trim().toLowerCase();
      if (isUsefulBusinessEmail(addr)) emailSet.add(addr);
    }

    const rawMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g) || [];
    for (const r of rawMatches) {
      const addr = r.trim().toLowerCase();
      if (isUsefulBusinessEmail(addr)) emailSet.add(addr);
    }

    for (const [rx, label] of TECH_PATTERNS) {
      if (rx.test(html)) techSet.add(label);
    }
  }

  return {
    url: baseUrl,
    domain,
    title,
    description,
    emails: Array.from(emailSet).slice(0, 8),
    techSignals: Array.from(techSet).slice(0, 8),
    sourceUrls: visited
  };
}

interface GitHubRepoSearchItem {
  full_name: string;
  html_url: string;
  description: string | null;
  homepage?: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  owner: { login: string; type: string; html_url: string };
}

interface GitHubUserDetail {
  login: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  email: string | null;
  bio: string | null;
  html_url: string;
  public_repos: number;
}

async function fetchGitHubJson<T>(url: string, userToken?: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const ghToken = await resolveIntegrationSecret('github', userToken);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GitStack-CRM-Prospecting/1.0',
        ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {})
      }
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverOpenSourceLeads(
  query: string,
  mode: 'auto' | 'github' | 'website' = 'auto',
  userToken?: string
): Promise<{
  candidates: DiscoveredProspectCandidate[];
  sourcesChecked: string[];
}> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { candidates: [], sourcesChecked: [] };

  const candidates: DiscoveredProspectCandidate[] = [];
  const sourcesChecked: string[] = [];
  const maybeDomain = normalizeDomain(cleanQuery);

  // 1. Direct Domain / Company Website Open-Source Scrape + MX Verification
  if (maybeDomain && (mode === 'auto' || mode === 'website')) {
    sourcesChecked.push(`https://${maybeDomain}`);
    const web = await scrapePublicWebsite(maybeDomain);
    const hasMx = await verifyEmailMxDomain(`contact@${maybeDomain}`);
    const foundEmails = web.emails.length > 0 ? web.emails : [`contact@${maybeDomain}`];

    for (const email of foundEmails.slice(0, 4)) {
      const mxOk = email.endsWith(maybeDomain) ? hasMx : await verifyEmailMxDomain(email);
      const localPart = email.split('@')[0];
      const guessedName = localPart
        .split(/[._-]/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
      const isGenericBox = /^(contact|hello|info|team|sales|support|security|hi)$/i.test(localPart);

      candidates.push({
        id: `cand-${crypto.randomUUID().slice(0, 8)}`,
        contact_name: isGenericBox ? `${maybeDomain} Team` : guessedName || maybeDomain,
        role_title: isGenericBox ? 'Engineering & Partnerships Desk' : 'Team Contact',
        email,
        email_status: web.emails.includes(email)
          ? mxOk
            ? 'verified_mx'
            : 'public_found'
          : mxOk
            ? 'inferred'
            : 'invalid',
        company_name: web.title.split('|')[0].split('—')[0].trim() || maybeDomain,
        company_domain: maybeDomain,
        website_url: web.url,
        github_url: '',
        source_type: 'website',
        source_urls: web.sourceUrls.length > 0 ? web.sourceUrls : [web.url],
        tech_stack: web.techSignals,
        fit_score: Math.min(96, 62 + web.techSignals.length * 6 + (mxOk ? 12 : 0)),
        snippet:
          web.description ||
          `Public company domain discovered via ${web.sourceUrls.length || 1} web endpoint(s).`
      });
    }
  }

  // 2. Public GitHub Repository & User/Org Discovery
  if (mode === 'auto' || mode === 'github') {
    const ghQuery = maybeDomain ? maybeDomain.split('.')[0] : cleanQuery;
    const repoSearch = await fetchGitHubJson<{ items?: GitHubRepoSearchItem[] }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(ghQuery)}&sort=stars&per_page=5`,
      userToken
    );

    if (repoSearch?.items?.length) {
      sourcesChecked.push(`https://api.github.com/search/repositories?q=${encodeURIComponent(ghQuery)}`);
      const uniqueLogins = Array.from(new Set(repoSearch.items.map((r) => r.owner.login))).slice(0, 5);

      const userDetails = await Promise.all(
        uniqueLogins.map(async (login) => {
          const detail = await fetchGitHubJson<GitHubUserDetail>(
            `https://api.github.com/users/${encodeURIComponent(login)}`,
            userToken
          );
          const repo = repoSearch.items!.find((r) => r.owner.login === login);
          return { detail, repo };
        })
      );

      for (const { detail, repo } of userDetails) {
        if (!detail) continue;
        const blogDomain = normalizeDomain(detail.blog || '');
        const webSignals = blogDomain ? await scrapePublicWebsite(blogDomain) : null;

        let chosenEmail = detail.email?.trim().toLowerCase() || '';
        let emailStatus: EmailVerificationStatus = 'inferred';

        if (chosenEmail && isUsefulBusinessEmail(chosenEmail)) {
          const mx = await verifyEmailMxDomain(chosenEmail);
          emailStatus = mx ? 'verified_mx' : 'public_found';
        } else if (webSignals && webSignals.emails.length > 0) {
          chosenEmail = webSignals.emails[0];
          const mx = await verifyEmailMxDomain(chosenEmail);
          emailStatus = mx ? 'verified_mx' : 'public_found';
        } else if (blogDomain) {
          chosenEmail = `hello@${blogDomain}`;
          const mx = await verifyEmailMxDomain(chosenEmail);
          emailStatus = mx ? 'inferred' : 'invalid';
        }

        const techSet = new Set<string>(webSignals?.techSignals || []);
        if (repo?.language) techSet.add(repo.language);

        candidates.push({
          id: `cand-${crypto.randomUUID().slice(0, 8)}`,
          contact_name: detail.name || detail.login,
          role_title: detail.company ? `Lead / Maintainer at ${detail.company}` : 'Open-Source Maintainer',
          email: chosenEmail,
          email_status: chosenEmail ? emailStatus : 'invalid',
          company_name: (detail.company || '').replace(/^@/, '') || detail.name || detail.login,
          company_domain: blogDomain || extractDomainFromEmail(chosenEmail),
          website_url: webSignals?.url || (blogDomain ? `https://${blogDomain}` : ''),
          github_url: detail.html_url,
          source_type: 'github',
          source_urls: [
            detail.html_url,
            ...(repo ? [repo.html_url] : []),
            ...(webSignals?.sourceUrls || [])
          ],
          tech_stack: Array.from(techSet).slice(0, 6),
          fit_score: Math.min(
            95,
            58 +
              (chosenEmail ? 15 : 0) +
              (emailStatus === 'verified_mx' ? 12 : 0) +
              (repo && repo.stargazers_count > 100 ? 8 : 3)
          ),
          snippet:
            detail.bio ||
            repo?.description ||
            `GitHub organization/maintainer (${detail.public_repos} public repos).`
        });
      }
    }
  }

  // 3. Optional Server-Side Gemini Search Grounding Fallback if sparse results
  const ai = await getGeminiClient(userToken);
  if (ai && candidates.length < 2 && mode !== 'github') {
    try {
      const searchResp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Identify up to 3 real companies or engineering leaders matching "${cleanQuery}" along with their official public website domain, engineering leadership role, likely open-source/cloud stack, and publicly listed contact email if available. Do not invent fake personal emails; if unknown, leave email blank and provide the verified company domain.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const groundingChunks =
        searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundedUrls = groundingChunks
        .map((c) => c.web?.uri)
        .filter((u): u is string => Boolean(u))
        .slice(0, 5);
      if (groundedUrls.length > 0) sourcesChecked.push(...groundedUrls);

      const parseResp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract structured B2B prospect leads from these research notes:\n\n${searchResp.text || ''}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                contact_name: { type: Type.STRING },
                role_title: { type: Type.STRING },
                company_name: { type: Type.STRING },
                company_domain: { type: Type.STRING },
                email: { type: Type.STRING },
                tech_stack: { type: Type.ARRAY, items: { type: Type.STRING } },
                snippet: { type: Type.STRING }
              }
            }
          }
        }
      });

      const parsed = JSON.parse((parseResp.text || '[]').trim()) as {
        contact_name?: string;
        role_title?: string;
        company_name?: string;
        company_domain?: string;
        email?: string;
        tech_stack?: string[];
        snippet?: string;
      }[];

      for (const item of parsed.slice(0, 4)) {
        const domain = normalizeDomain(item.company_domain || '');
        if (!item.company_name) continue;
        const email =
          item.email && isUsefulBusinessEmail(item.email)
            ? item.email.toLowerCase()
            : domain
              ? `contact@${domain}`
              : '';
        const mxOk = email ? await verifyEmailMxDomain(email) : false;

        candidates.push({
          id: `cand-${crypto.randomUUID().slice(0, 8)}`,
          contact_name: item.contact_name || `${item.company_name} Engineering`,
          role_title: item.role_title || 'Engineering Leadership',
          email,
          email_status:
            item.email && isUsefulBusinessEmail(item.email)
              ? mxOk
                ? 'verified_mx'
                : 'public_found'
              : mxOk
                ? 'inferred'
                : 'invalid',
          company_name: item.company_name,
          company_domain: domain,
          website_url: domain ? `https://${domain}` : '',
          github_url: '',
          source_type: 'gemini_search',
          source_urls: groundedUrls.length > 0 ? groundedUrls : domain ? [`https://${domain}`] : [],
          tech_stack: Array.isArray(item.tech_stack) ? item.tech_stack.slice(0, 5) : [],
          fit_score: mxOk ? 82 : 68,
          snippet: item.snippet || 'Identified via Gemini public web search grounding.'
        });
      }
    } catch {
      // keep existing GitHub & website scraper candidates cleanly
    }
  }

  // Deduplicate by (email || company_name)
  const seen = new Set<string>();
  const deduped = candidates.filter((c) => {
    const key = (c.email || c.company_domain || c.company_name).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    candidates: deduped.slice(0, 12),
    sourcesChecked: Array.from(new Set(sourcesChecked))
  };
}

export async function runProspectResearchAndProposal(
  lead: CrmLead,
  userToken?: string
): Promise<{
  research_brief: string;
  recommended_service: ServiceCategory;
  fit_score: number;
  deal_value: number;
  tech_stack: string[];
  proposal_subject: string;
  proposal_body: string;
  follow_up_sequence: CrmFollowUpStep[];
  source_urls: string[];
}> {
  const domain = normalizeDomain(lead.website_url || lead.company_domain || '');
  const web = domain ? await scrapePublicWebsite(domain) : null;

  let ghBio = '';
  const ghMatch = lead.github_url.match(/github\.com\/([^/]+)/i);
  if (ghMatch?.[1]) {
    const detail = await fetchGitHubJson<GitHubUserDetail>(
      `https://api.github.com/users/${encodeURIComponent(ghMatch[1])}`,
      userToken
    );
    if (detail) {
      ghBio = `GitHub Profile: ${detail.login}, Public Repos: ${detail.public_repos}, Bio: ${detail.bio || 'N/A'}`;
    }
  }

  const mergedTech = Array.from(
    new Set([...(lead.tech_stack || []), ...(web?.techSignals || [])])
  ).slice(0, 8);
  const mergedSources = Array.from(
    new Set([...(lead.source_urls || []), ...(web?.sourceUrls || [])])
  ).slice(0, 8);

  const ai = await getGeminiClient(userToken);
  if (ai) {
    try {
      const prompt = [
        `You are Scout, GitStack's Principal Solutions Architect & Enterprise Sales Researcher.`,
        `GitStack offers 5 core services: AI Integration, ML Automation, Cloud Infrastructure, Custom Software, and Technical Consulting.`,
        `Research this prospect using the verified public signals below and draft a high-converting executive proposal plus a 3-step follow-up cadence:`,
        ``,
        `Prospect Name: ${lead.contact_name}`,
        `Role: ${lead.role_title || 'Technology Leader'}`,
        `Company: ${lead.company_name}`,
        `Domain/Website: ${web?.url || lead.website_url || 'N/A'}`,
        `Website Title: ${web?.title || 'N/A'}`,
        `Website Summary: ${web?.description || 'N/A'}`,
        `GitHub Context: ${ghBio || lead.github_url || 'N/A'}`,
        `Detected Tech Stack: ${mergedTech.join(', ') || 'Cloud & Modern Web'}`,
        `Existing Notes: ${lead.research_brief || 'Initial discovery'}`
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Keep email outreach concise, concrete, non-pushy, under 190 words for the initial proposal, with specific architectural observations rather than generic fluff.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              research_brief: { type: Type.STRING },
              recommended_service: {
                type: Type.STRING,
                description:
                  'One of: AI Integration, ML Automation, Cloud Infrastructure, Custom Software, Technical Consulting'
              },
              fit_score: { type: Type.INTEGER },
              deal_value: { type: Type.INTEGER },
              tech_stack: { type: Type.ARRAY, items: { type: Type.STRING } },
              proposal_subject: { type: Type.STRING },
              proposal_body: { type: Type.STRING },
              follow_ups: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    delay_days: { type: Type.INTEGER },
                    subject: { type: Type.STRING },
                    body: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as {
        research_brief?: string;
        recommended_service?: string;
        fit_score?: number;
        deal_value?: number;
        tech_stack?: string[];
        proposal_subject?: string;
        proposal_body?: string;
        follow_ups?: { delay_days?: number; subject?: string; body?: string }[];
      };

      const validServices: ServiceCategory[] = [
        'AI Integration',
        'ML Automation',
        'Cloud Infrastructure',
        'Custom Software',
        'Technical Consulting'
      ];
      const service = validServices.includes(parsed.recommended_service as ServiceCategory)
        ? (parsed.recommended_service as ServiceCategory)
        : lead.recommended_service || 'AI Integration';

      const sequence: CrmFollowUpStep[] = (parsed.follow_ups || []).slice(0, 3).map((step, i) => ({
        step_number: i + 1,
        delay_days: Number(step.delay_days) || [3, 7, 14][i],
        subject: step.subject || `Re: ${parsed.proposal_subject || `${lead.company_name} architecture note`}`,
        body: step.body || `Following up on our proposal for ${lead.company_name}.`,
        sent_at: null
      }));

      if (parsed.proposal_subject && parsed.proposal_body) {
        return {
          research_brief:
            parsed.research_brief ||
            `Evaluated ${lead.company_name} (${mergedTech.join(', ') || 'Enterprise stack'}) for ${service}.`,
          recommended_service: service,
          fit_score: Math.max(40, Math.min(99, Number(parsed.fit_score) || lead.fit_score || 82)),
          deal_value: Math.max(5000, Number(parsed.deal_value) || lead.deal_value || 35000),
          tech_stack:
            Array.isArray(parsed.tech_stack) && parsed.tech_stack.length > 0
              ? parsed.tech_stack.slice(0, 8)
              : mergedTech,
          proposal_subject: parsed.proposal_subject,
          proposal_body: parsed.proposal_body,
          follow_up_sequence:
            sequence.length > 0 ? sequence : buildDefaultFollowUps(lead.contact_name, lead.company_name, service),
          source_urls: mergedSources
        };
      }
    } catch {
      // fall back deterministically below if Gemini API returns transient error
    }
  }

  // Deterministic high-precision proposal fallback
  const fallbackService: ServiceCategory = mergedTech.some((t) => /AI|PyTorch|LLM/i.test(t))
    ? 'AI Integration'
    : mergedTech.some((t) => /Kubernetes|Terraform|AWS|GCP/i.test(t))
      ? 'Cloud Infrastructure'
      : lead.recommended_service || 'Custom Software';

  const firstName = lead.contact_name.split(' ')[0] || 'there';
  const subject = `${lead.company_name} · ${fallbackService} & Production Reliability Proposal`;
  const brief = [
    `Company: ${lead.company_name} (${domain || 'no domain verified'})`,
    web?.description ? `Public Positioning: ${web.description}` : '',
    ghBio ? ghBio : '',
    `Detected Stack: ${mergedTech.length > 0 ? mergedTech.join(', ') : 'Modern Cloud & Web'}`
  ]
    .filter(Boolean)
    .join('\n');

  const body = [
    `Hi ${firstName},`,
    '',
    `I reviewed ${lead.company_name}'s public architecture footprint${
      mergedTech.length > 0 ? ` (${mergedTech.slice(0, 3).join(', ')})` : ''
    } and wanted to share a focused proposal from GitStack.`,
    '',
    `Our principal engineers partner with teams scaling ${fallbackService} systems to reduce deployment friction, harden security & governance boundaries, and deliver measurable reliability gains within 30 days.`,
    '',
    `Proposal Scope for ${lead.company_name}:`,
    `1. 2-Week Architecture & Bottleneck Audit across your ${fallbackService} workflow`,
    `2. Production Blueprint with cost, latency, and guardrail targets`,
    `3. Hands-on implementation sprint alongside your internal team`,
    '',
    `Would you be open to a brief 20-minute technical walkthrough this week?`,
    '',
    `Best regards,`,
    `GitStack Solutions Team`,
    `https://gitstack.io`
  ].join('\n');

  return {
    research_brief: brief,
    recommended_service: fallbackService,
    fit_score: Math.max(lead.fit_score || 75, mergedTech.length > 0 ? 84 : 74),
    deal_value: lead.deal_value || 35000,
    tech_stack: mergedTech,
    proposal_subject: subject,
    proposal_body: body,
    follow_up_sequence: buildDefaultFollowUps(lead.contact_name, lead.company_name, fallbackService),
    source_urls: mergedSources
  };
}

function buildDefaultFollowUps(
  contactName: string,
  companyName: string,
  service: ServiceCategory
): CrmFollowUpStep[] {
  const firstName = contactName.split(' ')[0] || 'there';
  return [
    {
      step_number: 1,
      delay_days: 3,
      subject: `Re: ${companyName} · ${service} & Production Reliability Proposal`,
      body: `Hi ${firstName},\n\nWanted to briefly bump our ${service} architecture note for ${companyName}. Happy to share a sample 2-week sprint roadmap if useful for your Q2 planning.\n\nBest,\nGitStack`,
      sent_at: null
    },
    {
      step_number: 2,
      delay_days: 7,
      subject: `${companyName} Technical Benchmark & Readiness Checklist`,
      body: `Hi ${firstName},\n\nWe put together a concise readiness checklist for ${service} teams looking to cut infrastructure overhead while tightening observability. Let me know if you would like a tailored teardown for ${companyName}.\n\nBest,\nGitStack`,
      sent_at: null
    },
    {
      step_number: 3,
      delay_days: 14,
      subject: `Closing the loop — ${companyName} x GitStack`,
      body: `Hi ${firstName},\n\nI won't crowd your inbox further—if ${service} priorities open up at ${companyName} next quarter, feel free to reply anytime.\n\nBest regards,\nGitStack`,
      sent_at: null
    }
  ];
}

const TRENDING_TRACK_CONFIG: Record<
  Exclude<OpenSourceSyncTrack, 'all'>,
  {
    label: string;
    service: ServiceCategory;
    queries: string[];
    fallbackDomains: { login: string; company: string; domain: string; role: string; stack: string[] }[];
  }
> = {
  ai: {
    label: 'Trending AI & LLM Repos',
    service: 'AI Integration',
    queries: ['topic:ai-agents stars:>500', 'topic:llm OR topic:rag stars:>1000'],
    fallbackDomains: [
      { login: 'langchain-ai', company: 'LangChain', domain: 'langchain.com', role: 'AI Engineering Team', stack: ['AI / LLM', 'Python', 'TypeScript'] },
      { login: 'pydantic', company: 'Pydantic', domain: 'pydantic.dev', role: 'Platform & AI Tooling', stack: ['AI / LLM', 'Python', 'Observability'] },
      { login: 'crewAIInc', company: 'CrewAI', domain: 'crewai.com', role: 'Agent Orchestration Team', stack: ['AI / LLM', 'Multi-Agent', 'Python'] },
      { login: 'qdrant', company: 'Qdrant', domain: 'qdrant.tech', role: 'Vector Engine Engineering', stack: ['AI / LLM', 'Rust', 'Vector DB'] }
    ]
  },
  cloud: {
    label: 'Trending Cloud & Infra Repos',
    service: 'Cloud Infrastructure',
    queries: ['topic:kubernetes OR topic:terraform stars:>1000', 'topic:observability OR topic:devops stars:>500'],
    fallbackDomains: [
      { login: 'grafana', company: 'Grafana Labs', domain: 'grafana.com', role: 'Cloud Observability Team', stack: ['Kubernetes', 'Observability', 'Go'] },
      { login: 'dagger', company: 'Dagger', domain: 'dagger.io', role: 'CI/CD Infrastructure Team', stack: ['Docker', 'Kubernetes', 'Go'] },
      { login: 'hashicorp', company: 'HashiCorp', domain: 'hashicorp.com', role: 'Infrastructure Automation', stack: ['Terraform', 'AWS', 'Cloud'] },
      { login: 'cilium', company: 'Isovalent / Cilium', domain: 'cilium.io', role: 'Cloud Networking Team', stack: ['Kubernetes', 'eBPF', 'Cloud'] }
    ]
  },
  devtools: {
    label: 'Trending DevTools & SaaS Repos',
    service: 'Custom Software',
    queries: ['topic:developer-tools stars:>1200', 'topic:typescript OR topic:postgres stars:>1500'],
    fallbackDomains: [
      { login: 'supabase', company: 'Supabase', domain: 'supabase.com', role: 'Developer Platform Team', stack: ['PostgreSQL', 'TypeScript', 'React / Next.js'] },
      { login: 'posthog', company: 'PostHog', domain: 'posthog.com', role: 'Product Analytics Engineering', stack: ['TypeScript', 'PostgreSQL', 'Python'] },
      { login: 'triggerdotdev', company: 'Trigger.dev', domain: 'trigger.dev', role: 'Background Jobs Infrastructure', stack: ['TypeScript', 'Node.js', 'Docker'] },
      { login: 'resend', company: 'Resend', domain: 'resend.com', role: 'Developer Email Platform', stack: ['TypeScript', 'React / Next.js', 'Cloud'] }
    ]
  }
};

function inferServiceFromSignals(
  stack: string[],
  defaultService: ServiceCategory
): ServiceCategory {
  if (stack.some((t) => /ai|llm|rag|pytorch|ml|vector|agent/i.test(t))) return 'AI Integration';
  if (stack.some((t) => /kubernetes|terraform|docker|aws|gcp|observability|ebpf/i.test(t))) {
    return 'Cloud Infrastructure';
  }
  return defaultService;
}

function isNonGenericWebsiteDomain(domain: string): boolean {
  if (!domain) return false;
  return !/^(github\.com|gist\.github\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|medium\.com|discord\.gg|npmjs\.com)$/i.test(
    domain
  );
}

export async function harvestTrendingOpenSourceLeads(
  track: OpenSourceSyncTrack = 'all',
  assignedUserId: string | null = null,
  userToken?: string
): Promise<{
  leads: CrmLead[];
  reposScanned: number;
  sourcesSynced: string[];
}> {
  const activeTracks: Exclude<OpenSourceSyncTrack, 'all'>[] =
    track === 'all' ? ['ai', 'cloud', 'devtools'] : [track];

  const searchJobs: { trackKey: Exclude<OpenSourceSyncTrack, 'all'>; query: string }[] = [];
  for (const tk of activeTracks) {
    const cfg = TRENDING_TRACK_CONFIG[tk];
    const queriesToRun = track === 'all' ? [cfg.queries[0]] : cfg.queries;
    for (const q of queriesToRun) {
      searchJobs.push({ trackKey: tk, query: q });
    }
  }

  const searchResponses = await Promise.all(
    searchJobs.map(async (job) => {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(job.query)}&sort=updated&per_page=7`;
      const data = await fetchGitHubJson<{ items?: GitHubRepoSearchItem[] }>(url, userToken);
      return { ...job, url, items: data?.items || [] };
    })
  );

  const sourcesSynced: string[] = [];
  let reposScanned = 0;
  const repoOwners = new Map<
    string,
    {
      login: string;
      repo: GitHubRepoSearchItem;
      trackKey: Exclude<OpenSourceSyncTrack, 'all'>;
    }
  >();

  for (const res of searchResponses) {
    if (res.items.length > 0) {
      sourcesSynced.push(TRENDING_TRACK_CONFIG[res.trackKey].label);
      reposScanned += res.items.length;
      for (const repo of res.items) {
        const key = repo.owner.login.toLowerCase();
        if (!repoOwners.has(key)) {
          repoOwners.set(key, { login: repo.owner.login, repo, trackKey: res.trackKey });
        }
      }
    }
  }

  const selectedEntries = Array.from(repoOwners.values()).slice(0, 14);
  const now = new Date().toISOString();
  const harvestedLeads: CrmLead[] = [];

  if (selectedEntries.length > 0) {
    const enrichedResults = await Promise.allSettled(
      selectedEntries.map(async ({ login, repo, trackKey }) => {
        const detail = await fetchGitHubJson<GitHubUserDetail>(
          `https://api.github.com/users/${encodeURIComponent(login)}`,
          userToken
        );
        const homepageDomain = normalizeDomain(repo.homepage || '');
        const blogDomain = normalizeDomain(detail?.blog || '');
        const chosenDomain = isNonGenericWebsiteDomain(homepageDomain)
          ? homepageDomain
          : isNonGenericWebsiteDomain(blogDomain)
            ? blogDomain
            : '';

        const webSignals = chosenDomain ? await scrapePublicWebsite(chosenDomain) : null;

        let chosenEmail = detail?.email?.trim().toLowerCase() || '';
        let emailStatus: EmailVerificationStatus = 'inferred';

        if (chosenEmail && isUsefulBusinessEmail(chosenEmail)) {
          const mx = await verifyEmailMxDomain(chosenEmail);
          emailStatus = mx ? 'verified_mx' : 'public_found';
        } else if (webSignals && webSignals.emails.length > 0) {
          chosenEmail = webSignals.emails[0];
          const mx = await verifyEmailMxDomain(chosenEmail);
          emailStatus = mx ? 'verified_mx' : 'public_found';
        } else if (chosenDomain) {
          chosenEmail = `contact@${chosenDomain}`;
          const mx = await verifyEmailMxDomain(chosenEmail);
          emailStatus = mx ? 'inferred' : 'invalid';
        }

        const techSet = new Set<string>(webSignals?.techSignals || []);
        if (repo.language) techSet.add(repo.language);
        for (const topic of (repo.topics || []).slice(0, 4)) {
          if (topic && topic.length <= 24) techSet.add(topic);
        }
        const techStack = Array.from(techSet).slice(0, 7);
        const defaultService = TRENDING_TRACK_CONFIG[trackKey].service;
        const recommendedService = inferServiceFromSignals(techStack, defaultService);
        const starsBonus = (repo.stargazers_count || 0) >= 5000 ? 12 : (repo.stargazers_count || 0) >= 1000 ? 8 : 4;
        const fitScore = Math.min(
          97,
          62 +
            starsBonus +
            (emailStatus === 'verified_mx' ? 14 : emailStatus === 'public_found' ? 10 : chosenEmail ? 5 : 0) +
            Math.min(10, techStack.length * 2)
        );
        const dealValue = fitScore >= 88 ? 55000 : fitScore >= 78 ? 38000 : 25000;

        const cleanCompany =
          (detail?.company || '').replace(/^@/, '').trim() ||
          detail?.name?.trim() ||
          repo.owner.login;
        const contactName =
          detail?.name?.trim() && detail.name.trim() !== cleanCompany
            ? detail.name.trim()
            : `${cleanCompany} Engineering`;

        const lead: CrmLead = {
          id: `crm-${crypto.randomUUID().slice(0, 8)}`,
          contact_name: contactName,
          role_title:
            detail?.company || chosenDomain
              ? `Maintainer · ${repo.full_name} (${(repo.stargazers_count || 0).toLocaleString()}★)`
              : `Open-Source Maintainer (${repo.full_name})`,
          email: chosenEmail,
          email_status: chosenEmail ? emailStatus : 'invalid',
          company_name: cleanCompany,
          company_domain: chosenDomain || extractDomainFromEmail(chosenEmail),
          website_url: webSignals?.url || (chosenDomain ? `https://${chosenDomain}` : ''),
          github_url: detail?.html_url || repo.owner.html_url,
          phone: '',
          location: '',
          rating: null,
          source_detail: TRENDING_TRACK_CONFIG[trackKey].label,
          source_type: 'github',
          source_urls: Array.from(
            new Set([
              repo.html_url,
              detail?.html_url || repo.owner.html_url,
              ...(webSignals?.sourceUrls || [])
            ])
          ).slice(0, 8),
          tech_stack: techStack,
          research_brief: [
            repo.description || detail?.bio || `Active open-source project ${repo.full_name}.`,
            `GitHub Repository: ${repo.full_name} (${(repo.stargazers_count || 0).toLocaleString()} stars)`
          ].join('\n'),
          recommended_service: recommendedService,
          fit_score: fitScore,
          deal_value: dealValue,
          stage: 'discovered',
          proposal_subject: '',
          proposal_body: '',
          follow_up_sequence: [],
          assigned_to: assignedUserId,
          last_contacted_at: null,
          next_followup_at: null,
          converted_inquiry_id: null,
          created_at: now,
          updated_at: now
        };
        return lead;
      })
    );
    for (const item of enrichedResults) {
      if (item.status === 'fulfilled' && item.value) {
        harvestedLeads.push(item.value);
      }
    }
  }

  // Fallback to live website + MX scraping of curated open-source leaders if GitHub Search is rate-limited
  if (harvestedLeads.length === 0) {
    const fallbackTargets = activeTracks.flatMap((tk) =>
      TRENDING_TRACK_CONFIG[tk].fallbackDomains.map((item) => ({
        ...item,
        service: TRENDING_TRACK_CONFIG[tk].service,
        trackLabel: TRENDING_TRACK_CONFIG[tk].label
      }))
    );
    reposScanned = fallbackTargets.length;
    for (const tk of activeTracks) {
      sourcesSynced.push(`${TRENDING_TRACK_CONFIG[tk].label} (Direct Org Scrape)`);
    }

    const fallbackResults = await Promise.allSettled(
      fallbackTargets.slice(0, 10).map(async (target) => {
        const webSignals = await scrapePublicWebsite(target.domain);
        const hasMx = await verifyEmailMxDomain(`contact@${target.domain}`);
        const email = webSignals.emails[0] || `contact@${target.domain}`;
        const mxOk = webSignals.emails[0] ? await verifyEmailMxDomain(email) : hasMx;
        const emailStatus: EmailVerificationStatus = webSignals.emails.length > 0
          ? mxOk
            ? 'verified_mx'
            : 'public_found'
          : mxOk
            ? 'inferred'
            : 'invalid';

        const techStack = Array.from(
          new Set([...target.stack, ...webSignals.techSignals])
        ).slice(0, 7);

        return {
          id: `crm-${crypto.randomUUID().slice(0, 8)}`,
          contact_name: `${target.company} Team`,
          role_title: target.role,
          email,
          email_status: emailStatus,
          company_name: target.company,
          company_domain: target.domain,
          website_url: `https://${target.domain}`,
          github_url: `https://github.com/${target.login}`,
          phone: '',
          location: '',
          rating: null,
          source_detail: `${target.trackLabel} (Direct Org Scrape)`,
          source_type: 'github' as const,
          source_urls: Array.from(
            new Set([`https://github.com/${target.login}`, ...webSignals.sourceUrls])
          ).slice(0, 8),
          tech_stack: techStack,
          research_brief:
            webSignals.description ||
            `Open-source ecosystem leader (${target.company}) synced via live public website & GitHub signals.`,
          recommended_service: target.service,
          fit_score: emailStatus === 'verified_mx' ? 88 : 79,
          deal_value: 40000,
          stage: 'discovered' as const,
          proposal_subject: '',
          proposal_body: '',
          follow_up_sequence: [],
          assigned_to: assignedUserId,
          last_contacted_at: null,
          next_followup_at: null,
          converted_inquiry_id: null,
          created_at: now,
          updated_at: now
        } satisfies CrmLead;
      })
    );
    for (const item of fallbackResults) {
      if (item.status === 'fulfilled' && item.value) {
        harvestedLeads.push(item.value);
      }
    }
  }

  return {
    leads: harvestedLeads,
    reposScanned,
    sourcesSynced: Array.from(new Set(sourcesSynced))
  };
}

