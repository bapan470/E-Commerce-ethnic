'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, CheckCircle2, MessageSquareOff, ImagePlus, X, Loader2, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  Review,
  fetchApprovedReviews,
  fetchMyReviewForProduct,
  hasPurchasedProduct,
  hasWrittenContent,
  scheduleAutoPublish,
  submitReview,
  summarizeReviews,
  updateMyReview,
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

const RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: 'Excellent',
  4: 'Very Good',
  3: 'Good',
  2: 'Average',
  1: 'Poor',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Public-facing reviews only ever show the reviewer's first name, for privacy. */
function firstName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? name;
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
  const [step, setStep] = useState<'rating' | 'details'>('rating');
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>({});
  const [markedHelpful, setMarkedHelpful] = useState<Record<string, boolean>>({});

  const MAX_PHOTOS = 4;

  const toggleHelpful = (reviewId: string) => {
    setMarkedHelpful((prev) => {
      const next = { ...prev, [reviewId]: !prev[reviewId] };
      setHelpfulVotes((v) => ({
        ...v,
        [reviewId]: (v[reviewId] ?? 0) + (next[reviewId] ? 1 : -1),
      }));
      return next;
    });
  };

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

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    setSubmitting(true);
    try {
      const review = await submitReview({ productId, rating });
      setMyReview(review);
      setStep('details');
      scheduleAutoPublish(review.id, () => {
        setMyReview((prev) => (prev && prev.id === review.id ? { ...prev, is_approved: true } : prev));
        fetchApprovedReviews(productId).then(setReviews).catch(() => {});
      });
      toast.success('Thanks for rating! Add a written review below, or come back anytime.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDetails = async () => {
    if (!myReview) return;
    setSubmitting(true);
    try {
      let photos: string[] = [];
      if (photoFiles.length > 0) {
        photos = await Promise.all(photoFiles.map(uploadReviewPhoto));
      }
      const updated = await updateMyReview(myReview.id, { title, comment, photos });
      setMyReview(updated);
      scheduleAutoPublish(updated.id, () => {
        setMyReview((prev) => (prev && prev.id === updated.id ? { ...prev, is_approved: true } : prev));
        fetchApprovedReviews(productId).then(setReviews).catch(() => {});
      });
      setFormOpen(false);
      setTitle('');
      setComment('');
      setPhotoFiles([]);
      toast.success('Thanks! Your review will go live within a few seconds.');
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
    if (myReview && !hasWrittenContent(myReview)) {
      // Already rated -- go straight to the "add details" step.
      setRating(myReview.rating);
      setStep('details');
    } else {
      setStep('rating');
      setRating(0);
    }
    setFormOpen(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <p className="font-serif text-4xl font-bold text-emerald-600">
            {summary.totalRatings > 0 ? summary.average.toFixed(1) : '—'}
            <span className="ml-1 align-middle text-lg text-secondary">★</span>
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {summary.totalRatings.toLocaleString('en-IN')} Rating{summary.totalRatings === 1 ? '' : 's'}
          </p>
          <p className="text-sm text-muted-foreground">
            {summary.totalReviews.toLocaleString('en-IN')} Review{summary.totalReviews === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = summary.breakdown[star];
            const pct = summary.totalRatings > 0 ? (count / summary.totalRatings) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-muted-foreground">{RATING_LABELS[star]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${
                      star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-lime-500' : star === 2 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>

        {myReview && hasWrittenContent(myReview) ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
            {myReview.is_approved
              ? 'You reviewed this product.'
              : 'Your review is awaiting approval.'}
          </div>
        ) : myReview ? (
          <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
              You rated this {myReview.rating}★
              {myReview.is_approved ? '' : ' (awaiting approval)'}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={openForm}
              className="w-fit border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Add a written review
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={openForm}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Rate this product
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
            {step === 'rating' ? (
              <>
                <p className="mb-2 text-sm font-semibold">Rate this product</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Just tap a star to submit your rating. You can add a written review after, if you&apos;d like.
                </p>
                <StarPicker value={rating} onChange={setRating} />
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleSubmitRating} disabled={submitting} className="bg-primary">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Rating'
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setFormOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-1 text-sm font-semibold">Write a review</p>
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <StarRow value={myReview?.rating ?? rating} size="h-3.5 w-3.5" />
                  Your rating &mdash; already saved
                </div>
                <Input
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
                  <Button onClick={handleSubmitDetails} disabled={submitting} className="bg-primary">
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
                    Maybe later
                  </Button>
                </div>
              </>
            )}
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
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(r.customer_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{firstName(r.customer_name)}</span>
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                        {r.rating.toFixed(1)}
                        <Star className="h-3 w-3 fill-white" />
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Posted on{' '}
                      {new Date(r.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>

                    {r.title && <p className="mt-2 text-sm font-semibold">{r.title}</p>}
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
                              alt={`Photo from ${firstName(r.customer_name)}'s review`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex animate-in fade-in zoom-in items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 duration-500 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-3 w-3 shrink-0 animate-pulse text-emerald-600 [animation-duration:2s] dark:text-emerald-400" />
                        Verified Purchase
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleHelpful(r.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                          markedHelpful[r.id]
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary'
                        }`}
                      >
                        <ThumbsUp
                          className={`h-3 w-3 transition-transform duration-200 ${
                            markedHelpful[r.id] ? 'fill-primary scale-110' : ''
                          }`}
                        />
                        Helpful{helpfulVotes[r.id] ? ` (${helpfulVotes[r.id]})` : ''}
                      </button>
                    </div>
                  </div>
                </div>
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
