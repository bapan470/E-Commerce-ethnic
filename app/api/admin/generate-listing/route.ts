import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

// Free-tier Gemini model with vision support. If you hit free-tier rate
// limits, "gemini-2.5-flash-lite" has a higher daily quota (lower quality).
const MODEL = 'gemini-2.5-flash';

interface GeneratedListing {
  name: string;
  description: string;
  fabric: string;
  origin: string;
  occasion: string[];
  material: string;
  pattern: string;
  gender: string;
  meta_description: string;
}

function buildPrompt(input: {
  hint: string;
  name: string;
  category: string;
  fabric: string;
  origin: string;
  colors: string;
  occasion: string;
  gender: string;
  material: string;
  pattern: string;
  hasImage: boolean;
}) {
  return `You are an SEO copywriter and Google Merchant Center data specialist for "Aruhi Handlooms", an Indian ethnic-wear e-commerce store selling handwoven sarees, lehengas, bridal wear and kurtis.

${input.hasImage ? 'A photo of the actual product is attached — look at it closely and base the fabric, color, motifs, and craft details on what you actually see in the image.' : ''}

Write a product listing based on this info (some fields may be blank — fill in sensible, realistic details for an Indian handloom ethnic-wear store where the field is missing, keeping existing details you ARE given exactly as-is where possible):

- Rough name/keywords: ${input.name || '(not given)'}
- Category: ${input.category || '(not given)'}
- Fabric: ${input.fabric || '(not given)'}
- Origin/weave region: ${input.origin || '(not given)'}
- Colors: ${input.colors || '(not given)'}
- Occasion tags: ${input.occasion || '(not given)'}
- Gender: ${input.gender || '(not given)'}
- Material (Google Shopping attribute, e.g. "Silk", "Cotton", "Georgette"): ${input.material || '(not given)'}
- Pattern (Google Shopping attribute, e.g. "Solid", "Floral Print", "Zari Border"): ${input.pattern || '(not given)'}
- Extra notes from the store owner: ${input.hint || '(none)'}

Respond with ONLY a JSON object (no markdown fences, no preamble) with these exact keys:
{
  "name": "SEO-friendly product title, 40-70 characters, includes fabric/craft + product type + a distinguishing detail (color/motif/occasion). No marketing fluff like 'Buy now'.",
  "description": "2-3 short paragraphs (120-180 words total) covering the fabric/weave/craft, look and feel, occasion fit, and a care tip. Written in warm, boutique-style language. No emojis.",
  "fabric": "short fabric name, e.g. 'Pure Kanjivaram Silk'",
  "origin": "short origin/weave region, e.g. 'Kanchipuram, Tamil Nadu'",
  "occasion": ["array", "of", "2-4", "short", "occasion", "tags", "e.g.", "Wedding", "Festive"],
  "material": "single Google Shopping material value, e.g. 'Silk' — a plain fabric-family word, not a brand name. NOTE: this is your best visual estimate from the photo/notes, not a lab-verified fact — the store owner should confirm it.",
  "pattern": "single Google Shopping pattern value, e.g. 'Solid', 'Zari Border', 'Floral Print', 'Striped'",
  "gender": "one of exactly: female, male, unisex",
  "meta_description": "a single SEO meta-description sentence, 140-160 characters, enticing and keyword-rich, ending without ellipsis"
}`;
}

/** Fetches a product image and base64-encodes it for Gemini's inline image input. */
async function fetchImageAsInlineData(imageUrl: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) return null;
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { mimeType, data: buffer.toString('base64') };
}

export async function POST(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI generation is not configured. Add GEMINI_API_KEY to your environment.' },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const input = {
    hint: (body?.hint as string | undefined)?.trim() || '',
    name: (body?.name as string | undefined)?.trim() || '',
    category: (body?.category as string | undefined)?.trim() || '',
    fabric: (body?.fabric as string | undefined)?.trim() || '',
    origin: (body?.origin as string | undefined)?.trim() || '',
    colors: (body?.colors as string | undefined)?.trim() || '',
    occasion: (body?.occasion as string | undefined)?.trim() || '',
    gender: (body?.gender as string | undefined)?.trim() || '',
    material: (body?.material as string | undefined)?.trim() || '',
    pattern: (body?.pattern as string | undefined)?.trim() || '',
  };
  const imageUrl = (body?.imageUrl as string | undefined)?.trim() || '';

  if (!input.hint && !input.name && !input.category && !imageUrl) {
    return NextResponse.json(
      { error: 'Give at least a product name, category, note, or photo to generate from.' },
      { status: 400 }
    );
  }

  try {
    let inlineImage: { mimeType: string; data: string } | null = null;
    if (imageUrl) {
      inlineImage = await fetchImageAsInlineData(imageUrl).catch(() => null);
    }

    const parts: any[] = [{ text: buildPrompt({ ...input, hasImage: !!inlineImage }) }];
    if (inlineImage) {
      parts.push({ inlineData: { mimeType: inlineImage.mimeType, data: inlineImage.data } });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[generate-listing] Gemini API error:', res.status, errText);
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
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const parsed: GeneratedListing = JSON.parse(cleaned);

    return NextResponse.json({ listing: parsed });
  } catch (err) {
    console.error('[generate-listing] error:', err);
    return NextResponse.json(
      { error: 'Could not generate a listing right now. Please try again.' },
      { status: 500 }
    );
  }
}
