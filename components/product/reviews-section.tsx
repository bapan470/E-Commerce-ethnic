'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, CheckCircle2, MessageSquareOff, ImagePlus, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  Review,
  fetchApprovedReviews,
  fetchMyReviewForProduct,
  hasPurchasedProduct,
  submitReview,
  summarizeReviews,
  uploadReviewPhoto,
} from '@/lib/reviews-api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function StarRow({
  value,
  size = 'h-4 w-4',
}: {
  value: number;
  size?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${size} ${
            i < Math.round(value) ? 'fill-secondary text-secondary' : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`Rate ${n} stars`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                n <= (hover || value)
                  ? 'fill-secondary text-secondary'
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function ReviewsSection({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug: string;
}) {
  const { user } = useAuth();
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [eligible, setEligible] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const MAX_PHOTOS = 4;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchApprovedReviews(productId)]).then(([r]) => {
      if (!cancelled) {
        setReviews(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!user) {
      setMyReview(null);
      setEligible(false);
      return;
    }
    fetchMyReviewForProduct(productId).then(setMyReview).catch(() => {});
    hasPurchasedProduct(productId).then(setEligible).catch(() => {});
  }, [user, productId]);

  const summary = summarizeReviews(reviews);

  const onPickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    setPhotoFiles((prev) => {
      const combined = [...prev, ...picked].slice(0, MAX_PHOTOS);
      if (prev.length + picked.length > MAX_PHOTOS) {
        toast.info(`You can attach up to ${MAX_PHOTOS} photos`);
      }
      return combined;
    });
  };

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const removePhoto = (idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    setSubmitting(true);
    try {
      let photos: string[] = [];
      if (photoFiles.length > 0) {
        photos = await Promise.all(photoFiles.map(uploadReviewPhoto));
      }
      const review = await submitReview({ productId, rating, title, comment, photos });
      setMyReview(review);
      setFormOpen(false);
      setRating(0);
      setTitle('');
      setComment('');
      setPhotoFiles([]);
      toast.success('Thanks! Your review will appear after a quick moderation check.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const openForm = () => {
    if (!user) {
      toast.info('Login to write a review');
      router.push(`/login?next=/product/${productSlug}`);
      return;
    }
    setFormOpen(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-serif text-4xl font-bold text-primary">
            {summary.total > 0 ? summary.average.toFixed(1) : '—'}
          </p>
          <StarRow value={summary.average} size="h-5 w-5" />
          <p className="mt-1 text-sm text-muted-foreground">
            Based on {summary.total} review{summary.total === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = summary.breakdown[star];
            const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-muted-foreground">{star} star</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>

        {myReview ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
            {myReview.is_approved
              ? 'You reviewed this product.'
              : 'Your review is awaiting approval.'}
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={openForm}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Write a review
          </Button>
        )}

        {user && !myReview && !eligible && (
          <p className="text-xs text-muted-foreground">
            Only customers who have purchased this product can leave a review.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {formOpen && (
          <div className="rounded-lg border border-border/60 bg-card p-5">
            <p className="mb-2 text-sm font-semibold">Rate this product</p>
            <StarPicker value={rating} onChange={setRating} />
            <Input
              className="mt-4"
              placeholder="Review title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <Textarea
              className="mt-3"
              placeholder="Share details about the fit, fabric, and quality..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
            />

            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Add photos (optional) — {photoFiles.length}/{MAX_PHOTOS}
              </p>
              <div className="flex flex-wrap gap-2">
                {photoPreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative h-16 w-16 overflow-hidden rounded-md border border-border/60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Attached photo ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-destructive shadow-sm hover:bg-background"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photoFiles.length < MAX_PHOTOS && (
                  <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={onPickPhotos}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="bg-primary">
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </Button>
              <Button variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <MessageSquareOff className="h-8 w-8" />
            <p className="text-sm">No reviews yet. Be the first to share your experience.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {reviews.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center justify-between">
                  <StarRow value={r.rating} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {r.title && <p className="mt-1.5 text-sm font-semibold">{r.title}</p>}
                {r.comment && (
                  <p className="mt-1 text-sm leading-relaxed text-foreground/80">{r.comment}</p>
                )}
                {r.photos && r.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.photos.map((src, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLightboxSrc(src)}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Photo from ${r.customer_name}'s review`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                  {r.customer_name} · Verified Purchase
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            aria-label="Close photo"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-4 rounded-full bg-background/20 p-2 text-white hover:bg-background/30"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Customer review photo enlarged"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
