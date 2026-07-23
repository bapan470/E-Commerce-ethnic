'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Boxes, PackagePlus, Barcode as BarcodeIcon, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  fetchMyVendorProducts,
  type VendorProductRow,
  type VendorProductApprovalStatus,
} from '@/lib/vendor-api';
import VendorVariantsManager from '@/components/vendor/vendor-variants-manager';

const PRODUCT_STATUS_META: Record<VendorProductApprovalStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  pending_review: {
    label: '⏳ Processing…',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  awaiting_stock: { label: 'Awaiting Stock Pickup', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  live: { label: 'Live on Site', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
};

/** Statuses where the vendor can edit the product */
const EDITABLE_STATUSES: VendorProductApprovalStatus[] = ['live', 'rejected', 'draft'];

// Poll interval (ms) while any product is still processing
const POLL_INTERVAL = 12_000;

export default function VendorProductsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<VendorProductRow[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    fetchMyVendorProducts()
      .then((rows) => {
        setProducts(rows);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load your products');
        setLoading(false);
      });
  };

  // Auto-refresh while any product is still in 'pending_review' (being processed).
  // Stops the interval once all products have settled.
  useEffect(() => {
    const hasPending = products.some((p) => p.approval_status === 'pending_review');
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(load, POLL_INTERVAL);
    }
    if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-2xl font-bold text-primary">Products</h1>
        </div>
        <Link href="/vendor/dashboard/products/add-product">
          <Button className="bg-primary">
            <PackagePlus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything you&apos;ve listed, in one place. You&apos;ll get an email when each product goes live.
      </p>

      <div className="mt-6 rounded-lg border border-border/60 bg-card p-5">
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing added yet.</p>
            <Link href="/vendor/dashboard/products/add-product">
              <Button className="mt-4 bg-primary">
                <PackagePlus className="mr-2 h-4 w-4" />
                Add your first product
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const meta = PRODUCT_STATUS_META[p.approval_status];
              const canEdit = EDITABLE_STATUSES.includes(p.approval_status);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    {p.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt=""
                        className="h-12 w-12 rounded-md border border-border/60 object-cover"
                      />
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
                      {p.approval_status === 'rejected' && p.rejection_reason && (
                        <p className="mt-0.5 text-xs text-red-600">Reason: {p.rejection_reason}</p>
                      )}
                      {p.approval_status === 'pending_review' && (
                        <p className="mt-0.5 text-xs text-amber-600">
                          Your listing is being prepared. You&apos;ll receive an email when it goes live.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                    {(p.final_price ?? p.ai_suggested_price) != null && (
                      <p className="text-xs text-muted-foreground">
                        ₹{p.final_price ?? p.ai_suggested_price}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {canEdit && (
                        <Link href={`/vendor/dashboard/products/edit-product/${p.id}`}>
                          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        </Link>
                      )}
                      {p.approval_status === 'live' && (
                        <VendorVariantsManager productId={p.id} productName={p.name} />
                      )}
                    </div>
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
