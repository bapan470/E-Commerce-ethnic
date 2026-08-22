'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { MapPin, CheckCircle2, XCircle, Loader2, Truck, ChevronRight, Clock } from 'lucide-react';
import { checkPincodeServiceability, PincodeResult } from '@/lib/pincode-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Once a shopper's pincode is confirmed serviceable, it's remembered here so
// they never have to re-type it on every product page — same pincode is
// reused everywhere PincodeChecker is rendered, until they tap "Change".
const STORAGE_KEY = 'aruhi_delivery_pincode';

interface SavedLocation extends PincodeResult {
  savedAt: number;
}

function loadSavedLocation(): SavedLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocation;
    return parsed.serviceable ? parsed : null;
  } catch {
    return null;
  }
}

function saveLocation(result: PincodeResult) {
  if (typeof window === 'undefined') return;
  try {
    const toSave: SavedLocation = { ...result, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Storage unavailable (private browsing etc.) — the checker still works,
    // it just won't be remembered on the next visit.
  }
}

// Orders placed before this hour are dispatched the same day; after it,
// dispatch slips to the next day. Drives both the delivery-date estimate
// and the "Order in Xh Ym Zs" countdown below. Adjust to match your
// actual daily pickup cutoff with the courier.
const DISPATCH_CUTOFF_HOUR = 18;

function nextCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setHours(DISPATCH_CUTOFF_HOUR, 0, 0, 0);
  if (now >= cutoff) cutoff.setDate(cutoff.getDate() + 1);
  return cutoff;
}

function effectiveDispatchDate(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setHours(DISPATCH_CUTOFF_HOUR, 0, 0, 0);
  const dispatch = new Date(now);
  if (now >= cutoff) dispatch.setDate(dispatch.getDate() + 1);
  return dispatch;
}

function formatDeliveryDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
  return `${day} ${month}, ${weekday}`;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function DeliveryCountdown() {
  const [msLeft, setMsLeft] = useState(() => nextCutoff(new Date()).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setMsLeft(nextCutoff(new Date()).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="flex items-center gap-1 text-xs font-medium text-destructive">
      <Clock className="h-3 w-3" />
      Order in {formatCountdown(msLeft)}
    </span>
  );
}

export default function PincodeChecker() {
  const [saved, setSaved] = useState<SavedLocation | null>(null);
  const [editing, setEditing] = useState(false);
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<PincodeResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const existing = loadSavedLocation();
    setSaved(existing);
    setEditing(!existing);
  }, []);

  const onCheck = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!pincode.trim()) return;
      setChecking(true);
      setResult(null);
      try {
        const res = await checkPincodeServiceability(pincode);
        setResult(res);
        if (res.serviceable) {
          saveLocation(res);
          setSaved({ ...res, savedAt: Date.now() });
          setEditing(false);
        }
      } finally {
        setChecking(false);
      }
    },
    [pincode]
  );

  // Adds the zone ETA on top of the effective dispatch day for the final
  // "delivery by" promise shown to the shopper.
  const deliveryByDate = saved
    ? (() => {
        const d = effectiveDispatchDate(new Date());
        d.setDate(d.getDate() + saved.etaDays);
        return formatDeliveryDate(d);
      })()
    : null;

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4 text-secondary" />
        Delivery details
      </div>

      {!editing && saved ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3 rounded-md bg-secondary/10 p-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              <div>
                <p className="text-sm font-semibold">
                  Delivering to {saved.city ? `${saved.city}, ` : ''}
                  {saved.pincode}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setPincode('');
                setResult(null);
              }}
              className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
            >
              Change
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Delivery by {deliveryByDate}
            </p>
            <DeliveryCountdown />
          </div>
          {/* NOTE: an occasion badge (e.g. "Arriving before Rakhi") can go
              here — intentionally left out for now, add when ready. */}
        </div>
      ) : (
        <>
          {!saved && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mb-3 flex w-full items-center justify-between gap-2 rounded-md bg-secondary/10 p-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-secondary" />
                Location not set
              </span>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
                Select delivery location
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          )}

          <form onSubmit={onCheck} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter pincode"
                inputMode="numeric"
                autoFocus={!saved}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={checking || pincode.length !== 6} variant="outline">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
            </Button>
            {saved && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </form>

          {result && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-md p-3 text-sm ${
                result.serviceable
                  ? 'bg-secondary/10 text-secondary-foreground'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {result.serviceable ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <div>
                <p className="font-medium">{result.message}</p>
                {result.serviceable && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {result.codAvailable ? 'Cash on Delivery available' : 'Prepaid orders only'}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
