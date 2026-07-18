'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { useProducts } from '@/lib/cart-context';
import { Product, Category } from '@/lib/types';
import ProductCard from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest';

function ShopContent() {
  const { products, categories, loading } = useProducts();
  const params = useSearchParams();

  const initialCategory = params.get('category') || '';
  const initialQuery = params.get('q') || '';

  const [selectedCats, setSelectedCats] = useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedFabrics, setSelectedFabrics] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 35000]);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>('featured');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filter option lists are derived from whatever products/admin have
  // actually tagged, so the panel never shows an empty or stale option.
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

  useEffect(() => {
    const c = params.get('category') || '';
    setSelectedCats(c ? [c] : []);
    setQuery(params.get('q') || '');
  }, [params]);

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
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.fabric.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q)
      );
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
      default:
        list.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    }
    return list;
  }, [products, selectedCats, selectedSizes, selectedFabrics, selectedOccasions, priceRange, query, sort]);

  const activeCount =
    selectedCats.length +
    selectedSizes.length +
    selectedFabrics.length +
    selectedOccasions.length +
    (priceRange[0] > 0 || priceRange[1] < 35000 ? 1 : 0);

  const clearAll = () => {
    setSelectedCats([]);
    setSelectedSizes([]);
    setSelectedFabrics([]);
    setSelectedOccasions([]);
    setPriceRange([0, 35000]);
    setQuery('');
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
          {categories.map((c) => (
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

  return (
    <div className="container-boutique py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
          The Collection
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">
          Shop All Sarees & Ethnic Wear
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'piece' : 'pieces'} found`}
        </p>
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-lg border border-border/60 bg-card p-5">
            {FiltersPanel}
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-5 flex items-center justify-between gap-3">
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
              <SheetContent side="left" className="w-80 overflow-y-auto bg-background">
                <SheetHeader>
                  <SheetTitle className="font-serif text-primary">Filters</SheetTitle>
                  <SheetDescription className="sr-only">Filter products</SheetDescription>
                </SheetHeader>
                <div className="mt-4">{FiltersPanel}</div>
              </SheetContent>
            </Sheet>

            <div className="ml-auto flex items-center gap-2">
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

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
              <p className="font-serif text-lg font-semibold">No products match your filters</p>
              <p className="text-sm text-muted-foreground">Try adjusting or clearing filters.</p>
              <Button onClick={clearAll} variant="outline">Clear filters</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p: Product, idx: number) => (
                <ProductCard key={p.id} product={p} priority={idx < 4} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="container-boutique py-20 text-center text-muted-foreground">Loading…</div>}>
      <ShopContent />
    </Suspense>
  );
}
