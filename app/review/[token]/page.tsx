'use client';

// ---------------------------------------------------------------------
// Public, login-free review page. Opened from the "Rate & Review" CTA in
// reviewRequestEmail / reviewReminderEmail (lib/email-templates.ts), which
// now link here instead of the login-gated /account/orders/[id] -- see
// lib/review-link-tokens.ts for how the token in the URL is minted and
// verified, and app/api/review-link/[token]/route.ts for the API this
// page talks to. NO auth guard: knowing the token is the only thing that
// grants access, same trust model as a password-reset link.
// ---------------------------------------------------------------------

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Loader2, ImagePlus, X, CheckCircle2, Copy, Check, PartyPopper, AlertTriangle } from 'lucide-react';
import {
  fetchReviewLinkOrder,
  submitGuestReview,
  uploadGuestReviewPhoto,
  type ReviewLinkItem,
  type ReviewLinkOrder,
  type ReviewLinkReward,
} from '@/lib/review-link-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const MAX_PHOTOS = 4;

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`Rate ${n} stars`}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                n <= (hover || value) ? 'fill-secondary text-secondary' : 'text-muted-foreground/30'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function formatDiscount(reward: ReviewLinkReward): string {
  return reward.discountType === 'percentage' ? `${reward.discountValue}% off` : `₹${reward.discountValue} off`;
}

function RewardBanner({ reward }: { reward: ReviewLinkReward }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(reward.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 rounded-lg border border-secondary/40 bg-gradient-to-br from-secondary/15 via-secondary/5 to-transparent p-4 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-center gap-2 text-primary">
        <PartyPopper className="h-5 w-5 text-secondary" />
        <span className="font-serif text-lg font-bold">You've earned {formatDiscount(reward)}!</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Thanks for the review -- here's your code, ready to use.</p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-dashed border-secondary bg-background px-4 py-2 font-mono text-sm font-semibold text-primary hover:bg-secondary/10"
      >
        {reward.code}
        {copied ? <Check className="h-4 w-4 text-secondary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
      </button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {copied ? 'Copied!' : 'Tap to copy'} · Valid till {new Date(reward.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </div>
  );
}

function ReviewItemCard({
  token,
  item,
  guestEmail,
  onSubmitted,
}: {
  token: string;
  item: ReviewLinkItem;
  guestEmail: string;
  onSubmitted: (productId: string, reward: ReviewLinkReward | null) => void;
}) {
  const [rating, setRating] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reward, setReward] = useState<ReviewLinkReward | null>(null);
  const [done, setDone] = useState(Boolean(item.existingReview));

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const onPickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    setPhotoFiles((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (idx: number) => setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!item.productId || rating < 1) return;
    setSubmitting(true);
    try {
      let photos: string[] = [];
      if (photoFiles.length > 0) {
        photos = await Promise.all(photoFiles.map((f) => uploadGuestReviewPhoto(token, f)));
      }
      const result = await submitGuestReview(token, {
        productId: item.productId,
        rating,
        title: title || undefined,
        comment: comment || undefined,
        photos,
        guestEmail: guestEmail || undefined,
      });
      setReward(result.reward);
      setDone(true);
      onSubmitted(item.productId, result.reward);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const existing = item.existingReview;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.name} className="h-16 w-16 shrink-0 rounded-lg object-cover border border-border/50" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
        )}
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-semibold text-primary">{item.name}</p>
          {item.size && <p className="text-xs text-muted-foreground">Size: {item.size}</p>}
        </div>
      </div>

      {done ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
          {existing ? `Thanks, already reviewed (${existing.rating}★)` : `Thanks for rating this ${rating}★!`}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-center">
            <StarPicker value={rating} onChange={(n) => { setRating(n); setDetailsOpen(true); }} disabled={submitting} />
          </div>

          {detailsOpen && rating > 0 && (
            <div className="space-y-2.5">
              <Input
                placeholder="Review title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                disabled={submitting}
              />
              <Textarea
                placeholder={`Tell us about ${item.name}'s fit, fabric and quality...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
                disabled={submitting}
              />
              <div className="flex flex-wrap gap-2">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-md border border-border/60">
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
                    <span className="text-[10px]">Add photo</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} disabled={submitting} />
                  </label>
                )}
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-primary">
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {reward && <RewardBanner reward={reward} />}
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="text-center">
      <div className="font-serif text-2xl font-bold">
        <span className="text-primary">Aruhi</span>
        <span className="text-secondary">Handlooms</span>
      </div>
      <div className="mx-auto mt-1.5 h-px w-12 bg-secondary/60" />
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Handwoven Ethnic Wear</p>
    </div>
  );
}

export default function ReviewLinkPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<ReviewLinkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestEmail, setGuestEmail] = useState('');
  const [rewards, setRewards] = useState<Record<string, ReviewLinkReward | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetchReviewLinkOrder(token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'This review link is invalid or has expired.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmitted = (productId: string, reward: ReviewLinkReward | null) => {
    setRewards((prev) => ({ ...prev, [productId]: reward }));
  };

  return (
    <div className="min-h-screen bg-[#f2ebe3]">
      <div className="mx-auto max-w-md px-4 py-8 sm:max-w-lg">
        <BrandHeader />

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading your order...</p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-xl border border-border/60 bg-card p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <h1 className="mt-3 font-serif text-lg font-bold text-primary">Link expired or invalid</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Already have an account? You can still review from{' '}
              <Link href="/account/orders" className="text-primary underline underline-offset-2">
                My Orders
              </Link>
              .
            </p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="mt-6 text-center">
              <h1 className="font-serif text-xl font-bold text-primary">
                Hi {data.order.customerName || 'there'}, how's your order?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Order <span className="font-medium text-foreground">#{data.order.shortId}</span> -- tap a star for each item below.
              </p>
            </div>

            {!data.items.some((it) => it.existingReview) && (
              <div className="mt-4">
                <Input
                  type="email"
                  placeholder="Email for order updates (optional)"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="bg-background"
                />
              </div>
            )}

            <div className="mt-5 space-y-4">
              {data.items.map((item, idx) => (
                <ReviewItemCard
                  key={item.productId || idx}
                  token={token}
                  item={item}
                  guestEmail={guestEmail}
                  onSubmitted={onSubmitted}
                />
              ))}
            </div>

            <p className="mt-8 text-center text-[11px] text-muted-foreground">
              This is a private link just for your order -- no account or login needed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
