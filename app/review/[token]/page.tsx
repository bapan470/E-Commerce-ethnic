'use client';

// ---------------------------------------------------------------------
// Public, login-free review page. Opened from the "Rate & Review" CTA in
// reviewRequestEmail / reviewReminderEmail (lib/email-templates.ts), which
// now link here instead of the login-gated /account/orders/[id] -- see
// lib/review-link-tokens.ts for how the token in the URL is minted and
// verified, and app/api/review-link/[token]/route.ts for the API this
// page talks to. NO auth guard: knowing the token is the only thing that
// grants access, same trust model as a password-reset link.
//
// 3-step flow: Rate -> Write a review -> Upload a real photo. Which of
// the last two steps actually show up depends on the store's settings
// (Admin > Review Rewards -- requireWrittenReview / requirePhoto), sent
// down in `data.reward`. ONE coupon is issued for the whole review, only
// once every step this store requires is done -- never one per step.
// ---------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Star,
  Loader2,
  ImagePlus,
  X,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  PartyPopper,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import {
  fetchReviewLinkOrder,
  submitGuestReview,
  uploadGuestReviewPhoto,
  type ReviewLinkItem,
  type ReviewLinkOrder,
  type ReviewLinkReward,
  type ReviewLinkRewardConfig,
} from '@/lib/review-link-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const MAX_PHOTOS = 4;

type StepKey = 'rate' | 'write' | 'photo';

/** Which steps this store's settings actually require, in order. */
function stepsFor(reward: ReviewLinkRewardConfig): StepKey[] {
  const steps: StepKey[] = ['rate'];
  if (reward.requireWrittenReview) steps.push('write');
  if (reward.requirePhoto) steps.push('photo');
  return steps;
}

const STEP_LABEL: Record<StepKey, string> = {
  rate: 'Rate',
  write: 'Write a review',
  photo: 'Add a photo',
};

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
      <p className="mt-1 text-xs text-muted-foreground">Thanks for the full review -- here's your code, ready to use.</p>
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

/** Small "Step 1 of 3" progress row -- done steps get a check, the
 *  current step is highlighted, future steps are dim. Purely visual;
 *  which steps exist at all is decided by `steps` (from store settings). */
function StepProgress({ steps, currentIndex }: { steps: StepKey[]; currentIndex: number }) {
  if (steps.length <= 1) return null;
  return (
    <div className="mb-3 flex items-center gap-1">
      {steps.map((step, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center gap-1">
            <div
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${
                done
                  ? 'bg-secondary/15 text-secondary'
                  : active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/60'
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{STEP_LABEL[step]}</span>
            </div>
            {idx < steps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
          </div>
        );
      })}
    </div>
  );
}

function ReviewItemCard({
  token,
  item,
  steps,
  guestEmail,
  onSubmitted,
}: {
  token: string;
  item: ReviewLinkItem;
  steps: StepKey[];
  guestEmail: string;
  onSubmitted: (productId: string, reward: ReviewLinkReward | null) => void;
}) {
  const existing = item.existingReview;

  // Resume at the first step that isn't done yet, so refreshing mid-way
  // through (or coming back later) never makes someone redo a step.
  const initialStepIndex = useMemo(() => {
    if (!existing) return 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] === 'rate' && !item.progress.rated) return i;
      if (steps[i] === 'write' && !item.progress.reviewed) return i;
      if (steps[i] === 'photo' && !item.progress.photoUploaded) return i;
    }
    return steps.length; // every required step already done
  }, [existing, item.progress, steps]);

  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [savedPhotoUrls, setSavedPhotoUrls] = useState<string[]>(existing?.photos ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [reward, setReward] = useState<ReviewLinkReward | null>(null);
  const [rewardIssued, setRewardIssued] = useState(item.progress.rewardIssued);

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const done = stepIndex >= steps.length;
  const currentStep = steps[stepIndex];

  const onPickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    setPhotoFiles((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS - savedPhotoUrls.length));
  };
  const removePhoto = (idx: number) => setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));

  const submitStep = async () => {
    if (!item.productId) return;
    setSubmitting(true);
    try {
      const payload: {
        productId: string;
        rating?: number;
        title?: string;
        comment?: string;
        photos?: string[];
        guestEmail?: string;
      } = { productId: item.productId, guestEmail: guestEmail || undefined };

      if (currentStep === 'rate') {
        payload.rating = rating;
      } else if (currentStep === 'write') {
        payload.title = title || undefined;
        payload.comment = comment;
      } else if (currentStep === 'photo') {
        const uploaded =
          photoFiles.length > 0 ? await Promise.all(photoFiles.map((f) => uploadGuestReviewPhoto(token, f))) : [];
        const allPhotos = [...savedPhotoUrls, ...uploaded].slice(0, MAX_PHOTOS);
        payload.photos = allPhotos;
        setSavedPhotoUrls(allPhotos);
        setPhotoFiles([]);
      }

      const result = await submitGuestReview(token, payload);
      setReward(result.reward);
      setRewardIssued(result.progress.rewardIssued);
      onSubmitted(item.productId, result.reward);
      setStepIndex((i) => i + 1);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'Could not save this step.');
    } finally {
      setSubmitting(false);
    }
  };

  const canContinue =
    currentStep === 'rate'
      ? rating > 0
      : currentStep === 'write'
      ? comment.trim().length > 0
      : currentStep === 'photo'
      ? savedPhotoUrls.length + photoFiles.length > 0
      : false;

  const isLastStep = stepIndex === steps.length - 1;

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
          <p className="text-xs text-muted-foreground">
            {item.size && <span>Size: {item.size}</span>}
            {item.size && item.color && <span> · </span>}
            {item.color && <span>Colour: {item.color}</span>}
          </p>
        </div>
      </div>

      {done ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
          {rating > 0 ? `Thanks, all done (${rating}★)!` : 'Thanks, already reviewed!'}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <StepProgress steps={steps} currentIndex={stepIndex} />

          {currentStep === 'rate' && (
            <div className="flex items-center justify-center">
              <StarPicker value={rating} onChange={setRating} disabled={submitting} />
            </div>
          )}

          {currentStep === 'write' && (
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
            </div>
          )}

          {currentStep === 'photo' && (
            <div className="flex flex-wrap gap-2">
              {savedPhotoUrls.map((src, idx) => (
                <div key={`saved-${idx}`} className="relative h-16 w-16 overflow-hidden rounded-md border border-border/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Uploaded photo ${idx + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
              {photoPreviews.map((src, idx) => (
                <div key={`new-${idx}`} className="relative h-16 w-16 overflow-hidden rounded-md border border-border/60">
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
              {savedPhotoUrls.length + photoFiles.length < MAX_PHOTOS && (
                <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">Real photo</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} disabled={submitting} />
                </label>
              )}
            </div>
          )}

          <Button onClick={submitStep} disabled={submitting || !canContinue} className="w-full bg-primary">
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : isLastStep ? (
              'Submit Review'
            ) : (
              'Continue'
            )}
          </Button>
          {currentStep === 'photo' && (
            <p className="text-center text-[11px] text-muted-foreground">
              A real photo of you wearing/using it -- helps other shoppers (and unlocks your reward).
            </p>
          )}
        </div>
      )}

      {rewardIssued && reward && <RewardBanner reward={reward} />}
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

  const steps = data ? stepsFor(data.reward) : (['rate'] as StepKey[]);

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
                Order <span className="font-medium text-foreground">#{data.order.shortId}</span> --{' '}
                {steps.length > 1
                  ? `complete all ${steps.length} steps for each item to unlock your reward.`
                  : 'tap a star for each item below.'}
              </p>
              {data.reward.enabled && (
                <p className="mt-1 text-xs font-medium text-secondary">
                  {steps.map((s) => STEP_LABEL[s]).join(' → ')} ={' '}
                  {data.reward.discountType === 'percentage'
                    ? `${data.reward.discountValue}% off`
                    : `₹${data.reward.discountValue} off`}{' '}
                  your next order
                </p>
              )}
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
                  steps={steps}
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
