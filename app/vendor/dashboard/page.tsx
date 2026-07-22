'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Clock, XCircle, Ban, Landmark, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchMyVendorProfile,
  requestVendorBankUpdate,
  type VendorProfile,
} from '@/lib/vendor-api';

function maskAccount(account: string | null) {
  if (!account) return '—';
  if (account.length <= 4) return account;
  return `${'•'.repeat(account.length - 4)}${account.slice(-4)}`;
}

export default function VendorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [accountInput, setAccountInput] = useState('');
  const [ifscInput, setIfscInput] = useState('');
  const [upiInput, setUpiInput] = useState('');
  const [requesting, setRequesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = await fetchMyVendorProfile();
      setProfile(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load vendor profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRequestBankUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountInput || !ifscInput) {
      toast.error('Enter both account number and IFSC');
      return;
    }
    setRequesting(true);
    try {
      await requestVendorBankUpdate(accountInput, ifscInput, upiInput || undefined);
      toast.success('Request sent — an admin will verify and approve it shortly.');
      setAccountInput('');
      setIfscInput('');
      setUpiInput('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request bank detail update');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-bold text-primary">No Application Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You haven't applied to sell with us yet.
        </p>
        <Link href="/sell-with-us">
          <Button className="mt-4 bg-primary">Apply Now</Button>
        </Link>
      </div>
    );
  }

  if (profile.status !== 'approved') {
    const meta = {
      pending: { icon: Clock, label: 'Application Under Review', color: 'text-amber-600' },
      rejected: { icon: XCircle, label: 'Application Not Approved', color: 'text-red-600' },
      suspended: { icon: Ban, label: 'Account Suspended', color: 'text-red-600' },
    }[profile.status];
    const Icon = meta.icon;
    return (
      <div>
        <h1 className={`flex items-center gap-2 font-serif text-2xl font-bold ${meta.color}`}>
          <Icon className="h-6 w-6" /> {meta.label}
        </h1>
        {profile.admin_note && (
          <p className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            {profile.admin_note}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-primary">Vendor Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome, {profile.business_name}.</p>

      <div className="mt-6 rounded-lg border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <p className="font-serif text-lg font-semibold text-primary">Bank Details</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Current account on file: <span className="font-mono">{maskAccount(profile.bank_account_number)}</span>
          {profile.bank_ifsc ? ` · ${profile.bank_ifsc}` : ''}
          {profile.upi_id ? ` · UPI: ${profile.upi_id}` : ''}
        </p>

        {profile.pending_bank_update ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              A bank detail change request is pending admin approval — for your security, this
              doesn't take effect until manually verified.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRequestBankUpdate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>New Account Number</Label>
              <Input value={accountInput} onChange={(e) => setAccountInput(e.target.value)} />
            </div>
            <div>
              <Label>New IFSC</Label>
              <Input value={ifscInput} onChange={(e) => setIfscInput(e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>UPI ID (optional)</Label>
              <Input placeholder="yourname@bank" value={upiInput} onChange={(e) => setUpiInput(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" disabled={requesting}>
                {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request Bank Detail Change'}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                For fraud prevention, changes are held for manual admin verification before they
                apply — this can take a little time. This same verification covers UPI ID changes
                too, there's no separate process for it.
              </p>
            </div>
          </form>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="font-serif text-lg font-semibold text-primary">KYC Documents</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your PAN card, GST certificate (if applicable), and bank proof for compliance records.
        </p>
        <Link href="/vendor/dashboard/kyc">
          <Button variant="outline" className="mt-3">
            Go to KYC Documents
          </Button>
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Product listing, order fulfillment, and earnings will appear here in future updates.
      </p>
    </div>
  );
}
