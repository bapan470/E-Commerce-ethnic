import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
  faqs: { question: string; answer: string }[];
  read_minutes: number;
  related_category_name: string;
  suggested_cover_image: string;
  // Real products auto-inserted as {{product:slug}} cards in body_paragraphs
  // below, surfaced back to the admin UI just so the toast/dialog can say
  // *which* products got picked — purely informational, the markers
  // themselves are already the source of truth for rendering.
  inserted_products: { slug: string; name: string }[];
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
  return `You are an SEO content writer for "AruhiHandlooms", an Indian ethnic-wear e-commerce store selling handwoven sarees, lehengas, bridal wear and kurtis. Their existing blog targets real search-intent, long-tail keywords (often Hinglish) in a warm, boutique-style, no-fuss voice — practical how-to and guide content, not generic marketing fluff.

Write a full, LONG-FORM blog post for this topic: "${topic}"
${extraKeywords ? `Additional keywords/context to weave in naturally: ${extraKeywords}` : ''}

The store's ACTUAL live product categories are exactly: ${categoryList}
Do not invent or use any category name outside this exact list.

LENGTH & STRUCTURE (both are hard requirements, not suggestions):
- Total length must land between 1200 and 1800 words across the whole body — this is a ranking-focused long-form guide, not a short blog snippet. If you find yourself running short, add another genuinely useful section rather than padding existing paragraphs with filler.
- Organize the post into 4 to 6 distinct sections. Each section starts with its own H2-style heading, written as its own array entry using the exact marker syntax: {{h2:Section Heading Text}} — the heading text itself should be specific and contain a natural keyword variation (e.g. "{{h2:How to Choose the Right Silk Saree for a Wedding}}"), not a generic label like "Introduction" or "Conclusion".
- Each section then contains 2 to 4 prose paragraphs (3-6 sentences each) directly after its {{h2:...}} marker entry, before the next section's heading.
- The very first array entries should be 1-2 intro paragraphs BEFORE the first {{h2:...}} marker, hooking the reader on the problem/question before the structured sections begin.

CRITICAL — avoid repetition across sections: if the post covers multiple outfit types (e.g. saree, lehenga, kurti), each one needs its own genuinely distinct styling advice, fabric detail, and occasion fit. Do not reuse the same color/pairing suggestion ("neutral color like beige or cream, paired with a white or light-colored blouse") more than once in the whole post — that reads as generic AI filler and hurts both readability and SEO.

OTHER CONTENT RULES:
- Written for an Indian audience shopping for ethnic wear online.
- No emojis, no markdown formatting — plain prose paragraphs only, EXCEPT for the {{h2:...}} section markers and the in-content category links described below.
- In 2 to 4 of the paragraphs (not all, and never inside a heading marker itself), naturally weave in ONE in-content link per paragraph using this exact syntax: [natural anchor text](category:Exact Category Name) — the category name must be copied exactly from the list above. Example: "you could reach for a [Banarasi silk saree](category:Silk Sarees) in a warm gold tone". Only link where it's a genuinely relevant, natural mention — never force it, never link the same category twice.
- Naturally mention relevant fabrics/crafts (e.g. Banarasi, Kanjivaram, Chanderi, Tussar, Mysore Silk, Georgette) only where genuinely relevant to the topic — don't force it.

FAQ SECTION (separate from body_paragraphs, required):
- Write 4 to 5 genuinely useful FAQ question/answer pairs that real shoppers would search for around this topic (think "People Also Ask" style queries). Questions should be specific, not generic. Answers should be 2-4 sentences, self-contained (make sense without reading the rest of the post), and free of markdown/emojis.

Respond with ONLY a JSON object (no markdown fences, no preamble) with these exact keys:
{
  "title": "SEO title, 45-70 characters, includes the main keyword naturally",
  "excerpt": "meta description / listing summary, 140-160 characters, makes someone want to click",
  "keywords": ["3-5 realistic search-intent keyword phrases a real shopper would type, mix of Hinglish and English where natural"],
  "body_paragraphs": ["1-2 intro paragraphs, then {{h2:Heading}} markers interleaved with 2-4 paragraphs each, 4 to 6 sections total, 1200-1800 words combined, with category links embedded per the syntax above"],
  "faqs": [{"question": "specific search-style question", "answer": "2-4 sentence self-contained answer"}, "... 4 to 5 items total"],
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
  const supabase = getSupabaseAdmin();
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
          // Bumped from 2048: long-form posts (1200-1800 words across 4-6
          // H2 sections) plus 4-5 FAQ pairs need meaningfully more tokens
          // than the old 6-8 short paragraphs did, or the JSON gets cut
          // off mid-string and fails to parse below.
          max_tokens: 4096,
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

    // Auto-insert real product cards ({{product:slug}} — same marker the
    // admin's "Insert product card" button writes, parsed by
    // app/blog/[slug]/page.tsx into a <BlogProductCard> with a real photo,
    // price and "Shop Now" link). Doing this here means every AI-generated
    // draft already has conversion-driving product cards in place, instead
    // of relying on the admin to add them by hand after the fact — the
    // admin can still remove/move the markers in the review step before
    // publishing, same as any other text in the draft.
    const insertedProducts: { slug: string; name: string }[] = [];
    if (relatedCategoryName) {
      const { data: cardCandidates } = await supabase
        .from('products')
        .select('slug, name, images, rating, featured')
        .eq('category_name', relatedCategoryName)
        .eq('approval_status', 'live')
        .eq('in_stock', true)
        .order('featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(10);

      // Posts are now long-form (4-6 H2 sections), so 2-3 product cards
      // spread through the post reads naturally instead of feeling sparse
      // — was capped at 1-2 back when posts were 6-8 short paragraphs.
      const picked = (cardCandidates ?? [])
        .filter((p: any) => Array.isArray(p.images) && p.images.length > 0)
        // Don't repeat the exact product whose photo is already the cover image.
        .filter((p: any) => p.images[0] !== suggestedCoverImage)
        .slice(0, bodyParagraphs.length >= 12 ? 3 : 2);

      if (picked.length > 0) {
        // Spread the cards through the post rather than bunching them at
        // the top/bottom — roughly evenly across the length — so they read
        // as a natural break, not an ad wall.
        const insertAt = picked.map((_, i) =>
          Math.max(1, Math.round(((i + 1) * bodyParagraphs.length) / (picked.length + 1)))
        );
        // Insert back-to-front so earlier insertions don't shift later indices.
        insertAt
          .map((pos, i) => ({ pos, product: picked[i] }))
          .sort((a, b) => b.pos - a.pos)
          .forEach(({ pos, product }) => {
            bodyParagraphs.splice(pos, 0, `{{product:${product.slug}}}`);
          });
        picked.forEach((p: any) => insertedProducts.push({ slug: p.slug, name: p.name }));
      }
    }

    // Auto-insert one real customer review as social proof — a short
    // blockquote from an actually-approved review on a product in the same
    // category, encoded into a {{review:<base64 json>}} marker so
    // app/blog/[slug]/page.tsx can render it without a second DB round
    // trip and without breaking if the underlying review is later deleted
    // or unapproved (the quote, once embedded, is just text from then on).
    // Best-effort: if the category has no approved reviews yet, the post
    // simply ships without one — nothing breaks.
    if (relatedCategoryName) {
      try {
        const { data: categoryProducts } = await supabase
          .from('products')
          .select('id, name')
          .eq('category_name', relatedCategoryName)
          .eq('approval_status', 'live')
          .limit(50);
        const productIds = (categoryProducts ?? []).map((p: any) => p.id);
        const productNameById = new Map((categoryProducts ?? []).map((p: any) => [p.id, p.name]));

        if (productIds.length > 0) {
          const { data: reviewRows } = await supabase
            .from('reviews')
            .select('product_id, customer_name, rating, comment')
            .in('product_id', productIds)
            .eq('is_approved', true)
            .not('comment', 'is', null)
            .order('rating', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(5);

          const bestReview = (reviewRows ?? []).find(
            (r: any) => typeof r.comment === 'string' && r.comment.trim().length >= 20
          );

          if (bestReview) {
            const payload = {
              name: bestReview.customer_name || 'Verified customer',
              rating: bestReview.rating || 5,
              comment: bestReview.comment.trim(),
              product: productNameById.get(bestReview.product_id) || relatedCategoryName,
            };
            const marker = `{{review:${Buffer.from(JSON.stringify(payload)).toString('base64')}}}`;
            // Place it about 80% of the way through — after most of the
            // how-to content, right before things wrap up, so it reads as
            // a natural "here's proof this works" beat, not an interruption.
            const pos = Math.max(1, Math.round(bodyParagraphs.length * 0.8));
            bodyParagraphs.splice(pos, 0, marker);
          }
        }
      } catch (reviewErr) {
        console.error('[generate-blog-post] review lookup failed (non-fatal):', reviewErr);
      }
    }

    // FAQs: validate shape defensively since this comes straight from the
    // model — anything malformed is dropped rather than saved as broken
    // JSON that could crash the FAQPage schema or the public render.
    const faqs = Array.isArray(parsed.faqs)
      ? parsed.faqs
          .filter(
            (f): f is { question: string; answer: string } =>
              !!f &&
              typeof f.question === 'string' &&
              typeof f.answer === 'string' &&
              f.question.trim().length > 0 &&
              f.answer.trim().length > 0
          )
          .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
          .slice(0, 6)
      : [];

    const result: GeneratedPost = {
      title: parsed.title.trim(),
      slug: slugify(parsed.title),
      excerpt: (parsed.excerpt || '').trim(),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
      body_paragraphs: bodyParagraphs,
      faqs,
      read_minutes: readMinutes,
      related_category_name: relatedCategoryName,
      suggested_cover_image: suggestedCoverImage,
      inserted_products: insertedProducts,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[generate-blog-post] Unexpected error:', err);
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 });
  }
}
