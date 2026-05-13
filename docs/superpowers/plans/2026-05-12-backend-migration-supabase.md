# Backend Migration — GAS/Sheets → Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the bakery shift-management app backend from Google Apps Script + Google Sheets to Supabase (PostgreSQL), and add a `report.html` dashboard with revenue-by-product, revenue-by-shift, and cash-discrepancy reports.

**Architecture:** The Cloudflare Worker keeps the same public URL — `index.html` (unchanged) still POSTs to it; the Worker now calls the Supabase REST API instead of GAS. `report.html` is a new static page on GitHub Pages that queries Supabase directly via the JS client with the anon key. GAS and Google Sheets are retired.

**Tech Stack:** Supabase (PostgreSQL + PostgREST), Cloudflare Workers (raw fetch — no npm), React 18 via CDN, Supabase JS v2 via CDN, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-05-12-backend-migration-supabase-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `index.html` | Copy (no changes) | PWA frontend — staff shift app |
| `manifest.json` | Copy (no changes) | PWA manifest |
| `sw.js` | Copy + bump cache version | Service worker — bump `CACHE_NAME` |
| `icon-192.png`, `icon-512.png` | Copy (no changes) | PWA icons |
| `report.html` | Create | Unified reporting dashboard |
| `supabase/schema.sql` | Create | Full DB schema + RLS policies |
| `supabase/seed.sql` | Create | Initial data: locations, products, users |
| `worker/wrangler.toml` | Create | Cloudflare Worker config |
| `worker/index.js` | Create | Worker: routing + all 4 actions |
| `CLAUDE.md` | Create | Updated project docs for new stack |

---

## Task 1: Repo Setup

**Files:**
- Create: all files listed in file map (copy + new)

- [ ] **Step 1: Initialize repo and copy static files**

```bash
git init quanlycuahang-v2
cd quanlycuahang-v2
# Copy from old project:
cp /path/to/old/index.html .
cp /path/to/old/manifest.json .
cp /path/to/old/sw.js .
cp /path/to/old/icon-192.png .
cp /path/to/old/icon-512.png .
mkdir -p docs/superpowers/specs docs/superpowers/plans supabase worker
cp /path/to/old/docs/superpowers/specs/2026-05-12-backend-migration-supabase-design.md docs/superpowers/specs/
```

- [ ] **Step 2: Bump service worker cache version in `sw.js`**

Find the line that defines the cache name (e.g. `const CACHE_NAME = 'kiem-ke-ca-vN'`) and increment N by 1.

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.wrangler/
*.env
.env.local
```

- [ ] **Step 4: Initial commit**

```bash
git add .
git commit -m "chore: initial project setup — copy static files, new structure"
```

---

## Task 2: Supabase Schema + Seed

**Files:**
- Create: `supabase/schema.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
-- Enable pgcrypto for gen_random_uuid() (already available on Supabase)

CREATE TABLE locations (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name    text NOT NULL UNIQUE,
  active  boolean DEFAULT true
);

CREATE TABLE products (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  price      numeric NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean DEFAULT true
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
  position         int NOT NULL DEFAULT 0,
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

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_cash         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;

-- report.html uses anon key — allow public read on all tables except users
CREATE POLICY "public read" ON locations         FOR SELECT USING (true);
CREATE POLICY "public read" ON products          FOR SELECT USING (true);
CREATE POLICY "public read" ON product_locations FOR SELECT USING (true);
CREATE POLICY "public read" ON shifts            FOR SELECT USING (true);
CREATE POLICY "public read" ON shift_products    FOR SELECT USING (true);
CREATE POLICY "public read" ON shift_cash        FOR SELECT USING (true);
CREATE POLICY "public read" ON shift_expenses    FOR SELECT USING (true);
-- users table: no anon read (Worker uses service_role key which bypasses RLS)
```

- [ ] **Step 2: Write `supabase/seed.sql`**

```sql
-- Locations
INSERT INTO locations (name) VALUES ('Bình Tân'), ('Quận 6');

-- Products (sort_order matches allProducts index in index.html)
INSERT INTO products (name, price, sort_order) VALUES
  ('Bánh bao xúc xích phomai',         20000,  0),
  ('Bánh bao xá xíu phomai',           22000,  1),
  ('Bánh bao gà nấm phomai',           28000,  2),
  ('Bánh bao bò phomai',               25000,  3),
  ('Bánh bao thịt trứng cút',          20000,  4),
  ('Bánh bao hình thú',                15000,  5),
  ('Bánh bao kimsa',                   15000,  6),
  ('Bánh bao lava matcha',             15000,  7),
  ('Bánh bao gạo lứt không nhân',      10000,  8),
  ('Bánh bao chay ngũ sắc',            15000,  9),
  ('Bánh mì pate chà bông',            15000, 10),
  ('Bánh mì xúc xích chà bông',       18000, 11),
  ('Bánh mì gà cay chua ngọt',        20000, 12),
  ('Bánh mì bò',                       22000, 13),
  ('Mì ý bò bằm',                      28000, 14),
  ('Mì ý sốt kem nấm thịt xông khói', 28000, 15),
  ('Mì ý sốt thanh cua',              28000, 16),
  ('Cơm nắm teriyaki',                 15000, 17),
  ('Cơm nắm xúc xích phomai tan chảy',17000, 18),
  ('Yaourt',                           10000, 19);

-- Product ↔ Location mapping
-- sort_order 0–7 and 17–19: both locations
INSERT INTO product_locations (product_id, location_id)
SELECT p.id, l.id FROM products p CROSS JOIN locations l
WHERE p.sort_order IN (0,1,2,3,4,5,6,7,17,18,19);

-- sort_order 8–16: Bình Tân only
INSERT INTO product_locations (product_id, location_id)
SELECT p.id, l.id FROM products p, locations l
WHERE p.sort_order BETWEEN 8 AND 16 AND l.name = 'Bình Tân';

-- Users — add staff emails here
INSERT INTO users (email) VALUES
  ('staff1@gmail.com'),   -- replace with real emails
  ('staff2@gmail.com');
```

- [ ] **Step 3: Run schema + seed in Supabase**

1. Go to [supabase.com](https://supabase.com) → create a new project (free tier).
2. Open **SQL Editor** → paste `supabase/schema.sql` → Run.
3. Open **SQL Editor** → paste `supabase/seed.sql` (update user emails first) → Run.
4. Copy from **Project Settings → API**:
   - `Project URL` → save as `SUPABASE_URL`
   - `anon public` key → save as `SUPABASE_ANON_KEY`
   - `service_role` key → save as `SUPABASE_SERVICE_KEY` (keep secret)

- [ ] **Step 4: Verify in Supabase Table Editor**

Open Table Editor → confirm `locations` has 2 rows, `products` has 20 rows, `product_locations` has 31 rows (11 products × 2 locations + 9 products × 1 location = 22 + 9 = 31).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql supabase/seed.sql
git commit -m "feat: Supabase schema and seed data"
```

---

## Task 3: Cloudflare Worker Skeleton

**Files:**
- Create: `worker/wrangler.toml`
- Create: `worker/index.js`

- [ ] **Step 1: Install wrangler (if not installed)**

```bash
npm install -g wrangler
wrangler --version
# Expected: wrangler 3.x.x
```

- [ ] **Step 2: Write `worker/wrangler.toml`**

```toml
name = "quanlycuahang"
main = "index.js"
compatibility_date = "2024-01-01"

# SUPABASE_URL set here; SUPABASE_SERVICE_KEY set as a secret (never in toml)
[vars]
SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"
```

Replace `YOUR_PROJECT_REF` with your actual Supabase project reference (from the URL in Supabase dashboard).

- [ ] **Step 3: Write `worker/index.js` skeleton**

```js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    try {
      let result;
      if (request.method === 'POST') {
        result = await submitShift(env, await request.json());
      } else if (action === 'getProducts') {
        result = await getProducts(env);
      } else if (action === 'lastShift') {
        result = await getLastShift(env, url.searchParams.get('vi_tri'));
      } else if (action === 'getUsers') {
        result = await getUsers(env);
      } else {
        result = { success: true };
      }
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sb(env, path, opts = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer ?? '',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function getProducts(env) {
  return { success: true, products: [] }; // stub
}

async function getUsers(env) {
  return { success: true, emails: [] }; // stub
}

async function getLastShift(env, vi_tri) {
  return { success: false, error: 'not implemented' }; // stub
}

async function submitShift(env, data) {
  return { success: false, error: 'not implemented' }; // stub
}
```

- [ ] **Step 4: Set service key secret**

```bash
cd worker
wrangler secret put SUPABASE_SERVICE_KEY
# Paste the service_role key when prompted
```

- [ ] **Step 5: Start dev server and verify routing**

```bash
cd worker
wrangler dev
```

In another terminal:
```bash
# Health check
curl "http://localhost:8787"
# Expected: {"success":true}

# CORS preflight
curl -X OPTIONS "http://localhost:8787" -H "Origin: https://example.com" -v
# Expected: 200 with Access-Control-Allow-Origin: *
```

- [ ] **Step 6: Commit**

```bash
cd ..
git add worker/
git commit -m "feat: Cloudflare Worker skeleton with routing and Supabase client helper"
```

---

## Task 4: Worker — getProducts

**Files:**
- Modify: `worker/index.js` — implement `getProducts`

- [ ] **Step 1: Implement `getProducts`**

Replace the `getProducts` stub in `worker/index.js`:

```js
async function getProducts(env) {
  const rows = await sb(env,
    '/products?select=name,price,product_locations(locations(name))&active=eq.true&order=sort_order.asc'
  );
  const products = rows.map(p => {
    const locationNames = p.product_locations.map(pl => pl.locations.name);
    return {
      ten: p.name,
      gia: p.price,
      binh_tan: locationNames.includes('Bình Tân'),
      quan_6: locationNames.includes('Quận 6'),
    };
  });
  return { success: true, products };
}
```

- [ ] **Step 2: Start dev server and test**

```bash
cd worker && wrangler dev
```

```bash
curl "http://localhost:8787?action=getProducts"
```

Expected response shape (20 products):
```json
{
  "success": true,
  "products": [
    { "ten": "Bánh bao xúc xích phomai", "gia": 20000, "binh_tan": true, "quan_6": true },
    { "ten": "Bánh bao gạo lứt không nhân", "gia": 10000, "binh_tan": true, "quan_6": false },
    ...
  ]
}
```

Verify: products 0–7 have `binh_tan: true, quan_6: true`. Products 8–16 have `binh_tan: true, quan_6: false`. Products 17–19 have `binh_tan: true, quan_6: true`.

- [ ] **Step 3: Commit**

```bash
cd ..
git add worker/index.js
git commit -m "feat: Worker getProducts — query Supabase, reconstruct location flags"
```

---

## Task 5: Worker — getUsers

**Files:**
- Modify: `worker/index.js` — implement `getUsers`

- [ ] **Step 1: Implement `getUsers`**

Replace the `getUsers` stub:

```js
async function getUsers(env) {
  const rows = await sb(env, '/users?select=email');
  return { success: true, emails: rows.map(r => r.email.toLowerCase()) };
}
```

- [ ] **Step 2: Test**

```bash
curl "http://localhost:8787?action=getUsers"
# Expected: {"success":true,"emails":["staff1@gmail.com","staff2@gmail.com"]}
```

- [ ] **Step 3: Commit**

```bash
git add worker/index.js
git commit -m "feat: Worker getUsers — query users table"
```

---

## Task 6: Worker — getLastShift

**Files:**
- Modify: `worker/index.js` — implement `getLastShift`

- [ ] **Step 1: Implement `getLastShift`**

Replace the `getLastShift` stub:

```js
async function getLastShift(env, vi_tri) {
  if (!vi_tri) return { success: false, error: 'vi_tri required' };

  const locs = await sb(env,
    `/locations?name=eq.${encodeURIComponent(vi_tri)}&select=id`
  );
  if (!locs.length) return { success: false, error: `Unknown location: ${vi_tri}` };

  const shifts = await sb(env,
    `/shifts?location_id=eq.${locs[0].id}&select=id,date,staff_name&order=created_at.desc&limit=1`
  );
  if (!shifts.length) return { success: false, error: 'Chưa có ca nào được lưu' };

  const sps = await sb(env,
    `/shift_products?shift_id=eq.${shifts[0].id}&select=closing_actual&order=position.asc`
  );

  return {
    success: true,
    ngay: shifts[0].date,
    ten: shifts[0].staff_name,
    products: sps.map(sp => ({
      cuoi_thuc: sp.closing_actual !== null ? sp.closing_actual : undefined,
    })),
  };
}
```

- [ ] **Step 2: Test (requires at least one shift in DB)**

Since no shifts exist yet, test the "no shifts" path:
```bash
curl "http://localhost:8787?action=lastShift&vi_tri=B%C3%ACnh+T%C3%A2n"
# Expected: {"success":false,"error":"Chưa có ca nào được lưu"}

curl "http://localhost:8787?action=lastShift&vi_tri=UnknownPlace"
# Expected: {"success":false,"error":"Unknown location: UnknownPlace"}

curl "http://localhost:8787?action=lastShift"
# Expected: {"success":false,"error":"vi_tri required"}
```

- [ ] **Step 3: Commit**

```bash
git add worker/index.js
git commit -m "feat: Worker getLastShift — two-step query: find latest shift then products"
```

---

## Task 7: Worker — submitShift

**Files:**
- Modify: `worker/index.js` — implement `submitShift`

- [ ] **Step 1: Implement `submitShift`**

Replace the `submitShift` stub with the full implementation:

```js
async function submitShift(env, data) {
  // 1. Resolve location_id
  const locs = await sb(env,
    `/locations?name=eq.${encodeURIComponent(data.vi_tri || '')}&select=id`
  );
  if (!locs.length) throw new Error(`Unknown location: ${data.vi_tri}`);
  const location_id = locs[0].id;

  // 2. All products in global order (same order as getProducts / allProducts in frontend)
  const allProducts = await sb(env,
    `/products?select=id,name,price,product_locations(locations(name))&active=eq.true&order=sort_order.asc`
  );

  // 3. Filter to location's products (preserve global index as idx)
  const locationProds = allProducts
    .map((p, idx) => ({
      id: p.id,
      price: p.price,
      idx,
      inLocation: p.product_locations.some(pl => pl.locations.name === data.vi_tri),
    }))
    .filter(p => p.inLocation);

  // 4. Compute per-product rows
  const dataProds = data.products || [];
  let totalSales = 0;

  const shiftProductRows = locationProds.map((p, locIdx) => {
    const v             = dataProds[p.idx] || {};
    const openingShelf  = Number(v.dau_h1)   || 0;
    const openingShelf2 = Number(v.dau_h2)   || 0;
    const openingStock  = Number(v.dau_kho)  || 0;
    const openingBox    = Number(v.dau_cu)   || 0;
    const sold          = Number(v.xuat)     || 0;
    const received      = Number(v.nhap)     || 0;
    const damaged       = Number(v.hu)       || 0;
    const promo         = Number(v.km)       || 0;
    const transferred   = Number(v.chuyen)   || 0;
    const closingActual = (v.cuoi_thuc !== undefined && v.cuoi_thuc !== '')
      ? Number(v.cuoi_thuc) : null;
    const expected    = openingShelf + openingShelf2 + openingStock + openingBox
                        + received - sold - damaged - promo - transferred;
    const discrepancy = closingActual !== null ? closingActual - expected : null;
    const consumed    = closingActual !== null
      ? Math.max(0, openingShelf + openingShelf2 + openingStock + openingBox
                     + received - damaged - promo - transferred - closingActual)
      : sold;
    const revenue = consumed * p.price;
    totalSales   += revenue;
    return {
      product_id: p.id,
      position: locIdx,
      opening_shelf: openingShelf,
      opening_shelf2: openingShelf2,
      opening_stock: openingStock,
      opening_box: openingBox,
      sold,
      received,
      damaged,
      promo,
      transferred,
      closing_actual: closingActual,
      closing_expected: expected,
      discrepancy,
      consumed,
      revenue,
    };
  });

  // 5. Compute cash totals
  const tienDau  = data.tien_dau  || {};
  const tienCuoi = data.tien_cuoi || {};
  const catDt    = data.cat_dt    || {};
  let cashOpen = 0, cashClose = 0, cashStored = 0;
  DENOMS.forEach(d => {
    cashOpen   += (Number(tienDau[d])  || 0) * d;
    cashClose  += (Number(tienCuoi[d]) || 0) * d;
    cashStored += (Number(catDt[d])    || 0) * d;
  });
  const expenses    = Number(data.chi_phi) || 0;
  const bankSales   = Number(data.dt_nh)   || 0;
  const cashDiff    = cashClose - (cashOpen + (totalSales - bankSales) - expenses);
  const cashRemain  = cashClose - cashStored;

  // 6. Insert shift row
  const shiftDate = data.ngay || new Date().toISOString().split('T')[0];
  const shifts = await sb(env, '/shifts', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({
      date: shiftDate,
      location_id,
      staff_name:  data.ten || '',
      expenses,
      bank_sales:  bankSales,
      total_sales: totalSales,
      cash_diff:   cashDiff,
      cash_stored: cashStored,
      cash_remain: cashRemain,
      notes:       data.ghi_chu || null,
    }),
  });
  const shift_id = shifts[0].id;

  // 7. Insert shift_products
  await sb(env, '/shift_products', {
    method: 'POST',
    body: JSON.stringify(shiftProductRows.map(r => ({ ...r, shift_id }))),
  });

  // 8. Insert shift_cash (9 denoms × 3 types = 27 rows)
  const cashRows = [];
  DENOMS.forEach(d => {
    cashRows.push({ shift_id, type: 'opening', denomination: d, count: Number(tienDau[d])  || 0 });
    cashRows.push({ shift_id, type: 'closing', denomination: d, count: Number(tienCuoi[d]) || 0 });
    cashRows.push({ shift_id, type: 'stored',  denomination: d, count: Number(catDt[d])    || 0 });
  });
  await sb(env, '/shift_cash', { method: 'POST', body: JSON.stringify(cashRows) });

  // 9. Insert shift_expenses (if any)
  const expItems = data.chi_phi_items || [];
  if (expItems.length) {
    await sb(env, '/shift_expenses', {
      method: 'POST',
      body: JSON.stringify(expItems.map(item => ({
        shift_id,
        category: item.type  || null,
        notes:    item.note  || null,
        amount:   Number(item.amount) || 0,
      }))),
    });
  }

  return { success: true, message: 'Đã lưu ca thành công!' };
}
```

- [ ] **Step 2: Test with a minimal POST**

```bash
curl -X POST "http://localhost:8787" \
  -H "Content-Type: application/json" \
  -d '{
    "vi_tri": "Bình Tân",
    "ngay": "2026-05-12",
    "ten": "Test Staff",
    "products": [],
    "tien_dau": {},
    "tien_cuoi": {},
    "cat_dt": {},
    "chi_phi": 0,
    "dt_nh": 0,
    "ghi_chu": "test submit",
    "chi_phi_items": []
  }'
# Expected: {"success":true,"message":"Đã lưu ca thành công!"}
```

- [ ] **Step 3: Verify in Supabase Table Editor**

Open Supabase Table Editor → `shifts` table → confirm 1 row was inserted with correct `location_id`.
Open `shift_products` → confirm rows were inserted (0 rows here since products array was empty — that's OK for this test).
Open `shift_cash` → confirm 27 rows were inserted.

- [ ] **Step 4: Test with a realistic POST (with product data)**

```bash
curl -X POST "http://localhost:8787" \
  -H "Content-Type: application/json" \
  -d '{
    "vi_tri": "Bình Tân",
    "ngay": "2026-05-12",
    "ten": "Test Staff",
    "products": [
      {"dau_h1":10,"dau_h2":0,"dau_kho":5,"dau_cu":0,"xuat":8,"nhap":0,"hu":0,"km":0,"chuyen":0,"cuoi_thuc":7}
    ],
    "tien_dau": {"500000":1,"200000":2},
    "tien_cuoi": {"500000":0,"200000":1,"100000":3},
    "cat_dt": {"100000":2},
    "chi_phi": 50000,
    "dt_nh": 0,
    "ghi_chu": "",
    "chi_phi_items": [{"type":"Nguyên liệu","note":"mua bột","amount":50000}]
  }'
# Expected: {"success":true,"message":"Đã lưu ca thành công!"}
```

Then test `lastShift` now that data exists:
```bash
curl "http://localhost:8787?action=lastShift&vi_tri=B%C3%ACnh+T%C3%A2n"
# Expected: {"success":true,"ngay":"2026-05-12","ten":"Test Staff","products":[{"cuoi_thuc":7},...]}
```

- [ ] **Step 5: Commit**

```bash
git add worker/index.js
git commit -m "feat: Worker submitShift — insert shift, products, cash, expenses to Supabase"
```

---

## Task 8: Deploy Cloudflare Worker

**Files:**
- Modify: `worker/wrangler.toml` (update Worker name if needed)
- Modify: `index.html` (update `GAS_URL` if the Worker URL changes)

- [ ] **Step 1: Log in to Cloudflare**

```bash
cd worker
wrangler login
```

- [ ] **Step 2: Deploy Worker**

```bash
wrangler deploy
# Expected output includes: "Published quanlycuahang (your-worker.workers.dev)"
# Note the Worker URL (e.g. https://quanlycuahang.YOUR_SUBDOMAIN.workers.dev)
```

- [ ] **Step 3: Update GAS_URL in `index.html` if Worker URL changed**

Search `index.html` for `GAS_URL` (or `const GAS_URL`) and update to the new Worker URL. If the Cloudflare account subdomain is the same as before, the URL may already be correct.

- [ ] **Step 4: Smoke test deployed Worker**

```bash
NEW_URL="https://quanlycuahang.YOUR_SUBDOMAIN.workers.dev"

curl "$NEW_URL?action=getProducts" | head -c 200
# Expected: {"success":true,"products":[...

curl "$NEW_URL?action=getUsers"
# Expected: {"success":true,"emails":[...
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add index.html worker/wrangler.toml
git commit -m "feat: deploy Worker to Cloudflare, update GAS_URL in index.html"
```

---

## Task 9: report.html — Auth, Filters, and Summary Cards

**Files:**
- Create: `report.html`

- [ ] **Step 1: Create `report.html` with auth + filter bar + summary cards**

Replace `SUPABASE_URL_HERE` and `SUPABASE_ANON_KEY_HERE` with the actual values from Task 2.
Replace `GIS_CLIENT_ID_HERE` with `570458211298-ogrk61hf89ou38l8q6lt9pba0qi2p969.apps.googleusercontent.com`.

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Báo cáo — Quản lý cửa hàng</title>
  <script src="https://accounts.google.com/gsi/client" async></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; font-size: 14px; }
    .container { max-width: 1100px; margin: 0 auto; padding: 16px; }
    .header { background: #1a1a2e; color: #fff; padding: 12px 16px; margin-bottom: 16px; }
    .header h1 { font-size: 18px; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
    .filters input, .filters select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    .filters button { padding: 6px 14px; background: #1a1a2e; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .card { background: #fff; padding: 14px 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .card .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .card .value { font-size: 20px; font-weight: 700; }
    .section { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 16px; margin-bottom: 20px; }
    .section h2 { font-size: 15px; margin-bottom: 12px; color: #333; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1a1a2e; color: #fff; padding: 8px 10px; text-align: left; position: sticky; top: 0; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:hover td { background: #f9f9f9; }
    .bar-wrap { height: 10px; background: #eee; border-radius: 5px; min-width: 60px; }
    .bar-fill { height: 10px; background: #1a4d8f; border-radius: 5px; }
    .red td { background: #fff0f0 !important; }
    .login-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 16px; }
    .loading { text-align: center; padding: 40px; color: #888; }
    .num-right { text-align: right; }
  </style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const SUPABASE_URL = 'SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY_HERE';
const GIS_CLIENT_ID = 'GIS_CLIENT_ID_HERE';
const AUTH_KEY = 'ca_auth';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('vi-VN');
}

function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function App() {
  const [user, setUser] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
  });

  const handleCredential = React.useCallback(async (resp) => {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${resp.credential}`);
    const info = await res.json();
    if (!info.email) return;
    const authUser = { email: info.email, name: info.name, picture: info.picture };
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  React.useEffect(() => {
    if (user) return;
    window.google?.accounts.id.initialize({ client_id: GIS_CLIENT_ID, callback: handleCredential });
    window.google?.accounts.id.renderButton(document.getElementById('g-btn'), { theme: 'outline', size: 'large' });
  }, [user, handleCredential]);

  if (!user) {
    return (
      <div className="login-wrap">
        <h2>Đăng nhập để xem báo cáo</h2>
        <div id="g-btn"></div>
      </div>
    );
  }
  return <Dashboard user={user} onLogout={() => { localStorage.removeItem(AUTH_KEY); setUser(null); }} />;
}

function Dashboard({ user, onLogout }) {
  const [startDate, setStartDate] = React.useState(daysAgo(30));
  const [endDate,   setEndDate]   = React.useState(today());
  const [location,  setLocation]  = React.useState('');
  const [locations, setLocations] = React.useState([]);
  const [shifts,    setShifts]    = React.useState(null);
  const [products,  setProducts]  = React.useState(null);
  const [loading,   setLoading]   = React.useState(false);

  React.useEffect(() => {
    db.from('locations').select('id,name').then(({ data }) => setLocations(data || []));
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      let q = db.from('shifts').select('*,locations(name)').gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
      if (location) q = q.eq('location_id', location);
      const { data: shiftData, error: e1 } = await q;
      if (e1) throw e1;

      const ids = (shiftData || []).map(s => s.id);
      let prods = [];
      if (ids.length) {
        const { data: pd, error: e2 } = await db.from('shift_products').select('*,products(name)').in('shift_id', ids);
        if (e2) throw e2;
        prods = pd || [];
      }
      setShifts(shiftData || []);
      setProducts(prods);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, location]);

  React.useEffect(() => { load(); }, [load]);

  const summary = React.useMemo(() => {
    if (!shifts) return null;
    return {
      totalSales: shifts.reduce((s, r) => s + Number(r.total_sales || 0), 0),
      totalExpenses: shifts.reduce((s, r) => s + Number(r.expenses || 0), 0),
      avgCashDiff: shifts.length ? shifts.reduce((s, r) => s + Number(r.cash_diff || 0), 0) / shifts.length : 0,
      count: shifts.length,
    };
  }, [shifts]);

  return (
    <div>
      <div className="header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h1>Báo cáo — Quản lý cửa hàng</h1>
          <span style={{ fontSize:12, opacity:.7 }}>{user.name} &nbsp;
            <button onClick={onLogout} style={{ background:'transparent', border:'1px solid #fff', color:'#fff', cursor:'pointer', padding:'2px 8px', borderRadius:4 }}>Đăng xuất</button>
          </span>
        </div>
      </div>
      <div className="container">
        <div className="filters">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span>→</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <select value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">Tất cả cơ sở</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button onClick={load}>{loading ? 'Đang tải...' : 'Áp dụng'}</button>
        </div>

        {loading && <div className="loading">Đang tải dữ liệu...</div>}

        {!loading && summary && (
          <div className="summary-cards">
            <div className="card"><div className="label">Tổng doanh thu</div><div className="value">{fmt(summary.totalSales)}</div></div>
            <div className="card"><div className="label">Tổng chi phí</div><div className="value">{fmt(summary.totalExpenses)}</div></div>
            <div className="card"><div className="label">Lệch tiền TB</div><div className="value">{fmt(Math.round(summary.avgCashDiff))}</div></div>
            <div className="card"><div className="label">Số ca</div><div className="value">{summary.count}</div></div>
          </div>
        )}

        {!loading && <ProductRevenue products={products} />}
        {!loading && <ShiftsTable shifts={shifts} />}
        {!loading && <CashDiscrepancy shifts={shifts} />}
      </div>
    </div>
  );
}

// Stub components — replaced in Tasks 10, 11, 12
function ProductRevenue() { return null; }
function ShiftsTable()    { return null; }
function CashDiscrepancy(){ return null; }

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
</body>
</html>
```

- [ ] **Step 2: Open `report.html` directly in browser (via file://)**

Sign in with a Google account that is in the `users` table. Verify:
- Summary cards show (all zeros since no real shifts yet).
- Locations dropdown populates with "Bình Tân" and "Quận 6".
- No console errors.

- [ ] **Step 3: Commit**

```bash
git add report.html
git commit -m "feat: report.html — auth, filter bar, summary cards"
```

---

## Task 10: report.html — Revenue by Product Section

**Files:**
- Modify: `report.html` — add `ProductRevenue` component

- [ ] **Step 1: Add `ProductRevenue` component before the `ReactDOM.createRoot` line**

```jsx
function ProductRevenue({ products }) {
  const rows = React.useMemo(() => {
    if (!products) return [];
    const map = {};
    products.forEach(sp => {
      const name = sp.products?.name || 'Unknown';
      if (!map[name]) map[name] = { name, revenue: 0, consumed: 0 };
      map[name].revenue  += Number(sp.revenue  || 0);
      map[name].consumed += Number(sp.consumed || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [products]);

  const maxRev = rows[0]?.revenue || 1;

  return (
    <div className="section">
      <h2>Doanh thu theo sản phẩm</h2>
      {!rows.length ? <p style={{color:'#888'}}>Chưa có dữ liệu</p> : (
        <table>
          <thead><tr>
            <th>Sản phẩm</th>
            <th className="num-right">Đã bán</th>
            <th className="num-right">Doanh thu (đ)</th>
            <th style={{width:120}}>Tỉ lệ</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="num-right">{fmt(r.consumed)}</td>
                <td className="num-right">{fmt(r.revenue)}</td>
                <td>
                  <div className="bar-wrap">
                    <div className="bar-fill" style={{ width: `${Math.round(r.revenue / maxRev * 100)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

After the previous test submit (Task 7 Step 4), the product table should show 1 row for "Bánh bao xúc xích phomai" with revenue = consumed × 20000.

- [ ] **Step 3: Commit**

```bash
git add report.html
git commit -m "feat: report.html — ProductRevenue section with bar chart"
```

---

## Task 11: report.html — Shifts Table Section

**Files:**
- Modify: `report.html` — add `ShiftsTable` component

- [ ] **Step 1: Add `ShiftsTable` component before `ReactDOM.createRoot`**

```jsx
function ShiftsTable({ shifts }) {
  if (!shifts) return null;

  const totalRow = {
    total_sales: shifts.reduce((s, r) => s + Number(r.total_sales || 0), 0),
    expenses:    shifts.reduce((s, r) => s + Number(r.expenses    || 0), 0),
    bank_sales:  shifts.reduce((s, r) => s + Number(r.bank_sales  || 0), 0),
    cash_diff:   shifts.reduce((s, r) => s + Number(r.cash_diff   || 0), 0),
  };

  return (
    <div className="section">
      <h2>Chi tiết ca làm việc</h2>
      {!shifts.length ? <p style={{color:'#888'}}>Chưa có dữ liệu</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr>
              <th>Ngày</th>
              <th>Cơ sở</th>
              <th>Nhân viên</th>
              <th className="num-right">Tổng DT</th>
              <th className="num-right">Chi phí</th>
              <th className="num-right">CK/NH</th>
              <th className="num-right">Lệch tiền</th>
              <th>Ghi chú</th>
            </tr></thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td>{s.locations?.name || '—'}</td>
                  <td>{s.staff_name}</td>
                  <td className="num-right">{fmt(s.total_sales)}</td>
                  <td className="num-right">{fmt(s.expenses)}</td>
                  <td className="num-right">{fmt(s.bank_sales)}</td>
                  <td className="num-right" style={{ color: Number(s.cash_diff) !== 0 ? '#c00' : 'inherit' }}>
                    {fmt(s.cash_diff)}
                  </td>
                  <td>{s.notes || ''}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#f0f0f0' }}>
                <td colSpan={3}>Tổng</td>
                <td className="num-right">{fmt(totalRow.total_sales)}</td>
                <td className="num-right">{fmt(totalRow.expenses)}</td>
                <td className="num-right">{fmt(totalRow.bank_sales)}</td>
                <td className="num-right">{fmt(totalRow.cash_diff)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

The shifts table should show the test shift from Task 7 with correct totals row.

- [ ] **Step 3: Commit**

```bash
git add report.html
git commit -m "feat: report.html — ShiftsTable section with totals row"
```

---

## Task 12: report.html — Cash Discrepancy Section

**Files:**
- Modify: `report.html` — add `CashDiscrepancy` component

- [ ] **Step 1: Add `CashDiscrepancy` component before `ReactDOM.createRoot`**

```jsx
function CashDiscrepancy({ shifts }) {
  const THRESHOLD = 50000;

  const rows = React.useMemo(() => {
    if (!shifts) return [];
    return [...shifts]
      .sort((a, b) => Math.abs(Number(b.cash_diff)) - Math.abs(Number(a.cash_diff)))
      .filter(s => s.cash_diff !== 0 && s.cash_diff !== null);
  }, [shifts]);

  return (
    <div className="section">
      <h2>Lệch tiền (theo mức độ)</h2>
      <p style={{ fontSize:12, color:'#888', marginBottom:8 }}>
        Đỏ = lệch &gt; {fmt(THRESHOLD)}đ. Chỉ hiển thị ca có lệch khác 0.
      </p>
      {!rows.length ? <p style={{color:'#888'}}>Không có ca nào lệch tiền trong khoảng thời gian này</p> : (
        <table>
          <thead><tr>
            <th>Ngày</th>
            <th>Cơ sở</th>
            <th>Nhân viên</th>
            <th className="num-right">Lệch tiền (đ)</th>
            <th>Ghi chú</th>
          </tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} className={Math.abs(Number(s.cash_diff)) > THRESHOLD ? 'red' : ''}>
                <td>{s.date}</td>
                <td>{s.locations?.name || '—'}</td>
                <td>{s.staff_name}</td>
                <td className="num-right" style={{ color: '#c00', fontWeight: 600 }}>{fmt(s.cash_diff)}</td>
                <td>{s.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Insert a test shift via curl with a non-zero `tien_cuoi` that doesn't match `tien_dau + total_sales - expenses`. Confirm the row appears in the discrepancy section.

- [ ] **Step 3: Commit**

```bash
git add report.html
git commit -m "feat: report.html — CashDiscrepancy section with threshold highlighting"
```

---

## Task 13: Deploy to GitHub Pages

**Files:**
- Modify: `sw.js` — confirm cache version bump from Task 1
- Modify: `CLAUDE.md` — create updated project docs

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# CLAUDE.md

## What this project is

Mobile-first PWA for shift inventory management at a small bakery (~2 locations, ~10 staff).
Staff use it on phones each shift to count stock, track sales, count cash, and hand over.

## Stack

| Layer | Tech |
|---|---|
| Frontend | `index.html` — React 18 via CDN + Babel standalone (no build step) |
| Auth | Google Identity Services (GIS) — client-side sign-in |
| CORS proxy / API | Cloudflare Worker (`worker/index.js`) |
| Database | Supabase (PostgreSQL + PostgREST) |
| Reports | `report.html` — React 18 via CDN + Supabase JS v2 via CDN |
| Hosting | GitHub Pages |
| Offline | PWA: `manifest.json` + `sw.js` (cache-first) |

## Deploy workflow

**Frontend** — push to `main`, GitHub Pages deploys automatically.
Always bump the cache version in `sw.js` when deploying changes to `index.html`.

**Worker** — from `worker/` directory:
```bash
wrangler deploy
```

**Supabase schema changes** — run SQL in Supabase SQL Editor. No migration tooling.

## IDs and endpoints

| Resource | Value |
|---|---|
| Worker URL | https://quanlycuahang.YOUR_SUBDOMAIN.workers.dev |
| Supabase project URL | https://YOUR_REF.supabase.co |
| GIS OAuth client ID | 570458211298-ogrk61hf89ou38l8q6lt9pba0qi2p969.apps.googleusercontent.com |

## Architecture

### Request flow

```
Browser → Cloudflare Worker → Supabase REST API (service_role key)
Browser → oauth2.googleapis.com/tokeninfo (direct, CORS-safe)
report.html → Supabase PostgREST (anon key, RLS: public read)
```

### Key files

- `index.html` — shift management PWA (staff-facing)
- `report.html` — reporting dashboard (manager-facing)
- `worker/index.js` — Cloudflare Worker (write proxy + read actions)
- `supabase/schema.sql` — full DB schema + RLS
- `supabase/seed.sql` — locations, products, users seed data

### Product indexing (critical)

`getProducts` returns all active products ordered by `sort_order ASC`.
Frontend assigns `idx` = position in this array.
`submitShift` payload uses `data.products[idx]` for per-product data.
Worker uses the same `sort_order ASC` query to resolve `idx → product_id`.
Never change `sort_order` values after seeding — it breaks existing cached state in browsers.
```

- [ ] **Step 2: Create GitHub repo and push**

```bash
git remote add origin https://github.com/YOUR_USERNAME/quanlycuahang-v2.git
git push -u origin main
```

- [ ] **Step 3: Enable GitHub Pages**

Go to GitHub repo → Settings → Pages → Source: `main` branch, root `/`. Save.
URL will be `https://YOUR_USERNAME.github.io/quanlycuahang-v2/`.

- [ ] **Step 4: Smoke test on GitHub Pages**

Open `https://YOUR_USERNAME.github.io/quanlycuahang-v2/` in mobile browser.
- Sign in with a whitelisted Google account.
- Confirm shift app loads and products appear.

Open `https://YOUR_USERNAME.github.io/quanlycuahang-v2/report.html`.
- Sign in.
- Confirm locations dropdown populates.
- Confirm test shift from Task 7 appears in the tables.

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md sw.js
git commit -m "docs: update CLAUDE.md for new Supabase stack"
git push
```
```
