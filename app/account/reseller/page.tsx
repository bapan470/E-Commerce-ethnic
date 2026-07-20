'use client';

import { useEffect, useMemo, useState } from 'react';
import { Store, IndianRupee, Package, TrendingUp, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatINR } from '@/lib/format';
import { fetchProducts } from '@/lib/products-api';
import type { Product } from '@/lib/types';
import {
  fetchMyResellerOverview,
  fetchMyResellerOrders,
  joinResellerProgram,
  updateResellerMargin,
  placeResellerOrder,
  resellerSellingPrice,
  type ResellerProfile,
  type ResellerEarnings,
  type ResellerOrderRow,
} from '@/lib/reseller-api';

interface OrderLine {
  product_id: string;
  size: string;
  quantity: number;
}

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
  const [products, setProducts] = useState<Product[]>([]);
  const [joining, setJoining] = useState(false);
  const [marginInput, setMarginInput] = useState('20');
  const [savingMargin, setSavingMargin] = useState(false);

  // New order form state
  const [lines, setLines] = useState<OrderLine[]>([{ product_id: '', size: '', quantity: 1 }]);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [addr, setAddr] = useState({ address: '', address2: '', city: '', state: '', pincode: '' });
  const [placing, setPlacing] = useState(false);

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
      const prods = await fetchProducts();
      setProducts(prods);
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
      toast.success('Margin updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update margin');
    } finally {
      setSavingMargin(false);
    }
  };

  const margin = Number(marginInput) || 0;

  const preview = useMemo(() => {
    let base = 0;
    let sell = 0;
    for (const line of lines) {
      const product = products.find((p) => p.id === line.product_id);
      if (!product) continue;
      const qty = Math.max(1, line.quantity);
      base += product.price * qty;
      sell += resellerSellingPrice(product.price, margin) * qty;
    }
    return { base, sell, profit: sell - base };
  }, [lines, products, margin]);

  const addLine = () => setLines((l) => [...l, { product_id: '', size: '', quantity: 1 }]);
  const removeLine = (idx: number) => setLines((l) => l.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<OrderLine>) =>
    setLines((l) => l.map((line, i) => (i === idx ? { ...line, ...patch } : line)));

  const handlePlaceOrder = async () => {
    const validLines = lines.filter((l) => l.product_id && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('Add at least one product');
      return;
    }
    if (!custName || !custPhone) {
      toast.error("Enter your customer's name and phone");
      return;
    }
    if (!addr.address || !addr.city || !addr.state || !addr.pincode) {
      toast.error('Complete the shipping address');
      return;
    }
    setPlacing(true);
    try {
      await placeResellerOrder({
        items: validLines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, size: l.size || null })),
        margin_percent: margin,
        customer_name: custName,
        customer_phone: custPhone,
        customer_email: custEmail || undefined,
        shipping_address: addr,
      });
      toast.success('Order placed! We will ship directly to your customer.');
      setLines([{ product_id: '', size: '', quantity: 1 }]);
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setAddr({ address: '', address2: '', city: '', state: '', pincode: '' });
      const myOrders = await fetchMyResellerOrders();
      setOrders(myOrders);
      const overview = await fetchMyResellerOverview();
      setEarnings(overview.earnings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setPlacing(false);
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
            <li>Set your own profit margin on every order</li>
            <li>We ship directly to your customer — no stock to hold</li>
            <li>Track your earnings from this dashboard</li>
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
        Place orders for your customers — we ship directly to them, you keep the margin.
      </p>

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
          Added on top of our price to decide what your customer pays. e.g. ₹1000 product + 20% = ₹1200.
        </p>
        <div className="mt-2 flex max-w-xs gap-2">
          <Input type="number" min={0} value={marginInput} onChange={(e) => setMarginInput(e.target.value)} />
          <Button variant="outline" onClick={handleSaveMargin} disabled={savingMargin}>
            {savingMargin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>

      {/* New order form */}
      <div className="mt-8 rounded-lg border border-border/60 p-4">
        <h2 className="font-serif text-lg font-semibold text-primary">Place a New Order</h2>
        <p className="text-xs text-muted-foreground">For your customer — we ship directly to their address.</p>

        <div className="mt-4 space-y-3">
          {lines.map((line, idx) => {
            const product = products.find((p) => p.id === line.product_id);
            return (
              <div key={idx} className="flex flex-wrap items-end gap-2 rounded-md border border-border/40 p-3">
                <div className="min-w-[200px] flex-1">
                  <Label className="text-xs">Product</Label>
                  <Select value={line.product_id} onValueChange={(v) => updateLine(idx, { product_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatINR(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs">Size</Label>
                  <Select value={line.size} onValueChange={(v) => updateLine(idx, { size: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      {(product?.sizes ?? ['Free Size']).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                {product && (
                  <p className="pb-2 text-xs text-muted-foreground">
                    Sell at{' '}
                    <span className="font-semibold text-primary">
                      {formatINR(resellerSellingPrice(product.price, margin))}
                    </span>
                  </p>
                )}
                <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" className="gap-1" onClick={addLine}>
            <Plus className="h-4 w-4" /> Add another product
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Customer name</Label>
            <Input value={custName} onChange={(e) => setCustName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Customer phone</Label>
            <Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Customer email (optional)</Label>
            <Input value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Address</Label>
            <Input value={addr.address} onChange={(e) => setAddr((a) => ({ ...a, address: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Address line 2 (optional)</Label>
            <Input value={addr.address2} onChange={(e) => setAddr((a) => ({ ...a, address2: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">City</Label>
            <Input value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">State</Label>
            <Input value={addr.state} onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Pincode</Label>
            <Input value={addr.pincode} onChange={(e) => setAddr((a) => ({ ...a, pincode: e.target.value }))} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-secondary/30 p-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Customer pays </span>
            <span className="font-semibold text-primary">{formatINR(preview.sell)}</span>
            <span className="text-muted-foreground"> · Your profit </span>
            <span className="font-semibold text-green-600">{formatINR(preview.profit)}</span>
          </div>
          <Button className="bg-primary" onClick={handlePlaceOrder} disabled={placing}>
            {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Place Order'}
          </Button>
        </div>
      </div>

      {/* Order history */}
      <h2 className="mt-8 font-serif text-lg font-semibold text-primary">Your Orders</h2>
      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No orders placed yet.</p>
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
