"use client";

import { useState, FormEvent, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ArrowLeft, Upload, Loader2, Sparkles, Link2, Palette, Wand2, Search, X, Truck, Package, Facebook, Instagram, CheckCircle2, Video } from 'lucide-react';
import { useProducts } from '@/lib/cart-context';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  extractErrorMessage,
} from '@/lib/products-api';
import { generateSlideshowVideo } from '@/lib/slideshow-video-generator';
import { generateProductSku } from '@/lib/sku';
import { searchPresets, ColorPreset } from '@/lib/color-presets';
import { Product, CategoryRow, ProductHighlights } from '@/lib/types';
import ProductVariantsManager from '@/components/admin/product-variants-manager';
import VendorSubmissionsPanel from '@/components/admin/vendor-submissions-panel';
import {
  fetchAdminVendorProducts,
  type AdminVendorProductRow,
  type VendorProductApprovalStatus,
  triggerSocialAutoPost,
  triggerVideoPublish,
} from '@/lib/vendor-api';
import { formatINR, discountPct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const DEFAULT_IMAGE =
  'https://images.pexels.com/photos/1191349/pexels-photo-1191349.jpeg?auto=compress&cs=tinysrgb&w=800&h=1000&fit=crop';

// ---------------------------------------------------------------------
// Per-platform social share buttons (Facebook / Instagram / Threads).
// Each product row gets three independent icon buttons instead of one
// combined "Share" button — an admin might only want the product on, say,
// Instagram, without also posting it to Facebook and Threads.
// ---------------------------------------------------------------------

type SocialPlatform = 'facebook' | 'instagram' | 'threads';

const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
};

// Matches the keys written into products.social_post_ids by
// publishProductToSocial() in lib/social-publish-api.ts.
const SOCIAL_PLATFORM_POST_ID_KEY: Record<SocialPlatform, string> = {
  facebook: 'facebook_post_id',
  instagram: 'instagram_media_id',
  threads: 'threads_post_id',
};

/** lucide-react ships Facebook/Instagram glyphs but not Threads (the app
 *  is too new); this is a minimal stand-in stroked to match lucide's
 *  24x24 / 2px-stroke look so it sits flush with the other two icons. */
function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2c-5.5 0-9 3.6-9 10s3.5 10 9 10c4.2 0 7-1.9 7-5.2 0-2.6-1.7-4.1-4.5-4.4" />
      <path d="M13.5 8.5c-3.2 0-5 1.6-5 4 0 2.6 2 3.7 4 3.7 2.5 0 4-1.4 4-4 0-4.7-2.6-7.2-6.7-7.2" />
    </svg>
  );
}

const SOCIAL_PLATFORM_ICON: Record<SocialPlatform, (props: { className?: string }) => JSX.Element> = {
  facebook: ({ className }) => <Facebook className={className} />,
  instagram: ({ className }) => <Instagram className={className} />,
  threads: ({ className }) => <ThreadsIcon className={className} />,
};

// Badge shown on the Catalog tab for vendor-submitted products that
// aren't live yet, so an admin glancing at the main products list can
// see at once that something is still being processed — same wording
// vendors see on their own dashboard — instead of the product silently
// not appearing at all (fetchProducts() only ever returns approval_status
// = 'live' rows, by design, so those never show up in the table below).
const IN_PROGRESS_STATUS_META: Partial<
  Record<VendorProductApprovalStatus, { label: string; className: string }>
> = {
  pending_review: {
    label: '⏳ Processing…',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  awaiting_stock: {
    label: 'Awaiting Stock Pickup',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
};

// Poll interval (ms) while any vendor listing is still processing —
// mirrors the vendor-facing dashboard's own polling.
const IN_PROGRESS_POLL_INTERVAL = 12_000;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/** Fire-and-forget: emails everyone waiting on a "Notify me" signup for this product. */
async function triggerRestockNotifications(productId: string) {
  try {
    const res = await fetch('/api/admin/notify-restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.sent > 0) {
        toast.success(`Notified ${body.sent} customer${body.sent === 1 ? '' : 's'} waiting for restock`);
      }
    }
  } catch {
    // Non-critical -- stock update already succeeded either way.
  }
}

interface FormState {
  id?: string;
  name: string;
  slug: string;
  category_name: string;
  price: string;
  mrp: string;
  description: string;
  fabric: string;
  origin: string;
  colors: string;
  sizes: string;
  occasion: string;
  gender: string;
  age_group: string;
  material: string;
  pattern: string;
  images: string[];
  video_url: string;
  sku: string;
  highlights: ProductHighlights;
  stock_quantity: string;
  low_stock_threshold: string;
  rating: string;
  reviews: string;
  featured: boolean;
  in_stock: boolean;
}

/** For a comma-separated field like "Maroon, Go", returns the in-progress
 *  last segment ("Go") so suggestions can be matched against just that. */
const lastCsvToken = (value: string) => value.split(',').pop()?.trim() ?? '';

/** Replaces the in-progress last segment of a comma-separated field with a
 *  picked preset name, keeping earlier entries untouched, and leaves a
 *  trailing ", " so the admin can keep typing the next colour. */
const applyCsvSuggestion = (value: string, pickedName: string) => {
  const parts = value.split(',').map((p) => p.trim());
  parts[parts.length - 1] = pickedName;
  return parts.filter((p) => p.length > 0).join(', ') + ', ';
};

const emptyHighlights = (): ProductHighlights => ({
  border: '',
  border_width: '',
  blouse: '',
  saree_fabric: '',
  saree_pattern: '',
  ornamentation: '',
  blouse_fabric: '',
  pallu_details: '',
  blouse_pattern: '',
  blouse_color: '',
  brand: '',
  loom_type: '',
  fit_shape: '',
  length: '',
  neck: '',
  sleeve_length: '',
  sleeve_styling: '',
  surface_styling: '',
  print_or_pattern_type: '',
  net_quantity: '1',
  add_on: '',
  type: '',
  generic_name: '',
  country_of_origin: 'India',
  transparency: '',
});

const emptyForm = (): FormState => ({
  name: '',
  slug: '',
  category_name: 'Silk Sarees',
  price: '',
  mrp: '',
  description: '',
  fabric: '',
  origin: '',
  colors: '',
  sizes: 'Free Size',
  occasion: '',
  gender: 'female',
  age_group: 'adult',
  material: '',
  pattern: '',
  images: [DEFAULT_IMAGE],
  video_url: '',
  sku: '',
  highlights: emptyHighlights(),
  stock_quantity: '0',
  low_stock_threshold: '5',
  rating: '4.5',
  reviews: '0',
  featured: false,
  in_stock: true,
});

const fromProduct = (p: Product): FormState => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  category_name: p.category,
  price: String(p.price),
  mrp: p.mrp ? String(p.mrp) : '',
  description: p.description,
  fabric: p.fabric,
  origin: p.origin,
  colors: p.colors.join(', '),
  sizes: p.sizes.join(', '),
  occasion: (p.occasion || []).join(', '),
  gender: p.gender || 'female',
  age_group: p.age_group || 'adult',
  material: p.material || '',
  pattern: p.pattern || '',
  images: p.images.length ? p.images : [DEFAULT_IMAGE],
  video_url: p.video_url || '',
  sku: p.sku || '',
  highlights: { ...emptyHighlights(), ...(p.highlights || {}) },
  stock_quantity: String(p.stock_quantity),
  low_stock_threshold: String(p.low_stock_threshold ?? 5),
  rating: String(p.rating),
  reviews: String(p.reviews),
  featured: !!p.featured,
  in_stock: p.inStock,
});

export default function ProductsPanel() {
  const { products, categories, loading, refresh } = useProducts();

  // Phase 2, Part 5 — "Vendor Submissions" lives as a second tab inside
  // this same Products panel (same pattern already used for colour/size
  // variants, which live inside the Add/Edit dialog rather than a
  // separate sidebar entry). Catalog products (this panel's original
  // scope) and vendor submissions are deliberately separate flows —
  // vendor rows are edited only through the guarded /api/admin/vendor-products
  // route, never through this panel's own createProduct/updateProduct.
  const [view, setView] = useState<'catalog' | 'vendor-submissions'>('catalog');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [colorSuggestions, setColorSuggestions] = useState<ColorPreset[]>([]);
  const [showColorSuggestions, setShowColorSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out' | 'low'>('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  // product_id -> vendor business name, fetched separately from the shared
  // useProducts() hook (which is also used by the storefront and only
  // returns live products with no vendor join). Products absent from this
  // map are in-house catalog items with no vendor.
  const [vendorNameById, setVendorNameById] = useState<Record<string, string>>({});
  const [vendorIdByProductId, setVendorIdByProductId] = useState<Record<string, string>>({});
  const [vendorOptions, setVendorOptions] = useState<{ id: string; name: string }[]>([]);
  const [variantCountById, setVariantCountById] = useState<Record<string, number>>({});
  const [variantColorsById, setVariantColorsById] = useState<
    Record<string, { color: string; color_hex: string | null }[]>
  >({});
  // product_id -> social_posted_at (ISO string) | null. Kept for reference
  // ("has this product ever been shared on any platform"), though the
  // per-row buttons below now decide their own Share/✓ Posted state from
  // socialPostIdsById instead, since each platform is independent.
  const [socialStatusById, setSocialStatusById] = useState<Record<string, string | null>>({});
  // product_id -> that product's social_post_ids row (facebook_post_id /
  // instagram_media_id / threads_post_id). Drives each of the three
  // Share/✓ Posted buttons per row, independently per platform.
  const [socialPostIdsById, setSocialPostIdsById] = useState<Record<string, Record<string, string>>>({});
  // `${productId}:${platform}` while that specific button's request is
  // in flight, so only that one button shows a spinner.
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const [reshareConfirm, setReshareConfirm] = useState<{ id: string; platform: SocialPlatform } | null>(null);

  const loadSocialStatus = useCallback(() => {
    fetch('/api/admin/product-social-status')
      .then((res) => (res.ok ? res.json() : { statusById: {}, postIdsById: {} }))
      .then((data) => {
        setSocialStatusById(data.statusById ?? {});
        setSocialPostIdsById(data.postIdsById ?? {});
      })
      .catch(() => {
        // Non-fatal — the Share buttons just won't know past-posted state
        // this session; they'll still work, defaulting to the "Share" state.
      });
  }, []);

  useEffect(() => {
    loadSocialStatus();
  }, [loadSocialStatus]);

  const shareProduct = async (productId: string, platform: SocialPlatform, force: boolean) => {
    const key = `${productId}:${platform}`;
    setSharingKey(key);
    try {
      const res = await triggerSocialAutoPost(productId, force, platform);
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        toast.success(
          force
            ? `Re-shared to ${SOCIAL_PLATFORM_LABEL[platform]}`
            : `Shared to ${SOCIAL_PLATFORM_LABEL[platform]}`
        );
      } else {
        toast.error(
          data.error ||
            `${SOCIAL_PLATFORM_LABEL[platform]} share failed — check that it's configured in Marketing settings`
        );
      }
    } catch {
      toast.error(`${SOCIAL_PLATFORM_LABEL[platform]} share failed — network error`);
    } finally {
      setSharingKey(null);
      setReshareConfirm(null);
      loadSocialStatus();
    }
  };

  // ---------------------------------------------------------------------
  // "Generate Video" (Admin > Products) — builds a vertical slideshow
  // video client-side from the product's images + price, uploads it, and
  // stamps products.video_url. Once a video exists, three "Post Video"
  // icons (Facebook / Instagram Reels / Threads) appear for that row.
  // ---------------------------------------------------------------------
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  // Local override so a freshly-generated video shows its "Post Video"
  // icons immediately, without needing a full product-list refetch.
  const [videoUrlOverrideById, setVideoUrlOverrideById] = useState<Record<string, string>>({});
  const [postingVideoKey, setPostingVideoKey] = useState<string | null>(null);

  const generateVideoForProduct = async (p: Product) => {
    if (!p.images || p.images.length === 0) {
      toast.error('This product has no images to build a video from.');
      return;
    }
    setGeneratingVideoId(p.id);
    setVideoProgress(0);
    try {
      const discount = discountPct(p.price, p.mrp);
      const blob = await generateSlideshowVideo({
        images: p.images,
        name: p.name,
        priceText: formatINR(p.price),
        mrpText: discount > 0 && p.mrp ? formatINR(p.mrp) : undefined,
        discountBadge: discount > 0 ? `${discount}% OFF` : undefined,
        onProgress: setVideoProgress,
      });

      const formData = new FormData();
      formData.append('file', blob, `${p.id}.webm`);
      formData.append('productId', p.id);
      const res = await fetch('/api/admin/product-video/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        toast.error(data.error || 'Video upload failed');
        return;
      }
      setVideoUrlOverrideById((prev) => ({ ...prev, [p.id]: data.videoUrl }));
      toast.success('Video generated! You can now post it to Facebook / Instagram / Threads.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Video generation failed');
    } finally {
      setGeneratingVideoId(null);
      setVideoProgress(0);
    }
  };

  const postVideo = async (productId: string, platform: SocialPlatform) => {
    const key = `video:${productId}:${platform}`;
    setPostingVideoKey(key);
    try {
      const res = await triggerVideoPublish(productId, platform);
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        toast.success(`Video posted to ${SOCIAL_PLATFORM_LABEL[platform]}`);
      } else {
        toast.error(data.error || `${SOCIAL_PLATFORM_LABEL[platform]} video post failed`);
      }
    } catch {
      toast.error(`${SOCIAL_PLATFORM_LABEL[platform]} video post failed — network error`);
    } finally {
      setPostingVideoKey(null);
    }
  };

  useEffect(() => {
    fetch('/api/admin/product-variant-counts')
      .then((res) => (res.ok ? res.json() : { counts: {}, colors: {} }))
      .then((data) => {
        setVariantCountById(data.counts ?? {});
        setVariantColorsById(data.colors ?? {});
      })
      .catch(() => {
        // Non-fatal — the catalog just won't show the colour-count badge this session.
      });
  }, []);

  useEffect(() => {
    fetch('/api/admin/product-vendors')
      .then((res) => (res.ok ? res.json() : { rows: [] }))
      .then((data) => {
        const rows: { product_id: string; vendor_id: string; vendor_name: string }[] = data.rows ?? [];
        const nameMap: Record<string, string> = {};
        const idMap: Record<string, string> = {};
        const vendorsSeen = new Map<string, string>();
        for (const r of rows) {
          nameMap[r.product_id] = r.vendor_name;
          idMap[r.product_id] = r.vendor_id;
          vendorsSeen.set(r.vendor_id, r.vendor_name);
        }
        setVendorNameById(nameMap);
        setVendorIdByProductId(idMap);
        setVendorOptions(
          Array.from(vendorsSeen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => {
        // Non-fatal — the catalog just won't show vendor names/filter this session.
      });
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const vendorName = vendorNameById[p.id];

      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.fabric ?? '').toLowerCase().includes(q) ||
        (p.origin ?? '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (vendorName ?? '').toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all' || p.category === categoryFilter;

      const matchesVendor =
        vendorFilter === 'all' ||
        (vendorFilter === 'in-house' ? !vendorName : vendorIdByProductId[p.id] === vendorFilter);

      const matchesStock =
        stockFilter === 'all'
          ? true
          : stockFilter === 'out'
          ? !p.inStock || p.stock_quantity <= 0
          : stockFilter === 'low'
          ? p.inStock &&
            p.stock_quantity > 0 &&
            p.stock_quantity <= (p.low_stock_threshold ?? 5)
          : p.inStock && p.stock_quantity > 0;

      return matchesQuery && matchesCategory && matchesStock && matchesVendor;
    });
  }, [products, searchQuery, categoryFilter, stockFilter, vendorFilter, vendorNameById, vendorIdByProductId, vendorOptions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── In-progress vendor listings (shown as a banner on the Catalog tab) ──
  // fetchProducts()/`products` above only ever contains approval_status =
  // 'live' rows, so a vendor's just-submitted product is otherwise
  // invisible here while it's still pending_review/awaiting_stock — the
  // admin has to already know to check the separate Vendor Submissions
  // tab. This polls the same admin vendor-products endpoint that tab
  // uses and surfaces a lightweight summary right on Catalog too.
  const [inProgressVendorProducts, setInProgressVendorProducts] = useState<AdminVendorProductRow[]>([]);
  const inProgressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadInProgressVendorProducts = useCallback(() => {
    fetchAdminVendorProducts()
      .then((rows) => {
        setInProgressVendorProducts(
          rows.filter((r) => r.approval_status === 'pending_review' || r.approval_status === 'awaiting_stock')
        );
      })
      .catch(() => {
        // Non-critical — this is a supplementary banner, not the main
        // product list, so fail silently rather than toasting an error
        // every poll.
      });
  }, []);

  useEffect(() => {
    loadInProgressVendorProducts();
  }, [loadInProgressVendorProducts]);

  // Keep polling while anything is still 'pending_review' (being AI
  // processed) — same idea as the vendor-facing dashboard's own polling.
  // 'awaiting_stock' rows don't need polling since only an admin action
  // changes that status, not a background process.
  useEffect(() => {
    const hasProcessing = inProgressVendorProducts.some((p) => p.approval_status === 'pending_review');
    if (hasProcessing && !inProgressPollRef.current) {
      inProgressPollRef.current = setInterval(loadInProgressVendorProducts, IN_PROGRESS_POLL_INTERVAL);
    }
    if (!hasProcessing && inProgressPollRef.current) {
      clearInterval(inProgressPollRef.current);
      inProgressPollRef.current = null;
    }
    return () => {
      if (inProgressPollRef.current) {
        clearInterval(inProgressPollRef.current);
        inProgressPollRef.current = null;
      }
    };
  }, [inProgressVendorProducts, loadInProgressVendorProducts]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setAiHint('');
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(fromProduct(p));
    setAiHint('');
    setOpen(true);
  };

  const generateWithAI = async () => {
    const referenceImage = form.images.find((url) => url && url !== DEFAULT_IMAGE);
    if (!form.name.trim() && !form.category_name.trim() && !aiHint.trim() && !referenceImage) {
      toast.error('Add a product name, quick note, or photo first, then generate');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hint: aiHint,
          name: form.name,
          category: form.category_name,
          fabric: form.fabric,
          origin: form.origin,
          colors: form.colors,
          occasion: form.occasion,
          gender: form.gender,
          material: form.material,
          pattern: form.pattern,
          imageUrl: referenceImage || undefined,
        }),
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        toast.error(
          res.status === 504 || res.status === 502
            ? 'AI took too long to respond. Please try again.'
            : `AI generation failed (server returned an unexpected response, status ${res.status}).`
        );
        return;
      }
      if (!res.ok) {
        toast.error(data.error || 'AI generation failed');
        return;
      }
      const { listing } = data;
      setForm((f) => ({
        ...f,
        name: listing.name || f.name,
        slug: f.slug || slugify(listing.name || f.name),
        description: listing.description || f.description,
        fabric: listing.fabric || f.fabric,
        origin: listing.origin || f.origin,
        occasion: Array.isArray(listing.occasion) ? listing.occasion.join(', ') : f.occasion,
        colors: f.colors || (Array.isArray(listing.colors) ? listing.colors.join(', ') : f.colors),
        material: f.material || listing.material || f.material,
        pattern: f.pattern || listing.pattern || f.pattern,
        gender: f.gender !== 'female' ? f.gender : listing.gender || f.gender,
        highlights: { ...f.highlights, ...(listing.highlights || {}) },
      }));
      toast.success(
        'AI listing generated — including Product Highlights. Review and tweak before saving'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map((file) => uploadProductImage(file, form.name)));
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const importFromUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    try {
      const res = await fetch('/api/admin/import-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, folder: 'products' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not import that image');
        return;
      }
      setForm((f) => ({ ...f, images: [...f.images, data.url] }));
      setImportUrl('');
      toast.success('Image imported and converted to WebP');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image import failed');
    } finally {
      setImporting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      toast.error('Name and price are required');
      return;
    }
    const colors = form.colors.split(',').map((s) => s.trim()).filter(Boolean);
    const sizes = form.sizes.split(',').map((s) => s.trim()).filter(Boolean);
    const occasion = form.occasion.split(',').map((s) => s.trim()).filter(Boolean);
    const images = form.images.length ? form.images : [DEFAULT_IMAGE];
    const category = categories.find((c) => c.name === form.category_name);
    const wasOutOfStock = !!editing && (editing.stock_quantity === 0 || !editing.inStock);
    const newStockQty = Number(form.stock_quantity) || 0;

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description,
      price: Number(form.price),
      mrp: form.mrp ? Number(form.mrp) : null,
      category_id: category?.id ?? null,
      category_name: form.category_name,
      fabric: form.fabric,
      origin: form.origin,
      colors,
      sizes: sizes.length ? sizes : ['Free Size'],
      occasion,
      gender: form.gender,
      age_group: form.age_group,
      material: form.material.trim() || null,
      pattern: form.pattern.trim() || null,
      images,
      video_url: form.video_url.trim() || null,
      sku: form.sku.trim() || generateProductSku(form.name, form.category_name),
      highlights: form.highlights,
      stock_quantity: newStockQty,
      low_stock_threshold: Number(form.low_stock_threshold) || 5,
      rating: Number(form.rating) || 4.5,
      reviews: Number(form.reviews) || 0,
      featured: form.featured,
      in_stock: form.in_stock,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success('Product updated');
        if (wasOutOfStock && newStockQty > 0) {
          triggerRestockNotifications(editing.id);
        }
        setEditing({ ...editing, ...payload } as unknown as Product);
        setForm((f) => ({ ...f, sku: payload.sku }));
        await refresh();
      } else {
        const created = await createProduct(payload);
        toast.success('Product added — now add colour variants below, or close to finish.');
        // No auto-post here — social sharing only happens when the admin
        // clicks the Share button on this product's row (see shareProduct()).
        // Keep the dialog open, switched into "edit" mode for the product we
        // just created, so colour/size variants can be added right here
        // without hunting for a separate tab.
        setEditing(created);
        setForm(fromProduct(created));
        await refresh();
        return;
      }
      setOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmId) return;
    try {
      await deleteProduct(confirmId);
      toast.success('Product deleted');
      await refresh();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Delete failed'));
    } finally {
      setConfirmId(null);
    }
  };

  const quickStockUpdate = async (p: Product, delta: number) => {
    const newQty = Math.max(0, p.stock_quantity + delta);
    const wasOutOfStock = p.stock_quantity === 0 || !p.inStock;
    try {
      await updateProduct(p.id, {
        stock_quantity: newQty,
        in_stock: newQty > 0,
      });
      await refresh();
      toast.success(`Stock updated to ${newQty}`);
      if (wasOutOfStock && newQty > 0) {
        triggerRestockNotifications(p.id);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Update failed'));
    }
  };

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to store
      </Link>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('catalog')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            view === 'catalog'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          <Package className="h-3.5 w-3.5" /> Catalog
        </button>
        <button
          type="button"
          onClick={() => setView('vendor-submissions')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            view === 'vendor-submissions'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          <Truck className="h-3.5 w-3.5" /> Vendor Submissions
        </button>
      </div>

      {view === 'vendor-submissions' ? (
        <VendorSubmissionsPanel />
      ) : (
        <>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Admin
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">
            Manage Products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : searchQuery || categoryFilter !== 'all' || stockFilter !== 'all' || vendorFilter !== 'all'
              ? `${filteredProducts.length} of ${products.length} products · stored in Supabase`
              : `${products.length} products · stored in Supabase`}
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-primary">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {inProgressVendorProducts.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-amber-800">
              {inProgressVendorProducts.length} vendor listing
              {inProgressVendorProducts.length === 1 ? '' : 's'} not live yet
            </p>
            <button
              type="button"
              onClick={() => setView('vendor-submissions')}
              className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
            >
              Review in Vendor Submissions →
            </button>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {inProgressVendorProducts.map((p) => {
              const meta = IN_PROGRESS_STATUS_META[p.approval_status];
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/70 bg-white px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="relative h-10 w-9 shrink-0 overflow-hidden rounded bg-muted">
                      <Image
                        src={p.images[0] || 'https://placehold.co/36x40?text=No+Image'}
                        alt={p.name}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.vendors?.business_name || 'Vendor'} · {p.category_name || '—'}
                      </p>
                    </div>
                  </div>
                  {meta && (
                    <Badge variant="outline" className={`shrink-0 ${meta.className}`}>
                      {meta.label}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!loading && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, SKU, fabric…"
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as typeof stockFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                <SelectItem value="in-house">In-house (no vendor)</SelectItem>
                {vendorOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery || categoryFilter !== 'all' || stockFilter !== 'all' || vendorFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStockFilter('all');
                  setVendorFilter('all');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No products match your search or filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="hidden grid-cols-12 gap-3 border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <div className="col-span-4">Product</div>
            <div className="col-span-2">Vendor</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-1">Stock</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          <ul className="flex flex-col divide-y divide-border/60">
            {filteredProducts.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-12 sm:items-center"
              >
                <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={p.images[0] || 'https://placehold.co/48x60?text=No+Image'}
                      alt={`${p.name} - ${p.fabric} ${p.category}`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="min-w-0 text-left"
                    title="Click to edit details or manage colour/size variants"
                  >
                    <p className="line-clamp-1 text-sm font-semibold hover:text-primary hover:underline">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.fabric || '—'} · {p.origin || '—'} {p.sku ? `· SKU ${p.sku}` : ''}
                    </p>
                    {(variantCountById[p.id] ?? 0) > 0 && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {(variantColorsById[p.id] ?? []).map((v, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs text-primary"
                            title={v.color}
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                              style={{ backgroundColor: v.color_hex || '#d4d4d4' }}
                            />
                            {v.color}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </div>
                <div className="col-span-2 text-sm sm:col-span-2">
                  {vendorNameById[p.id] ? (
                    <Badge variant="outline" className="font-normal">
                      {vendorNameById[p.id]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">In-house</span>
                  )}
                </div>
                <div className="col-span-1 text-sm sm:col-span-2">
                  <Badge variant="outline" className="font-normal">{p.category}</Badge>
                </div>
                <div className="col-span-1 text-sm sm:col-span-2">
                  <span className="font-medium">{formatINR(p.price)}</span>
                  {p.mrp && p.mrp > p.price && (
                    <span className="ml-1 text-xs text-muted-foreground line-through">
                      {formatINR(p.mrp)}
                    </span>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-1 sm:col-span-1">
                  <button
                    onClick={() => quickStockUpdate(p, -1)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary/50"
                    aria-label="Decrease stock"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold">
                    {p.stock_quantity}
                  </span>
                  <button
                    onClick={() => quickStockUpdate(p, 1)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary/50"
                    aria-label="Increase stock"
                  >
                    +
                  </button>
                  {!p.inStock && (
                    <Badge variant="destructive" className="ml-1">Out</Badge>
                  )}
                </div>
                <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                  {(['facebook', 'instagram', 'threads'] as const).map((platform) => {
                    const key = `${p.id}:${platform}`;
                    const postedId = socialPostIdsById[p.id]?.[SOCIAL_PLATFORM_POST_ID_KEY[platform]];
                    const Icon = SOCIAL_PLATFORM_ICON[platform];
                    const label = SOCIAL_PLATFORM_LABEL[platform];
                    return postedId ? (
                      <Button
                        key={platform}
                        size="icon"
                        variant="ghost"
                        onClick={() => setReshareConfirm({ id: p.id, platform })}
                        aria-label={`Posted to ${label} — click to re-share`}
                        title={`Already posted to ${label}. Click to re-share (confirmation required).`}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        key={platform}
                        size="icon"
                        variant="ghost"
                        onClick={() => shareProduct(p.id, platform, false)}
                        disabled={sharingKey === key}
                        aria-label={`Share to ${label}`}
                        title={`Post this product to ${label} now`}
                      >
                        {sharingKey === key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </Button>
                    );
                  })}
                  {(() => {
                    const videoUrl = videoUrlOverrideById[p.id] ?? p.video_url;
                    if (!videoUrl) {
                      return (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => generateVideoForProduct(p)}
                          disabled={generatingVideoId === p.id}
                          aria-label="Generate slideshow video"
                          title="Generate a vertical slideshow video from this product's images"
                        >
                          {generatingVideoId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Video className="h-4 w-4" />
                          )}
                        </Button>
                      );
                    }
                    return (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => generateVideoForProduct(p)}
                          disabled={generatingVideoId === p.id}
                          aria-label="Regenerate slideshow video"
                          title="Video ready — click to regenerate"
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          {generatingVideoId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Video className="h-4 w-4" />
                          )}
                        </Button>
                        {(['facebook', 'instagram', 'threads'] as const).map((platform) => {
                          const vKey = `video:${p.id}:${platform}`;
                          const Icon = SOCIAL_PLATFORM_ICON[platform];
                          const label = SOCIAL_PLATFORM_LABEL[platform];
                          return (
                            <Button
                              key={vKey}
                              size="icon"
                              variant="ghost"
                              onClick={() => postVideo(p.id, platform)}
                              disabled={postingVideoKey === vKey}
                              aria-label={`Post video to ${label}`}
                              title={`Post the generated video to ${label} now`}
                            >
                              {postingVideoKey === vKey ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Icon className="h-4 w-4" />
                              )}
                            </Button>
                          );
                        })}
                      </>
                    );
                  })()}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(p)}
                    aria-label="Manage colour/size variants"
                    title="Manage colour/size variants (inside product details)"
                  >
                    <Palette className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(p)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setConfirmId(p.id)}
                    aria-label="Delete"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">
              {editing ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the details of this product.'
                : 'Fill in the details to add a new product to the catalog.'}
            </DialogDescription>
            {editing && (variantColorsById[editing.id]?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-medium text-muted-foreground">Colours:</span>
                {(variantColorsById[editing.id] ?? []).map((v, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
                    title={v.color}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: v.color_hex || '#d4d4d4' }}
                    />
                    {v.color}
                  </span>
                ))}
              </div>
            )}
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid gap-4 py-2">
            <div className="grid gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <Label htmlFor="ai-hint" className="flex items-center gap-1.5 text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI listing generator
              </Label>
              <Textarea
                id="ai-hint"
                rows={2}
                value={aiHint}
                onChange={(e) => setAiHint(e.target.value)}
                placeholder="Optional notes to guide the AI, e.g. 'maroon Banarasi silk saree with gold zari border, bridal'"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Fills in title, description, fabric, origin &amp; occasion tags. If you&apos;ve
                  already uploaded a product photo (in the Images section below), it&apos;s used as
                  a visual reference too. Review everything before saving.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={generateWithAI}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {generating ? 'Generating…' : 'Generate with AI'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      slug: f.slug || slugify(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sku">SKU code</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="sku"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="auto-generated on save"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Auto-generate SKU"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        sku: generateProductSku(f.name, f.category_name),
                      }))
                    }
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={form.category_name}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category_name: v }))
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: CategoryRow) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="price">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  required
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mrp">MRP (₹, optional)</Label>
                <Input
                  id="mrp"
                  type="number"
                  min={0}
                  value={form.mrp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mrp: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="fabric">Fabric</Label>
              <Input
                id="fabric"
                value={form.fabric}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fabric: e.target.value }))
                }
                placeholder="e.g. Pure Silk"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="origin">Origin</Label>
              <Input
                id="origin"
                value={form.origin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, origin: e.target.value }))
                }
                placeholder="e.g. Varanasi, UP"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                required
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Describe the product..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative grid gap-1.5">
                <Label htmlFor="colors">Colors (comma-separated)</Label>
                <Input
                  id="colors"
                  value={form.colors}
                  autoComplete="off"
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((f) => ({ ...f, colors: value }));
                    setColorSuggestions(searchPresets(lastCsvToken(value)));
                    setShowColorSuggestions(true);
                  }}
                  onFocus={(e) => {
                    setColorSuggestions(searchPresets(lastCsvToken(e.target.value)));
                    setShowColorSuggestions(true);
                  }}
                  onBlur={() => {
                    // Delay so a click on a suggestion registers before the list unmounts.
                    setTimeout(() => setShowColorSuggestions(false), 150);
                  }}
                  placeholder="Maroon, Gold"
                />
                {showColorSuggestions && colorSuggestions.length > 0 && (
                  <ul
                    role="listbox"
                    className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md"
                  >
                    {colorSuggestions.map((c) => (
                      <li key={c.name}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          // onMouseDown fires before the input's onBlur, so the click still registers.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setForm((f) => ({ ...f, colors: applyCsvSuggestion(f.colors, c.name) }));
                            setShowColorSuggestions(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent/60"
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/70"
                            style={{ backgroundColor: c.hex }}
                          />
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Typing a name that isn&apos;t in the library is fine — it&apos;s saved as-is, no need to pick a suggestion.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sizes">Sizes (comma-separated)</Label>
                <Input
                  id="sizes"
                  value={form.sizes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sizes: e.target.value }))
                  }
                  placeholder="S, M, L, XL"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="occasion">Occasion tags (comma-separated)</Label>
              <Input
                id="occasion"
                value={form.occasion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, occasion: e.target.value }))
                }
                placeholder="Wedding, Festive, Party, Casual, Office Wear"
              />
              <p className="text-xs text-muted-foreground">
                Shown as filters on the Shop page and used to power &quot;You may also like&quot; recommendations.
              </p>
            </div>

            <div className="grid gap-2 rounded-lg border border-border/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Google Merchant Center &mdash; required for every apparel listing
              </p>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="unisex">Unisex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="age_group">Age group *</Label>
                  <Select
                    value={form.age_group}
                    onValueChange={(v) => setForm((f) => ({ ...f, age_group: v }))}
                  >
                    <SelectTrigger id="age_group">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adult">Adult</SelectItem>
                      <SelectItem value="kids">Kids</SelectItem>
                      <SelectItem value="toddler">Toddler</SelectItem>
                      <SelectItem value="infant">Infant</SelectItem>
                      <SelectItem value="newborn">Newborn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="material">Material</Label>
                  <Input
                    id="material"
                    value={form.material}
                    onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                    placeholder="e.g. Silk"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pattern">Pattern</Label>
                  <Input
                    id="pattern"
                    value={form.pattern}
                    onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                    placeholder="e.g. Zari Border"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Gender &amp; age group are mandatory for Google Shopping/free listings on apparel
                &mdash; missing them gets products disapproved. Color and size come from the fields
                above.
              </p>
            </div>

            <div className="grid gap-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Product Highlights (shown on the product page)</p>
                  <p className="text-xs text-muted-foreground">
                    &quot;Generate with AI&quot; above fills these in automatically from the name/photo
                    &mdash; review and tweak. Blank fields just won&apos;t show on the storefront.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="h-border">Border</Label>
                  <Input
                    id="h-border"
                    value={form.highlights.border}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, border: e.target.value } }))}
                    placeholder="e.g. Lace"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-border-width">Border Width</Label>
                  <Input
                    id="h-border-width"
                    value={form.highlights.border_width}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, border_width: e.target.value } }))}
                    placeholder="e.g. Small Border"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-blouse">Blouse</Label>
                  <Input
                    id="h-blouse"
                    value={form.highlights.blouse}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, blouse: e.target.value } }))}
                    placeholder="e.g. Separate Blouse Piece / Without Blouse"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-saree-fabric">Saree Fabric</Label>
                  <Input
                    id="h-saree-fabric"
                    value={form.highlights.saree_fabric}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, saree_fabric: e.target.value } }))}
                    placeholder="e.g. Georgette"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-saree-pattern">Pattern</Label>
                  <Input
                    id="h-saree-pattern"
                    value={form.highlights.saree_pattern}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, saree_pattern: e.target.value } }))}
                    placeholder="e.g. Dyed / Washed"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-ornamentation">Ornamentation</Label>
                  <Input
                    id="h-ornamentation"
                    value={form.highlights.ornamentation}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, ornamentation: e.target.value } }))}
                    placeholder="e.g. Lace Border"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-blouse-fabric">Blouse Fabric</Label>
                  <Input
                    id="h-blouse-fabric"
                    value={form.highlights.blouse_fabric}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, blouse_fabric: e.target.value } }))}
                    placeholder="e.g. Bangalori Silk"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-pallu">Pallu Details</Label>
                  <Input
                    id="h-pallu"
                    value={form.highlights.pallu_details}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, pallu_details: e.target.value } }))}
                    placeholder="e.g. Same as Saree"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-blouse-pattern">Blouse Pattern</Label>
                  <Input
                    id="h-blouse-pattern"
                    value={form.highlights.blouse_pattern}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, blouse_pattern: e.target.value } }))}
                    placeholder="e.g. Solid"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-blouse-color">Blouse Color</Label>
                  <Input
                    id="h-blouse-color"
                    value={form.highlights.blouse_color}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, blouse_color: e.target.value } }))}
                    placeholder="e.g. Black"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-brand">Brand</Label>
                  <Input
                    id="h-brand"
                    value={form.highlights.brand}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, brand: e.target.value } }))}
                    placeholder="e.g. Aruhi Handlooms"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-loom-type">Loom Type</Label>
                  <Input
                    id="h-loom-type"
                    value={form.highlights.loom_type}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, loom_type: e.target.value } }))}
                    placeholder="e.g. Handloom"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-transparency">Transparency</Label>
                  <Input
                    id="h-transparency"
                    value={form.highlights.transparency}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, transparency: e.target.value } }))}
                    placeholder="e.g. Opaque"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-fit-shape">Fit / Shape</Label>
                  <Input
                    id="h-fit-shape"
                    value={form.highlights.fit_shape}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, fit_shape: e.target.value } }))}
                    placeholder="e.g. Fit and Flare"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-length">Length</Label>
                  <Input
                    id="h-length"
                    value={form.highlights.length}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, length: e.target.value } }))}
                    placeholder="e.g. Calf-Length"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-neck">Neck</Label>
                  <Input
                    id="h-neck"
                    value={form.highlights.neck}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, neck: e.target.value } }))}
                    placeholder="e.g. Shoulder Straps"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-print">Print or Pattern Type</Label>
                  <Input
                    id="h-print"
                    value={form.highlights.print_or_pattern_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, highlights: { ...f.highlights, print_or_pattern_type: e.target.value } }))
                    }
                    placeholder="e.g. Solid"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-surface">Surface Styling</Label>
                  <Input
                    id="h-surface"
                    value={form.highlights.surface_styling}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, surface_styling: e.target.value } }))}
                    placeholder="e.g. Smocking or Shirred"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-sleeve-length">Sleeve Length</Label>
                  <Input
                    id="h-sleeve-length"
                    value={form.highlights.sleeve_length}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, sleeve_length: e.target.value } }))}
                    placeholder="e.g. Sleeveless"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-sleeve-styling">Sleeve Styling</Label>
                  <Input
                    id="h-sleeve-styling"
                    value={form.highlights.sleeve_styling}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, sleeve_styling: e.target.value } }))}
                    placeholder="e.g. Shoulder Strap"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-net-qty">Net Quantity</Label>
                  <Input
                    id="h-net-qty"
                    value={form.highlights.net_quantity}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, net_quantity: e.target.value } }))}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-addon">Add On</Label>
                  <Input
                    id="h-addon"
                    value={form.highlights.add_on}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, add_on: e.target.value } }))}
                    placeholder="e.g. Jacket"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-type">Type</Label>
                  <Input
                    id="h-type"
                    value={form.highlights.type}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, type: e.target.value } }))}
                    placeholder="e.g. One Piece"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-generic">Generic Name</Label>
                  <Input
                    id="h-generic"
                    value={form.highlights.generic_name}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, generic_name: e.target.value } }))}
                    placeholder="e.g. Dresses"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="h-country">Country of Origin</Label>
                  <Input
                    id="h-country"
                    value={form.highlights.country_of_origin}
                    onChange={(e) => setForm((f) => ({ ...f, highlights: { ...f.highlights, country_of_origin: e.target.value } }))}
                    placeholder="e.g. India"
                  />
                </div>
              </div>
            </div>

            {/* Image upload + URL list */}
            <div className="grid gap-1.5">
              <Label>Images</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-2 text-sm hover:border-primary/50">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>{uploading ? 'Uploading…' : 'Upload to Storage'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onUpload}
                    disabled={uploading}
                  />
                </label>
                <span className="text-xs text-muted-foreground">
                  Or import from any public image URL below.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="Paste any public image URL (Amazon, Google, etc.)"
                  className="max-w-md"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      importFromUrl();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={importFromUrl}
                  disabled={importing || !importUrl.trim()}
                >
                  {importing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-1.5 h-4 w-4" />
                  )}
                  {importing ? 'Importing…' : 'Import from URL'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This downloads the image and saves it in your own Supabase
                storage — so it keeps working even if the original site removes it.
              </p>
              <div className="flex flex-wrap gap-3">
                {form.images.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative h-20 w-16 overflow-hidden rounded-md border border-border bg-muted"
                  >
                    <Image
                      src={url}
                      alt={`${form.name || 'Product'} - uploaded image ${idx + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-destructive shadow-sm hover:bg-background"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Textarea
                rows={2}
                value={form.images.join('\n')}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    images: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                  }))
                }
                placeholder="One image URL per line"
              />
            </div>

            {/* Colour/size variants -- managed inline, right inside this same dialog */}
            <ProductVariantsManager
              productId={editing?.id ?? null}
              productName={form.name}
              productSku={form.sku}
              baseImage={form.images[0]}
            />

            {/* Product video (shows as the first slide in the gallery, before photos) */}
            <div className="grid gap-1.5">
              <Label htmlFor="video_url">Product Video URL (optional)</Label>
              <Input
                id="video_url"
                value={form.video_url}
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="https://... (.mp4 or .webm, hosted anywhere public)"
              />
              <p className="text-xs text-muted-foreground">
                Short fabric/drape video. Shows as the first slide on the product page gallery,
                before the photos — helps buyers see texture and movement.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="stock">Stock quantity *</Label>
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  required
                  value={form.stock_quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stock_quantity: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="low-stock-threshold">Low stock alert at</Label>
                <Input
                  id="low-stock-threshold"
                  type="number"
                  min={0}
                  value={form.low_stock_threshold}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rating">Rating (0–5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={form.rating}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rating: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="reviews">Reviews count</Label>
                <Input
                  id="reviews"
                  type="number"
                  min={0}
                  value={form.reviews}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reviews: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.featured}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, featured: v === true }))
                  }
                />
                Featured
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.in_stock}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, in_stock: v === true }))
                  }
                />
                In stock
              </label>
            </div>

            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving} className="bg-primary">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">
              Delete this product?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The product will be removed from your catalog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-share confirm — this product was already posted once. Posting
          the exact same product/images again is the kind of repeated,
          near-duplicate content Meta's spam systems watch for, so this is
          deliberately a click-through confirmation rather than a one-click
          action. */}
      <Dialog open={!!reshareConfirm} onOpenChange={(o) => !o && setReshareConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">
              Share this product to {reshareConfirm ? SOCIAL_PLATFORM_LABEL[reshareConfirm.platform] : 'social'} again?
            </DialogTitle>
            <DialogDescription>
              This product was already posted to {reshareConfirm ? SOCIAL_PLATFORM_LABEL[reshareConfirm.platform] : 'this platform'} once.
              Posting the same product repeatedly can look like duplicate/spam content, which risks
              your account getting restricted. Only re-share if something meaningfully changed
              (price drop, restock, new photos).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => reshareConfirm && shareProduct(reshareConfirm.id, reshareConfirm.platform, true)}
              disabled={!!reshareConfirm && sharingKey === `${reshareConfirm.id}:${reshareConfirm.platform}`}
            >
              {reshareConfirm && sharingKey === `${reshareConfirm.id}:${reshareConfirm.platform}` ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Yes, share again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}
