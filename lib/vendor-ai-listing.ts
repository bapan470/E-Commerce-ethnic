// Shared AI listing generator for vendor-submitted products.
// Called by /api/vendor/ai-process/[id] after a vendor publishes or edits a product.
// Uses the same NVIDIA NIM vision-language model as the admin generate-listing route.

const MODEL = 'meta/llama-3.2-11b-vision-instruct';
const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

export interface VendorAIInput {
  name: string;
  fabric: string;
  category: string;
  images: string[];
}

export interface VendorAIListing {
  name: string;
  description: string;
  fabric: string;
  origin: string;
  occasion: string[];
  material: string;
  pattern: string;
  gender: string;
  meta_description: string;
  colors: string[];
  highlights: Record<string, string>;
}

function buildVendorPrompt(input: {
  name: string;
  fabric: string;
  category: string;
  hasImage: boolean;
}): string {
  return `You are an SEO copywriter and Google Merchant Center data specialist for "Aruhi Handlooms", an Indian ethnic-wear e-commerce store selling handwoven sarees, lehengas, bridal wear and kurtis.

${input.hasImage ? 'A photo of the actual product is attached — look at it closely and base the fabric, color, motifs, and craft details on what you actually see in the image.' : ''}

Write a complete product listing based on this vendor-submitted info:

- Product name/keywords: ${input.name || '(not given)'}
- Category: ${input.category || '(not given)'}
- Fabric: ${input.fabric || '(not given)'}

Fill in sensible, realistic details for an Indian handloom ethnic-wear store where a field is missing. Keep the vendor's provided details exactly as-is where possible.

Respond with ONLY a JSON object (no markdown fences, no preamble) with these exact keys:
{
  "name": "SEO-friendly product title, 40-70 characters. Must combine: (1) the fabric/craft type, (2) the product type, (3) the exact base colour of THIS specific photographed item (e.g. 'Green', 'Black', 'Maroon'), and (4) one concrete visual detail that is actually visible in THIS photo (e.g. the specific motif, border style, or embroidery placement — not a generic word like 'floral' if you can see it's actually a vine or booti pattern). Two different products must never end up with an identical title — if you were shown a different photo, colour, or motif, the title must read differently too. No marketing fluff, no filler adjectives that don't come from the photo.",
  "description": "2-3 short paragraphs (120-180 words total) covering fabric/weave/craft, look and feel, occasion fit, and a care tip. Warm, boutique-style language. No emojis.",
  "fabric": "full fabric name, e.g. 'Pure Kanjivaram Silk'",
  "origin": "weave region, e.g. 'Kanchipuram, Tamil Nadu'",
  "occasion": ["2-4 occasion tags, e.g.", "Wedding", "Festive"],
  "material": "single Google Shopping material value, e.g. 'Silk'",
  "pattern": "single Google Shopping pattern value, e.g. 'Zari Border'",
  "gender": "one of exactly: female, male, unisex",
  "meta_description": "SEO meta-description, 140-160 characters, enticing and keyword-rich",
  "colors": ["exactly ONE value -- the single base colour this exact photographed item is sold in, e.g. 'Maroon'. Do NOT list every decorative/embroidery/border colour visible in the photo -- this value becomes the colour swatch shown to shoppers, so extra colours here make the product look like it comes in colours it doesn't."],
  "highlights": {
    "border": "e.g. 'Zari', 'Temple Border' — leave empty string if not applicable",
    "border_width": "e.g. 'Small Border', 'Broad Border' — leave empty string if not applicable",
    "blouse": "e.g. 'Separate Blouse Piece', 'Without Blouse' — leave empty string if not applicable",
    "saree_fabric": "e.g. 'Georgette' — leave empty string if not a saree",
    "saree_pattern": "e.g. 'Handloom Woven' — leave empty string if not applicable",
    "ornamentation": "e.g. 'Zari Work', 'Plain' — leave empty string if none",
    "blouse_fabric": "e.g. 'Bangalori Silk' — leave empty string if no blouse",
    "pallu_details": "e.g. 'Same as Saree', 'Contrast Pallu' — leave empty string if not applicable",
    "blouse_pattern": "e.g. 'Solid' — leave empty string if no blouse",
    "blouse_color": "e.g. 'Black' — leave empty string if no blouse",
    "brand": "Aruhi Handlooms",
    "loom_type": "e.g. 'Handloom', 'Powerloom' — your best estimate, leave empty string if unclear",
    "fit_shape": "e.g. 'Straight', 'A-Line' — leave empty string if not applicable",
    "length": "e.g. 'Ankle-Length', 'Saree Length (5.5 m)'",
    "neck": "e.g. 'Round Neck' — leave empty string if not applicable (e.g. saree)",
    "sleeve_length": "e.g. 'Sleeveless', 'Full Sleeves' — leave empty string if not applicable",
    "sleeve_styling": "e.g. 'Regular Sleeves' — leave empty string if not applicable",
    "surface_styling": "e.g. 'Zari Woven', 'Embroidered', 'Plain'",
    "print_or_pattern_type": "e.g. 'Solid', 'Floral Print', 'Zari Border'",
    "net_quantity": "1",
    "add_on": "e.g. 'Blouse Piece' — leave empty string if nothing bundled",
    "type": "e.g. 'Saree', 'Lehenga Set', 'Kurti'",
    "generic_name": "e.g. 'Sarees', 'Kurtis'",
    "country_of_origin": "India",
    "transparency": "e.g. 'Opaque', 'Semi-Sheer' — leave empty string if unsure"
  }
}`;
}

/** Calls NVIDIA NIM to generate a full product listing from vendor-submitted basics.
 *  Returns null if NVIDIA_API_KEY is not set or the AI call fails — callers
 *  should still publish the product with basic fields in that case. */
export async function generateVendorListing(input: VendorAIInput): Promise<VendorAIListing | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  // Fetch and convert the first image to base64 for vision analysis.
  // A 10s timeout (matching app/api/admin/generate-listing/route.ts) stops a
  // slow/hanging storage fetch from eating into the 60s function budget and
  // starving the NIM call below of the time it needs (20-55s on the free tier).
  let imageDataUri: string | null = null;
  if (input.images[0]) {
    const imgController = new AbortController();
    const imgTimeout = setTimeout(() => imgController.abort(), 10_000);
    try {
      const imgRes = await fetch(input.images[0], { signal: imgController.signal });
      if (imgRes.ok) {
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        imageDataUri = `data:${contentType};base64,${base64}`;
      } else {
        console.error('[vendor-ai-listing] image fetch not ok:', imgRes.status, input.images[0]);
      }
    } catch (err) {
      console.error('[vendor-ai-listing] image fetch failed/timed out, proceeding text-only:', err);
    } finally {
      clearTimeout(imgTimeout);
    }
  }

  const promptText = buildVendorPrompt({
    name: input.name,
    fabric: input.fabric,
    category: input.category,
    hasImage: !!imageDataUri,
  });

  const userContent: unknown = imageDataUri
    ? [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: imageDataUri } },
      ]
    : promptText;

  // The calling route (/api/vendor/ai-process/[id]) declares
  // `export const maxDuration = 60`, and this app is hosted on Vercel
  // (not Netlify — an earlier version of this comment assumed Netlify's
  // 10s hard limit, which doesn't apply here and was never correct for
  // this deployment). The NVIDIA vision-language model routinely takes
  // 20-55s to respond on the free tier — see app/api/admin/generate-listing/
  // route.ts, which already uses a 55s timeout for this exact model/call
  // and works reliably. An 8s timeout was aborting almost every request,
  // which is why vendor products were going live with empty AI fields
  // (name/fabric/category from the vendor's own submission, but no
  // description/origin/occasion/highlights — those only ever come from
  // this call). 50s leaves ~10s of headroom within the 60s function
  // budget for the DB update + vendor email that follow.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);

  let res: Response;
  try {
    res = await fetch(NIM_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.4,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    // Network error, abort/timeout, DNS failure, etc. Never let this
    // throw out of the function — caller falls back to publishing the
    // product with the vendor's basic fields instead of AI-generated ones.
    console.error('[vendor-ai-listing] NIM fetch failed:', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[vendor-ai-listing] NIM API error:', res.status, errText);
    return null;
  }

  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    console.error('[vendor-ai-listing] failed to parse NIM response as JSON:', err);
    return null;
  }
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const cleaned = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();

  let parsed: VendorAIListing | undefined;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
  }

  if (!parsed) {
    console.error('[vendor-ai-listing] non-JSON model response:', text.slice(0, 300));
    return null;
  }

  // Safety net: the prompt asks for exactly one base colour, but a vision
  // model won't always follow that perfectly. `colors` here represents this
  // product's own swatch (merged with real product_variants colours by
  // resolveAllColors in lib/products-api.ts / products-api-server.ts), so
  // any extra values that slip through would show up as fake colour dots
  // on the product card for colours that were never actually listed.
  if (Array.isArray(parsed.colors) && parsed.colors.length > 1) {
    parsed.colors = parsed.colors.slice(0, 1);
  }

  return parsed;
}
