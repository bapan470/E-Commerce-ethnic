'use client';

import { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SlidersHorizontal, TrendingDown, Flame, Gift, Camera, ChevronRight, ImageOff, Video, VideoOff } from 'lucide-react';
import { Product, CategoryRow } from '@/lib/types';
import { expandProductVariants, ExpandedProduct } from '@/lib/expand-product-variants';
import ProductCard from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { STANDARD_SIZES } from '@/lib/size-chart';
import { productMatchesQuery, expandHindiQuery, fuzzyMatch } from '@/lib/search-utils';
import { getColorSwatchHex } from '@/lib/color-swatch';
import { trackEvent } from '@/lib/track-api';
import { fireGtagEvent } from '@/lib/gtag-track';
import { blurDataURL } from '@/lib/utils';
import QuickNavIcons from '@/components/quick-nav-icons';
import { fetchCatalogVideoSettings, fetchCatalogListingSettings, DEFAULT_CATALOG_LISTING_SETTINGS } from '@/lib/settings-api';

const CATALOG_VIDEO_PREF_KEY = 'aruhi-catalog-video-enabled';

const ALL_SIZES = [...STANDARD_SIZES];

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest' | 'price-drop' | 'most-gifted';

const QUICK_FILTERS: { key: SortKey; label: string; icon: typeof TrendingDown }[] = [
  { key: 'price-drop', label: 'Price Drop', icon: TrendingDown },
  { key: 'rating', label: 'Bestseller', icon: Flame },
  { key: 'most-gifted', label: 'Most Gifted', icon: Gift },
];

// `products` and `categories` now arrive as props, already fetched on the
// server (see page.tsx). This component never re-fetches them -- it only
// filters/sorts the list the server handed it, so the first paint has real
// products instead of a loading skeleton, and there's no client-side
// waterfall hitting Supabase on every visit.
interface ShopContentProps {
  products: Product[];
  categories: CategoryRow[];
}

function ShopContentInner({ products, categories }: ShopContentProps) {
  const params = useSearchParams();
  const router = useRouter();
  // This component is now mounted at both /shop (category/filter browsing)
  // and /search (text search has its own URL — see app/search/page.tsx), so
  // any navigation back to "the current listing page" must use whichever
  // path we're actually on instead of a hardcoded '/shop'.
  const pathname = usePathname();

  // Set by the header's "search by image" camera button: it ranks the
  // catalog by visual similarity client-side (lib/image-search.ts) and
  // hands us the ranked product ids via sessionStorage, since an uploaded
  // photo can't be put in a URL the way a text query can.
  const [imageSearchIds, setImageSearchIds] = useState<string[] | null>(null);
  // Per-product id, the exact photo (default OR a colour variant's) that
  // matched the shopper's uploaded photo best — lets each card show that
  // specific photo instead of always falling back to its default image.
  const [imageSearchMatches, setImageSearchMatches] = useState<Record<string, string>>({});
  // Small preview of the photo the shopper searched with, shown in the
  // banner below so it's obvious the results are tied to that photo.
  const [imageSearchThumbnail, setImageSearchThumbnail] = useState<string | null>(null);

  const initialCategory = params.get('category') || '';
  const initialQuery = params.get('q') || '';

  const [selectedCats, setSelectedCats] = useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedFabrics, setSelectedFabrics] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 35000]);
  const initialSort = (params.get('sort') as SortKey) || 'featured';
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Shopper-facing "Video" toggle (next to Filters/Sort) — lets them turn
  // the autoplaying catalog video previews on/off for their own browsing.
  // Starts from the admin's master default (Admin > Settings > Catalog
  // Video Autoplay) the first time this browser visits; after that, their
  // own choice is remembered in localStorage and wins over the admin
  // default on later visits, same as the sort/filter state on this page
  // being per-shopper rather than server-dictated.
  const [videoEnabled, setVideoEnabled] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(CATALOG_VIDEO_PREF_KEY) : null;
    if (stored === 'on' || stored === 'off') {
      setVideoEnabled(stored === 'on');
      return;
    }
    fetchCatalogVideoSettings()
      .then((s) => {
        if (!cancelled) setVideoEnabled(s.default_enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const toggleVideoEnabled = (checked: boolean) => {
    setVideoEnabled(checked);
    try {
      window.localStorage.setItem(CATALOG_VIDEO_PREF_KEY, checked ? 'on' : 'off');
    } catch {
      // Private browsing / storage blocked -- toggle still works for this
      // page view, it just won't be remembered next visit.
    }
  };

  // Filter option lists are derived from whatever products/admin have
  // actually tagged, so the panel never shows an empty or stale option.
  const allColors = useMemo(
    () =>
      Array.from(
        new Set(
          products.flatMap((p) => [
            ...(p.all_colors ?? p.colors ?? []),
            ...(p.variant_list?.map((v) => v.color) ?? []),
          ])
        )
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const allFabrics = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.fabric).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [products]
  );
  const allOccasions = useMemo(
    () => Array.from(new Set(products.flatMap((p) => p.occasion || []))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  // Only show categories that actually have at least one product,
  // so the filter panel never lists an empty category.
  const categoriesWithProducts = useMemo(() => {
    const namesWithProducts = new Set(products.map((p) => p.category));
    return categories.filter((c) => namesWithProducts.has(c.name));
  }, [categories, products]);

  useEffect(() => {
    const c = params.get('category') || '';
    setSelectedCats(c ? [c] : []);
    setQuery(params.get('q') || '');

    if (params.get('imgsearch') === '1') {
      try {
        const raw = sessionStorage.getItem('imageSearchResults');
        setImageSearchIds(raw ? JSON.parse(raw) : null);
      } catch {
        setImageSearchIds(null);
      }
      try {
        const rawMatches = sessionStorage.getItem('imageSearchMatchedImages');
        setImageSearchMatches(rawMatches ? JSON.parse(rawMatches) : {});
      } catch {
        setImageSearchMatches({});
      }
      setImageSearchThumbnail(sessionStorage.getItem('imageSearchThumbnail'));
    } else {
      setImageSearchIds(null);
      setImageSearchMatches({});
      setImageSearchThumbnail(null);
    }
  }, [params]);

  const clearImageSearch = () => {
    sessionStorage.removeItem('imageSearchResults');
    sessionStorage.removeItem('imageSearchMatchedImages');
    sessionStorage.removeItem('imageSearchThumbnail');
    setImageSearchIds(null);
    setImageSearchMatches({});
    setImageSearchThumbnail(null);
    router.replace(pathname);
  };

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const filtered = useMemo(() => {
    let list = [...products];
    if (selectedCats.length > 0) {
      list = list.filter((p) => selectedCats.includes(p.category));
    }
    if (selectedSizes.length > 0) {
      list = list.filter((p) => p.sizes.some((s) => selectedSizes.includes(s)));
    }
    if (selectedColors.length > 0) {
      list = list.filter((p) => {
        const productColors = [
          ...(p.all_colors ?? p.colors ?? []),
          ...(p.variant_list?.map((v) => v.color) ?? []),
        ].map((c) => c.toLowerCase());
        return selectedColors.some((sc) => productColors.includes(sc.toLowerCase()));
      });
    }
    if (selectedFabrics.length > 0) {
      list = list.filter((p) => selectedFabrics.includes(p.fabric));
    }
    if (selectedOccasions.length > 0) {
      list = list.filter((p) => (p.occasion || []).some((o) => selectedOccasions.includes(o)));
    }
    list = list.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );
    if (query.trim()) {
      list = list.filter((p) => productMatchesQuery(p, query.trim()).matched);
    }
    if (imageSearchIds) {
      // Visual-similarity order takes over from the regular sort dropdown —
      // most-similar-first is the whole point of an image search. Other
      // filters (category/size/price/etc.) still apply on top of it.
      const rank = new Map(imageSearchIds.map((id, i) => [id, i]));
      list = list.filter((p) => rank.has(p.id));
      list.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
      return list;
    }

    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        break;
      case 'price-drop':
        list.sort(
          (a, b) => ((b.mrp ?? 0) - b.price || 0) - ((a.mrp ?? 0) - a.price || 0)
        );
        break;
      case 'most-gifted':
        list.sort((a, b) => b.reviews - a.reviews);
        break;
      default:
        list.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    }
    return list;
  }, [products, selectedCats, selectedSizes, selectedColors, selectedFabrics, selectedOccasions, priceRange, query, sort, imageSearchIds]);

  const activeCount =
    selectedCats.length +
    selectedSizes.length +
    selectedColors.length +
    selectedFabrics.length +
    selectedOccasions.length +
    (priceRange[0] > 0 || priceRange[1] < 35000 ? 1 : 0);

  // Admin > Settings > Catalog Listing Size -- how many cards load per
  // page/batch, and how many colour cards one product may contribute to
  // this grid (see lib/expand-product-variants.ts). Falls back to this
  // page's original defaults if the setting hasn't been saved yet.
  const [listingSettings, setListingSettings] = useState(DEFAULT_CATALOG_LISTING_SETTINGS);
  useEffect(() => {
    let cancelled = false;
    fetchCatalogListingSettings()
      .then((s) => {
        if (!cancelled) setListingSettings(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Progressive reveal instead of rendering every matching product (and
  // therefore every product's images) at once -- a 71-product catalog was
  // shipping 200+ image requests and 15MB+ on first paint. Starts at
  // PAGE_SIZE and grows by PAGE_SIZE each "Load more" click. Resets back to
  // PAGE_SIZE whenever the actual result set changes (new filter/sort/
  // search) so a narrowed search doesn't stay scrolled deep into a stale
  // count from the previous broader list.
  const PAGE_SIZE = listingSettings.page_size;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCats, selectedSizes, selectedColors, selectedFabrics, selectedOccasions, priceRange, query, sort, imageSearchIds, PAGE_SIZE]);
  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Log searches for Admin > Analytics > Search -- debounced so a shopper
  // still typing doesn't fire an event per keystroke, and deduped so the
  // same query text (e.g. re-rendering after an unrelated filter toggle)
  // is only logged once. Best-effort: trackEvent never throws, so a failed
  // log never breaks the actual search experience.
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  const lastLoggedQueryRef = useRef('');
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      lastLoggedQueryRef.current = '';
      return;
    }
    if (q.toLowerCase() === lastLoggedQueryRef.current) return;
    const timer = setTimeout(() => {
      lastLoggedQueryRef.current = q.toLowerCase();
      trackEvent('search', {
        pagePath: pathname,
        metadata: { query: q, resultsCount: filteredRef.current.length },
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [query, pathname]);

  // Fire GA4 / Google Ads view_item_list whenever the grid the shopper is
  // actually looking at changes (filters, sort, search, or the underlying
  // product list itself). Debounced like the search log above so rapid
  // filter toggling doesn't spam an event per click. GA4 caps ecommerce
  // item arrays at 200 items, and no shopper scrolls a 200-card grid
  // meaningfully, so we only report the first 20 — this is a "what did
  // they see first" list-view signal, not full pagination data.
  useEffect(() => {
    if (filtered.length === 0) return;
    const timer = setTimeout(() => {
      fireGtagEvent('view_item_list', {
        item_list_name: query.trim() ? `Search: ${query.trim()}` : selectedCats.length > 0 ? selectedCats.join(', ') : 'Shop All',
        items: filtered.slice(0, 20).map((p, idx) => ({
          item_id: p.id,
          item_name: p.name,
          item_category: p.category,
          price: p.price,
          index: idx,
        })),
      });
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const clearAll = () => {
    setSelectedCats([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSelectedFabrics([]);
    setSelectedOccasions([]);
    setPriceRange([0, 35000]);
    setQuery('');
    if (imageSearchIds) clearImageSearch();
  };

  const FiltersPanel = (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
          Search
        </h3>
        <Input
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
          Category
        </h3>
        <div className="flex flex-col gap-2.5">
          {categoriesWithProducts.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2.5 text-sm"
            >
              <Checkbox
                checked={selectedCats.includes(c.name)}
                onCheckedChange={() =>
                  setSelectedCats((prev) => toggle(prev, c.name))
                }
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
          Size
        </h3>
        <div className="flex flex-wrap gap-2">
          {ALL_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSizes((prev) => toggle(prev, s))}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedSizes.includes(s)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {allColors.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
              Color
            </h3>
            <div className="flex flex-wrap gap-2">
              {allColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedColors((prev) => toggle(prev, c))}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    selectedColors.includes(c)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full border ${
                      selectedColors.includes(c) ? 'border-primary-foreground/50' : 'border-border/70'
                    }`}
                    style={{ backgroundColor: getColorSwatchHex(c) }}
                    aria-hidden="true"
                  />
                  {c}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {allFabrics.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
              Fabric
            </h3>
            <div className="flex flex-col gap-2.5">
              {allFabrics.map((f) => (
                <label key={f} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={selectedFabrics.includes(f)}
                    onCheckedChange={() => setSelectedFabrics((prev) => toggle(prev, f))}
                  />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {allOccasions.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
              Occasion
            </h3>
            <div className="flex flex-wrap gap-2">
              {allOccasions.map((o) => (
                <button
                  key={o}
                  onClick={() => setSelectedOccasions((prev) => toggle(prev, o))}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedOccasions.includes(o)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div>
        <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
          Price Range
        </h3>
        <Slider
          min={0}
          max={35000}
          step={500}
          value={[priceRange[0], priceRange[1]]}
          onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
          className="py-4"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>₹{priceRange[0].toLocaleString('en-IN')}</span>
          <span>₹{priceRange[1].toLocaleString('en-IN')}</span>
        </div>
      </div>

      {activeCount > 0 && (
        <Button variant="outline" onClick={clearAll} className="w-full">
          Clear all filters
        </Button>
      )}
    </div>
  );

  // On /search, once a query is present (typed + submitted, or picked from
  // a suggestion), the heading should reflect exactly what was searched
  // instead of the generic "Shop All Sarees" title -- so it's obvious at
  // the top of the page which search actually ran.
  const isSearchPage = pathname === '/search';
  const trimmedQuery = query.trim();
  const showingSearchHeading = isSearchPage && trimmedQuery.length > 0;

  // "More options" suggestion for a narrow search: if the query names (or
  // roughly names) an actual category -- e.g. "Yellow Cotton Sarees"
  // contains "Cotton Sarees" -- but the search itself is narrowed further
  // by a colour/word that isn't part of the category name, the shopper is
  // usually seeing far fewer pieces than that category actually has (6
  // yellow ones vs. 34 total cotton sarees). Surface a "browse the whole
  // category" card so they can see everything else in it, not just the
  // exact colour/word they typed.
  const relatedCategory = useMemo(() => {
    if (!showingSearchHeading) return null;
    const queryTokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean);

    // A category matches when every word in its own name appears
    // somewhere in the typed query (fuzzy per-word, same tolerance as the
    // product search itself) -- "Cotton Sarees" matches "Yellow Cotton
    // Sarees" because both "cotton" and "sarees" are present.
    const candidates = categoriesWithProducts.filter((c) => {
      const nameWords = c.name.toLowerCase().split(/\s+/).filter(Boolean);
      return nameWords.every((w) => queryTokens.some((t) => fuzzyMatch(t, w) || fuzzyMatch(w, t)));
    });
    if (candidates.length === 0) return null;

    // Prefer the most specific (longest name / most words) match --
    // "Cotton Sarees" over a broader "Sarees" if both happen to match.
    candidates.sort((a, b) => b.name.length - a.name.length);
    const category = candidates[0];

    const inCat = products.filter((p) => p.category === category.name);
    const count = inCat.reduce((sum, p) => sum + 1 + (p.variant_list?.length ?? 0), 0);
    // Only worth showing if there's genuinely more to see than what the
    // narrower search already returned.
    if (count <= filtered.length) return null;

    const thumbs = inCat
      .slice()
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured))
      .slice(0, 3)
      .map((p) => p.images[0])
      .filter(Boolean) as string[];

    return { ...category, count, thumbs };
  }, [showingSearchHeading, trimmedQuery, categoriesWithProducts, products, filtered.length]);

  return (
    <div className="container-boutique py-8 pb-24 md:pb-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
          {showingSearchHeading ? 'Search Results' : 'The Collection'}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">
          {showingSearchHeading ? (
            <>&quot;{trimmedQuery}&quot;</>
          ) : (
            'Shop All Sarees & Ethnic Wear'
          )}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'} found
        </p>

        {relatedCategory && (
          <Link
            href={`/category/${relatedCategory.slug}`}
            className="group mt-3 flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">
                More options
              </p>
              <p className="mt-0.5 truncate font-serif text-base font-semibold text-foreground">
                See all {relatedCategory.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {relatedCategory.count} {relatedCategory.count === 1 ? 'piece' : 'pieces'} in this
                category
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center -space-x-3">
                {relatedCategory.thumbs.length > 0 ? (
                  relatedCategory.thumbs.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm sm:h-14 sm:w-14"
                      style={{ zIndex: relatedCategory.thumbs.length - idx }}
                    >
                      <Image
                        src={src}
                        alt={`${relatedCategory.name} product`}
                        fill
                        sizes="56px"
                        quality={70}
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL={blurDataURL(32, 32)}
                        className="object-cover"
                      />
                    </div>
                  ))
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground sm:h-14 sm:w-14">
                    <ImageOff className="h-4 w-4" />
                  </div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        )}

        {imageSearchIds && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            {imageSearchThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSearchThumbnail}
                alt="Your uploaded search photo"
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-primary/30"
              />
            ) : (
              <Camera className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span>Showing pieces visually similar to your uploaded photo.</span>
            <button
              onClick={clearImageSearch}
              className="ml-auto shrink-0 text-xs font-medium text-primary underline underline-offset-2"
            >
              Clear
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSort((prev) => (prev === f.key ? 'featured' : f.key))}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                sort === f.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground/80 hover:border-primary/50'
              }`}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-lg border border-border/60 bg-card p-5">
            {FiltersPanel}
          </div>
        </aside>

        <div className="flex-1">
          <div
            className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm md:static md:mb-5 md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-none"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-2">
              <QuickNavIcons />
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
                    {activeCount > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {activeCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-80 overflow-y-auto bg-background"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <SheetHeader>
                    <SheetTitle className="font-serif text-primary">Filters</SheetTitle>
                    <SheetDescription className="sr-only">Filter products</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4">{FiltersPanel}</div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Compact icon-only toggle on mobile (fixed bottom bar is tight
                  on space); full switch + label from sm/tablet upward. */}
              <button
                type="button"
                onClick={() => toggleVideoEnabled(!videoEnabled)}
                aria-label={videoEnabled ? 'Turn off video previews' : 'Turn on video previews'}
                aria-pressed={videoEnabled}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors sm:hidden ${
                  videoEnabled
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground/70'
                }`}
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
              <div className="hidden items-center gap-1.5 sm:flex">
                {videoEnabled ? (
                  <Video className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <VideoOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="catalog-video-toggle" className="text-sm text-muted-foreground">
                  Video
                </Label>
                <Switch
                  id="catalog-video-toggle"
                  checked={videoEnabled}
                  onCheckedChange={toggleVideoEnabled}
                  aria-label="Toggle autoplay video previews in the catalog"
                />
              </div>
              <Label className="hidden text-sm text-muted-foreground sm:inline">
                Sort by
              </Label>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
              <div className="text-4xl">🔍</div>
              <div>
                <p className="font-serif text-lg font-semibold">No products found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {query.trim()
                    ? <>No results for &quot;<span className="font-medium text-foreground">{query}</span>&quot;. Try a different spelling or browse below.</>
                    : 'Try adjusting or clearing your filters.'}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {['Silk Sarees', 'Cotton Sarees', 'Lehenga', 'Kurti', 'Mulmul Cotton'].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); setSelectedCats([]); setSelectedColors([]); setSelectedFabrics([]); setSelectedSizes([]); setSelectedOccasions([]); }}
                    className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-primary hover:text-primary transition-colors"
                  >{s}</button>
                ))}
              </div>
              <Button onClick={clearAll} variant="outline" className="mt-2">Clear all filters</Button>

              {/* Show some featured products as fallback */}
              {products.length > 0 && (
                <div className="mt-6 w-full text-left">
                  <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">You might like</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {products.filter((p) => p.featured).slice(0, 3).map((p, idx) => (
                      <ProductCard key={p.id} product={p} priority={idx === 0} disableAutoplayVideo={isSearchPage || !videoEnabled} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {(isSearchPage || imageSearchIds
                  ? visibleProducts
                  : expandProductVariants(visibleProducts, listingSettings.max_variant_cards_per_product)
                ).map((p: ExpandedProduct, idx: number) => {
                  const q = query.trim();
                  // Use productMatchesQuery to get the exact matched variant (same logic as search suggestions)
                  const { matchedVariant } = q ? productMatchesQuery(p, q) : { matchedVariant: undefined };
                  const colorMatchSlug = matchedVariant ? matchedVariant.slug : undefined;
                  // If variant has no image, fall back to all_images[0] then product default
                  const colorMatchImage = matchedVariant
                    ? (matchedVariant.image ?? p.all_images?.[0] ?? p.images?.[0] ?? undefined)
                    : undefined;
                  return (
                    <ProductCard
                      key={`${p.id}-${p.slug}`}
                      product={p}
                      priority={idx < 4}
                      imageOverride={imageSearchIds ? imageSearchMatches[p.id] : (colorMatchImage || undefined)}
                      slugOverride={colorMatchSlug}
                      // Search results should always show a still photo (the
                      // matched colour variant's photo when the query matched
                      // one) instead of the autoplaying catalog video -- the
                      // video preview stays on /shop, category pages, etc.
                      // Also off whenever the shopper has switched the
                      // catalog "Video" toggle off for this browsing session.
                      // Per-colour exploded cards (isVariantCard) never
                      // autoplay -- only the one base card that still shows
                      // every colour as a swatch dot does, so the grid
                      // doesn't end up with the same video playing 4-5
                      // times in a row for one product's colours.
                      disableAutoplayVideo={isSearchPage || !videoEnabled || !!p.isVariantCard}
                    />
                  );
                })}
              </div>

              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="min-w-40"
                  >
                    Load more ({filtered.length - visibleCount} more)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in the app router --
// kept here (instead of in page.tsx) so the server page itself stays a
// plain server component with no client-only wrapping concerns.
export default function ShopContent(props: ShopContentProps) {
  return (
    <Suspense fallback={<div className="container-boutique py-20 text-center text-muted-foreground">Loading…</div>}>
      <ShopContentInner {...props} />
    </Suspense>
  );
}
