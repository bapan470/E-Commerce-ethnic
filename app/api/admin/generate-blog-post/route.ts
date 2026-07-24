import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

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
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function buildPrompt(topic: string, extraKeywords: string) {
  return `You are an SEO content writer for "Aruhi Handlooms", an Indian ethnic-wear e-commerce store selling handwoven sarees, lehengas, bridal wear and kurtis. Their existing blog targets real search-intent, long-tail keywords (often Hinglish) in a warm, boutique-style, no-fuss voice — practical how-to and guide content, not generic marketing fluff.

Write a full blog post for this topic: "${topic}"
${extraKeywords ? `Additional keywords/context to weave in naturally: ${extraKeywords}` : ''}

Requirements:
- 6 to 8 paragraphs, each 3-6 sentences, genuinely useful and specific (real technique, real fabric names, real practical detail) — not vague filler.
- Written for an Indian audience shopping for ethnic wear online.
- No emojis, no markdown formatting, no headers inside paragraphs — plain prose paragraphs only.
- Naturally mention relevant fabrics/crafts (e.g. Banarasi, Kanjivaram, Chanderi, Tussar, Mysore Silk, Georgette) only where genuinely relevant to the topic — don't force it.

Respond with ONLY a JSON object (no markdown fences, no preamble) with these exact keys:
{
  "title": "SEO title, 45-70 characters, includes the main keyword naturally",
  "excerpt": "meta description / listing summary, 140-160 characters, makes someone want to click",
  "keywords": ["3-5 realistic search-intent keyword phrases a real shopper would type, mix of Hinglish and English where natural"],
  "body_paragraphs": ["paragraph 1", "paragraph 2", "... 6 to 8 paragraphs total"],
  "read_minutes": integer estimate based on total word count (roughly 200 words per minute),
  "related_category_name": "single best-matching product category name for a 'Shop this' link, one of exactly: Silk Sarees, Cotton Sarees, Lehenga, Kurtis, Bridal Wear, Sarees — pick whichever fits the topic best, or empty string if none fit"
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

  try {
    const promptText = buildPrompt(topic, extraKeywords);

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

    const result: GeneratedPost = {
      title: parsed.title.trim(),
      slug: slugify(parsed.title),
      excerpt: (parsed.excerpt || '').trim(),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
      body_paragraphs: parsed.body_paragraphs.filter((p) => typeof p === 'string' && p.trim().length > 0),
      read_minutes: Number.isFinite(parsed.read_minutes) && parsed.read_minutes > 0 ? Math.round(parsed.read_minutes) : 5,
      related_category_name: (parsed.related_category_name || '').trim(),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[generate-blog-post] Unexpected error:', err);
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 });
  }
}
