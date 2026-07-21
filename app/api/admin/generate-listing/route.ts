import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

// Vercel kills serverless functions after 10s by default (Hobby plan).
// The NVIDIA vision model + image fetch routinely takes longer than that on
// the free tier, which was silently truncating this request before it could
// respond — the admin panel would spin forever then fail with an empty form
// and no real error message. This tells Vercel to allow up to 60s (the max
// on Hobby; Pro/Enterprise can go higher).
export const maxDuration = 60;

// Free-tier NVIDIA NIM vision-language model (build.nvidia.com).
// Get a free API key (nvapi-...) at https://build.nvidia.com — no credit card,
// ~1,000 free inference credits on signup. Swap this string for any other
// vision-capable model in the NIM catalog if you want to try alternatives.
//
// Using the 11B model instead of 90B: the 90B model was regularly taking
// 55s+ on the free tier, which blows past Vercel Hobby's 60s hard timeout
// ceiling. 11B is noticeably faster while still handling this task
// (extracting fabric/color/pattern details from a product photo) well.
const MODEL = 'meta/llama-3.2-11b-vision-instruct';
const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

interface GeneratedHighlights {
  fit_shape: string;
  length: string;
  neck: string;
  sleeve_length: string;
  sleeve_styling: string;
  surface_styling: string;
  print_or_pattern_type: string;
  net_quantity: string;
  add_on: string;
  type: string;
  generic_name: string;
  country_of_origin: string;
  transparency: string;
}

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
  highlights: GeneratedHighlights;
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
  "meta_description": "a single SEO meta-description sentence, 140-160 characters, enticing and keyword-rich, ending without ellipsis",
  "highlights": {
    "fit_shape": "e.g. 'Fit and Flare', 'Straight', 'A-Line' — leave '' if not applicable to this product type",
    "length": "e.g. 'Calf-Length', 'Ankle-Length', 'Saree Length (5.5 m)'",
    "neck": "e.g. 'Round Neck', 'Shoulder Straps', 'Sweetheart' — leave '' if not applicable (e.g. a saree with no stitched neckline)",
    "sleeve_length": "e.g. 'Sleeveless', 'Three-Quarter Sleeves', 'Full Sleeves' — leave '' if not applicable",
    "sleeve_styling": "e.g. 'Shoulder Strap', 'Regular Sleeves', 'Puff Sleeves' — leave '' if not applicable",
    "surface_styling": "e.g. 'Zari Woven', 'Embroidered', 'Smocking or Shirred', 'Plain'",
    "print_or_pattern_type": "e.g. 'Solid', 'Floral Print', 'Zari Border'",
    "net_quantity": "a plain number as a string, almost always '1'",
    "add_on": "e.g. 'Jacket', 'Blouse Piece', 'Petticoat' — leave '' if nothing is bundled",
    "type": "the product form factor, e.g. 'Saree', 'One Piece', 'Lehenga Set', 'Kurti'",
    "generic_name": "the plain-English product category, e.g. 'Sarees', 'Dresses', 'Kurtis'",
    "country_of_origin": "almost always 'India' for this store unless notes say otherwise",
    "transparency": "e.g. 'Opaque', 'Semi-Sheer' — your best visual estimate, leave '' if unsure"
  }
}

For the "highlights" object: look closely at the attached photo (if any) and infer these spec-sheet style details yourself the way an experienced merchandiser would — the store owner should not have to type these in by hand. Leave a field as an empty string '' rather than guessing wildly if it genuinely doesn't apply to this product type (e.g. a saree has no "neck" or "sleeve" of its own).

CRITICAL OUTPUT RULE: Reply with the raw JSON object ONLY. Do not use markdown formatting, headers (e.g. "**Product Listing**"), bullet points, or any text before or after the JSON. Your entire reply must start with { and end with }.`;
}

/** Fetches a product image and returns it as a base64 data: URI for NIM's image_url input. */
async function fetchImageAsDataUri(imageUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(imageUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) return null;
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
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
    let imageDataUri: string | null = null;
    if (imageUrl) {
      imageDataUri = await fetchImageAsDataUri(imageUrl).catch(() => null);
    }

    const promptText = buildPrompt({ ...input, hasImage: !!imageDataUri });

    // NIM follows the OpenAI chat-completions format: content is either a
    // plain string, or an array of {type:"text"} / {type:"image_url"} parts
    // when an image is attached.
    const userContent: any = imageDataUri
      ? [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: imageDataUri } },
        ]
      : promptText;

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
          messages: [{ role: 'user', content: userContent }],
          temperature: 0.4,
          max_tokens: 1024,
          // The 90B model handled the full nested json_schema mode fine, but
          // the faster 11B model doesn't reliably honor it and would reply
          // with markdown prose instead of JSON. json_object is a simpler,
          // more widely-supported mode — exact field names/types come from
          // the strict instructions in the prompt itself instead.
          response_format: { type: 'json_object' },
        }),
      });
    } finally {
      clearTimeout(nimTimeout);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[generate-listing] NVIDIA NIM API error:', res.status, errText);
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

    let parsed: GeneratedListing;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Smaller/faster vision models (e.g. 11B) don't always honor
      // response_format and sometimes reply in markdown/prose with the JSON
      // object embedded inside (or not at all). Try to salvage a JSON object
      // from anywhere in the text before giving up.
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = undefined as any;
        }
      }
      if (!parsed) {
        // Log the raw model output so we can see exactly what came back
        // (e.g. a markdown-formatted refusal) instead of just "not valid JSON".
        console.error('[generate-listing] Non-JSON model response:', text.slice(0, 500));
        return NextResponse.json(
          { error: 'AI returned an unexpected response format. Please try again.' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ listing: parsed });
  } catch (err) {
    console.error('[generate-listing] error:', err);
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        error: timedOut
          ? 'AI is taking too long to respond (free tier can be slow). Please try again in a minute.'
          : 'Could not generate a listing right now. Please try again.',
      },
      { status: timedOut ? 504 : 500 }
    );
  }
}
