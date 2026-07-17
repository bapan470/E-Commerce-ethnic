'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, CheckCircle2, MessageSquareOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  Review,
  fetchApprovedReviews,
  fetchMyReviewForProduct,
  hasPurchasedProduct,
  submitReview,
  summarizeReviews,
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

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    setSubmitting(true);
    try {
      const review = await submitReview({ productId, rating, title, comment });
      setMyReview(review);
      setFormOpen(false);
      setRating(0);
      setTitle('');
      setComment('');
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
            <div className="mt-3 flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="bg-primary">
                {submitting ? 'Submitting...' : 'Submit Review'}
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
                <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                  {r.customer_name} · Verified Purchase
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
