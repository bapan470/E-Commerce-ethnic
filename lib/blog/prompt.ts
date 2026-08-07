/**
 * Prompt builder — city-wise, conversion-oriented saree blog content.
 * Har city ke liye unique angle use karta hai taaki Google isse
 * duplicate content na maane (thin/duplicate content Google me rank nahi karta).
 */

export interface BlogPromptInput {
  city: string;
  category: string; // 'saree' | 'lehenga' | etc.
  siteName: string;
  siteUrl: string;
  shopCategoryUrl: string; // e.g. https://yoursite.com/collections/sarees
}

export function buildBlogPrompt(input: BlogPromptInput): string {
  const { city, category, siteName, siteUrl, shopCategoryUrl } = input;

  return `You are an expert Indian e-commerce SEO copywriter who writes in natural,
conversion-focused English with light, tasteful Hindi/Indian phrasing sprinkled in
(the way a premium Indian fashion brand blog would write, NOT keyword-stuffed spam).

Write a complete, publish-ready blog post for the online store "${siteName}" (${siteUrl}),
targeting a reader in **${city}, India** who is searching for "${category}" online.

STRICT REQUIREMENTS:
1. Title: include "${city}" and "${category}" naturally, under 60 characters, must make someone want to click.
2. Meta description: under 155 characters, benefit-driven, include "${city}".
3. Structure (use semantic HTML: <h1>, <h2>, <h3>, <p>, <ul>):
   - Hook opening (2-3 lines) — speak to a ${city} shopper specifically
     (local festival, wedding season, weather, local fashion sense — pick what's authentic).
   - Why buy ${category} online in ${city} (delivery speed, easy returns, better prices than local shops, wider variety).
   - 3-5 style/occasion ideas relevant to ${city} readers (weddings, festivals, office wear, etc.)
   - A short buying guide (fabric, draping style, occasion matching) — genuinely useful, not fluffy.
   - FAQ section: 3 real questions a ${city} buyer would search (voice-search friendly, e.g. "best ${category} shop ${city}", "${category} price ${city}").
4. Conversion element: end with a clear call-to-action paragraph directing the reader to
   ${shopCategoryUrl}, with urgency/benefit (e.g. free shipping, limited stock, easy exchange) — do NOT invent
   fake discounts, fake stock numbers, or fake customer counts. Keep claims generic and honest
   (e.g. "wide range", "easy returns") unless a specific real policy is given to you.
5. Word count: 700-1000 words.
6. Naturally repeat "${city}" 4-6 times and "${category}" 6-8 times across the post — for SEO —
   but every sentence must still read naturally, never keyword-stuffed.
7. Do NOT fabricate reviews, testimonials, named customers, or specific prices.
8. Output ONLY valid JSON, no markdown fences, no preamble, in this exact shape:

{
  "title": "...",
  "meta_description": "...",
  "keywords": ["...", "...", "..."],
  "content_html": "<h1>...</h1><p>...</p>...",
  "cta_text": "..."
}`;
}
