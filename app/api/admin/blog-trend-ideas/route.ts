import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

// Google has no official free Trends API. The public "Trending Now" RSS feed
// (used by the Trends website itself) is the closest thing — no key needed,
// but it's undocumented, can change shape, get rate-limited, or be
// unreachable from some hosts. Everything here is best-effort: if the fetch
// or parse fails, we just fall back to the curated list below instead of
// erroring the whole endpoint out.
const TRENDS_RSS_URL = 'https://trends.google.com/trending/rss?geo=IN';

// Loose relevance filter — keeps only trending queries that plausibly relate
// to this store's niche (Indian ethnic wear) instead of showing completely
// unrelated trending news to the admin.
const RELEVANCE_WORDS = [
  'saree', 'sari', 'lehenga', 'kurti', 'kurta', 'ethnic', 'wedding', 'bridal',
  'silk', 'banarasi', 'kanjivaram', 'festive', 'diwali', 'navratri', 'durga puja',
  'karva chauth', 'raksha bandhan', 'eid', 'holi', 'fashion', 'outfit', 'dress',
  'salwar', 'anarkali', 'dupatta', 'handloom', 'weave', 'blouse', 'sangeet',
];

// Evergreen topic bank tied to the Indian festival/wedding calendar plus
// reliable SEO content shapes (how-to, comparison, care guide, size guide).
// Always returned alongside live Trends data so the admin never sees an
// empty list — this is the reliable backbone, Trends data is the bonus.
const SEASONAL_BANK: { month: number; topics: string[] }[] = [
  { month: 1, topics: ['republic day outfit ideas ethnic wear', 'winter wedding guest saree guide', 'pongal and makar sankranti traditional outfits'] },
  { month: 2, topics: ['valentines day ethnic outfit ideas', 'spring wedding season lehenga trends', 'how to accessorize a saree for day functions'] },
  { month: 3, topics: ['holi outfit guide cotton and silk', 'what to wear for holi that wont stain', 'navratri chaniya choli buying guide'] },
  { month: 4, topics: ['summer saree fabric guide cotton vs linen', 'baisakhi traditional outfit ideas', 'lightweight kurtis for summer'] },
  { month: 5, topics: ['how to keep silk sarees cool and fresh in summer', 'destination wedding outfit packing guide', 'best fabrics for humid weather ethnic wear'] },
  { month: 6, topics: ['monsoon saree care tips', 'rath yatra traditional outfit guide', 'how to prevent silk from fungus in monsoon'] },
  { month: 7, topics: ['guru purnima traditional outfit ideas', 'monsoon wedding guest outfit guide', 'how to store sarees during monsoon'] },
  { month: 8, topics: ['raksha bandhan outfit ideas for sisters', 'independence day tricolor ethnic outfit ideas', 'janmashtami traditional dress guide'] },
  { month: 9, topics: ['onam traditional kasavu saree guide', 'ganesh chaturthi outfit ideas', 'early navratri shopping guide'] },
  { month: 10, topics: ['navratri 9 colours outfit guide', 'durga puja saree shopping guide', 'karva chauth outfit and makeup pairing', 'dussehra traditional outfit ideas'] },
  { month: 11, topics: ['diwali saree and lehenga trends', 'wedding season 2026 lehenga trends', 'diwali gifting guide ethnic wear', 'bhai dooj outfit ideas'] },
  { month: 12, topics: ['winter wedding season bridal shopping guide', 'christmas and new year ethnic party wear', 'year end sale saree shopping guide'] },
];

interface TopicIdea {
  topic: string;
  source: 'trends' | 'seasonal';
}

function extractRssTitles(xml: string): string[] {
  // Deliberately regex-based rather than pulling in an XML parser dependency
  // for one endpoint — Trends RSS <item><title> is a plain, well-formed tag.
  const titles: string[] = [];
  const itemBlocks = xml.split('<item>').slice(1);
  for (const block of itemBlocks) {
    const match = block.match(/<title>([\s\S]*?)<\/title>/);
    if (match) {
      const raw = match[1]
        .replace('<![CDATA[', '')
        .replace(']]>', '')
        .trim();
      if (raw) titles.push(raw);
    }
  }
  return titles;
}

async function fetchTrendingTopics(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let res: Response;
    try {
      res = await fetch(TRENDS_RSS_URL, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogTrendBot/1.0)' },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return [];
    const xml = await res.text();
    const titles = extractRssTitles(xml);
    const lower = (s: string) => s.toLowerCase();
    return titles.filter((t) => RELEVANCE_WORDS.some((w) => lower(t).includes(w)));
  } catch (err) {
    console.error('[blog-trend-ideas] Trends RSS fetch failed (non-fatal, using seasonal bank only):', err);
    return [];
  }
}

export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const thisMonth = SEASONAL_BANK.find((m) => m.month === now.getMonth() + 1);
  const nextMonth = SEASONAL_BANK.find((m) => m.month === ((now.getMonth() + 1) % 12) + 1);

  const seasonal: TopicIdea[] = [
    ...(thisMonth?.topics ?? []),
    ...(nextMonth?.topics.slice(0, 2) ?? []),
  ].map((topic) => ({ topic, source: 'seasonal' as const }));

  const trendingRaw = await fetchTrendingTopics();
  const trending: TopicIdea[] = trendingRaw.slice(0, 8).map((topic) => ({ topic, source: 'trends' as const }));

  return NextResponse.json({ ideas: [...trending, ...seasonal] });
}
