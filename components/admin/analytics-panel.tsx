'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
} from 'recharts';
import { AlertTriangle, TrendingUp, ShoppingBag, Percent, PackageX } from 'lucide-react';
import { fetchAnalytics, AnalyticsData } from '@/lib/analytics-api';
import { formatINR } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const FUNNEL_COLORS = ['#8b5e3c', '#a9744f', '#c68b5f', '#e0a374', '#f0b98a'];

export default function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Could not load analytics right now.</p>;
  }

  const { summary, salesTrend, topProducts, funnel, lowStock } = data;

  return (
    <div className="grid gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Revenue (30d)"
          value={formatINR(summary.totalRevenue30d)}
        />
        <SummaryCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Orders (30d)"
          value={String(summary.orderCount30d)}
        />
        <SummaryCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Avg. order value"
          value={formatINR(summary.avgOrderValue30d)}
        />
        <SummaryCard
          icon={<Percent className="h-4 w-4" />}
          label="Conversion rate"
          value={`${summary.conversionRate}%`}
        />
        <SummaryCard
          icon={<PackageX className="h-4 w-4" />}
          label="Low stock"
          value={String(summary.lowStockCount)}
          tone={summary.lowStockCount > 0 ? 'warn' : undefined}
        />
      </div>

      {/* Sales trend */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <h3 className="mb-3 font-serif text-lg font-bold text-primary">Sales Trend — last 30 days</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={salesTrend} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatINR(v)} />
            <Tooltip
              labelFormatter={(d) => new Date(d as string).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              formatter={(value: number, name: string) =>
                name === 'revenue' ? [formatINR(value), 'Revenue'] : [value, 'Orders']
              }
            />
            <Line type="monotone" dataKey="revenue" stroke="#8b5e3c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h3 className="mb-3 font-serif text-lg font-bold text-primary">Top Products</h3>
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topProducts.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v)} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={110}
                    tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)}
                  />
                  <Tooltip formatter={(value: number) => [formatINR(value), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#8b5e3c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <ul className="mt-3 divide-y divide-border/50 text-sm">
                {topProducts.map((p, i) => (
                  <li key={p.productId ?? p.name} className="flex items-center gap-3 py-2">
                    <span className="w-5 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-muted" />
                    )}
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.unitsSold} sold</span>
                    <span className="font-medium">{formatINR(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Conversion funnel */}
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h3 className="mb-3 font-serif text-lg font-bold text-primary">Conversion Funnel (30d)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <FunnelChart>
              <Tooltip formatter={(value: number) => [`${value} sessions`, '']} />
              <Funnel data={funnel} dataKey="sessions" nameKey="stage" isAnimationActive>
                <LabelList position="right" dataKey="stage" fill="#3a2a1c" stroke="none" fontSize={12} />
                {funnel.map((_, i) => (
                  <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5">
            {funnel.map((f) => (
              <li key={f.stage} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
                <div className="font-semibold text-foreground">{f.sessions}</div>
                {f.stage}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Low stock alerts */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-primary">
          <AlertTriangle className="h-5 w-5 text-amber-600" /> Low Stock Alerts
        </h3>
        {lowStock.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Everything is well stocked — no alerts right now.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-muted" />
                )}
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    p.stock_quantity === 0
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} left`}
                </span>
                <span className="text-xs text-muted-foreground">Threshold: {p.low_stock_threshold}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'warn';
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-border/60 bg-card'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
