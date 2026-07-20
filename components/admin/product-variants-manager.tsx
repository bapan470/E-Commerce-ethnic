'use client';

import { useEffect, useState, FormEvent } from 'react';
import Image from 'next/image';
import { Plus, Pencil, Trash2, Upload, Loader2, Star, Link2, Wand2 } from 'lucide-react';
import {
  fetchVariantsWithSizes,
  createVariant,
  updateVariant,
  deleteVariant,
  setDefaultVariant,
  addVariantSize,
  updateVariantSize,
  deleteVariantSize,
  uploadVariantImage,
  VariantWithSizes,
} from '@/lib/variants-api';
import { generateVariantSku, generateSizeSku } from '@/lib/sku';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

interface VariantFormState {
  color: string;
  slug: string;
  images: string[];
  priceOverride: string;
  sku: string;
  metaTitle: string;
  metaDescription: string;
  isDefault: boolean;
  sizes: { size: string; stockQuantity: string; sku: string }[];
}

const emptyVariantForm = (): VariantFormState => ({
  color: '',
  slug: '',
  images: [],
  priceOverride: '',
  sku: '',
  metaTitle: '',
  metaDescription: '',
  isDefault: false,
  sizes: [{ size: 'Free Size', stockQuantity: '0', sku: '' }],
});

interface Props {
  productId: string | null;
  productName: string;
  productSku: string;
  baseImage?: string;
}

/**
 * Colour/size variant management, embedded directly inside the Add/Edit
 * Product dialog -- no separate "Variants" tab to hunt for. Click a
 * product's title/row in the list (or the palette icon) to open the same
 * dialog this lives in.
 */
export default function ProductVariantsManager({ productId, productName, productSku, baseImage }: Props) {
  const [variants, setVariants] = useState<VariantWithSizes[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VariantWithSizes | null>(null);
  const [form, setForm] = useState<VariantFormState>(emptyVariantForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [confirmVariant, setConfirmVariant] = useState<VariantWithSizes | null>(null);

  const loadVariants = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchVariantsWithSizes(id);
      setVariants(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load variants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) loadVariants(productId);
    else setVariants([]);
  }, [productId]);

  const openNew = () => {
    setEditing(null);
    setForm({
      ...emptyVariantForm(),
      images: baseImage ? [baseImage] : [],
    });
    setOpen(true);
  };

  const openEdit = (v: VariantWithSizes) => {
    setEditing(v);
    setForm({
      color: v.color,
      slug: v.slug,
      images: v.images,
      priceOverride: v.price_override != null ? String(v.price_override) : '',
      sku: v.sku ?? '',
      metaTitle: v.meta_title ?? '',
      metaDescription: v.meta_description ?? '',
      isDefault: v.is_default,
      sizes: v.sizes.length
        ? v.sizes.map((s) => ({ size: s.size, stockQuantity: String(s.stock_quantity), sku: s.sku ?? '' }))
        : [{ size: 'Free Size', stockQuantity: '0', sku: '' }],
    });
    setOpen(true);
  };

  // Auto-fill the colour + size SKUs from the product SKU the moment a
  // colour name is typed, if the admin hasn't set one manually yet.
  const autoFillSkus = () => {
    const base = productSku.trim();
    if (!base || !form.color.trim()) {
      toast.error('Add the product SKU and a colour name first');
      return;
    }
    const vSku = generateVariantSku(base, form.color.trim());
    setForm((f) => ({
      ...f,
      sku: vSku,
      sizes: f.sizes.map((s) => ({ ...s, sku: s.sku || generateSizeSku(vSku, s.size || 'FREE') })),
    }));
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(uploadVariantImage));
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
        body: JSON.stringify({ url, folder: 'variants' }),
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

  const updateSizeRow = (idx: number, patch: Partial<{ size: string; stockQuantity: string; sku: string }>) => {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addSizeRow = () => {
    setForm((f) => ({ ...f, sizes: [...f.sizes, { size: '', stockQuantity: '0', sku: '' }] }));
  };

  const removeSizeRow = (idx: number) => {
    setForm((f) => ({ ...f, sizes: f.sizes.filter((_, i) => i !== idx) }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast.error('Save the product first');
      return;
    }
    if (!form.color.trim()) {
      toast.error('Colour name is required');
      return;
    }
    if (form.images.length === 0) {
      toast.error('Add at least one image for this variant');
      return;
    }
    const validSizes = form.sizes.filter((s) => s.size.trim());
    if (validSizes.length === 0) {
      toast.error('Add at least one size');
      return;
    }

    setSaving(true);
    try {
      const slug = form.slug.trim() || slugify(`${productName}-${form.color}`);
      const priceOverride = form.priceOverride ? Number(form.priceOverride) : null;
      const vSku = form.sku.trim() || (productSku ? generateVariantSku(productSku, form.color) : null);

      if (editing) {
        await updateVariant(editing.id, {
          color: form.color.trim(),
          slug,
          images: form.images,
          price_override: priceOverride,
          meta_title: form.metaTitle.trim() || null,
          meta_description: form.metaDescription.trim() || null,
          sku: vSku,
        });

        const existingIds = new Set(editing.sizes.map((s) => s.id));
        const keptIds = new Set<string>();
        for (const row of form.sizes) {
          if (!row.size.trim()) continue;
          const match = editing.sizes.find((s) => s.size === row.size);
          const rowSku = row.sku.trim() || (vSku ? generateSizeSku(vSku, row.size) : null);
          if (match) {
            keptIds.add(match.id);
            await updateVariantSize(match.id, {
              size: row.size.trim(),
              stock_quantity: Number(row.stockQuantity) || 0,
              sku: rowSku,
            });
          } else {
            await addVariantSize({
              variantId: editing.id,
              size: row.size.trim(),
              stockQuantity: Number(row.stockQuantity) || 0,
              sku: rowSku,
            });
          }
        }
        for (const id of Array.from(existingIds)) {
          if (!keptIds.has(id)) await deleteVariantSize(id);
        }

        if (form.isDefault && !editing.is_default) {
          await setDefaultVariant(productId, editing.id);
        }
        toast.success('Variant updated');
      } else {
        const created = await createVariant({
          productId,
          color: form.color.trim(),
          slug,
          images: form.images,
          priceOverride,
          metaTitle: form.metaTitle.trim() || undefined,
          metaDescription: form.metaDescription.trim() || undefined,
          isDefault: form.isDefault,
          sku: vSku,
          sizes: validSizes.map((s) => ({
            size: s.size.trim(),
            stockQuantity: Number(s.stockQuantity) || 0,
            sku: s.sku.trim() || (vSku ? generateSizeSku(vSku, s.size) : null),
          })),
        });
        if (form.isDefault) {
          await setDefaultVariant(productId, created.id);
        }
        toast.success('Colour variant added');
      }
      setOpen(false);
      await loadVariants(productId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmVariant || !productId) return;
    try {
      await deleteVariant(confirmVariant.id);
      toast.success('Variant deleted');
      await loadVariants(productId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setConfirmVariant(null);
    }
  };

  const makeDefault = async (v: VariantWithSizes) => {
    if (!productId) return;
    try {
      await setDefaultVariant(productId, v.id);
      toast.success(`${v.color} set as default`);
      await loadVariants(productId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  if (!productId) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        Save this product first — colour/size variants can be added right here once it exists.
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Colour &amp; size variants</p>
          <p className="text-xs text-muted-foreground">
            Each colour gets its own photos, SKU and per-size stock — managed right here.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openNew} className="shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add colour
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : variants.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No colour variants yet. Click &quot;Add colour&quot; to create the first one (e.g. Maroon, Green).
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {variants.map((v) => (
            <div
              key={v.id}
              className={`flex items-start gap-2 rounded-md border p-2 ${
                v.is_default ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border/60'
              }`}
            >
              <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-muted">
                {v.images[0] ? (
                  <Image src={v.images[0]} alt={v.color} fill sizes="44px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <p className="truncate text-sm font-semibold">{v.color}</p>
                  {v.is_default && (
                    <Badge className="bg-primary px-1 py-0 text-[10px] text-primary-foreground">
                      <Star className="mr-0.5 h-2.5 w-2.5 fill-current" /> Default
                    </Badge>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  SKU: {v.sku || <span className="italic">not set</span>}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {v.sizes.map((s) => (
                    <Badge key={s.id} variant="outline" className="px-1 py-0 text-[10px]">
                      {s.size}: {s.stock_quantity}
                    </Badge>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-6 px-1.5 text-[11px]" onClick={() => openEdit(v)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  {!v.is_default && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-[11px]"
                      onClick={() => makeDefault(v)}
                    >
                      <Star className="mr-1 h-3 w-3" /> Default
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmVariant(v)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit variant dialog -- stacks on top of the product dialog. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">
              {editing ? 'Edit Variant' : 'Add Colour Variant'}
            </DialogTitle>
            <DialogDescription>For &quot;{productName || 'this product'}&quot;</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="v-color">Colour *</Label>
                <Input
                  id="v-color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="e.g. Maroon"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-slug">SEO Slug (optional)</Label>
                <Input
                  id="v-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="auto-generated"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="v-sku">SKU code</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="v-sku"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="auto-generated on save"
                  />
                  <Button type="button" variant="outline" size="icon" title="Auto-generate SKU" onClick={autoFillSkus}>
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-price">Price override (₹, optional)</Label>
                <Input
                  id="v-price"
                  type="number"
                  min={0}
                  value={form.priceOverride}
                  onChange={(e) => setForm((f) => ({ ...f, priceOverride: e.target.value }))}
                  placeholder="Leave blank to use base product price"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Images *</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-2 text-sm hover:border-primary/50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="Paste any public image URL"
                  className="max-w-md"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      importFromUrl();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={importFromUrl} disabled={importing || !importUrl.trim()}>
                  {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
                  {importing ? 'Importing…' : 'Import from URL'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Nothing uploaded yet? The base product photo is used automatically as a placeholder — swap it out any time.
              </p>
              <div className="flex flex-wrap gap-3">
                {form.images.map((url, idx) => (
                  <div key={idx} className="relative h-20 w-16 overflow-hidden rounded-md border border-border bg-muted">
                    <Image src={url} alt={`${form.color || 'Variant'} image ${idx + 1}`} fill sizes="64px" className="object-cover" />
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
            </div>

            <div className="grid gap-1.5">
              <Label>Sizes, stock &amp; SKU *</Label>
              <div className="grid gap-2">
                {form.sizes.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={row.size}
                      onChange={(e) => updateSizeRow(idx, { size: e.target.value })}
                      placeholder="Size (e.g. M)"
                      className="w-24"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={row.stockQuantity}
                      onChange={(e) => updateSizeRow(idx, { stockQuantity: e.target.value })}
                      placeholder="Stock"
                      className="w-20"
                    />
                    <Input
                      value={row.sku}
                      onChange={(e) => updateSizeRow(idx, { sku: e.target.value })}
                      placeholder="SKU (auto)"
                      className="flex-1"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => removeSizeRow(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addSizeRow} className="w-fit">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add size
              </Button>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Set as default colour for this product
            </label>

            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving} className="bg-primary">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Variant'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmVariant} onOpenChange={(o) => !o && setConfirmVariant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">Delete this variant?</DialogTitle>
            <DialogDescription>
              This removes the &quot;{confirmVariant?.color}&quot; colour option and its SEO page. This action cannot be
              undone.
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
