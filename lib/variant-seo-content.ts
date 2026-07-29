// Deterministic (no AI call) SEO content generator for colour variants.
//
// WHY THIS EXISTS: each colour variant gets its own URL (see
// app/product/[slug]/page.tsx), but if the vendor/admin leaves the
// meta_title/meta_description blank for every colour, or copy-pastes the
// same text into each one, Google can end up treating all the colour pages
// as near-duplicate content and only indexing one of them (the "Discovered
// - currently not indexed" pattern). This generator guarantees every colour
// gets a genuinely different <title>, meta description, AND a visible
// on-page paragraph (`styleNote`, rendered in the Description tab — see
// product-detail.tsx) so the *content*, not just the URL, differs.
//
// Selection is seeded from the product name + colour (not random), so:
//   - the same product+colour always regenerates the same copy (idempotent,
//     safe to call again after an edit)
//   - two different colours on the same product reliably land on different
//     template combinations
//   - re-running this after a title/colour change naturally produces fresh
//     copy instead of being stuck on stale wording
//
// The phrase pools below are grounded in what's actually driving search
// traffic for Indian ethnic wear right now (organic/office wear cottons,
// festive silks with zari/jewel tones, sustainable handloom, linen/organza/
// silk-cotton blends) rather than generic filler, since the whole point is
// to help these pages rank and pull in organic traffic -- not just pass a
// "content is unique" check.

export interface VariantSeoInput {
  /** Base product / listing name, e.g. "Cotton Silk Saree with Floral Motif Embroidery". */
  productName: string;
  /** e.g. "Banarasi Silk", "Chanderi Cotton" — falls back to "handloom" if missing. */
  fabric?: string | null;
  /** e.g. "Sarees", "Lehengas" — used to pick the right product noun. */
  category?: string | null;
  /** AI-generated occasion tags for the base product, e.g. ["Wedding", "Festive"]. */
  occasion?: string[] | null;
  /** This variant's colour, e.g. "Peacock Blue". */
  color: string;
}

export interface VariantSeoOutput {
  metaTitle: string;
  metaDescription: string;
  /** Short on-page paragraph, unique per colour — render this visibly on
   *  the PDP (not just in <head> metadata) so the page's actual content
   *  differs between colour variants, not only its meta tags. */
  styleNote: string;
}

// Search-intent phrases currently driving traffic for Indian ethnic wear
// (organic/daily-wear cottons, festive silks, sustainable handloom,
// linen/organza/silk-cotton blends). Rotated per variant so the same
// phrase isn't reused across every colour of a product.
const KEYWORD_PHRASES = [
  'handloom saree online',
  'pure cotton handloom saree',
  'silk saree for wedding',
  'festive silk saree with zari border',
  'sustainable handloom saree',
  'banarasi silk saree online',
  'silk-cotton blend saree',
  'checked cotton saree for daily wear',
  'organza saree online',
  'linen saree for office wear',
  'handwoven saree for festive season',
  'cotton saree for daily wear',
];

const OCCASION_HOOKS = [
  'perfect for festive get-togethers',
  'an easy pick for everyday office wear',
  'ideal for a wedding sangeet or reception',
  'a versatile piece you can dress up or down',
  'great for pooja days and family functions',
  'a comfortable choice for long summer days',
  'a statement piece for date nights and parties',
  'suited to Diwali, Durga Puja and festive mornings',
  'made for the daily-wear rotation that still looks put together',
  'a graceful pick for a formal work event',
];

const STYLING_TIPS = [
  'Pair it with polki or kundan jewellery and a sleek bun for a classic festive look.',
  'Keep the blouse minimal and let the drape do the talking — a single statement earring is enough.',
  'Style it with a contrast blouse and juttis for a modern ethnic-chic look.',
  'A jhumka and a small bindi finish the look beautifully without overdoing it.',
  'Layer a light shawl over it on cooler evenings without hiding the weave.',
  'Go for gold-toned accessories to bring out the border work.',
  'Team it with a potli bag and block heels for weddings and receptions.',
  'Keep hair in loose waves to balance the structured pallu.',
  'A simple cotton blouse and minimal jewellery keep this one office-appropriate.',
  'Add a statement neckpiece if dressing it up for evening functions.',
];

/** Small deterministic string hash (djb2) — good enough to pick stable,
 *  well-spread indices from the pools above; no crypto requirement here. */
function seedFrom(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

/** Strips any previously-appended " - Colour" suffix so we don't end up
 *  with "Saree - Blue - Blue" if this runs on an already-suffixed name. */
function cleanProductName(name: string): string {
  return name.replace(/\s*[-–]\s*[^-–]+$/, '').trim() || name.trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd().replace(/[,.;:]$/, '') + '…';
}

export function generateVariantSeoContent(input: VariantSeoInput): VariantSeoOutput {
  const color = input.color.trim();
  const baseName = cleanProductName(input.productName || 'Handloom Saree');
  const fabric = (input.fabric || 'handloom').trim();
  const seed = seedFrom(`${baseName}|${color}`);

  const keyword = KEYWORD_PHRASES[seed % KEYWORD_PHRASES.length];
  const hook = OCCASION_HOOKS[Math.floor(seed / KEYWORD_PHRASES.length) % OCCASION_HOOKS.length];
  const tip = STYLING_TIPS[Math.floor(seed / (KEYWORD_PHRASES.length * OCCASION_HOOKS.length)) % STYLING_TIPS.length];

  const keywordTitleCase = keyword.replace(/\b\w/g, (c) => c.toUpperCase());

  const metaTitle = truncate(
    `${color} ${keywordTitleCase} – ${baseName} | AruhiHandlooms`,
    100
  );

  const metaDescription = truncate(
    `Shop the ${color} ${baseName.toLowerCase()} — ${hook}. Genuine ${fabric}, ${keyword}, doorstep delivery across India.`,
    160
  );

  const styleNote = `This ${color.toLowerCase()} colourway is ${hook}. ${tip}`;

  return { metaTitle, metaDescription, styleNote };
}
