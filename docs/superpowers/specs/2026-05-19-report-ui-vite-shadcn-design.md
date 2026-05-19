# Report UI — Vite + shadcn/ui + Recharts

**Date:** 2026-05-19
**Status:** Approved
**Scope:** Replace `report.html` with a Vite + React + shadcn/ui dashboard at `report/`, served from GitHub Pages at `/report/`.

---

## 1. Goals

- Replace the CDN React `report.html` with a properly built Vite app using shadcn/ui components.
- Add a smooth dual-line revenue chart (Bình Tân vs Quận 6) above the product revenue table.
- Fix auth gap: verify signed-in email against Supabase `users` table before rendering data.
- Keep the staff PWA (`index.html`) and `sw.js` completely unchanged.

---

## 2. Stack

| Layer | Tech |
|---|---|
| Framework | Vite + React 18 |
| UI components | shadcn/ui (style: default, base color: zinc) |
| CSS | Tailwind CSS v4 via `@tailwindcss/vite` |
| Chart | Recharts (shadcn/ui standard) |
| Data | `@supabase/supabase-js` v2 — anon key, direct PostgREST reads |
| Auth | Google Identity Services (GIS) — same flow as `index.html` |
| Hosting | GitHub Pages — `report/dist/` committed to git, served at `/report/` |

---

## 3. Project Structure

```
quanlycuahang-v2/
├── index.html              (staff PWA — CDN React, no changes ever)
├── sw.js
├── manifest.json
├── report.html             (DELETE — replaced by report/ app)
├── report/                 (new Vite app)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── lib/
│   │   │   ├── supabase.js     (createClient — anon key)
│   │   │   └── utils.js        (fmt, today, daysAgo, cn)
│   │   └── components/
│   │       ├── ui/             (shadcn generated — Button, Card, Select, Table, Skeleton, Badge)
│   │       ├── Login.jsx
│   │       ├── FilterBar.jsx
│   │       ├── SummaryCards.jsx
│   │       ├── RevenueChart.jsx
│   │       ├── ProductRevenue.jsx
│   │       ├── ShiftsTable.jsx
│   │       └── CashDiscrepancy.jsx
│   ├── index.html
│   ├── vite.config.js      (base: '/quanlycuahang-v2/report/')
│   └── package.json
├── worker/
├── supabase/
└── docs/
```

---

## 4. Layout

Single-page scroll (no tabs). Sections always visible below the filter bar.

```
┌──────────────────────────────────────────────┐
│  [Date range]   [Location ▾]   [Áp dụng]    │  ← FilterBar (shadcn Card)
├──────────────────────────────────────────────┤
│  Total Sales │ Expenses │ Avg Cash Diff │ Ca │  ← SummaryCards (4× shadcn Card)
├──────────────────────────────────────────────┤
│  Revenue Chart                               │  ← RevenueChart (Recharts)
│  Smooth line: Bình Tân (solid) + Quận 6 (--) │
│  X axis: date, Y axis: revenue (đ)           │
│  Hover tooltip: date · location · amount     │
├──────────────────────────────────────────────┤
│  Revenue by Product                          │  ← ProductRevenue (shadcn Table + Progress)
├──────────────────────────────────────────────┤
│  Shifts                                      │  ← ShiftsTable (shadcn Table + Badge)
│  Total row at bottom                         │
├──────────────────────────────────────────────┤
│  Cash Discrepancy (sorted by |cash_diff| ↓)  │  ← CashDiscrepancy (shadcn Table)
│  Rows with |cash_diff| > 50,000đ in red      │
└──────────────────────────────────────────────┘
```

---

## 5. Component Mapping

| UI Element | shadcn/ui Component | Notes |
|---|---|---|
| Date inputs | Plain `<input type="date">` inside shadcn `Card` | No date picker library needed |
| Location dropdown | `Select` | Options from Supabase `locations` |
| Apply button | `Button` | Triggers data refetch |
| Summary cards | `Card`, `CardHeader`, `CardContent` | 4-column responsive grid |
| Revenue chart | `Recharts` `LineChart` + `ResponsiveContainer` | `type="monotone"` for smooth curves |
| Revenue table bars | `Progress` | Width = revenue / maxRevenue × 100% |
| Location badge | `Badge` | In shifts table |
| Cash diff highlight | `cn('bg-red-50 text-red-700')` | Rows where `Math.abs(cash_diff) > 50000` |
| Loading states | `Skeleton` | Replaces cards and table rows while fetching |
| Section wrappers | `Card` | One per section |
| Login screen | `Card` + Google `Button` | Centered, GIS flow |

---

## 6. Revenue Chart — RevenueChart.jsx

Uses Recharts `LineChart` with `ResponsiveContainer`. Two `Line` series:

```jsx
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
    <YAxis tickFormatter={v => (v/1000000).toFixed(1)+'M'} tick={{ fontSize: 11 }} />
    <Tooltip formatter={(v, name) => [fmt(v), name]} />
    <Legend />
    <Line type="monotone" dataKey="binhTan" name="Bình Tân" stroke="#18181b" strokeWidth={2.5} dot={{ r: 3 }} />
    <Line type="monotone" dataKey="quan6"   name="Quận 6"   stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="6 3" />
  </LineChart>
</ResponsiveContainer>
```

**`chartData` shape:** one object per unique date in the filtered range:
```js
[{ date: '2026-05-01', binhTan: 1850000, quan6: 1320000 }, ...]
```

Built from `shifts` state by grouping on `date` + `locations.name`. Missing days for a location get `null` (Recharts skips them cleanly with `connectNulls={false}`).

---

## 7. Auth

1. On mount: read `ca_auth` from `localStorage` (shared key with staff PWA — user may already be signed in).
2. If not present: render centered `<Login />` with Google GIS sign-in button. On credential response, verify via `oauth2.googleapis.com/tokeninfo`, then save to `localStorage`.
3. After sign-in: query `SELECT email FROM users WHERE email = $1` via Supabase anon client. If not found → show "Không có quyền truy cập" error, clear `localStorage`, return to login.
4. If found: render `<Dashboard />`.

**Prerequisite — RLS on `users` table:** The `users` table currently has no anon-read policy, so the check in step 3 would fail silently. Before implementing, run this in Supabase SQL Editor:

```sql
CREATE POLICY "anon read" ON users FOR SELECT USING (true);
```

This exposes staff email addresses to anyone with the anon key, which is an accepted trade-off: the anon key is already embedded in a public GitHub Pages file, and staff emails are not regulated data for this project.

This fixes the gap in the old `report.html` where any Google account could sign in.

---

## 8. Data Layer

All reads use Supabase JS anon client (RLS: `SELECT USING (true)` on all tables except `users`).

**On filter apply:**
```js
// 1. shifts + location name
db.from('shifts')
  .select('*, locations(name)')
  .gte('date', startDate)
  .lte('date', endDate)
  .eq('location_id', locationId)  // omit if "all locations"
  .order('date', { ascending: false })

// 2. shift_products + product name (for product revenue section)
db.from('shift_products')
  .select('*, products(name)')
  .in('shift_id', shiftIds)
```

No write operations from `report/`.

---

## 9. Deployment

**Setup (one-time):**
```bash
cd report
npm create vite@latest . -- --template react
npm install -D tailwindcss @tailwindcss/vite
npm install @supabase/supabase-js recharts
npx shadcn@latest init   # style: default, base color: zinc, CSS variables: yes
npx shadcn@latest add button card select table badge progress skeleton
```

`vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/quanlycuahang-v2/report/',
})
```

**Deploy:**
```bash
cd report && npm run build
cd ..
git add report/dist/ report/src/ report/index.html report/package.json report/vite.config.js report/public/ report/components.json
git rm report.html
git commit -m "feat: report dashboard — Vite + shadcn/ui + Recharts"
git push
```

GitHub Pages serves `report/dist/index.html` at `https://tranductri.github.io/quanlycuahang-v2/report/`.

Add to `.gitignore`:
```
report/node_modules/
```
Do **not** ignore `report/dist/` — it must be committed for GitHub Pages.

---

## 10. What is NOT in scope

- Drill-down into individual shift details.
- Export to CSV/PDF.
- Real-time subscriptions.
- Changes to `index.html`, `sw.js`, `worker/`, or Supabase schema.
