'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
} from 'recharts';
import { AlertTriangle, TrendingUp, ShoppingBag, Percent, PackageX, BarChart3, Wifi, Receipt, Search, ShoppingCart, CreditCard, CheckCircle2 } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { fetchAnalytics, AnalyticsData } from '@/lib/analytics-api';
import { formatINR } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import TrafficPanel from '@/components/admin/traffic-panel';
import SearchInsightsPanel from '@/components/admin/search-insights-panel';
import { DateRangePicker, SimpleRange } from '@/components/admin/date-range-picker';

const FUNNEL_COLORS = ['#8b5e3c', '#a9744f', '#c68b5f', '#e0a374', '#f0b98a'];
const BAR_COLOR = '#c9a48a';
const ORDER_DOT_COLOR = '#8b5e3c';

// ── Tab bar ────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'traffic' | 'search';

function TabBar({
  active,
  onChange,
  right,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 w-fit">
        <TabButton value="sales" active={active} onChange={onChange} icon={<BarChart3 className="h-4 w-4" />}>
          Sales Analytics
        </TabButton>
        <TabButton value="traffic" active={active} onChange={onChange} icon={<Wifi className="h-4 w-4" />}>
          Traffic
        </TabButton>
        <TabButton value="search" active={active} onChange={onChange} icon={<Search className="h-4 w-4" />}>
          Search
        </TabButton>
      </div>
      {active === 'sales' && right}
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

// ── Sales trend + order-level chart tooltip ─────────────────────────────────

function SalesTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const dayEntry = payload.find((p: any) => p.dataKey === 'revenue');
  const orderEntries = payload.filter((p: any) => p.dataKey === 'amount');

  return (
    <div className="min-w-[200px] rounded-lg border border-border/60 bg-white/97 p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 font-serif text-sm font-bold text-primary">
        {new Date(`${label}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
      </p>
      {dayEntry && (
        <p className="mb-1.5 flex items-center justify-between text-muted-foreground">
          <span>Day revenue</span>
          <span className="font-semibold text-foreground">{formatINR(dayEntry.value as number)}</span>
        </p>
      )}
      {orderEntries.length > 0 ? (
        <div className="max-h-40 space-y-1 overflow-y-auto border-t border-border/50 pt-1.5 pr-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Orders ({orderEntries.length})
          </p>
          {orderEntries.map((entry: any, i: number) => {
            const o = entry.payload;
            return (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {new Date(o.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-medium">{formatINR(o.amount)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="border-t border-border/50 pt-1.5 text-muted-foreground">No orders this day.</p>
      )}
    </div>
  );
}

// ── Sales panel (existing analytics) ─────────────────────────────────────

// Token like '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '90d' -- one value
// that drives the Product Performance window dropdown, mapped below to
// either the `hours` or `days` param fetchAnalytics expects.
type PerfWindow = `${number}h` | `${number}d`;

function perfWindowToParams(w: PerfWindow): { productPerformanceHours?: number; productPerformanceDays?: number } {
  if (w.endsWith('h')) return { productPerformanceHours: Number(w.slice(0, -1)) };
  return { productPerformanceDays: Number(w.slice(0, -1)) };
}

const PERF_WINDOW_OPTIONS: { value: PerfWindow; label: string; group: 'hour' | 'day' }[] = [
  { value: '1h', label: 'Last 1 hour', group: 'hour' },
  { value: '6h', label: 'Last 6 hours', group: 'hour' },
  { value: '12h', label: 'Last 12 hours', group: 'hour' },
  { value: '24h', label: 'Last 24 hours', group: 'hour' },
  { value: '7d', label: 'Last 7 days', group: 'day' },
  { value: '30d', label: 'Last 30 days', group: 'day' },
  { value: '90d', label: 'Last 90 days', group: 'day' },
];

const PERF_PAGE_SIZE = 8;

function SalesPanel({ range, onRangeChange }: { range: SimpleRange; onRangeChange: (r: SimpleRange) => void }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfWindow, setPerfWindow] = useState<PerfWindow>('30d');
  const [perfSearch, setPerfSearch] = useState('');
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfVisibleCount, setPerfVisibleCount] = useState(PERF_PAGE_SIZE);

  // Refetch the whole dashboard whenever the top-right date range changes.
  useEffect(() => {
    setLoading(true);
    fetchAnalytics({
      from: format(range.from, 'yyyy-MM-dd'),
      to: format(range.to, 'yyyy-MM-dd'),
      ...perfWindowToParams(perfWindow),
    })
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Only re-fetches when the Product Performance window changes (not on
  // every keystroke of the search box) -- and only swaps in the new
  // productPerformance slice so the rest of the dashboard doesn't flicker.
  useEffect(() => {
    if (!data) return; // wait for the initial full load above
    setPerfLoading(true);
    setPerfVisibleCount(PERF_PAGE_SIZE);
    fetchAnalytics({
      from: format(range.from, 'yyyy-MM-dd'),
      to: format(range.to, 'yyyy-MM-dd'),
      ...perfWindowToParams(perfWindow),
    })
      .then((res) =>
        setData((prev) =>
          prev
            ? {
                ...prev,
                productPerformance: res.productPerformance,
                productPerformanceDays: res.productPerformanceDays,
                productPerformanceHours: res.productPerformanceHours,
              }
            : res
        )
      )
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load product performance'))
      .finally(() => setPerfLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfWindow]);

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Could not load analytics right now.</p>;
  }

  const { summary, salesTrend, orders, topProducts, funnel, lowStock, productPerformance, range: dataRange } = data;

  // Pull the three requested funnel stages out by name so the summary cards
  // stay correct even if the stage order in the API response ever changes.
  const addToCartSessions = funnel.find((f) => f.stage === 'Added to cart')?.sessions ?? 0;
  const checkoutSessions = funnel.find((f) => f.stage === 'Started checkout')?.sessions ?? 0;
  const purchaseSessions = funnel.find((f) => f.stage === 'Purchased')?.sessions ?? 0;

  // Bars: one per day in the selected range, showing that day's total revenue.
  const dayData = salesTrend.map((d) => ({ date: d.date, revenue: d.revenue }));
  // Dots: one per order, positioned on the same day-bucket, at its exact price —
  // hovering a dot (or its day) surfaces the exact order time & price.
  const orderScatterData = orders.map((o) => ({
    date: o.time.slice(0, 10),
    amount: o.amount,
    time: o.time,
    status: o.status,
  }));

  const rangeLabel =
    dataRange.days === 1
      ? new Date(`${dataRange.from}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' })
      : `${dataRange.days} days`;

  return (
    <div className="grid gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Revenue"
          sublabel={rangeLabel}
          value={formatINR(summary.totalRevenue)}
        />
        <SummaryCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Orders"
          sublabel={rangeLabel}
          value={String(summary.orderCount)}
        />
        <SummaryCard
          icon={<Receipt className="h-4 w-4" />}
          label="Avg. order value"
          sublabel={rangeLabel}
          value={formatINR(summary.avgOrderValue)}
        />
        <SummaryCard
          icon={<Percent className="h-4 w-4" />}
          label="Conversion rate"
          sublabel={rangeLabel}
          value={`${summary.conversionRate}%`}
        />
        <SummaryCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Add to cart"
          sublabel={rangeLabel}
          value={String(addToCartSessions)}
        />
        <SummaryCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Begin checkout"
          sublabel={rangeLabel}
          value={String(checkoutSessions)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Purchase"
          sublabel={rangeLabel}
          value={String(purchaseSessions)}
        />
        <SummaryCard
          icon={<PackageX className="h-4 w-4" />}
          label="Low stock"
          value={String(summary.lowStockCount)}
          tone={summary.lowStockCount > 0 ? 'warn' : undefined}
        />
      </div>

      {/* Sales trend + exact order time & price */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg font-bold text-primary">Sales Trend & Orders — {rangeLabel}</h3>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAR_COLOR }} />
            Daily revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
              style={{ backgroundColor: ORDER_DOT_COLOR }}
            />
            Individual order — exact time &amp; price (hover to see)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              type="category"
              allowDuplicatedCategory={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatINR(v)} />
            <Tooltip content={<SalesTooltip />} />
            <Bar dataKey="revenue" data={dayData as any} fill={BAR_COLOR} radius={[3, 3, 0, 0]} barSize={18} />
            <Scatter dataKey="amount" data={orderScatterData as any} fill={ORDER_DOT_COLOR} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
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
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-serif text-lg font-bold text-primary">Conversion Funnel — {rangeLabel}</h3>
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

      {/* Product performance: Impressions vs Conversion */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg font-bold text-primary">Product Performance</h3>
          <div className="flex items-center gap-2">
            <select
              value={perfWindow}
              onChange={(e) => setPerfWindow(e.target.value as PerfWindow)}
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
            >
              <optgroup label="By hour">
                {PERF_WINDOW_OPTIONS.filter((o) => o.group === 'hour').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="By day">
                {PERF_WINDOW_OPTIONS.filter((o) => o.group === 'day').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <input
              type="text"
              value={perfSearch}
              onChange={(e) => {
                setPerfSearch(e.target.value);
                setPerfVisibleCount(PERF_PAGE_SIZE);
              }}
              placeholder="Search product..."
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
            />
          </div>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Impressions = product page views. Add to cart / Begin checkout / Purchase = how many sessions/orders
          reached that step with this product. Conversion = % of impressions that led to a purchase.
        </p>
        {(() => {
          const filtered = productPerformance.filter((p) =>
            p.name.toLowerCase().includes(perfSearch.trim().toLowerCase())
          );
          if (perfLoading) {
            return <Skeleton className="h-40 rounded-lg" />;
          }
          if (productPerformance.length === 0) {
            return (
              <p className="text-sm text-muted-foreground">
                No product activity recorded in this period yet.
              </p>
            );
          }
          if (filtered.length === 0) {
            return <p className="text-sm text-muted-foreground">No product matches "{perfSearch}".</p>;
          }
          const visible = filtered.slice(0, perfVisibleCount);
          const hasMore = filtered.length > visible.length;
          return (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Product</th>
                      <th className="pb-2 pr-3 font-medium">Impressions</th>
                      <th className="pb-2 pr-3 font-medium">Add to cart</th>
                      <th className="pb-2 pr-3 font-medium">Begin checkout</th>
                      <th className="pb-2 pr-3 font-medium">Purchase</th>
                      <th className="pb-2 font-medium">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {visible.map((p) => (
                      <tr key={p.productId}>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            {p.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image} alt={p.name} className="h-8 w-8 rounded-md object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-muted" />
                            )}
                            <span className="max-w-[220px] truncate font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-emerald-600">{p.impressions}</td>
                        <td className="py-2 pr-3 text-amber-600">{p.addToCart}</td>
                        <td className="py-2 pr-3 text-sky-600">{p.beginCheckout}</td>
                        <td className="py-2 pr-3 text-violet-600">{p.purchases}</td>
                        <td
                          className={`py-2 font-medium ${
                            p.conversionRate > 0 ? 'text-emerald-600' : 'text-destructive'
                          }`}
                        >
                          {p.conversionRate.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <div className="mt-3 flex justify-center">
                  <button
                    onClick={() => setPerfVisibleCount((c) => c + PERF_PAGE_SIZE)}
                    className="rounded-md border border-border/60 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Show more ({filtered.length - visible.length} more)
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Low stock alerts */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
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
  sublabel,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  value: string;
  tone?: 'warn';
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-border/60 bg-card'
      }`}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {sublabel && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{sublabel}</span>}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function AnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [range, setRange] = useState<SimpleRange>(() => ({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  }));

  return (
    <div>
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        right={<DateRangePicker value={range} onChange={setRange} />}
      />
      {activeTab === 'sales' ? (
        <SalesPanel range={range} onRangeChange={setRange} />
      ) : activeTab === 'traffic' ? (
        <TrafficPanel />
      ) : (
        <SearchInsightsPanel />
      )}
    </div>
  );
}
