# Backend Migration — GAS/Google Sheets → Supabase

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Migrate backend from Google Apps Script + Google Sheets to Supabase (PostgreSQL + PostgREST), and add a `report.html` dashboard page.

---

## 1. Goals

- Replace GAS + Google Sheets with a proper relational database to support flexible reporting.
- Enable three report types: revenue by product, revenue by shift/location, cash discrepancy trends.
- Keep the frontend (`index.html`) unchanged — the migration is transparent to staff using the PWA.
- Stay within $0/month (Supabase free tier).

---

## 2. Architecture

```
Browser (PWA — index.html)           [no changes]
  ├── Google GIS ─────────────────► oauth2.googleapis.com/tokeninfo
  └── Cloudflare Worker ──────────► Supabase REST API
       (same URL as before)           (service role key — writes only)

report.html (GitHub Pages — new)
  └── Supabase JS client ──────────► Supabase PostgREST
                                       (anon key — reads only, RLS enforced)

Hosting: GitHub Pages  [no changes]
Offline: SW cache-first  [no changes]
```

### What changes

| Component | Before | After |
|---|---|---|
| `index.html` | unchanged | unchanged |
| `sw.js` | unchanged | unchanged |
| Cloudflare Worker | proxy to GAS | proxy to Supabase REST API |
| `Code.gs` (GAS) | backend | **removed** |
| Google Sheets | database | **removed** (Supabase Table Editor replaces it for owner) |
| `report.html` | does not exist | **new** — unified reporting dashboard |

---

## 3. Database Schema

### 3.1 Tables

```sql
CREATE TABLE locations (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name    text NOT NULL UNIQUE,
  active  boolean DEFAULT true
);

CREATE TABLE products (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name    text NOT NULL UNIQUE,
  price   numeric NOT NULL,
  active  boolean DEFAULT true
);

CREATE TABLE product_locations (
  product_id   uuid REFERENCES products(id) ON DELETE CASCADE,
  location_id  uuid REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, location_id)
);

CREATE TABLE shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  date        date NOT NULL,
  location_id uuid REFERENCES locations(id),
  staff_name  text NOT NULL,
  expenses    numeric DEFAULT 0,
  bank_sales  numeric DEFAULT 0,
  total_sales numeric DEFAULT 0,
  cash_diff   numeric DEFAULT 0,
  cash_stored numeric DEFAULT 0,
  cash_remain numeric DEFAULT 0,
  notes       text
);

CREATE TABLE shift_products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id         uuid REFERENCES shifts(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES products(id),
  opening_shelf    int DEFAULT 0,
  opening_shelf2   int DEFAULT 0,
  opening_stock    int DEFAULT 0,
  opening_box      int DEFAULT 0,
  sold             int DEFAULT 0,
  received         int DEFAULT 0,
  damaged          int DEFAULT 0,
  promo            int DEFAULT 0,
  transferred      int DEFAULT 0,
  closing_actual   int,
  closing_expected int,
  discrepancy      int,
  consumed         int DEFAULT 0,
  revenue          numeric DEFAULT 0
);

CREATE TABLE shift_cash (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     uuid REFERENCES shifts(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('opening', 'closing', 'stored')),
  denomination int NOT NULL,
  count        int DEFAULT 0
);

CREATE TABLE shift_expenses (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE,
  category text,
  notes    text,
  amount   numeric DEFAULT 0
);

CREATE TABLE users (
  email      text PRIMARY KEY,
  name       text,
  created_at timestamptz DEFAULT now()
);
```

### 3.2 Design rationale

- `locations` table makes adding a new store a single `INSERT` — no schema or code changes.
- `product_locations` many-to-many allows products to be available at any combination of locations.
- `shift_products` stores one row per product per shift, enabling `GROUP BY product` queries directly.
- `shift_cash` stores denomination counts as rows (not wide columns), making cash queries simple aggregations.

---

## 4. Data Flow

### 4.1 Write path (shift submit)

1. Frontend POSTs the same JSON payload to Cloudflare Worker (no frontend changes).
2. Worker resolves `vi_tri` string → `location_id` via `SELECT id FROM locations WHERE name = $1`.
3. Worker inserts in order:
   - `shifts` → returns `shift_id`
   - `shift_products` — one row per product in the location's product list
   - `shift_cash` — 27 rows (9 denominations × 3 types: opening/closing/stored)
   - `shift_expenses` — one row per expense item (if any)
4. Worker uses Supabase **service role key** (secret, never exposed to browser).
5. Worker returns `{success: true, message: "..."}` — same response shape as before.

### 4.2 Read path (Worker GET actions)

All three existing GET actions are reimplemented in the Worker against Supabase:

**`getProducts`**
Query: `SELECT p.id, p.name, p.price, l.name as location_name FROM products p JOIN product_locations pl ON p.id = pl.product_id JOIN locations l ON pl.location_id = l.id WHERE p.active = true`

Worker groups rows by product and reconstructs the boolean flags expected by `index.html`:
```js
// Worker transforms Supabase result → existing response shape
{ ten: p.name, gia: p.price, binh_tan: locations.includes('Bình Tân'), quan_6: locations.includes('Quận 6') }
```
`index.html` uses `p.binh_tan` and `p.quan_6` to filter products by location — these must be present.

**`lastShift`**
Two-step query: (1) find the most recent shift for the location, (2) return all its `shift_products`.
```sql
-- Step 1
SELECT id FROM shifts WHERE location_id = $1 ORDER BY created_at DESC LIMIT 1;
-- Step 2
SELECT sp.closing_actual, p.name FROM shift_products sp
JOIN products p ON sp.product_id = p.id
WHERE sp.shift_id = $shift_id;
```
Worker returns `{ success, ngay, ten, products: [{cuoi_thuc}, ...] }` indexed by location product order — same shape as current GAS response.

**`getUsers`**
Query: `SELECT email FROM users`

Response shapes remain identical to current GAS responses — `index.html` requires no changes.

### 4.3 Report path (report.html)

- `report.html` uses Supabase JS client with **anon key** (read-only).
- RLS policy on all tables: `SELECT USING (true)` — anyone who obtains the anon key can read all shift data directly via the Supabase REST API, bypassing the `report.html` sign-in UI entirely.
- The anon key is embedded in `report.html`, which is committed to a public GitHub Pages repo. It is therefore effectively public.
- **This is an accepted trade-off for this project.** The data (inventory counts, cash totals) is operational, not personal/regulated, and the URL is not widely advertised. Adding real auth protection would require Supabase Auth or routing all reads through the Worker — too much complexity for a ~10-staff bakery app.
- No writes from `report.html`.

---

## 5. report.html — Unified Dashboard

Single static HTML file (React via CDN + Supabase JS via CDN, no build step).

### Layout

```
┌──────────────────────────────────────────────┐
│  [Date range picker]   [Location dropdown]   │  ← global filters
├──────────────────────────────────────────────┤
│  Total Sales  │  Expenses  │  Avg Cash Diff  │  Shifts count  │
├──────────────────────────────────────────────┤
│  Revenue by Product                          │
│  (table: product name, units sold, revenue)  │
│  + simple CSS bar chart                      │
├──────────────────────────────────────────────┤
│  Shifts                                      │
│  (table: date, location, staff, total sales, │
│   expenses, bank sales, cash diff)           │
├──────────────────────────────────────────────┤
│  Cash Discrepancy                            │
│  (table sorted by |cash_diff| desc;          │
│   rows where |cash_diff| > 50,000 in red)    │
└──────────────────────────────────────────────┘
```

All three sections share the global date range + location filter. One data fetch on filter change, results distributed to each section.

### Auth

- On load: check `localStorage` for `ca_auth` (same key as main app).
- If not present: show Google Sign-In button (same GIS flow as `index.html`).
- After sign-in: query `users` table to verify email is whitelisted before rendering data.

---

## 6. What is NOT in scope

- Historical data migration from Google Sheets (can be done manually or via a one-off script later).
- Changes to `index.html` or `sw.js`.
- Real-time subscriptions (Supabase Realtime) — polling on filter change is sufficient.
- Role-based access control beyond email whitelist.

---

## 7. Deployment

### Supabase setup (one-time)
1. Create Supabase project at supabase.com.
2. Run schema SQL in Supabase SQL Editor.
3. Enable RLS on all tables; add read policy for whitelisted users.
4. Seed `locations`, `products`, `product_locations`, `users` tables.
5. Copy **anon key** (for `report.html`) and **service role key** (for Worker).

### Cloudflare Worker update
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as Worker secrets.
- Rewrite Worker to call Supabase REST API instead of GAS.
- Keep existing Worker URL — no frontend changes needed.

### report.html deploy
- Add `report.html` to repo root.
- Bump SW cache version in `sw.js` (SW must not cache `report.html` API calls).
- Push to `main` — GitHub Pages deploys automatically.

### Retire GAS
- After Worker cutover is verified: `clasp undeploy` the GAS deployment.
- Archive `Code.gs` (keep in repo for reference, remove from clasp push).
