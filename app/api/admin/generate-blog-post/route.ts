import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';

// Same free-tier NVIDIA NIM setup already used by
// app/api/admin/generate-listing/route.ts and lib/vendor-ai-listing.ts —
// reuses NVIDIA_API_KEY so there's nothing new to configure. Text-only here
// (no product photo), so the vision model is used purely as a text model.
export const maxDuration = 60;

const MODEL = 'meta/llama-3.2-11b-vision-instruct';
const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

interface GeneratedPost {
  title: string;
  slug: string;
  excerpt: string;
  keywords: string[];
  body_paragraphs: string[];
  read_minutes: number;
  related_category_name: string;
  suggested_cover_image: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// In-content links use `[anchor text](category:Exact Category Name)`. Kept
// as plain text markup (no DB/schema change) and parsed by the public blog
// page into real <Link>s. Anything that doesn't match a real category name
// is stripped back to plain anchor text below — so a broken/hallucinated
// category name can never render as a dead link on the live site.
const CATEGORY_LINK_RE = /\[([^\]]+)\]\(category:([^)]+)\)/g;

function sanitizeInlineLinks(paragraph: string, validNames: Set<string>): string {
  return paragraph.replace(CATEGORY_LINK_RE, (full, anchorText, categoryName) => {
    const trimmed = categoryName.trim();
    return validNames.has(trimmed.toLowerCase()) ? full : anchorText;
  });
}

function buildPrompt(topic: string, extraKeywords: string, categoryNames: string[]) {
  const categoryList = categoryNames.length > 0 ? categoryNames.join(', ') : '(no categories available)';
  return `You are an SEO content writer for "Aruhi Handlooms", an Indian ethnic-wear e-commerce store selling handwoven sarees, lehengas, bridal wear and kurtis. Their existing blog targets real search-intent, long-tail keywords (often Hinglish) in a warm, boutique-style, no-fuss voice — practical how-to and guide content, not generic marketing fluff.

Write a full blog post for this topic: "${topic}"
${extraKeywords ? `Additional keywords/context to weave in naturally: ${extraKeywords}` : ''}

The store's ACTUAL live product categories are exactly: ${categoryList}
Do not invent or use any category name outside this exact list.

Requirements:
- 6 to 8 paragraphs, each 3-6 sentences, genuinely useful and specific (real technique, real fabric names, real practical detail) — not vague filler.
- CRITICAL — avoid repetition across paragraphs: if the post covers multiple outfit types (e.g. saree, lehenga, kurti), each one needs its own genuinely distinct styling advice, fabric detail, and occasion fit. Do not reuse the same color/pairing suggestion ("neutral color like beige or cream, paired with a white or light-colored blouse") more than once in the whole post — that reads as generic AI filler and hurts both readability and SEO.
- Written for an Indian audience shopping for ethnic wear online.
- No emojis, no markdown formatting, no headers inside paragraphs — plain prose paragraphs only, EXCEPT for the in-content category links described below.
- In 2 to 4 of the paragraphs (not all), naturally weave in ONE in-content link per paragraph using this exact syntax: [natural anchor text](category:Exact Category Name) — the category name must be copied exactly from the list above. Example: "you could reach for a [Banarasi silk saree](category:Silk Sarees) in a warm gold tone". Only link where it's a genuinely relevant, natural mention — never force it, never link the same category twice.
- Naturally mention relevant fabrics/crafts (e.g. Banarasi, Kanjivaram, Chanderi, Tussar, Mysore Silk, Georgette) only where genuinely relevant to the topic — don't force it.

Respond with ONLY a JSON object (no markdown fences, no preamble) with these exact keys:
{
  "title": "SEO title, 45-70 characters, includes the main keyword naturally",
  "excerpt": "meta description / listing summary, 140-160 characters, makes someone want to click",
  "keywords": ["3-5 realistic search-intent keyword phrases a real shopper would type, mix of Hinglish and English where natural"],
  "body_paragraphs": ["paragraph 1", "paragraph 2", "... 6 to 8 paragraphs total, with category links embedded per the syntax above"],
  "related_category_name": "the single BEST-matching category from the exact list above for a final 'Shop this collection' button — must be copied exactly from the list, or empty string if genuinely none fit"
}`;
}

export async function POST(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI generation is not configured. Add NVIDIA_API_KEY to your environment (free key at build.nvidia.com).' },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const topic = (body?.topic as string | undefined)?.trim() || '';
  const extraKeywords = (body?.keywords as string | undefined)?.trim() || '';

  if (!topic) {
    return NextResponse.json({ error: 'Give a topic or pick a trending idea to generate from.' }, { status: 400 });
  }

  // Real, live category names — this is what actually fixes "related
  // category: None" and dead-end inline links: the AI is only ever allowed
  // to reference categories that genuinely exist and have products, instead
  // of guessing from a hardcoded list that can drift out of sync with the
  // real catalog.
  const supabase = getServerSupabase();
  const { data: categoriesData } = await supabase.from('categories').select('name');
  const categoryNames: string[] = (categoriesData ?? []).map((c: any) => String(c.name)).filter(Boolean);
  const validNameSet = new Set(categoryNames.map((n) => n.toLowerCase()));

  try {
    const promptText = buildPrompt(topic, extraKeywords, categoryNames);

    const nimController = new AbortController();
    const nimTimeout = setTimeout(() => nimController.abort(), 55_000);

    let res: Response;
    try {
      res = await fetch(NIM_ENDPOINT, {
        method: 'POST',
        signal: nimController.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.6,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        }),
      });
    } finally {
      clearTimeout(nimTimeout);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[generate-blog-post] NVIDIA NIM API error:', res.status, errText);
      const rateLimited = res.status === 429;
      return NextResponse.json(
        {
          error: rateLimited
            ? 'AI is rate-limited right now (free tier). Wait a minute and try again.'
            : 'AI generation failed. Please try again.',
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const cleaned = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();

    let parsed: GeneratedPost | undefined;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = undefined;
        }
      }
    }

    if (!parsed || !parsed.title || !Array.isArray(parsed.body_paragraphs) || parsed.body_paragraphs.length === 0) {
      console.error('[generate-blog-post] Could not parse AI response:', text.slice(0, 500));
      return NextResponse.json({ error: 'AI returned an unexpected format. Please try again.' }, { status: 502 });
    }

    const bodyParagraphs = parsed.body_paragraphs
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .map((p) => sanitizeInlineLinks(p, validNameSet));

    // Estimated by us from the actual generated word count (~200 wpm),
    // rather than trusting the model's own guess, which was frequently off
    // (e.g. claiming 8 minutes for a ~500-word post).
    const totalWords = bodyParagraphs.join(' ').split(/\s+/).filter(Boolean).length;
    const readMinutes = Math.max(2, Math.round(totalWords / 200));

    const relatedRaw = (parsed.related_category_name || '').trim();
    const relatedCategoryName = validNameSet.has(relatedRaw.toLowerCase())
      ? categoryNames.find((n) => n.toLowerCase() === relatedRaw.toLowerCase()) || ''
      : '';

    // Pull a real product photo from that category to suggest as the cover
    // image — a live catalog photo converts better than a generic stock
    // image, and it saves the manual "go find a URL" step for the admin.
    // Best-effort: if nothing's found (empty category, no images), the
    // admin just gets an empty cover field like before, nothing breaks.
    let suggestedCoverImage = '';
    if (relatedCategoryName) {
      const { data: productRows } = await supabase
        .from('products')
        .select('images')
        .eq('category_name', relatedCategoryName)
        .eq('approval_status', 'live')
        .order('created_at', { ascending: false })
        .limit(10);
      const withImages = (productRows ?? []).find(
        (p: any) => Array.isArray(p.images) && p.images.length > 0
      );
      if (withImages) suggestedCoverImage = withImages.images[0];
    }

    const result: GeneratedPost = {
      title: parsed.title.trim(),
      slug: slugify(parsed.title),
      excerpt: (parsed.excerpt || '').trim(),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
      body_paragraphs: bodyParagraphs,
      read_minutes: readMinutes,
      related_category_name: relatedCategoryName,
      suggested_cover_image: suggestedCoverImage,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[generate-blog-post] Unexpected error:', err);
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 });
  }
}
