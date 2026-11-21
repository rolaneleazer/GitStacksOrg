import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  EDITORIAL_COVER_POOL,
  pickUniqueCoverForArticle
} from '../shared/editorialCovers.ts';
import { slugify } from '../shared/qualityGate.ts';
import type { Article, ServiceCategory } from '../shared/types.ts';
import {
  isGeminiQuotaCoolingDown,
  markGeminiQuotaCooldownIfNeeded
} from './geminiResilience.ts';
import { listPosts, upsertPost } from './repository.ts';
import { resolveIntegrationSecret } from './vault.ts';

const IS_VERCEL = Boolean(process.env.VERCEL);
const COVERS_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'gitstack-data', 'generated-covers')
  : path.resolve(process.cwd(), 'data', 'generated-covers');

// Keep recent generated buffers in memory so ephemeral serverless instances serve immediately
const memoryCovers = new Map<string, { buffer: Buffer; mimeType: string }>();

export interface GeneratedCoverResult {
  url: string;
  alt: string;
  source: 'gemini_ai' | 'editorial_preset';
  model: string;
  notice?: string;
}

async function resolveGeminiKey(userToken?: string): Promise<string> {
  const vaultKey = await resolveIntegrationSecret('gemini', userToken).catch(() => '');
  if (vaultKey) return vaultKey;
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey !== 'MY_GEMINI_API_KEY') return envKey.trim();
  return '';
}

function buildEditorialImagePrompt(params: {
  title: string;
  category?: string;
  primaryKeyword?: string;
  styleHint?: string;
}): string {
  const category = params.category || 'Enterprise Software Architecture';
  const kw = params.primaryKeyword ? `Focused theme: ${params.primaryKeyword}. ` : '';
  const extra = params.styleHint?.trim() ? `Visual direction: ${params.styleHint.trim()}. ` : '';
  return [
    `Create a unique, clean 16:9 widescreen editorial cover visual for a senior software engineering article titled "${params.title}".`,
    `Domain: ${category}. ${kw}${extra}`,
    'Style: minimalist high-craft architectural studio photography or precision clean isometric glass/metallic engineering render on a bright neutral cool-white/stone palette with subtle cobalt blue or emerald rim lighting.',
    'Composition: uncluttered focal object with generous negative space, crisp daylight shadows, high resolution.',
    'STRICT RULE: Include ZERO readable text, ZERO letters, ZERO watermarks, and ZERO overlaid logos inside the image.'
  ].join(' ');
}

export async function generateArticleCoverImage(params: {
  title: string;
  category?: ServiceCategory | string;
  primaryKeyword?: string;
  slug?: string;
  styleHint?: string;
  excludeUrls?: string[];
  preferAi?: boolean;
  userToken?: string;
}): Promise<GeneratedCoverResult> {
  const cleanTitle = (params.title || 'Enterprise Software Architecture').trim();
  const baseSlug = slugify(params.slug || cleanTitle) || 'gitstack-insight';

  // Fetch existing article covers so we never repeat an already-overused preset when falling back
  const existingPosts = await listPosts(true, params.userToken).catch(() => [] as Article[]);
  const usedCovers = existingPosts.map((p) => p.cover_image).filter(Boolean);

  const shouldTryGemini = params.preferAi !== false && !isGeminiQuotaCoolingDown();
  if (shouldTryGemini) {
    const apiKey = await resolveGeminiKey(params.userToken).catch(() => '');
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: { 'User-Agent': 'aistudio-build' }
          }
        });
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [{ text: buildEditorialImagePrompt(params) }]
          },
          config: {
            imageConfig: {
              aspectRatio: '16:9'
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
            const shortHash = crypto
              .createHash('sha1')
              .update(`${cleanTitle}|${Date.now()}|${Math.random()}`)
              .digest('hex')
              .slice(0, 8);
            const filename = `${baseSlug.slice(0, 48)}-${shortHash}.${ext}`;
            const buffer = Buffer.from(part.inlineData.data, 'base64');

            memoryCovers.set(filename, { buffer, mimeType });
            if (memoryCovers.size > 60) {
              const oldest = memoryCovers.keys().next().value;
              if (oldest) memoryCovers.delete(oldest);
            }

            try {
              await fs.mkdir(COVERS_DIR, { recursive: true });
              await fs.writeFile(path.join(COVERS_DIR, filename), buffer);
            } catch {
              // In read-only serverless environments memory cache still serves immediately
            }

            return {
              url: `/generated-covers/${filename}`,
              alt: `${cleanTitle} — Custom AI Editorial Cover (${params.category || 'Architecture'})`,
              source: 'gemini_ai',
              model: 'gemini-3.1-flash-lite-image'
            };
          }
        }
      } catch (err) {
        markGeminiQuotaCooldownIfNeeded(err);
      }
    }
  }

  // Unique topic-matched preset rotation fallback (never repeats a single static image)
  const fallback = pickUniqueCoverForArticle({
    title: cleanTitle,
    category: params.category,
    keyword: params.primaryKeyword,
    usedCovers,
    excludeUrls: params.excludeUrls
  });

  return {
    url: fallback.url,
    alt: fallback.alt,
    source: 'editorial_preset',
    model: 'topic-rotation-v2',
    notice:
      'Assigned unique topic-matched editorial visual from the expanded 9-asset library (Gemini image generation activates automatically when a billing-enabled Gemini key is active).'
  };
}

export async function readGeneratedCoverFile(
  rawFilename: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const safeName = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName || (!safeName.endsWith('.png') && !safeName.endsWith('.jpg'))) {
    return null;
  }

  const cached = memoryCovers.get(safeName);
  if (cached) return cached;

  try {
    const filePath = path.join(COVERS_DIR, safeName);
    const buffer = await fs.readFile(filePath);
    const mimeType = safeName.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    memoryCovers.set(safeName, { buffer, mimeType });
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

export async function deduplicateArticleCovers(userToken?: string): Promise<{
  scannedCount: number;
  updatedCount: number;
  updatedArticles: Array<{ id: string; title: string; oldCover: string; newCover: string }>;
}> {
  const posts = await listPosts(true, userToken);
  const seenCovers = new Set<string>();
  const usedCovers: string[] = [];
  const updatedArticles: Array<{ id: string; title: string; oldCover: string; newCover: string }> = [];

  for (const post of posts) {
    const current = (post.cover_image || '').trim();
    const isDuplicate = !current || seenCovers.has(current);
    if (!isDuplicate) {
      seenCovers.add(current);
      usedCovers.push(current);
      continue;
    }

    const picked = pickUniqueCoverForArticle({
      title: post.title,
      category: post.category,
      keyword: post.primary_keyword,
      usedCovers: [...usedCovers],
      excludeUrls: Array.from(seenCovers).slice(0, EDITORIAL_COVER_POOL.length - 1)
    });

    seenCovers.add(picked.url);
    usedCovers.push(picked.url);

    await upsertPost(
      {
        ...post,
        cover_image: picked.url,
        cover_alt: post.cover_alt && !post.cover_alt.includes('Optical glass prisms') ? post.cover_alt : picked.alt,
        updated_at: new Date().toISOString()
      },
      userToken
    );

    updatedArticles.push({
      id: post.id,
      title: post.title,
      oldCover: current || '(empty)',
      newCover: picked.url
    });
  }

  return {
    scannedCount: posts.length,
    updatedCount: updatedArticles.length,
    updatedArticles
  };
}
