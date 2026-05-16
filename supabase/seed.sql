-- Locations
INSERT INTO locations (name) VALUES ('Bình Tân'), ('Quận 6');

-- Products (sort_order matches allProducts index in index.html, 0-indexed)
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

-- Stock types per location.
-- Both locations start with the same 4 types. Add/remove rows per location as needed.
INSERT INTO stock_types (location_id, name, field_key, sort_order)
SELECT l.id, t.name, t.field_key, t.sort_order
FROM locations l
CROSS JOIN (VALUES
  ('H1',  'dau_h1',  0),
  ('H2',  'dau_h2',  1),
  ('Kho', 'dau_kho', 2),
  ('Hộp', 'dau_cu',  3)
) AS t(name, field_key, sort_order);

-- Users — add staff emails here (replace with real emails)
INSERT INTO users (email) VALUES
  ('tdtri281090@gmail.com');
