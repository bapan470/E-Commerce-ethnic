'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Truck,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Landmark,
  Loader2,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fetchAdminVendors,
  updateAdminVendorStatus,
  reviewAdminVendorBankUpdate,
  closeVendorAccount,
  type AdminVendorRow,
} from '@/lib/vendor-api';

const STATUS_META: Record<
  AdminVendorRow['status'],
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-700' },
  suspended: { label: 'Suspended', icon: Ban, className: 'bg-red-100 text-red-700' },
};

const TABS: { value: AdminVendorRow['status'] | 'bank_requests'; label: string }[] = [
  { value: 'pending', label: 'Pending Applications' },
  { value: 'approved', label: 'Approved' },
  { value: 'bank_requests', label: 'Bank Update Requests' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

export default function VendorsPanel() {
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['value']>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [closeAccountTarget, setCloseAccountTarget] = useState<AdminVendorRow | null>(null);
  const [closing, setClosing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchAdminVendors();
      setVendors(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const bankRequestVendors = useMemo(() => vendors.filter((v) => v.pending_bank_update), [vendors]);
  const listForTab = activeTab === 'bank_requests' ? bankRequestVendors : vendors.filter((v) => v.status === activeTab);

  const handleStatusChange = async (
    v: AdminVendorRow,
    status: 'approved' | 'rejected' | 'suspended' | 'pending'
  ) => {
    setBusyId(v.id);
    try {
      const note = noteDraft[v.id];
      await updateAdminVendorStatus(v.id, status, note);
      toast.success(`Vendor ${status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update vendor');
    } finally {
      setBusyId(null);
    }
  };

  const handleBankReview = async (v: AdminVendorRow, action: 'approve' | 'reject') => {
    setBusyId(v.id);
    try {
      await reviewAdminVendorBankUpdate(v.id, action);
      toast.success(action === 'approve' ? 'Bank details updated' : 'Request rejected');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to review request');
    } finally {
      setBusyId(null);
    }
  };

  // Phase 4C, point 5 — full off-boarding: return stock immediately
  // (skips the 90/60-day timers), finalize any pending settlement, then
  // suspend. Distinct from the plain "Suspend" button below, which only
  // flips status and leaves stock/settlement untouched.
  const handleCloseAccount = async () => {
    if (!closeAccountTarget) return;
    setClosing(true);
    try {
      const result = await closeVendorAccount(closeAccountTarget.id);
      toast.success(
        `Vendor account closed. ${result.products_flagged} product(s) sent to Return to Vendor` +
          (result.final_settlement_amount != null
            ? `, final settlement ₹${result.final_settlement_amount} created.`
            : '.')
      );
      setCloseAccountTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close vendor account');
    } finally {
      setClosing(false);
    }
  };

  const counts = useMemo(
    () => ({
      pending: vendors.filter((v) => v.status === 'pending').length,
      approved: vendors.filter((v) => v.status === 'approved').length,
      rejected: vendors.filter((v) => v.status === 'rejected').length,
      suspended: vendors.filter((v) => v.status === 'suspended').length,
      bank_requests: bankRequestVendors.length,
    }),
    [vendors, bankRequestVendors]
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Admin</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal sourcing vendors — never shown on the customer-facing site.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label} ({counts[tab.value]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      ) : listForTab.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card py-10 text-center text-sm text-muted-foreground">
          <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          Nothing here.
        </div>
      ) : (
        <div className="space-y-3">
          {listForTab.map((v) => {
            const meta = STATUS_META[v.status];
            const StatusIcon = meta.icon;
            return (
              <div key={v.id} className="rounded-lg border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-serif text-lg font-semibold text-primary">{v.business_name}</p>
                      <Badge className={`flex w-fit items-center gap-1 ${meta.className}`}>
                        <StatusIcon className="h-3 w-3" /> {meta.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {v.owner_name} · {v.phone} {v.whatsapp ? `· WA: ${v.whatsapp}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">{v.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PAN: {v.pan_number} {v.gst_number ? `· GST: ${v.gst_number}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Pickup: {v.pickup_address}</p>
                    {v.expected_category && (
                      <p className="mt-1 text-xs text-muted-foreground">Category: {v.expected_category}</p>
                    )}
                  </div>
                </div>

                {activeTab === 'bank_requests' && v.pending_bank_update ? (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-medium text-amber-800">
                      <Landmark className="h-4 w-4" /> Requested bank details
                    </p>
                    <p className="mt-1 font-mono text-amber-900">
                      A/C: {v.pending_bank_update.bank_account_number} · IFSC: {v.pending_bank_update.bank_ifsc}
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Requested {new Date(v.pending_bank_update.requested_at).toLocaleString('en-IN')}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="bg-primary"
                        disabled={busyId === v.id}
                        onClick={() => handleBankReview(v, 'approve')}
                      >
                        Verify &amp; Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === v.id}
                        onClick={() => handleBankReview(v, 'reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'pending' && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      placeholder="Optional note (shown to vendor, e.g. rejection reason)"
                      className="w-full rounded-md border border-border/60 p-2 text-sm"
                      rows={2}
                      value={noteDraft[v.id] || ''}
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [v.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-primary"
                        disabled={busyId === v.id}
                        onClick={() => handleStatusChange(v, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === v.id}
                        onClick={() => handleStatusChange(v, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'approved' && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === v.id}
                      onClick={() => handleStatusChange(v, 'suspended')}
                    >
                      Suspend
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === v.id}
                      onClick={() => setCloseAccountTarget(v)}
                    >
                      <UserX className="mr-1 h-4 w-4" /> Close Vendor Account
                    </Button>
                  </div>
                )}

                {activeTab === 'suspended' && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      className="bg-primary"
                      disabled={busyId === v.id}
                      onClick={() => handleStatusChange(v, 'approved')}
                    >
                      Reinstate
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!closeAccountTarget} onOpenChange={(open) => !open && setCloseAccountTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {closeAccountTarget?.business_name}'s vendor account?</AlertDialogTitle>
            <AlertDialogDescription>
              This is irreversible from here. It will immediately: send every awaiting-stock/live
              product to the Return to Vendor list (skipping the 90/60-day timers), finalize any
              pending settlement as a Final Settlement, and suspend the vendor's dashboard access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={closing} onClick={handleCloseAccount}>
              {closing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Yes, close account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
