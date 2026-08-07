/**
 * Search utilities:
 * 1. Hindi/Hinglish color word mapping
 * 2. Typo-tolerant fuzzy matching (Levenshtein distance)
 */

// Hindi/Hinglish → English color mappings
const HINDI_COLOR_MAP: Record<string, string> = {
  // Reds
  lal: 'red', laal: 'red', surkh: 'red', gulabi: 'pink', gulaabi: 'pink',
  // Blues
  neela: 'blue', nila: 'blue', neeli: 'blue', nili: 'blue',
  // Greens
  hara: 'green', hari: 'green', haara: 'green',
  // Yellows
  peela: 'yellow', pila: 'yellow', peeli: 'yellow',
  // Whites
  safed: 'white', safaid: 'white', shwet: 'white',
  // Blacks
  kala: 'black', kaala: 'black', kali: 'black',
  // Oranges
  narangi: 'orange', kesariya: 'orange', kesari: 'orange',
  // Purples
  baingani: 'purple', jamuni: 'purple', jaamuni: 'purple',
  // Browns
  bhura: 'brown', bhoora: 'brown', bhoori: 'brown',
  // Greys
  thaitha: 'grey', dhusri: 'grey', surmai: 'grey',
  // Maroon
  maroon: 'maroon', laalimaa: 'maroon',
  // Gold
  sona: 'gold', sone: 'gold', golden: 'gold',
  // Cream/Beige
  cream: 'cream', malai: 'cream', beige: 'beige',
  // Magenta/Rani
  rani: 'rani pink', magenta: 'magenta',
};

/**
 * Translate a query: replace any Hindi color word with its English equivalent.
 * Also returns the original so both can be searched.
 */
export function expandHindiQuery(q: string): string[] {
  const lower = q.trim().toLowerCase();
  const words = lower.split(/\s+/);
  let translated = false;
  const mappedWords = words.map((w) => {
    if (HINDI_COLOR_MAP[w]) {
      translated = true;
      return HINDI_COLOR_MAP[w];
    }
    return w;
  });
  const results = [lower];
  if (translated) results.push(mappedWords.join(' '));
  return results;
}

/** Simple Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy match: returns true if `text` contains a word close enough to `q`.
 * Tolerance: 1 edit for words 4+ chars, exact for shorter.
 */
export function fuzzyMatch(text: string, q: string): boolean {
  if (!text || !q) return false;
  const textLower = text.toLowerCase();
  const qLower = q.toLowerCase();

  // Exact substring match first (fast path)
  if (textLower.includes(qLower)) return true;

  // For very short queries, only exact
  if (qLower.length < 4) return false;

  // Check each word in text against query
  const maxDist = qLower.length <= 5 ? 1 : 2;
  const words = textLower.split(/[\s,/-]+/);
  for (const word of words) {
    if (word.length < 2) continue;
    if (levenshtein(word, qLower) <= maxDist) return true;
    // Also check if query is a prefix-match within longer words
    if (word.length > qLower.length && word.startsWith(qLower.slice(0, -1))) return true;
  }
  return false;
}

/**
 * Master search function: checks if a product matches query using
 * exact match, Hindi translation, and fuzzy matching.
 */
export function productMatchesQuery(
  product: {
    name: string;
    category: string;
    fabric: string;
    origin: string;
    colors?: string[];
    all_colors?: string[];
    occasion?: string[];
    variant_list?: { color: string; slug: string; image?: string | null }[];
  },
  rawQuery: string
): { matched: boolean; matchedVariant?: { color: string; slug: string; image?: string | null } } {
  const queries = expandHindiQuery(rawQuery);

  for (const q of queries) {
    const nameMatch = fuzzyMatch(product.name, q);
    const catMatch = fuzzyMatch(product.category, q);
    const fabricMatch = fuzzyMatch(product.fabric, q);
    const originMatch = fuzzyMatch(product.origin, q);
    const colorMatch = (product.all_colors ?? product.colors ?? []).some((c) => fuzzyMatch(c, q));
    const occasionMatch = (product.occasion ?? []).some((o) => fuzzyMatch(o, q));
    const matchedVariant = product.variant_list?.find((v) => fuzzyMatch(v.color, q));

    if (nameMatch || catMatch || fabricMatch || originMatch || colorMatch || occasionMatch || matchedVariant) {
      return { matched: true, matchedVariant };
    }
  }

  return { matched: false };
}
