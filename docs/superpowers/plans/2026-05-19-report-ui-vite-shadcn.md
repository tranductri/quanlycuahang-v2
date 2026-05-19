# Report UI — Vite + shadcn/ui + Recharts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `report.html` (CDN React) with a Vite + shadcn/ui + Recharts dashboard in `report/`, with GIS auth that verifies email against the Supabase `users` table, plus a smooth dual-line revenue chart.

**Architecture:** Vite project lives in `report/`. Build output goes to `report/dist/`. GitHub Pages serves it at `https://tranductri.github.io/quanlycuahang-v2/report/dist/`. Pure data-transform functions in `src/lib/` are unit-tested with Vitest. All Supabase reads use the anon key directly (PostgREST). No writes from `report/`.

**Tech Stack:** Vite + React 18, shadcn/ui (zinc), Tailwind CSS v3 (PostCSS), Recharts, @supabase/supabase-js v2, Vitest, Google Identity Services.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `report/index.html` | Create | Vite entry — loads GIS script |
| `report/vite.config.js` | Create | Vite config — base path, path alias, Vitest |
| `report/tailwind.config.js` | Create | Tailwind content paths |
| `report/postcss.config.js` | Create | PostCSS for Tailwind |
| `report/src/index.css` | Create | Tailwind directives |
| `report/src/main.jsx` | Create | React root mount |
| `report/src/App.jsx` | Create | Auth gate — checks localStorage, GIS sign-in, users table |
| `report/src/lib/supabase.js` | Create | `db` client — anon key |
| `report/src/lib/format.js` | Create | `fmt`, `today`, `daysAgo` — pure helpers |
| `report/src/lib/dataTransform.js` | Create | `summarize`, `buildChartData`, `aggregateProducts` — pure, tested |
| `report/src/lib/format.test.js` | Create | Vitest tests for format.js |
| `report/src/lib/dataTransform.test.js` | Create | Vitest tests for dataTransform.js |
| `report/src/components/Login.jsx` | Create | Centered GIS sign-in card |
| `report/src/components/Dashboard.jsx` | Create | Data fetching, state, layout shell |
| `report/src/components/FilterBar.jsx` | Create | Date range + location + apply |
| `report/src/components/SummaryCards.jsx` | Create | 4-card grid |
| `report/src/components/RevenueChart.jsx` | Create | Recharts dual-line smooth chart |
| `report/src/components/ProductRevenue.jsx` | Create | Table + Progress bars |
| `report/src/components/ShiftsTable.jsx` | Create | Table + Badge + totals row |
| `report/src/components/CashDiscrepancy.jsx` | Create | Table sorted by \|cash_diff\|, red rows |
| `report/src/components/ui/` | Generate | shadcn: button, card, select, table, badge, progress, skeleton |
| `report.html` | Delete | Replaced by report/ app |
| `.gitignore` | Modify | Add `report/node_modules/` |

---

## Task 1: Supabase RLS prerequisite

**Files:** Supabase SQL Editor (remote, no local files)

- [ ] **Step 1: Run the policy SQL in Supabase**

Go to [supabase.com](https://supabase.com) → project `rowqvgjzsoaptmqujluw` → SQL Editor. Run:

```sql
CREATE POLICY "anon read" ON users FOR SELECT USING (true);
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Verify the policy was created**

```sql
SELECT policyname, tablename, cmd FROM pg_policies WHERE tablename = 'users';
```

Expected: row with `policyname = 'anon read'`, `cmd = 'SELECT'`.

---

## Task 2: Vite project setup

**Files:**
- Create: `report/` directory and all scaffolding files

- [ ] **Step 1: Scaffold Vite project inside `report/`**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
npm create vite@latest report -- --template react
```

When prompted: confirm overwriting existing `report/` directory with `y` (only `report/` is new — no existing files there).

Expected: `report/` created with `src/`, `index.html`, `package.json`, `vite.config.js`.

- [ ] **Step 2: Install dependencies**

```bash
cd report
npm install
npm install @supabase/supabase-js recharts
npm install -D tailwindcss postcss autoprefixer vitest
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Init Tailwind**

```bash
npx tailwindcss init -p
```

Expected: `tailwind.config.js` and `postcss.config.js` created.

- [ ] **Step 4: Init shadcn**

```bash
npx shadcn@latest init
```

Respond to prompts:
- Style: `Default`
- Base color: `Zinc`
- CSS variables: `Yes`
- Global CSS file: `src/index.css` (default, press Enter)
- Tailwind config: `tailwind.config.js` (default, press Enter)
- Import alias for components: `@/components` (default, press Enter)
- Import alias for utils: `@/lib/utils` (default, press Enter)
- React Server Components: `No`
- Write configuration to components.json: `Yes`

Expected: `components.json` created, `src/lib/utils.js` created with `cn`, `src/index.css` updated with CSS variables and `@tailwind` directives.

- [ ] **Step 5: Add shadcn components**

```bash
npx shadcn@latest add button card select table badge progress skeleton
```

Expected: `src/components/ui/` populated with 7 component files.

- [ ] **Step 6: Rewrite `tailwind.config.js`**

Replace the generated file entirely:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 7: Rewrite `vite.config.js`**

```js
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/quanlycuahang-v2/report/dist/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
```

- [ ] **Step 8: Rewrite `report/index.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Báo cáo — Quản lý cửa hàng</title>
  <script src="https://accounts.google.com/gsi/client" async></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 9: Add `report/node_modules/` to `.gitignore`**

In `/Users/tritran/projects/store-management/quanlycuahang-v2/.gitignore`, add:
```
report/node_modules/
```

- [ ] **Step 10: Commit scaffolding**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/index.html report/vite.config.js report/tailwind.config.js report/postcss.config.js report/package.json report/components.json report/src/index.css report/src/lib/utils.js report/src/components/ui/ .gitignore
git commit -m "chore: scaffold report/ Vite + shadcn/ui project"
```

---

## Task 3: Pure utilities and data transform (TDD)

**Files:**
- Create: `report/src/lib/format.js`
- Create: `report/src/lib/format.test.js`
- Create: `report/src/lib/dataTransform.js`
- Create: `report/src/lib/dataTransform.test.js`

- [ ] **Step 1: Write failing tests for format.js**

Create `report/src/lib/format.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fmt, today, daysAgo } from './format'

describe('fmt', () => {
  it('formats number in vi-VN locale', () => {
    expect(fmt(1000000)).toBe('1.000.000')
  })
  it('returns — for null', () => {
    expect(fmt(null)).toBe('—')
  })
  it('returns — for undefined', () => {
    expect(fmt(undefined)).toBe('—')
  })
  it('handles zero', () => {
    expect(fmt(0)).toBe('0')
  })
})

describe('today', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('daysAgo', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(daysAgo(7)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('returns earlier date than today', () => {
    expect(daysAgo(1) < today()).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
cd report
npx vitest run src/lib/format.test.js
```

Expected: FAIL — "Cannot find module './format'"

- [ ] **Step 3: Create `report/src/lib/format.js`**

```js
export function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('vi-VN')
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx vitest run src/lib/format.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Write failing tests for dataTransform.js**

Create `report/src/lib/dataTransform.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { summarize, buildChartData, aggregateProducts } from './dataTransform'

const makeShift = (overrides) => ({
  id: 'a',
  date: '2026-05-01',
  total_sales: 0,
  expenses: 0,
  cash_diff: 0,
  locations: { name: 'Bình Tân' },
  ...overrides,
})

describe('summarize', () => {
  it('returns zeros for empty array', () => {
    expect(summarize([])).toEqual({ totalSales: 0, totalExpenses: 0, avgCashDiff: 0, count: 0 })
  })

  it('aggregates totals correctly', () => {
    const shifts = [
      makeShift({ total_sales: 1000000, expenses: 50000, cash_diff: -10000 }),
      makeShift({ total_sales: 1500000, expenses: 0, cash_diff: 20000 }),
    ]
    expect(summarize(shifts)).toEqual({
      totalSales: 2500000,
      totalExpenses: 50000,
      avgCashDiff: 5000,
      count: 2,
    })
  })

  it('rounds avgCashDiff', () => {
    const shifts = [
      makeShift({ cash_diff: 10000 }),
      makeShift({ cash_diff: 20000 }),
      makeShift({ cash_diff: 30000 }),
    ]
    expect(summarize(shifts).avgCashDiff).toBe(20000)
  })
})

describe('buildChartData', () => {
  it('groups by date and location', () => {
    const shifts = [
      makeShift({ date: '2026-05-01', total_sales: 1000000, locations: { name: 'Bình Tân' } }),
      makeShift({ date: '2026-05-01', total_sales: 800000,  locations: { name: 'Quận 6' } }),
      makeShift({ date: '2026-05-02', total_sales: 1200000, locations: { name: 'Bình Tân' } }),
    ]
    expect(buildChartData(shifts)).toEqual([
      { date: '2026-05-01', binhTan: 1000000, quan6: 800000 },
      { date: '2026-05-02', binhTan: 1200000, quan6: null },
    ])
  })

  it('sorts by date ascending', () => {
    const shifts = [
      makeShift({ date: '2026-05-03', total_sales: 500000 }),
      makeShift({ date: '2026-05-01', total_sales: 800000 }),
    ]
    const result = buildChartData(shifts)
    expect(result[0].date).toBe('2026-05-01')
    expect(result[1].date).toBe('2026-05-03')
  })

  it('returns empty array for no shifts', () => {
    expect(buildChartData([])).toEqual([])
  })
})

describe('aggregateProducts', () => {
  it('groups by product name and sorts by revenue desc', () => {
    const prods = [
      { products: { name: 'Bánh mì' }, revenue: 500000, consumed: 25 },
      { products: { name: 'Bánh bao' }, revenue: 200000, consumed: 10 },
      { products: { name: 'Bánh mì' }, revenue: 300000, consumed: 15 },
    ]
    const result = aggregateProducts(prods)
    expect(result[0]).toEqual({ name: 'Bánh mì', revenue: 800000, consumed: 40 })
    expect(result[1]).toEqual({ name: 'Bánh bao', revenue: 200000, consumed: 10 })
  })

  it('returns empty array for no products', () => {
    expect(aggregateProducts([])).toEqual([])
  })
})
```

- [ ] **Step 6: Run tests — expect them to fail**

```bash
npx vitest run src/lib/dataTransform.test.js
```

Expected: FAIL — "Cannot find module './dataTransform'"

- [ ] **Step 7: Create `report/src/lib/dataTransform.js`**

```js
export function summarize(shifts) {
  const count = shifts.length
  const totalSales    = shifts.reduce((s, r) => s + Number(r.total_sales || 0), 0)
  const totalExpenses = shifts.reduce((s, r) => s + Number(r.expenses    || 0), 0)
  const avgCashDiff   = count
    ? Math.round(shifts.reduce((s, r) => s + Number(r.cash_diff || 0), 0) / count)
    : 0
  return { totalSales, totalExpenses, avgCashDiff, count }
}

export function buildChartData(shifts) {
  const map = {}
  shifts.forEach(s => {
    const date = s.date
    const loc  = s.locations?.name
    if (!map[date]) map[date] = { date, binhTan: null, quan6: null }
    if (loc === 'Bình Tân') map[date].binhTan = (map[date].binhTan || 0) + Number(s.total_sales || 0)
    if (loc === 'Quận 6')  map[date].quan6   = (map[date].quan6   || 0) + Number(s.total_sales || 0)
  })
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

export function aggregateProducts(shiftProducts) {
  const map = {}
  shiftProducts.forEach(sp => {
    const name = sp.products?.name || 'Unknown'
    if (!map[name]) map[name] = { name, revenue: 0, consumed: 0 }
    map[name].revenue  += Number(sp.revenue  || 0)
    map[name].consumed += Number(sp.consumed || 0)
  })
  return Object.values(map).sort((a, b) => b.revenue - a.revenue)
}
```

- [ ] **Step 8: Run all tests — expect them to pass**

```bash
npx vitest run
```

Expected: 13 tests pass, 0 failures.

- [ ] **Step 9: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/lib/
git commit -m "feat: pure utilities and data transform with tests"
```

---

## Task 4: Supabase client

**Files:**
- Create: `report/src/lib/supabase.js`

- [ ] **Step 1: Create `report/src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rowqvgjzsoaptmqujluw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvd3F2Z2p6c29hcHRtcXVqbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjYwNTAsImV4cCI6MjA5NDI0MjA1MH0.FfL7Ut9krwordccdZ7heo_2NaZ6adnDJbiluwJAmRh8'

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/lib/supabase.js
git commit -m "feat: Supabase anon client"
```

---

## Task 5: Auth — App.jsx + Login.jsx

**Files:**
- Create: `report/src/components/Login.jsx`
- Modify: `report/src/App.jsx`
- Modify: `report/src/main.jsx`

- [ ] **Step 1: Rewrite `report/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Create `report/src/components/Login.jsx`**

```jsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login({ error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-center text-base">Báo cáo Quản lý</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-zinc-500">Đăng nhập để xem báo cáo</p>
          <div id="g-btn" />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `report/src/App.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/supabase'
import Login from '@/components/Login'
import Dashboard from '@/components/Dashboard'

const AUTH_KEY = 'ca_auth'
const GIS_CLIENT_ID = '570458211298-ogrk61hf89ou38l8q6lt9pba0qi2p969.apps.googleusercontent.com'

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
  })
  const [authError, setAuthError] = useState('')

  const handleCredential = useCallback(async (resp) => {
    setAuthError('')
    try {
      const res  = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${resp.credential}`)
      const info = await res.json()
      if (!info.email) { setAuthError('Đăng nhập thất bại.'); return }

      const { data } = await db.from('users').select('email').eq('email', info.email).maybeSingle()
      if (!data) { setAuthError('Email không có quyền truy cập.'); return }

      const authUser = { email: info.email, name: info.name, picture: info.picture }
      localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
      setUser(authUser)
    } catch {
      setAuthError('Có lỗi xảy ra, vui lòng thử lại.')
    }
  }, [])

  useEffect(() => {
    if (user) return
    const init = () => {
      window.google?.accounts.id.initialize({ client_id: GIS_CLIENT_ID, callback: handleCredential })
      window.google?.accounts.id.renderButton(document.getElementById('g-btn'), { theme: 'outline', size: 'large' })
    }
    if (window.google) init()
    else window.addEventListener('load', init)
    return () => window.removeEventListener('load', init)
  }, [user, handleCredential])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }, [])

  if (!user) return <Login error={authError} />
  return <Dashboard user={user} onLogout={handleLogout} />
}
```

- [ ] **Step 4: Verify dev server loads login screen**

```bash
cd report && npm run dev
```

Open `http://localhost:5173`. Expected: centered card with "Đăng nhập để xem báo cáo" and Google sign-in button visible.

Stop server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/main.jsx report/src/App.jsx report/src/components/Login.jsx
git commit -m "feat: auth gate — GIS sign-in + users table check"
```

---

## Task 6: FilterBar

**Files:**
- Create: `report/src/components/FilterBar.jsx`

- [ ] **Step 1: Create `report/src/components/FilterBar.jsx`**

```jsx
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

export default function FilterBar({ startDate, endDate, locationId, locations, loading, onStartDate, onEndDate, onLocation, onApply }) {
  return (
    <Card className="mb-4">
      <CardContent className="pt-4 pb-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Lọc</span>
          <input
            type="date"
            value={startDate}
            onChange={e => onStartDate(e.target.value)}
            className="border border-zinc-200 rounded-md px-3 py-1.5 text-sm bg-zinc-50 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <span className="text-zinc-400 text-sm">→</span>
          <input
            type="date"
            value={endDate}
            onChange={e => onEndDate(e.target.value)}
            className="border border-zinc-200 rounded-md px-3 py-1.5 text-sm bg-zinc-50 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <Select value={locationId} onValueChange={onLocation}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Tất cả cơ sở" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả cơ sở</SelectItem>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={onApply} disabled={loading}>
            {loading ? 'Đang tải...' : 'Áp dụng'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/components/FilterBar.jsx
git commit -m "feat: FilterBar — date range + location select"
```

---

## Task 7: SummaryCards

**Files:**
- Create: `report/src/components/SummaryCards.jsx`

- [ ] **Step 1: Create `report/src/components/SummaryCards.jsx`**

```jsx
import { Card, CardContent } from '@/components/ui/card'
import { fmt } from '@/lib/format'

function SummaryCard({ label, value, sub, valueClass }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-zinc-500 font-medium mb-1">{label}</p>
        <p className={`text-xl font-bold ${valueClass ?? ''}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function SummaryCards({ summary }) {
  const perShift = summary.count
    ? fmt(Math.round(summary.totalExpenses / summary.count))
    : '—'
  return (
    <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
      <SummaryCard label="Tổng doanh thu" value={fmt(summary.totalSales)} sub={`${summary.count} ca`} />
      <SummaryCard label="Tổng chi phí" value={fmt(summary.totalExpenses)} sub={`TB: ${perShift}đ/ca`} />
      <SummaryCard
        label="Lệch tiền TB"
        value={fmt(summary.avgCashDiff)}
        valueClass={summary.avgCashDiff < 0 ? 'text-red-600' : ''}
      />
      <SummaryCard label="Số ca" value={summary.count} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/components/SummaryCards.jsx
git commit -m "feat: SummaryCards — 4-up grid"
```

---

## Task 8: RevenueChart

**Files:**
- Create: `report/src/components/RevenueChart.jsx`

- [ ] **Step 1: Create `report/src/components/RevenueChart.jsx`**

```jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

export default function RevenueChart({ data }) {
  if (!data.length) return null

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Doanh thu theo ngày</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={d => d.slice(5)}
            />
            <YAxis
              tickFormatter={v => v ? (v / 1000000).toFixed(1) + 'M' : '0'}
              tick={{ fontSize: 11 }}
              width={42}
            />
            <Tooltip formatter={(v, name) => [fmt(v) + 'đ', name]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="binhTan"
              name="Bình Tân"
              stroke="#18181b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="quan6"
              name="Quận 6"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
              strokeDasharray="6 3"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/components/RevenueChart.jsx
git commit -m "feat: RevenueChart — smooth dual-line Recharts"
```

---

## Task 9: ProductRevenue

**Files:**
- Create: `report/src/components/ProductRevenue.jsx`

- [ ] **Step 1: Create `report/src/components/ProductRevenue.jsx`**

```jsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

export default function ProductRevenue({ rows }) {
  const maxRev = rows[0]?.revenue || 1

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Doanh thu theo sản phẩm</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!rows.length ? (
          <p className="px-6 py-4 text-sm text-zinc-400">Chưa có dữ liệu</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Đã bán</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="w-32">Tỉ lệ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{fmt(r.consumed)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.revenue)}</TableCell>
                  <TableCell>
                    <Progress value={Math.round(r.revenue / maxRev * 100)} className="h-2" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/components/ProductRevenue.jsx
git commit -m "feat: ProductRevenue — table with progress bars"
```

---

## Task 10: ShiftsTable

**Files:**
- Create: `report/src/components/ShiftsTable.jsx`

- [ ] **Step 1: Create `report/src/components/ShiftsTable.jsx`**

```jsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

export default function ShiftsTable({ shifts }) {
  if (!shifts.length) return (
    <Card className="mb-4">
      <CardHeader><CardTitle className="text-sm font-semibold">Chi tiết ca làm việc</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-zinc-400">Chưa có dữ liệu</p></CardContent>
    </Card>
  )

  const total = {
    total_sales: shifts.reduce((s, r) => s + Number(r.total_sales || 0), 0),
    expenses:    shifts.reduce((s, r) => s + Number(r.expenses    || 0), 0),
    bank_sales:  shifts.reduce((s, r) => s + Number(r.bank_sales  || 0), 0),
    cash_diff:   shifts.reduce((s, r) => s + Number(r.cash_diff   || 0), 0),
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Chi tiết ca làm việc</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Cơ sở</TableHead>
              <TableHead>Nhân viên</TableHead>
              <TableHead className="text-right">Tổng DT</TableHead>
              <TableHead className="text-right">Chi phí</TableHead>
              <TableHead className="text-right">CK/NH</TableHead>
              <TableHead className="text-right">Lệch tiền</TableHead>
              <TableHead>Ghi chú</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.date}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{s.locations?.name || '—'}</Badge>
                </TableCell>
                <TableCell>{s.staff_name}</TableCell>
                <TableCell className="text-right">{fmt(s.total_sales)}</TableCell>
                <TableCell className="text-right">{fmt(s.expenses)}</TableCell>
                <TableCell className="text-right">{fmt(s.bank_sales)}</TableCell>
                <TableCell className={`text-right ${Number(s.cash_diff) !== 0 ? 'text-red-600' : ''}`}>
                  {fmt(s.cash_diff)}
                </TableCell>
                <TableCell>{s.notes || ''}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-zinc-50">
              <TableCell colSpan={3}>Tổng</TableCell>
              <TableCell className="text-right">{fmt(total.total_sales)}</TableCell>
              <TableCell className="text-right">{fmt(total.expenses)}</TableCell>
              <TableCell className="text-right">{fmt(total.bank_sales)}</TableCell>
              <TableCell className="text-right">{fmt(total.cash_diff)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/components/ShiftsTable.jsx
git commit -m "feat: ShiftsTable — table with Badge and totals row"
```

---

## Task 11: CashDiscrepancy

**Files:**
- Create: `report/src/components/CashDiscrepancy.jsx`

- [ ] **Step 1: Create `report/src/components/CashDiscrepancy.jsx`**

```jsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmt } from '@/lib/format'

const THRESHOLD = 50000

export default function CashDiscrepancy({ shifts }) {
  const rows = [...shifts]
    .filter(s => s.cash_diff !== 0 && s.cash_diff !== null)
    .sort((a, b) => Math.abs(Number(b.cash_diff)) - Math.abs(Number(a.cash_diff)))

  return (
    <Card className="mb-4">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">Lệch tiền (theo mức độ)</CardTitle>
        <p className="text-xs text-zinc-400 mt-0.5">
          Đỏ = lệch &gt; {fmt(THRESHOLD)}đ · Chỉ hiển thị ca có lệch khác 0
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {!rows.length ? (
          <p className="px-6 py-4 text-sm text-zinc-400">Không có ca nào lệch tiền trong khoảng thời gian này</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Nhân viên</TableHead>
                <TableHead className="text-right">Lệch tiền</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(s => (
                <TableRow
                  key={s.id}
                  className={Math.abs(Number(s.cash_diff)) > THRESHOLD ? 'bg-red-50' : ''}
                >
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{s.locations?.name || '—'}</TableCell>
                  <TableCell>{s.staff_name}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    {fmt(s.cash_diff)}
                  </TableCell>
                  <TableCell>{s.notes || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/components/CashDiscrepancy.jsx
git commit -m "feat: CashDiscrepancy — sorted table with red highlight"
```

---

## Task 12: Dashboard — wire everything together

**Files:**
- Create: `report/src/components/Dashboard.jsx`

- [ ] **Step 1: Create `report/src/components/Dashboard.jsx`**

```jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from '@/lib/supabase'
import { today, daysAgo } from '@/lib/format'
import { summarize, buildChartData, aggregateProducts } from '@/lib/dataTransform'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import FilterBar from '@/components/FilterBar'
import SummaryCards from '@/components/SummaryCards'
import RevenueChart from '@/components/RevenueChart'
import ProductRevenue from '@/components/ProductRevenue'
import ShiftsTable from '@/components/ShiftsTable'
import CashDiscrepancy from '@/components/CashDiscrepancy'

export default function Dashboard({ user, onLogout }) {
  const [startDate,  setStartDate]  = useState(daysAgo(30))
  const [endDate,    setEndDate]    = useState(today())
  const [locationId, setLocationId] = useState('')
  const [locations,  setLocations]  = useState([])
  const [shifts,     setShifts]     = useState(null)
  const [shiftProds, setShiftProds] = useState(null)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    db.from('locations').select('id,name').then(({ data }) => setLocations(data || []))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = db.from('shifts')
        .select('*, locations(name)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
      if (locationId) q = q.eq('location_id', locationId)

      const { data: shiftData, error: e1 } = await q
      if (e1) throw e1

      const ids = (shiftData || []).map(s => s.id)
      let prods = []
      if (ids.length) {
        const { data: pd, error: e2 } = await db
          .from('shift_products')
          .select('*, products(name)')
          .in('shift_id', ids)
        if (e2) throw e2
        prods = pd || []
      }
      setShifts(shiftData || [])
      setShiftProds(prods)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, locationId])

  useEffect(() => { load() }, [load])

  const summary     = useMemo(() => shifts      ? summarize(shifts)           : null, [shifts])
  const chartData   = useMemo(() => shifts      ? buildChartData(shifts)       : [],   [shifts])
  const productRows = useMemo(() => shiftProds  ? aggregateProducts(shiftProds): [],   [shiftProds])

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-zinc-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Báo cáo — Quản lý cửa hàng</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>{user.name}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-6 text-xs border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            Đăng xuất
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <FilterBar
          startDate={startDate} endDate={endDate} locationId={locationId}
          locations={locations} loading={loading}
          onStartDate={setStartDate} onEndDate={setEndDate}
          onLocation={setLocationId} onApply={load}
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-56 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : (
          <>
            {summary && <SummaryCards summary={summary} />}
            <RevenueChart data={chartData} />
            <ProductRevenue rows={productRows} />
            <ShiftsTable shifts={shifts || []} />
            <CashDiscrepancy shifts={shifts || []} />
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Run dev server and sign in**

```bash
cd report && npm run dev
```

Open `http://localhost:5173`. Sign in with a Google account that is in the `users` table. Expected:
- Summary cards appear with real data
- Revenue chart shows two smooth lines
- All three tables are populated

- [ ] **Step 3: Run all unit tests one final time**

```bash
npx vitest run
```

Expected: 13 tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/src/components/Dashboard.jsx
git commit -m "feat: Dashboard — data layer and full layout"
```

---

## Task 13: Build and deploy

**Files:**
- Generate: `report/dist/`
- Delete: `report.html`

- [ ] **Step 1: Build**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2/report
npm run build
```

Expected: `dist/` created inside `report/`. No errors. Output shows `dist/index.html` and `dist/assets/`.

- [ ] **Step 2: Verify built assets reference the correct base path**

```bash
grep -m1 'quanlycuahang-v2' report/dist/index.html
```

Expected: output containing `/quanlycuahang-v2/report/dist/assets/`.

- [ ] **Step 3: Stage, remove old report.html, commit, and push**

```bash
cd /Users/tritran/projects/store-management/quanlycuahang-v2
git add report/dist/ report/src/ report/index.html report/package.json report/vite.config.js report/tailwind.config.js report/postcss.config.js report/components.json report/public/
git rm report.html
git commit -m "feat: report dashboard — Vite + shadcn/ui + Recharts (replace report.html)"
git push
```

- [ ] **Step 4: Verify on GitHub Pages**

Wait ~60 seconds for Pages to deploy, then open:

```
https://tranductri.github.io/quanlycuahang-v2/report/dist/
```

Note: the URL ends in `/dist/` because the Vite project lives in `report/` and builds to `report/dist/`. The old `/report.html` URL is now gone (404). Expected: login screen loads, sign-in works, dashboard shows real data from the 62 migrated shifts.
