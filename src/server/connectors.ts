import crypto from 'node:crypto';
import type {
  ApolloCandidate,
  ApolloSearchFilters,
  CrmLead,
  CsvImportLeadInput,
  EmailVerificationStatus,
  GoogleMapsPlaceCandidate,
  ServiceCategory
} from '../shared/types.ts';
import {
  runProspectResearchAndProposal,
  scrapePublicWebsite,
  verifyEmailMxDomain
} from './prospecting.ts';
import { resolveIntegrationSecret } from './vault.ts';

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

function stripHtmlTags(html: string): string {
  return html
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractFirstBusinessEmail(text: string): string {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g) || [];
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (
      !lower.includes('noreply') &&
      !lower.includes('no-reply') &&
      !lower.includes('example.com') &&
      !lower.endsWith('.png') &&
      !lower.endsWith('.jpg')
    ) {
      return lower;
    }
  }
  return '';
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  return Array.from(
    new Set(
      matches.filter(
        (u) =>
          !/news\.ycombinator\.com|linkedin\.com|twitter\.com|x\.com|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com/i.test(
            u
          )
      )
    )
  );
}

const STACK_PATTERNS: [RegExp, string][] = [
  [/\breact\b|next\.js/i, 'React / Next.js'],
  [/typescript/i, 'TypeScript'],
  [/python/i, 'Python'],
  [/\brust\b/i, 'Rust'],
  [/\bgo\b|golang/i, 'Go'],
  [/kubernetes|k8s/i, 'Kubernetes'],
  [/terraform/i, 'Terraform'],
  [/\baws\b/i, 'AWS'],
  [/postgres|postgresql|supabase/i, 'PostgreSQL'],
  [/\bai\b|\bllm\b|openai|gemini|pytorch|ml/i, 'AI / LLM']
];

function detectStackFromText(text: string): string[] {
  const out: string[] = [];
  for (const [rx, label] of STACK_PATTERNS) {
    if (rx.test(text)) out.push(label);
  }
  return out.slice(0, 6);
}

function inferServiceFromStack(stack: string[], hint = ''): ServiceCategory {
  const combined = `${stack.join(' ')} ${hint}`;
  if (/ai|llm|ml|pytorch|openai|agent|rag/i.test(combined)) return 'AI Integration';
  if (/kubernetes|terraform|aws|gcp|cloud|devops|infra/i.test(combined)) return 'Cloud Infrastructure';
  if (/automation|pipeline|data|analytics/i.test(combined)) return 'ML Automation';
  return 'Custom Software';
}

// --- 1. APOLLO.IO SERVER-SECRET CONNECTOR ---

export async function getApolloApiKey(userToken?: string): Promise<string> {
  return resolveIntegrationSecret('apollo', userToken);
}

interface ApolloApiPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  last_name_obfuscated?: string;
  name?: string;
  title?: string;
  email?: string;
  has_email?: boolean;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: {
    name?: string;
    primary_domain?: string;
    website_url?: string;
    industry?: string;
    estimated_num_employees?: number;
  };
}

export async function searchApolloPeople(
  filters: ApolloSearchFilters,
  userToken?: string
): Promise<{
  candidates: ApolloCandidate[];
  totalEntries: number;
}> {
  const apiKey = await getApolloApiKey(userToken);
  if (!apiKey) {
    throw new Error(
      'Apollo.io API key is not configured or is disconnected. Connect Apollo.io in Settings -> Integrations Vault.'
    );
  }

  const body: Record<string, unknown> = {
    page: Math.max(1, filters.page || 1),
    per_page: Math.min(25, Math.max(5, filters.perPage || 15))
  };
  if (filters.personTitles?.length) body.person_titles = filters.personTitles;
  if (filters.qKeywords?.trim()) body.q_keywords = filters.qKeywords.trim();
  if (filters.personLocations?.length) body.person_locations = filters.personLocations;
  if (filters.organizationDomains?.length) {
    body.q_organization_domains_list = filters.organizationDomains;
  }

  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'x-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Apollo API returned HTTP ${res.status}: ${errText.slice(0, 220)}`);
  }

  const data = (await res.json()) as {
    people?: ApolloApiPerson[];
    total_entries?: number;
  };

  const people = Array.isArray(data.people) ? data.people : [];
  const candidates: ApolloCandidate[] = people.map((p) => {
    const fullName =
      p.name?.trim() ||
      [p.first_name, p.last_name || p.last_name_obfuscated].filter(Boolean).join(' ').trim() ||
      'Decision Maker';
    const domain = normalizeDomain(
      p.organization?.primary_domain || p.organization?.website_url || ''
    );
    const location = [p.city, p.state, p.country].filter(Boolean).join(', ');
    return {
      id: `apollo-${p.id}`,
      apollo_person_id: p.id,
      contact_name: fullName,
      role_title: p.title || 'Technology Leader',
      email: p.email || '',
      has_email: Boolean(p.email || p.has_email),
      company_name: p.organization?.name || domain || 'Unknown Company',
      company_domain: domain,
      website_url: p.organization?.website_url || (domain ? `https://${domain}` : ''),
      linkedin_url: p.linkedin_url || '',
      location,
      industry: p.organization?.industry || '',
      tech_stack: p.organization?.industry ? [p.organization.industry] : [],
      snippet: [
        p.organization?.industry ? `Industry: ${p.organization.industry}` : '',
        p.organization?.estimated_num_employees
          ? `Team size: ~${p.organization.estimated_num_employees}`
          : '',
        location ? `Location: ${location}` : ''
      ]
        .filter(Boolean)
        .join(' · ')
    };
  });

  return {
    candidates,
    totalEntries: Number(data.total_entries) || candidates.length
  };
}

export async function enrichAndBuildApolloLeads(
  selectedCandidates: ApolloCandidate[],
  assignedUserId: string | null,
  userToken?: string
): Promise<CrmLead[]> {
  const apiKey = await getApolloApiKey(userToken);
  if (!apiKey) {
    throw new Error('Apollo.io API key is required to enrich Apollo contacts. Connect it in Settings -> Integrations Vault.');
  }

  const enrichedMap = new Map<string, ApolloApiPerson>();
  const idsToMatch = selectedCandidates
    .filter((c) => c.apollo_person_id && !c.email)
    .map((c) => c.apollo_person_id)
    .slice(0, 10);

  if (idsToMatch.length > 0) {
    try {
      const res = await fetch('https://api.apollo.io/api/v1/people/bulk_match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          details: idsToMatch.map((id) => ({ id }))
        })
      });
      if (res.ok) {
        const data = (await res.json()) as { matches?: ApolloApiPerson[] };
        for (const m of data.matches || []) {
          if (m?.id) enrichedMap.set(m.id, m);
        }
      }
    } catch {
      // fall back to candidate metadata & MX inference cleanly
    }
  }

  const now = new Date().toISOString();
  const leads: CrmLead[] = [];

  for (const cand of selectedCandidates.slice(0, 20)) {
    const matched = enrichedMap.get(cand.apollo_person_id);
    const domain = normalizeDomain(
      matched?.organization?.primary_domain || cand.company_domain || cand.website_url
    );
    const rawEmail = (matched?.email || cand.email || '').trim().toLowerCase();
    let email = rawEmail;
    let emailStatus: EmailVerificationStatus = 'invalid';

    if (email) {
      const mxOk = await verifyEmailMxDomain(email);
      emailStatus = mxOk ? 'verified_mx' : 'public_found';
    } else if (domain) {
      const webSignals = await scrapePublicWebsite(domain);
      if (webSignals.emails.length > 0) {
        email = webSignals.emails[0];
        emailStatus = (await verifyEmailMxDomain(email)) ? 'verified_mx' : 'public_found';
      } else {
        email = `contact@${domain}`;
        emailStatus = (await verifyEmailMxDomain(email)) ? 'inferred' : 'invalid';
      }
    }

    const fullName =
      matched?.name?.trim() ||
      [matched?.first_name, matched?.last_name].filter(Boolean).join(' ').trim() ||
      cand.contact_name;
    const roleTitle = matched?.title || cand.role_title;
    const companyName = matched?.organization?.name || cand.company_name;
    const websiteUrl =
      matched?.organization?.website_url || cand.website_url || (domain ? `https://${domain}` : '');
    const stack = Array.from(
      new Set([...(cand.tech_stack || []), ...detectStackFromText(`${roleTitle} ${cand.industry}`)])
    ).slice(0, 6);

    leads.push({
      id: `crm-${crypto.randomUUID().slice(0, 8)}`,
      contact_name: fullName,
      role_title: roleTitle,
      email,
      email_status: email ? emailStatus : 'invalid',
      company_name: companyName,
      company_domain: domain,
      website_url: websiteUrl,
      github_url: '',
      phone: '',
      location: cand.location || '',
      rating: null,
      source_detail: 'Apollo.io People API',
      source_type: 'apollo',
      source_urls: Array.from(
        new Set(
          [
            cand.linkedin_url,
            websiteUrl,
            `https://app.apollo.io/#/people/${cand.apollo_person_id}`
          ].filter(Boolean)
        )
      ),
      tech_stack: stack,
      research_brief: cand.snippet || `Enriched via Apollo.io (${roleTitle} at ${companyName}).`,
      recommended_service: inferServiceFromStack(stack, `${roleTitle} ${cand.industry}`),
      fit_score: emailStatus === 'verified_mx' ? 88 : 76,
      deal_value: 38000,
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
    });
  }

  return leads;
}

// --- 2. HACKER NEWS "WHO IS HIRING?" ALGOLIA HARVESTER ---

interface HnAlgoliaHit {
  objectID: string;
  title?: string;
  comment_text?: string;
  story_title?: string;
  created_at?: string;
}

export async function harvestHackerNewsLeads(
  keyword = '',
  assignedUserId: string | null = null
): Promise<{
  threadTitle: string;
  scannedCount: number;
  leads: CrmLead[];
}> {
  const storyRes = await fetch(
    'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=Who%20is%20hiring&hitsPerPage=1'
  );
  if (!storyRes.ok) {
    throw new Error(`Hacker News Algolia story lookup failed (${storyRes.status}).`);
  }
  const storyJson = (await storyRes.json()) as { hits?: HnAlgoliaHit[] };
  const thread = storyJson.hits?.[0];
  if (!thread) {
    throw new Error('Could not find a recent Ask HN: Who is hiring thread.');
  }

  const commentsRes = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_${encodeURIComponent(
      thread.objectID
    )}&hitsPerPage=45`
  );
  if (!commentsRes.ok) {
    throw new Error(`Hacker News comments fetch failed (${commentsRes.status}).`);
  }
  const commentsJson = (await commentsRes.json()) as { hits?: HnAlgoliaHit[] };
  const hits = commentsJson.hits || [];
  const filterTerm = keyword.trim().toLowerCase();

  const matching = hits
    .map((h) => {
      const plain = stripHtmlTags(h.comment_text || '');
      return { id: h.objectID, plain };
    })
    .filter((item) => item.plain.length >= 40)
    .filter((item) => !filterTerm || item.plain.toLowerCase().includes(filterTerm))
    .slice(0, 10);

  const now = new Date().toISOString();
  const leads = await Promise.all(
    matching.map(async (item) => {
      const firstLine = item.plain.split('\n')[0] || '';
      const segments = firstLine
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const companyName = (segments[0] || 'HN Hiring Startup').slice(0, 80);
      const roleTitle = (segments[1] || 'Engineering Team (Hiring)').slice(0, 90);
      const location = (segments[2] || 'Remote / Hybrid').slice(0, 80);

      const urls = extractUrls(item.plain);
      const primaryUrl = urls[0] || '';
      const domain = normalizeDomain(primaryUrl);
      const directEmail = extractFirstBusinessEmail(item.plain);
      const webSignals = !directEmail && domain ? await scrapePublicWebsite(domain) : null;

      let email = directEmail || webSignals?.emails[0] || '';
      let emailStatus: EmailVerificationStatus = 'invalid';
      if (email) {
        const mx = await verifyEmailMxDomain(email);
        emailStatus = mx ? 'verified_mx' : 'public_found';
      } else if (domain) {
        email = `jobs@${domain}`;
        emailStatus = (await verifyEmailMxDomain(email)) ? 'inferred' : 'invalid';
      }

      const stack = Array.from(
        new Set([...detectStackFromText(item.plain), ...(webSignals?.techSignals || [])])
      ).slice(0, 7);
      const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`;

      return {
        id: `crm-${crypto.randomUUID().slice(0, 8)}`,
        contact_name: `${companyName} Hiring Team`,
        role_title: roleTitle,
        email,
        email_status: email ? emailStatus : 'invalid',
        company_name: companyName,
        company_domain: domain,
        website_url: primaryUrl || (domain ? `https://${domain}` : ''),
        github_url: urls.find((u) => u.includes('github.com')) || '',
        phone: '',
        location,
        rating: null,
        source_detail: thread.title || 'Ask HN: Who is hiring',
        source_type: 'hacker_news',
        source_urls: Array.from(new Set([hnUrl, ...urls.slice(0, 3)])),
        tech_stack: stack,
        research_brief: item.plain.slice(0, 420),
        recommended_service: inferServiceFromStack(stack, item.plain),
        fit_score: emailStatus === 'verified_mx' ? 86 : 75,
        deal_value: 35000,
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
      } satisfies CrmLead;
    })
  );

  return {
    threadTitle: thread.title || 'Ask HN: Who is hiring?',
    scannedCount: hits.length,
    leads
  };
}

// --- 3. Y COMBINATOR DIRECTORY PUBLIC JSON HARVESTER ---

interface YcCompanyRecord {
  id?: number;
  name: string;
  slug?: string;
  website?: string;
  one_liner?: string;
  long_description?: string;
  batch?: string;
  team_size?: number;
  industry?: string;
  subindustry?: string;
  all_locations?: string;
  tags?: string[];
  url?: string;
}

export async function harvestYCombinatorLeads(
  keyword = '',
  assignedUserId: string | null = null
): Promise<{
  datasetLabel: string;
  scannedCount: number;
  leads: CrmLead[];
}> {
  let res = await fetch('https://yc-oss.github.io/api/companies/hiring.json');
  let datasetLabel = 'YC Companies Hiring (yc-oss)';
  if (!res.ok) {
    res = await fetch('https://yc-oss.github.io/api/companies/top.json');
    datasetLabel = 'YC Top Companies (yc-oss)';
  }
  if (!res.ok) {
    throw new Error(`Y Combinator public directory fetch failed (${res.status}).`);
  }

  const all = (await res.json()) as YcCompanyRecord[];
  const q = keyword.trim().toLowerCase();
  const filtered = all
    .filter((c) => Boolean(c.name && c.website))
    .filter((c) => {
      if (!q) return true;
      const hay = [
        c.name,
        c.one_liner,
        c.batch,
        c.industry,
        c.subindustry,
        ...(c.tags || [])
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 10);

  const now = new Date().toISOString();
  const leads = await Promise.all(
    filtered.map(async (co) => {
      const domain = normalizeDomain(co.website || '');
      const webSignals = domain ? await scrapePublicWebsite(domain) : null;
      let email = webSignals?.emails[0] || '';
      let emailStatus: EmailVerificationStatus = 'invalid';

      if (email) {
        emailStatus = (await verifyEmailMxDomain(email)) ? 'verified_mx' : 'public_found';
      } else if (domain) {
        email = `founders@${domain}`;
        emailStatus = (await verifyEmailMxDomain(email)) ? 'inferred' : 'invalid';
      }

      const stack = Array.from(
        new Set([
          ...(webSignals?.techSignals || []),
          ...detectStackFromText(`${co.one_liner || ''} ${co.long_description || ''}`),
          ...(co.tags || []).slice(0, 3)
        ])
      ).slice(0, 7);

      const ycProfileUrl =
        co.url ||
        (co.slug ? `https://www.ycombinator.com/companies/${co.slug}` : 'https://www.ycombinator.com/companies');

      return {
        id: `crm-${crypto.randomUUID().slice(0, 8)}`,
        contact_name: `${co.name} Founders`,
        role_title: `YC ${co.batch || 'Alumni'} · ${co.subindustry || co.industry || 'Startup'}`,
        email,
        email_status: email ? emailStatus : 'invalid',
        company_name: co.name,
        company_domain: domain,
        website_url: webSignals?.url || co.website || (domain ? `https://${domain}` : ''),
        github_url: '',
        phone: '',
        location: co.all_locations || '',
        rating: null,
        source_detail: `Y Combinator ${co.batch || 'Directory'}`,
        source_type: 'ycombinator',
        source_urls: Array.from(new Set([ycProfileUrl, ...(webSignals?.sourceUrls || [])])).slice(0, 6),
        tech_stack: stack,
        research_brief: [
          co.one_liner || '',
          co.team_size ? `Team Size: ${co.team_size}` : '',
          co.long_description ? co.long_description.slice(0, 260) : ''
        ]
          .filter(Boolean)
          .join('\n'),
        recommended_service: inferServiceFromStack(stack, `${co.one_liner || ''} ${co.industry || ''}`),
        fit_score: emailStatus === 'verified_mx' ? 87 : 78,
        deal_value: co.team_size && co.team_size >= 50 ? 48000 : 32000,
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
      } satisfies CrmLead;
    })
  );

  return {
    datasetLabel,
    scannedCount: all.length,
    leads
  };
}

// --- 4. GOOGLE MAPS PLACES API (NEW) ESTABLISHMENT PROSPECTOR ---

export class MapsQuotaExceededError extends Error {
  quotaExceeded = true;
  constructor(message: string) {
    super(message);
    this.name = 'MapsQuotaExceededError';
  }
}

export async function getGoogleMapsApiKey(userToken?: string): Promise<string> {
  return resolveIntegrationSecret('google_maps', userToken);
}

interface PlacesApiNewPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
}

export async function searchGoogleMapsEstablishments(
  textQuery: string,
  regionCode = '',
  userToken?: string
): Promise<GoogleMapsPlaceCandidate[]> {
  const apiKey = await getGoogleMapsApiKey(userToken);
  if (!apiKey) {
    throw new Error(
      'Google Maps API key is not connected. Configure or reconnect Google Maps in Settings -> Integrations Vault.'
    );
  }

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.primaryTypeDisplayName',
    'places.googleMapsUri',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.rating',
    'places.userRatingCount',
    'places.websiteUri'
  ].join(',');

  const body: Record<string, unknown> = {
    textQuery: textQuery.trim(),
    pageSize: 15,
    languageCode: 'en'
  };
  if (regionCode.trim().length === 2) {
    body.regionCode = regionCode.trim().toLowerCase();
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
      'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errPayload = (await res.json().catch(() => ({}))) as {
      error?: { status?: string; message?: string };
    };
    const statusStr = errPayload?.error?.status || '';
    const errMsg = errPayload?.error?.message || `Places API error (${res.status})`;
    if (res.status === 429 || statusStr === 'RESOURCE_EXHAUSTED') {
      throw new MapsQuotaExceededError(errMsg);
    }
    throw new Error(errMsg);
  }

  const data = (await res.json()) as { places?: PlacesApiNewPlace[] };
  const places = Array.isArray(data.places) ? data.places : [];

  return places
    .filter((p) => p.location?.latitude !== undefined && p.location?.longitude !== undefined)
    .map((p) => ({
      place_id: p.id,
      name: p.displayName?.text || 'Business Establishment',
      primary_type: p.primaryTypeDisplayName?.text || 'Local Establishment',
      formatted_address: p.formattedAddress || '',
      location: {
        lat: Number(p.location!.latitude),
        lng: Number(p.location!.longitude)
      },
      phone: p.internationalPhoneNumber || p.nationalPhoneNumber || '',
      website_url: p.websiteUri || '',
      google_maps_uri: p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`,
      rating: typeof p.rating === 'number' ? p.rating : null,
      user_rating_count: typeof p.userRatingCount === 'number' ? p.userRatingCount : null
    }));
}

export async function importAndAnalyzeGoogleMapsPlaces(
  places: GoogleMapsPlaceCandidate[],
  assignedUserId: string | null,
  runGeminiAnalysis = true,
  userToken?: string
): Promise<CrmLead[]> {
  const now = new Date().toISOString();
  const createdLeads: CrmLead[] = [];

  for (const place of places.slice(0, 8)) {
    const domain = normalizeDomain(place.website_url || '');
    const webSignals = domain ? await scrapePublicWebsite(domain) : null;

    let email = webSignals?.emails[0] || '';
    let emailStatus: EmailVerificationStatus = 'invalid';
    if (email) {
      emailStatus = (await verifyEmailMxDomain(email)) ? 'verified_mx' : 'public_found';
    } else if (domain) {
      email = `info@${domain}`;
      emailStatus = (await verifyEmailMxDomain(email)) ? 'inferred' : 'invalid';
    }

    const baseLead: CrmLead = {
      id: `crm-${crypto.randomUUID().slice(0, 8)}`,
      contact_name: `${place.name} Management`,
      role_title: `${place.primary_type} (${place.rating ? `${place.rating}★` : 'Google Maps'})`,
      email,
      email_status: email ? emailStatus : 'invalid',
      company_name: place.name,
      company_domain: domain,
      website_url: webSignals?.url || place.website_url || '',
      github_url: '',
      phone: place.phone || '',
      location: place.formatted_address || '',
      rating: place.rating,
      source_detail: `Google Maps · ${place.primary_type}`,
      source_type: 'google_maps',
      source_urls: Array.from(
        new Set([place.google_maps_uri, ...(webSignals?.sourceUrls || []), place.website_url].filter(Boolean))
      ).slice(0, 8),
      tech_stack: webSignals?.techSignals || [],
      research_brief: [
        `Establishment: ${place.name} (${place.primary_type})`,
        place.formatted_address ? `Address: ${place.formatted_address}` : '',
        place.phone ? `Phone: ${place.phone}` : '',
        place.rating
          ? `Google Rating: ${place.rating} (${place.user_rating_count || 0} reviews)`
          : '',
        webSignals?.description ? `Website Summary: ${webSignals.description}` : ''
      ]
        .filter(Boolean)
        .join('\n'),
      recommended_service: inferServiceFromStack(
        webSignals?.techSignals || [],
        `${place.primary_type} ${webSignals?.description || ''}`
      ),
      fit_score: emailStatus === 'verified_mx' ? 84 : place.website_url ? 74 : 58,
      deal_value: 24000,
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

    if (runGeminiAnalysis) {
      try {
        const analysis = await runProspectResearchAndProposal(baseLead, userToken);
        baseLead.research_brief = analysis.research_brief;
        baseLead.recommended_service = analysis.recommended_service;
        baseLead.fit_score = analysis.fit_score;
        baseLead.deal_value = analysis.deal_value;
        baseLead.tech_stack = analysis.tech_stack;
        baseLead.proposal_subject = analysis.proposal_subject;
        baseLead.proposal_body = analysis.proposal_body;
        baseLead.follow_up_sequence = analysis.follow_up_sequence;
        baseLead.source_urls = Array.from(
          new Set([...baseLead.source_urls, ...analysis.source_urls])
        ).slice(0, 8);
        baseLead.stage = 'researched';
      } catch {
        // Keep base establishment lead if AI analysis times out
      }
    }

    createdLeads.push(baseLead);
  }

  return createdLeads;
}

// --- 5. CSV / JSON BULK IMPORTER ---

export async function buildLeadsFromCsvInputs(
  rows: CsvImportLeadInput[],
  assignedUserId: string | null
): Promise<CrmLead[]> {
  const now = new Date().toISOString();
  const validRows = rows.filter((r) => Boolean(r.company_name?.trim())).slice(0, 100);

  return Promise.all(
    validRows.map(async (row) => {
      const domain = normalizeDomain(row.company_domain || row.website_url || '');
      const cleanEmail = (row.email || '').trim().toLowerCase();
      let emailStatus: EmailVerificationStatus = 'invalid';

      if (cleanEmail) {
        emailStatus = (await verifyEmailMxDomain(cleanEmail)) ? 'verified_mx' : 'public_found';
      } else if (domain) {
        emailStatus = (await verifyEmailMxDomain(`contact@${domain}`)) ? 'inferred' : 'invalid';
      }

      const stack = Array.isArray(row.tech_stack) ? row.tech_stack.slice(0, 8) : [];
      const service = row.recommended_service || inferServiceFromStack(stack, row.role_title || '');

      return {
        id: `crm-${crypto.randomUUID().slice(0, 8)}`,
        contact_name: (row.contact_name || '').trim() || `${row.company_name.trim()} Team`,
        role_title: (row.role_title || '').trim() || 'Decision Maker',
        email: cleanEmail || (domain ? `contact@${domain}` : ''),
        email_status: emailStatus,
        company_name: row.company_name.trim(),
        company_domain: domain,
        website_url: row.website_url?.trim() || (domain ? `https://${domain}` : ''),
        github_url: '',
        phone: (row.phone || '').trim(),
        location: (row.location || '').trim(),
        rating: null,
        source_detail: 'Bulk CSV Import',
        source_type: 'csv_import',
        source_urls: domain ? [`https://${domain}`] : [],
        tech_stack: stack,
        research_brief: `Imported via CSV bulk upload (${row.company_name.trim()}).`,
        recommended_service: service,
        fit_score: emailStatus === 'verified_mx' ? 85 : 72,
        deal_value: Number(row.deal_value) || 28000,
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
      } satisfies CrmLead;
    })
  );
}
