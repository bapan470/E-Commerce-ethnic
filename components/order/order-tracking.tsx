'use client';

import { useEffect, useState } from 'react';
import { Truck, PackageCheck, Loader2, RefreshCw, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrackingScan {
  status: string;
  location?: string;
  dateTime?: string;
  instructions?: string;
}

interface TrackingResponse {
  tracked: boolean;
  waybill?: string;
  courier?: string;
  currentStatus?: string;
  currentLocation?: string;
  expectedDeliveryDate?: string;
  scans?: TrackingScan[];
  error?: string;
  orderStatus?: string;
}

export default function OrderTracking({
  orderId,
  initialTrackingNumber,
  initialCourierName,
}: {
  orderId: string;
  initialTrackingNumber?: string | null;
  initialCourierName?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [fetched, setFetched] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/tracking`, { cache: 'no-store' });
      const body = await res.json();
      setData(body);
    } catch {
      setData({ tracked: false, error: 'Could not load tracking info' });
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  useEffect(() => {
    if (initialTrackingNumber) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrackingNumber]);

  if (!initialTrackingNumber) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Your order hasn't been dispatched yet. Tracking details will appear here once it ships.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">Courier: {initialCourierName || 'Delhivery'}</p>
          <p className="text-xs text-muted-foreground">Tracking #: {initialTrackingNumber}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={load}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {!fetched && loading && (
        <p className="mt-3 text-sm text-muted-foreground">Fetching live status…</p>
      )}

      {fetched && data && !data.tracked && (
        <p className="mt-3 text-sm text-muted-foreground">
          {data.error || 'Live tracking will appear here once the courier scans your package.'}
        </p>
      )}

      {fetched && data?.tracked && (
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-md bg-secondary/10 px-3 py-2 text-sm font-medium text-secondary-foreground">
            <PackageCheck className="h-4 w-4 shrink-0" />
            {data.currentStatus || 'In transit'}
            {data.currentLocation ? (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <MapPin className="h-3 w-3" /> {data.currentLocation}
              </span>
            ) : null}
          </div>
          {data.expectedDeliveryDate && (
            <p className="mt-2 text-xs text-muted-foreground">
              Expected delivery: {data.expectedDeliveryDate}
            </p>
          )}

          {data.scans && data.scans.length > 0 && (
            <ol className="mt-4 flex flex-col gap-3 border-l border-border/60 pl-4">
              {data.scans.map((scan, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-secondary" />
                  <p className="font-medium">{scan.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {[scan.location, scan.dateTime].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
