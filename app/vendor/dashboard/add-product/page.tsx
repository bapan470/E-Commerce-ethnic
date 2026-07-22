'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Upload, X, PackagePlus, Barcode as BarcodeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { uploadProductImage } from '@/lib/products-api';
import { useProducts } from '@/lib/cart-context';
import {
  fetchMyVendorProfile,
  submitVendorProduct,
  fetchMyVendorProducts,
  type VendorProductRow,
  type VendorProductApprovalStatus,
} from '@/lib/vendor-api';
import PhotographyGuidelines from '@/components/vendor/photography-guidelines';

const EMPTY_FORM = {
  name: '',
  fabric: '',
  category_id: '',
  category_name: '',
  available_quantity: '',
  vendor_expected_price: '',
  is_dead_stock: false,
  images: [] as string[],
};

const STATUS_META: Record<VendorProductApprovalStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  pending_review: { label: 'Pending Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  awaiting_stock: { label: 'Approved — Awaiting Stock Pickup', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  live: { label: 'Live on Site', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
};

export default function AddVendorProductPage() {
  const { categories } = useProducts();

  const [checkingVendor, setCheckingVendor] = useState(true);
  const [vendorApproved, setVendorApproved] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [submissions, setSubmissions] = useState<VendorProductRow[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  useEffect(() => {
    fetchMyVendorProfile()
      .then((p) => setVendorApproved(p?.status === 'approved'))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to check vendor status'))
      .finally(() => setCheckingVendor(false));
  }, []);

  const loadSubmissions = () => {
    setLoadingSubmissions(true);
    fetchMyVendorProducts()
      .then(setSubmissions)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load your submissions'))
      .finally(() => setLoadingSubmissions(false));
  };

  useEffect(() => {
    if (vendorApproved) loadSubmissions();
  }, [vendorApproved]);

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

  const handleCategoryChange = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    setForm((f) => ({ ...f, category_id: categoryId, category_name: cat?.name || '' }));
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.fabric.trim() || !form.category_name) {
      toast.error('Please fill in product name, fabric and category');
      return;
    }
    if (form.images.length === 0) {
      toast.error('Upload at least one product photo');
      return;
    }
    const qty = Number(form.available_quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitVendorProduct({
        name: form.name.trim(),
        fabric: form.fabric.trim(),
        category_id: form.category_id || null,
        category_name: form.category_name,
        available_quantity: qty,
        vendor_expected_price: form.vendor_expected_price ? Number(form.vendor_expected_price) : null,
        is_dead_stock: form.is_dead_stock,
        images: form.images,
      });
      toast.success(`Submitted for review — barcode ${created.barcode ?? 'assigned'}. We'll notify you once it's checked.`);
      resetForm();
      loadSubmissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit product');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingVendor) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendorApproved) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-bold text-primary">Not Available Yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only approved vendors can list products. Check your application status on your dashboard.
        </p>
        <Link href="/vendor/dashboard">
          <Button variant="outline" className="mt-4">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <PackagePlus className="h-5 w-5 text-primary" />
        <h1 className="font-serif text-2xl font-bold text-primary">Add a Product</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit for review — our team checks every listing before it's photographed and goes live.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border/60 bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Product Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Maroon Banarasi Silk Saree"
              />
            </div>
            <div>
              <Label>Fabric *</Label>
              <Input
                required
                value={form.fabric}
                onChange={(e) => setForm((f) => ({ ...f, fabric: e.target.value }))}
                placeholder="e.g. Banarasi Silk"
              />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category_id} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input
                required
                type="number"
                min={0}
                value={form.available_quantity}
                onChange={(e) => setForm((f) => ({ ...f, available_quantity: e.target.value }))}
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <Label>Expected Price (optional)</Label>
              <Input
                type="number"
                min={0}
                value={form.vendor_expected_price}
                onChange={(e) => setForm((f) => ({ ...f, vendor_expected_price: e.target.value }))}
                placeholder="₹ what you'd like for this"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                We'll suggest a price based on similar live listings — the final price is confirmed by our team.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
            <Checkbox
              id="dead-stock"
              checked={form.is_dead_stock}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_dead_stock: v === true }))}
            />
            <label htmlFor="dead-stock" className="text-sm leading-snug">
              This is dead / slow-moving stock
              <span className="block text-xs text-muted-foreground">
                We'll suggest a lower price to help it sell faster.
              </span>
            </label>
          </div>

          <div className="grid gap-1.5">
            <Label>Photos *</Label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-2 text-sm hover:border-primary/50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>{uploading ? 'Uploading…' : 'Upload Photos'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onUpload}
                  disabled={uploading}
                />
              </label>
              <span className="text-xs text-muted-foreground">Follow the checklist on the right.</span>
            </div>
            {form.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.images.map((url, idx) => (
                  <div key={url + idx} className="group relative h-20 w-20 overflow-hidden rounded-md border border-border/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full bg-primary" disabled={submitting || uploading}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit for Review'}
          </Button>
        </form>

        <PhotographyGuidelines />
      </div>

      <div className="mt-10">
        <h2 className="font-serif text-lg font-semibold text-primary">Your Submissions</h2>
        {loadingSubmissions ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing submitted yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {submissions.map((p) => {
              const meta = STATUS_META[p.approval_status];
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    {p.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="h-14 w-14 rounded-md border border-border/60 object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.category_name} · Qty {p.available_quantity}
                      </p>
                      {p.barcode && (
                        <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                          <BarcodeIcon className="h-3 w-3" /> {p.barcode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                    {p.approval_status === 'rejected' && p.rejection_reason && (
                      <p className="mt-1 max-w-[220px] text-xs text-red-600">{p.rejection_reason}</p>
                    )}
                    {(p.final_price ?? p.ai_suggested_price) != null && p.approval_status !== 'pending_review' && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Price: ₹{p.final_price ?? p.ai_suggested_price}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
