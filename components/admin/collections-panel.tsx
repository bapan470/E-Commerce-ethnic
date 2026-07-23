'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Plus, Pencil, Trash2, Search, X, ExternalLink, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useProducts } from '@/lib/cart-context';
import {
  fetchAdminCollections,
  fetchAdminCollection,
  createAdminCollection,
  updateAdminCollection,
  deleteAdminCollection,
} from '@/lib/admin-collections-api';
import { AdminCollectionRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

type StatusFilter = 'all' | 'active' | 'inactive';

export default function CollectionsPanel() {
  const { products } = useProducts();

  const [collections, setCollections] = useState<AdminCollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCollectionRow | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<AdminCollectionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchAdminCollections();
      setCollections(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => ({
      all: collections.length,
      active: collections.filter((c) => c.is_active).length,
      inactive: collections.filter((c) => !c.is_active).length,
    }),
    [collections]
  );

  const filtered = useMemo(() => {
    let list = collections;
    if (statusFilter === 'active') list = list.filter((c) => c.is_active);
    if (statusFilter === 'inactive') list = list.filter((c) => !c.is_active);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [collections, statusFilter, searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setSlug('');
    setDescription('');
    setIsActive(true);
    setSelectedProductIds([]);
    setProductSearch('');
    setOpen(true);
  };

  const openEdit = async (c: AdminCollectionRow) => {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description ?? '');
    setIsActive(c.is_active);
    setSelectedProductIds([]);
    setProductSearch('');
    setOpen(true);
    setLoadingProducts(true);
    try {
      const { product_ids } = await fetchAdminCollection(c.id);
      setSelectedProductIds(product_ids);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load collection products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Collection name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        description: description.trim() || null,
        is_active: isActive,
        product_ids: selectedProductIds,
      };
      if (editing) {
        await updateAdminCollection(editing.id, payload);
        toast.success('Collection updated');
      } else {
        await createAdminCollection(payload);
        toast.success('Collection created');
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteAdminCollection(confirmTarget.id);
      toast.success('Collection deleted');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Admin</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">Collections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curated product groups you manage directly — separate from the automatic
            &ldquo;&lt;Vendor&gt;&rsquo;s Collection&rdquo; pages. Each one gets its own page at /collection/[slug].
          </p>
        </div>
        <Button onClick={openNew} className="bg-primary">
          <Plus className="mr-1 h-4 w-4" /> Add New Collection
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {([
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ] as { value: StatusFilter; label: string }[]).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label} ({counts[tab.value]})
          </button>
        ))}
      </div>

      <div className="mb-4 relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, slug, description…"
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

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <table className="w-full table-auto">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  <a
                    href={`/collection/${c.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                  >
                    {c.slug}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {c.product_count} {c.product_count === 1 ? 'product' : 'products'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge
                    className={
                      c.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-100'
                        : 'bg-muted text-muted-foreground hover:bg-muted'
                    }
                  >
                    {c.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmTarget(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && collections.length > 0 && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No collections match your search/filter.
                </td>
              </tr>
            )}
            {!loading && collections.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  No collections yet. Add one to get started.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">
              {editing ? 'Edit Collection' : 'Add New Collection'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="coll-name">Name *</Label>
              <Input
                id="coll-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diwali Specials"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coll-slug">Slug (optional — auto-generated if left blank)</Label>
              <Input
                id="coll-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={slugify(name) || 'diwali-specials'}
              />
              <p className="text-xs text-muted-foreground">
                Public page: /collection/{slug.trim() || slugify(name) || 'diwali-specials'}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coll-desc">Description</Label>
              <Textarea
                id="coll-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description shown on the collection page"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="coll-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="coll-active" className="text-sm text-muted-foreground">
                Active (visible at /collection/{slug.trim() || slugify(name) || '…'})
              </Label>
            </div>

            <div className="grid gap-1.5">
              <Label>Products ({selectedProductIds.length} selected)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products to add…"
                  className="pl-9"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border/60">
                {loadingProducts ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">Loading products…</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">No products match.</p>
                ) : (
                  filteredProducts.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-border/40 px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving} className="bg-primary">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Collection'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">Delete this collection?</DialogTitle>
            <DialogDescription>
              {confirmTarget && confirmTarget.product_count > 0
                ? `${confirmTarget.product_count} product${
                    confirmTarget.product_count === 1 ? '' : 's'
                  } are in this collection. Deleting it will not delete those products, just removes this
                    curated grouping and its public page. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
