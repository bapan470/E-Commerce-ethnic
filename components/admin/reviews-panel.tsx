'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, X, Trash2, Star } from 'lucide-react';
import {
  fetchAllReviewsAdmin,
  approveReview,
  unapproveReview,
  deleteReviewAdmin,
  AdminReview,
} from '@/lib/reviews-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type Filter = 'all' | 'pending' | 'approved';

export default function ReviewsPanel() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [confirmTarget, setConfirmTarget] = useState<AdminReview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllReviewsAdmin();
      setReviews(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'pending') return reviews.filter((r) => !r.is_approved);
    if (filter === 'approved') return reviews.filter((r) => r.is_approved);
    return reviews;
  }, [reviews, filter]);

  const pendingCount = reviews.filter((r) => !r.is_approved).length;

  const handleApprove = async (r: AdminReview) => {
    setBusyId(r.id);
    try {
      await approveReview(r.id);
      toast.success('Review approved — now live on the product page');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnapprove = async (r: AdminReview) => {
    setBusyId(r.id);
    try {
      await unapproveReview(r.id);
      toast.success('Review hidden from the storefront');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    setBusyId(confirmTarget.id);
    try {
      await deleteReviewAdmin(confirmTarget.id);
      toast.success('Review deleted');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
      setConfirmTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Admin</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">
            Review Moderation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : `${pendingCount} pending · ${reviews.length} total`}
          </p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          {filter === 'pending' ? 'No reviews waiting for moderation.' : 'No reviews here.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{r.customer_name}</p>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-current' : ''}`}
                        />
                      ))}
                    </div>
                    <Badge variant={r.is_approved ? 'default' : 'outline'} className="text-xs">
                      {r.is_approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>
                  {r.product_slug ? (
                    <Link
                      href={`/product/${r.product_slug}`}
                      target="_blank"
                      className="text-xs text-secondary hover:underline"
                    >
                      {r.product_name}
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground">{r.product_name}</p>
                  )}
                  {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
                  {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                  {r.photos && r.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.photos.map((url, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={`${r.customer_name} review photo ${idx + 1}`}
                            className="h-14 w-14 rounded-md border border-border/60 object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!r.is_approved ? (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(r)}
                      disabled={busyId === r.id}
                      className="bg-primary"
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnapprove(r)}
                      disabled={busyId === r.id}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Unpublish
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmTarget(r)}
                    disabled={busyId === r.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">Delete this review?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
