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

-- Opening stock types per location.
-- Each location defines its own set of opening stock positions (e.g. H1, H2, Kho, Hộp).
-- field_key maps to the frontend payload field name (dau_h1, dau_h2, dau_kho, dau_cu).
CREATE TABLE stock_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  field_key   text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  active      boolean DEFAULT true
);

CREATE TABLE shift_products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id         uuid REFERENCES shifts(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES products(id),
  position         int NOT NULL DEFAULT 0,
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

-- One row per stock type per product per shift.
CREATE TABLE shift_product_openings (
  shift_product_id uuid REFERENCES shift_products(id) ON DELETE CASCADE,
  stock_type_id    uuid REFERENCES stock_types(id),
  count            int NOT NULL DEFAULT 0,
  PRIMARY KEY (shift_product_id, stock_type_id)
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
ALTER TABLE locations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_locations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_types            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_product_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_cash             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;

-- report.html uses anon key — allow public read on all tables except users.
-- TRADE-OFF: anyone with the anon key (embedded in public report.html) can read
-- all shift data via the Supabase REST API. Accepted for this small bakery use case.
CREATE POLICY "public read" ON locations              FOR SELECT USING (true);
CREATE POLICY "public read" ON products               FOR SELECT USING (true);
CREATE POLICY "public read" ON product_locations      FOR SELECT USING (true);
CREATE POLICY "public read" ON stock_types            FOR SELECT USING (true);
CREATE POLICY "public read" ON shifts                 FOR SELECT USING (true);
CREATE POLICY "public read" ON shift_products         FOR SELECT USING (true);
CREATE POLICY "public read" ON shift_product_openings FOR SELECT USING (true);
CREATE POLICY "public read" ON shift_cash             FOR SELECT USING (true);
CREATE POLICY "public read" ON shift_expenses         FOR SELECT USING (true);
-- users table: no anon read (Worker uses service_role key which bypasses RLS)
