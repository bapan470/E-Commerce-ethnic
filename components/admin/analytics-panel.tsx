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
import { AlertTriangle, TrendingUp, ShoppingBag, Percent, PackageX, BarChart3, Wifi } from 'lucide-react';
import { fetchAnalytics, AnalyticsData } from '@/lib/analytics-api';
import { formatINR } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import TrafficPanel from '@/components/admin/traffic-panel';

const FUNNEL_COLORS = ['#8b5e3c', '#a9744f', '#c68b5f', '#e0a374', '#f0b98a'];

// ── Tab bar ────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'traffic';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="mb-6 flex gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 w-fit">
      <TabButton value="sales" active={active} onChange={onChange} icon={<BarChart3 className="h-4 w-4" />}>
        Sales Analytics
      </TabButton>
      <TabButton value="traffic" active={active} onChange={onChange} icon={<Wifi className="h-4 w-4" />}>
        Traffic
      </TabButton>
    </div>
  );
}

function TabButton({
  value,
  active,
  onChange,
  icon,
  children,
}: {
  value: Tab;
  active: Tab;
  onChange: (t: Tab) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isActive = active === value;
  return (
    <button
      onClick={() => onChange(value)}
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-white text-primary shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Sales panel (existing analytics) ─────────────────────────────────────

function SalesPanel() {
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
          <h3 className="mb-3 font-serif text-lg font-bold text-primary">Top Products — by revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topProducts.slice(0, 8)}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v)} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={100}
                tickFormatter={(n: string) => (n.length > 14 ? n.slice(0, 13) + '…' : n)}
              />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="revenue" fill="#8b5e3c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion funnel */}
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h3 className="mb-3 font-serif text-lg font-bold text-primary">Conversion Funnel — last 30 days</h3>
          <ResponsiveContainer width="100%" height={280}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="sessions" data={funnel} isAnimationActive>
                <LabelList position="right" fill="#555" stroke="none" dataKey="stage" />
                {funnel.map((_, i) => (
                  <Cell key={i} fill={FUNNEL_COLORS[i] ?? '#ccc'} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Low stock alerts */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="font-serif text-lg font-bold text-primary">
            Low Stock Alerts{' '}
            {lowStock.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">
                {lowStock.length}
              </span>
            )}
          </h3>
        </div>
        {lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">All products are well-stocked.</p>
        ) : (
          <ul className="divide-y divide-border/40">
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

// ── Main export ────────────────────────────────────────────────────────────

export default function AnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');

  return (
    <div>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'sales' ? <SalesPanel /> : <TrafficPanel />}
    </div>
  );
}
