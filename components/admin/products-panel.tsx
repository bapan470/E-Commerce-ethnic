"use client";

import { useState, FormEvent, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ArrowLeft, Upload, Loader2, Sparkles, Link2 } from 'lucide-react';
import { useProducts } from '@/lib/cart-context';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from '@/lib/products-api';
import { Product, CategoryRow } from '@/lib/types';
import { formatINR } from '@/lib/format';
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
  stock_quantity: string;
  low_stock_threshold: string;
  rating: string;
  reviews: string;
  featured: boolean;
  in_stock: boolean;
}

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
  stock_quantity: String(p.stock_quantity),
  low_stock_threshold: String(p.low_stock_threshold ?? 5),
  rating: String(p.rating),
  reviews: String(p.reviews),
  featured: !!p.featured,
  in_stock: p.inStock,
});

export default function ProductsPanel() {
  const { products, categories, loading, refresh } = useProducts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      const data = await res.json();
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
        material: f.material || listing.material || f.material,
        pattern: f.pattern || listing.pattern || f.pattern,
        gender: f.gender !== 'female' ? f.gender : listing.gender || f.gender,
      }));
      toast.success('AI listing generated — review and tweak before saving');
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
      const urls = await Promise.all(files.map(uploadProductImage));
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
      } else {
        await createProduct(payload);
        toast.success('Product added');
      }
      setOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
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
      toast.error(err instanceof Error ? err.message : 'Delete failed');
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
      toast.error(err instanceof Error ? err.message : 'Update failed');
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
              : `${products.length} products · stored in Supabase`}
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-primary">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="hidden grid-cols-12 gap-3 border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <div className="col-span-5">Product</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Stock</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          <ul className="flex flex-col divide-y divide-border/60">
            {products.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-12 sm:items-center"
              >
                <div className="col-span-2 flex items-center gap-3 sm:col-span-5">
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={p.images[0] || 'https://placehold.co/48x60?text=No+Image'}
                      alt={`${p.name} - ${p.fabric} ${p.category}`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.fabric || '—'} · {p.origin || '—'}
                    </p>
                  </div>
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
                <div className="col-span-2 flex items-center gap-1 sm:col-span-2">
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
              <div className="grid gap-1.5">
                <Label htmlFor="colors">Colors (comma-separated)</Label>
                <Input
                  id="colors"
                  value={form.colors}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, colors: e.target.value }))
                  }
                  placeholder="Maroon, Gold"
                />
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
    </div>
  );
}
