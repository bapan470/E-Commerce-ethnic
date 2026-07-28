# Analytics upgrade — order time + price chart, calendar date filter

These 4 files replace the same-named files in `bapan470/E-Commerce-ethnic`.
Everything type-checks clean (`npx tsc --noEmit` → 0 errors) against the
project's existing dependencies — no new packages needed, since
`react-day-picker`, `date-fns`, and the shadcn `Calendar`/`Popover` were
already in the repo.

## What changed

1. **`app/api/admin/analytics/route.ts`**
   Accepts `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Defaults to the last 30 days
   when absent (so nothing else that calls this route breaks). The response
   now also includes:
   - `range: { from, to, days }`
   - `orders: [{ id, time, amount, status }, ...]` — every order in the
     selected range with its **exact** timestamp and price.
   All summary numbers (revenue, order count, avg order value, funnel) are
   now computed over the selected range instead of a hardcoded 30 days.

2. **`lib/analytics-api.ts`**
   Updated types (`OrderPoint`, `AnalyticsRange`) and `fetchAnalytics(options)`
   now takes `{ from, to, productPerformanceDays }` instead of a single
   `days` number.

3. **`components/admin/date-range-picker.tsx`** (new)
   A calendar-style date-range filter: click → pick a preset (Today, Last 7
   / 30 / 90 days, This month, Last month) or drag a range on a two-month
   calendar → Apply. Built entirely from the shadcn `Calendar`/`Popover`
   components already in your `components/ui` folder.

4. **`components/admin/analytics-panel.tsx`**
   - The date-range picker sits top-right, next to the Sales Analytics /
     Traffic tabs.
   - The first chart ("Sales Trend & Orders") is now a combo chart: bars
     show daily revenue, and a dot is plotted for every individual order.
     Hovering any point (bar or dot) shows a tooltip with that day's total
     **and** a scrollable list of every order's exact time and price.
   - Summary cards now show the range length (e.g. "7 days") instead of a
     fixed "(30d)" label, and update live as you change the filter.
   - Cards/panels got a slightly more polished look (rounded-xl, soft
     shadows) to read as a more "professional" dashboard.

## How to apply

From your repo root:

```bash
# copy these 4 files over the matching paths in your project, then:
npm install   # no new deps required, just in case
npm run dev   # or your usual build/deploy command
```

No database migration is needed — `orders.created_at` and
`orders.total_amount` (already selected by the route) are what power the
exact time/price chart.
