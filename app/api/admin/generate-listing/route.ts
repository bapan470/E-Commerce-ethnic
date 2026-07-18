import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

// Free-tier NVIDIA NIM vision-language model (build.nvidia.com).
// Get a free API key (nvapi-...) at https://build.nvidia.com — no credit card,
// ~1,000 free inference credits on signup. Swap this string for any other
// vision-capable model in the NIM catalog if you want to try alternatives.
const MODEL = 'meta/llama-3.2-90b-vision-instruct';
const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

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

/** Fetches a product image and returns it as a base64 data: URI for NIM's image_url input. */
async function fetchImageAsDataUri(imageUrl: string) {
  const res = await fetch(imageUrl);
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

    const res = await fetch(NIM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.4,
        max_tokens: 1024,
        // Forces the model to always emit valid, schema-matching JSON instead
        // of occasionally replying with a plain-text sentence (which used to
        // crash JSON.parse below).
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ProductListing',
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                fabric: { type: 'string' },
                origin: { type: 'string' },
                occasion: { type: 'array', items: { type: 'string' } },
                material: { type: 'string' },
                pattern: { type: 'string' },
                gender: { type: 'string', enum: ['female', 'male', 'unisex'] },
                meta_description: { type: 'string' },
              },
              required: [
                'name',
                'description',
                'fabric',
                'origin',
                'occasion',
                'material',
                'pattern',
                'gender',
                'meta_description',
              ],
            },
          },
        },
      }),
    });

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
    } catch (parseErr) {
      // Log the raw model output so we can see exactly what came back
      // (e.g. a refusal sentence) instead of just "not valid JSON".
      console.error('[generate-listing] Non-JSON model response:', text.slice(0, 500));
      return NextResponse.json(
        { error: 'AI returned an unexpected response. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ listing: parsed });
  } catch (err) {
    console.error('[generate-listing] error:', err);
    return NextResponse.json(
      { error: 'Could not generate a listing right now. Please try again.' },
      { status: 500 }
    );
  }
}
