'use client';

import { useEffect, useState } from 'react';
import { Store, IndianRupee, Package, TrendingUp, Loader2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatINR } from '@/lib/format';
import {
  fetchMyResellerOverview,
  fetchMyResellerOrders,
  joinResellerProgram,
  updateResellerMargin,
  type ResellerProfile,
  type ResellerEarnings,
  type ResellerOrderRow,
} from '@/lib/reseller-api';

export default function ResellerPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [earnings, setEarnings] = useState<ResellerEarnings>({
    totalOrders: 0,
    totalSales: 0,
    totalProfit: 0,
    pendingOrders: 0,
  });
  const [orders, setOrders] = useState<ResellerOrderRow[]>([]);
  const [joining, setJoining] = useState(false);
  const [marginInput, setMarginInput] = useState('20');
  const [savingMargin, setSavingMargin] = useState(false);

  const load = async () => {
    try {
      const overview = await fetchMyResellerOverview();
      setProfile(overview.profile);
      setEarnings(overview.earnings);
      if (overview.profile) {
        setMarginInput(String(overview.profile.default_margin_percent));
        const myOrders = await fetchMyResellerOrders();
        setOrders(myOrders);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reseller data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const p = await joinResellerProgram(20);
      setProfile(p);
      setMarginInput(String(p.default_margin_percent));
      toast.success('Welcome! You are now a reseller.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const handleSaveMargin = async () => {
    const val = Number(marginInput);
    if (!Number.isFinite(val) || val < 0) {
      toast.error('Enter a valid margin %');
      return;
    }
    setSavingMargin(true);
    try {
      await updateResellerMargin(val);
      setProfile((p) => (p ? { ...p, default_margin_percent: val } : p));
      toast.success('Default margin updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update margin');
    } finally {
      setSavingMargin(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!profile) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-bold text-primary">Become a Reseller</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this same account to resell our products — set your own margin, place orders for your
          customers, and we handle packing &amp; shipping directly to them.
        </p>
        <div className="mt-6 rounded-lg border border-border/60 bg-gradient-to-br from-primary/5 to-secondary/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-serif text-lg font-semibold text-primary">No new signup needed</p>
              <p className="text-sm text-muted-foreground">Your existing login is your reseller login too.</p>
            </div>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Tick "Resell this product" at checkout on any order</li>
            <li>Set your own profit margin right there, see it in green</li>
            <li>We ship directly to your customer — no stock to hold</li>
            <li>Track every resale order and your earnings from this dashboard</li>
          </ul>
          <Button className="mt-5 bg-primary" onClick={handleJoin} disabled={joining}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Become a Reseller'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-primary">Reseller Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tick "Resell this product" at checkout to place an order for your own customer — we ship
        directly to them, you keep the margin.
      </p>

      <Link href="/shop">
        <Button className="mt-4 gap-2 bg-primary">
          <ShoppingBag className="h-4 w-4" /> Browse products to resell
        </Button>
      </Link>

      {/* Earnings summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/60 p-4">
          <Package className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xl font-bold text-primary">{earnings.totalOrders}</p>
          <p className="text-xs text-muted-foreground">Total Orders</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <IndianRupee className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xl font-bold text-primary">{formatINR(earnings.totalSales)}</p>
          <p className="text-xs text-muted-foreground">Total Sales</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xl font-bold text-green-600">{formatINR(earnings.totalProfit)}</p>
          <p className="text-xs text-muted-foreground">Your Earnings</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <Package className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xl font-bold text-primary">{earnings.pendingOrders}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </div>
      </div>

      {/* Margin setting */}
      <div className="mt-6 rounded-lg border border-border/60 p-4">
        <Label className="text-sm font-medium">Your default margin (%)</Label>
        <p className="text-xs text-muted-foreground">
          Pre-filled at checkout whenever you tick "Resell this product" — you can still change it
          per order. e.g. ₹1000 product + 20% = ₹1200.
        </p>
        <div className="mt-2 flex max-w-xs gap-2">
          <Input type="number" min={0} value={marginInput} onChange={(e) => setMarginInput(e.target.value)} />
          <Button variant="outline" onClick={handleSaveMargin} disabled={savingMargin}>
            {savingMargin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>

      {/* Order history */}
      <h2 className="mt-8 font-serif text-lg font-semibold text-primary">Your Resale Orders</h2>
      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No resale orders yet — tick "Resell this product" next time you check out.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 p-3 text-sm">
              <div>
                <p className="font-medium text-primary">{o.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString('en-IN')} · {o.items?.length ?? 0} item(s)
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatINR(o.total_amount)}</p>
                <p className="text-xs text-green-600">+{formatINR(o.reseller_profit)} profit</p>
              </div>
              <span className="rounded-full bg-secondary px-2 py-1 text-xs capitalize">{o.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
