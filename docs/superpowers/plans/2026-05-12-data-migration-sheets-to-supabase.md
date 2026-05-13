# Data Migration — Google Sheets → Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all historical shift data from the existing Google Sheets (`binh_tan`, `quan_6`, `binh_tan_chi_phi`, `quan_6_chi_phi`) into the new Supabase database by posting each row through the new Cloudflare Worker.

**Architecture:** A temporary GAS script (`migrate.gs`) is added to the existing old clasp project, run once from the GAS console, then removed. The script reads each sheet row, reconstructs the JSON payload format the Worker expects, and calls the new Worker's POST endpoint. The Worker handles all Supabase insertions — no direct Supabase calls needed from GAS.

**Tech Stack:** Google Apps Script (temporary, read from old project), Cloudflare Worker (new, already deployed), Supabase (destination).

**Prerequisite:** Complete the backend migration plan (`2026-05-12-backend-migration-supabase.md`) through Task 8 (Worker deployed) before running this migration.

---

## Critical: Product Index Mapping

This is the most important thing to understand before reading the code.

The Worker's `submitShift` expects `data.products` indexed by **global allProducts position** (`p.idx`). The Google Sheets store products in **locIdx order** (position within the location's filtered product list).

| Location | Products in sheet (locIdx order) | Global allProducts index |
|---|---|---|
| Bình Tân | All 20, locIdx 0–19 | idx = locIdx (same) |
| Quận 6 | 11 products, locIdx 0–10 | locIdx 0–7 → idx 0–7; locIdx 8 → idx 17; locIdx 9 → idx 18; locIdx 10 → idx 19 |

The migration script must convert locIdx → global idx for Quận 6 before building the payload.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `migrate.gs` | Create in **old** clasp project directory | One-time migration script — remove after running |

---

## Task 1: Write the Migration Script

**Files:**
- Create: `migrate.gs` in the **old project** directory (alongside `Code.gs`)

- [ ] **Step 1: Write `migrate.gs`**

```js
// migrate.gs — add to OLD clasp project, run once, then delete
// Prerequisites: new Worker must be deployed (Task 8 of main plan)

var NEW_WORKER_URL = 'https://quanlycuahang.YOUR_SUBDOMAIN.workers.dev';
var SPREADSHEET_ID = '1EfEAvuYPyf3GWVbi7egfR6SI3riNKPsCiVW0OFZLpg8';
var DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

// Global allProducts indices for each location's locIdx
// Bình Tân: 20 products, locIdx == global idx
var BINH_TAN_GLOBAL = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19];
// Quận 6: 11 products — locIdx 8,9,10 map to global 17,18,19
var QUAN_6_GLOBAL   = [0,1,2,3,4,5,6,7,17,18,19];

function parseDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  }
  var s = String(val).trim();
  // "dd/MM/yyyy" → "yyyy-MM-dd"
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
  return s; // already ISO or unknown — pass through
}

function buildChiPhiMap(ss) {
  var map = {};
  ['binh_tan_chi_phi', 'quan_6_chi_phi'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    var rows = sheet.getDataRange().getValues().slice(1); // skip header row
    rows.forEach(function(row) {
      // Columns: Timestamp, Ngày, Vị trí, Tên, Loại chi phí, Ghi chú, Số tiền
      var ngay   = parseDate(row[1]);
      var vi_tri = String(row[2] || '').trim();
      var ten    = String(row[3] || '').trim();
      var key    = ngay + '|' + vi_tri + '|' + ten;
      if (!map[key]) map[key] = [];
      var amount = Number(row[6]) || 0;
      if (amount > 0) {
        map[key].push({
          type: String(row[4] || ''),
          note: String(row[5] || ''),
          amount: amount,
        });
      }
    });
  });
  return map;
}

function parseProductData(row, base) {
  var cuoi_thuc = row[base + 9];
  return {
    dau_h1:    Number(row[base])     || 0,
    dau_h2:    Number(row[base + 1]) || 0,
    dau_kho:   Number(row[base + 2]) || 0,
    dau_cu:    Number(row[base + 3]) || 0,
    xuat:      Number(row[base + 4]) || 0,
    nhap:      Number(row[base + 5]) || 0,
    hu:        Number(row[base + 6]) || 0,
    km:        Number(row[base + 7]) || 0,
    chuyen:    Number(row[base + 8]) || 0,
    cuoi_thuc: (cuoi_thuc !== '' && cuoi_thuc !== null && cuoi_thuc !== undefined)
                 ? Number(cuoi_thuc) : undefined,
  };
}

function migrateSheet(ss, sheetName, vi_tri, globalIndices, chiPhiMap) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('Sheet not found: ' + sheetName);
    return { ok: 0, fail: 0 };
  }

  var allRows = sheet.getDataRange().getValues();
  var dataRows = allRows.slice(3); // skip 3 header rows
  var numLocProducts = globalIndices.length;
  var denomStart     = 4 + numLocProducts * 14;
  var summaryStart   = denomStart + DENOMS.length * 3;

  var ok = 0, fail = 0;

  dataRows.forEach(function(row, i) {
    // Skip empty rows
    if (!row[0] && !row[1] && !row[3]) return;

    try {
      var ngay   = parseDate(row[1]);
      var ten    = String(row[3] || '').trim();

      // Build products array indexed by global allProducts position (length 20)
      var products = new Array(20);
      globalIndices.forEach(function(globalIdx, locIdx) {
        var base = 4 + locIdx * 14;
        products[globalIdx] = parseProductData(row, base);
      });

      // Denomination counts
      var tien_dau = {}, tien_cuoi = {}, cat_dt = {};
      DENOMS.forEach(function(d, j) {
        tien_dau[d]  = Number(row[denomStart + j])                   || 0;
        tien_cuoi[d] = Number(row[denomStart + DENOMS.length + j])   || 0;
        cat_dt[d]    = Number(row[denomStart + DENOMS.length * 2 + j]) || 0;
      });

      // Summary: tongDau[0], tongCuoi[1], chiPhi[2], dtNH[3], totalRev[4],
      //          lechTien[5], tongCat[6], conLai[7], ghi_chu[8]
      var chi_phi = Number(row[summaryStart + 2]) || 0;
      var dt_nh   = Number(row[summaryStart + 3]) || 0;
      var ghi_chu = String(row[summaryStart + 8] || '');

      // Match expense line items from chi_phi sheets
      var chiPhiKey   = ngay + '|' + vi_tri + '|' + ten;
      var chi_phi_items = chiPhiMap[chiPhiKey] || [];

      var payload = {
        vi_tri:       vi_tri,
        ngay:         ngay,
        ten:          ten,
        products:     products,
        tien_dau:     tien_dau,
        tien_cuoi:    tien_cuoi,
        cat_dt:       cat_dt,
        chi_phi:      chi_phi,
        dt_nh:        dt_nh,
        ghi_chu:      ghi_chu,
        chi_phi_items: chi_phi_items,
      };

      var resp = UrlFetchApp.fetch(NEW_WORKER_URL, {
        method:      'post',
        contentType: 'application/json',
        payload:     JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      var result = JSON.parse(resp.getContentText());
      if (result.success) {
        ok++;
      } else {
        fail++;
        Logger.log('[FAIL] ' + sheetName + ' row ' + (i + 4) + ': ' + result.error);
      }

      Utilities.sleep(300); // stay well under UrlFetchApp quota
    } catch(e) {
      fail++;
      Logger.log('[ERR] ' + sheetName + ' row ' + (i + 4) + ': ' + e.toString());
    }
  });

  Logger.log(sheetName + ' → ' + ok + ' ok, ' + fail + ' failed');
  return { ok: ok, fail: fail };
}

function migrateAll() {
  var ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
  var chiPhiMap = buildChiPhiMap(ss);

  Logger.log('Chi phí map entries: ' + Object.keys(chiPhiMap).length);
  Logger.log('Starting Bình Tân...');
  var bt = migrateSheet(ss, 'binh_tan', 'Bình Tân', BINH_TAN_GLOBAL, chiPhiMap);

  Logger.log('Starting Quận 6...');
  var q6 = migrateSheet(ss, 'quan_6',   'Quận 6',   QUAN_6_GLOBAL,   chiPhiMap);

  Logger.log('=== Done: ' + (bt.ok + q6.ok) + ' ok, ' + (bt.fail + q6.fail) + ' failed ===');
}

// Run a single test row before migrating everything
function migrateTest() {
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('binh_tan');
  if (!sheet || sheet.getLastRow() < 4) {
    Logger.log('No data rows in binh_tan');
    return;
  }
  // Read just the first data row (row index 3 = 4th row, after 3 header rows)
  var rows = sheet.getDataRange().getValues();
  var firstDataRow = rows[3];
  Logger.log('First row sample: ngay=' + firstDataRow[1] + ', ten=' + firstDataRow[3]);

  var chiPhiMap = buildChiPhiMap(ss);
  var numLocProducts = BINH_TAN_GLOBAL.length;
  var denomStart   = 4 + numLocProducts * 14;
  var summaryStart = denomStart + DENOMS.length * 3;

  var products = new Array(20);
  BINH_TAN_GLOBAL.forEach(function(globalIdx, locIdx) {
    products[globalIdx] = parseProductData(firstDataRow, 4 + locIdx * 14);
  });

  var tien_dau = {}, tien_cuoi = {}, cat_dt = {};
  DENOMS.forEach(function(d, j) {
    tien_dau[d]  = Number(firstDataRow[denomStart + j])                   || 0;
    tien_cuoi[d] = Number(firstDataRow[denomStart + DENOMS.length + j])   || 0;
    cat_dt[d]    = Number(firstDataRow[denomStart + DENOMS.length * 2 + j]) || 0;
  });

  var ngay   = parseDate(firstDataRow[1]);
  var ten    = String(firstDataRow[3] || '');
  var payload = {
    vi_tri:        'Bình Tân',
    ngay:          ngay,
    ten:           ten,
    products:      products,
    tien_dau:      tien_dau,
    tien_cuoi:     tien_cuoi,
    cat_dt:        cat_dt,
    chi_phi:       Number(firstDataRow[summaryStart + 2]) || 0,
    dt_nh:         Number(firstDataRow[summaryStart + 3]) || 0,
    ghi_chu:       String(firstDataRow[summaryStart + 8] || ''),
    chi_phi_items: chiPhiMap[ngay + '|Bình Tân|' + ten] || [],
  };

  Logger.log('Test payload: ' + JSON.stringify(payload).substring(0, 500));

  var resp = UrlFetchApp.fetch(NEW_WORKER_URL, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  Logger.log('Response: ' + resp.getContentText());
}
```

- [ ] **Step 2: Update `NEW_WORKER_URL`**

Replace `YOUR_SUBDOMAIN` with the actual Cloudflare subdomain from Task 8 of the main plan.

- [ ] **Step 3: Push `migrate.gs` to old GAS project**

From the old project directory (where `Code.gs` and `.clasp.json` live):

```bash
clasp push --force
```

Expected output: lists all files including `migrate.gs`. The existing `Code.gs` deployment is NOT affected — `clasp push` only updates the script source, not the deployment.

---

## Task 2: Test Migration with One Row

**Files:** no changes — run from GAS console

- [ ] **Step 1: Run `migrateTest()` in GAS console**

1. Open [script.google.com](https://script.google.com) → open the old project.
2. Select function `migrateTest` from the dropdown.
3. Click Run.
4. Open **Execution log** (View → Logs).

Expected log output:
```
First row sample: ngay=<date>, ten=<staff name>
Test payload: {"vi_tri":"Bình Tân","ngay":"2026-xx-xx","ten":"...","products":[...
Response: {"success":true,"message":"Đã lưu ca thành công!"}
```

- [ ] **Step 2: Verify in Supabase Table Editor**

Open Supabase → Table Editor:
- `shifts` table: 1 new row with correct `date`, `location_id`, `staff_name`, `total_sales`, `cash_diff`.
- `shift_products` table: rows for that shift, correct `revenue` values.
- `shift_cash` table: 27 rows for that shift (9 denominations × 3 types).
- `shift_expenses` table: rows if the test shift had expense items.

- [ ] **Step 3: Delete the test row before running full migration**

In Supabase Table Editor → `shifts` → delete the test row. Because `shift_products` and `shift_cash` use `ON DELETE CASCADE`, deleting the shift row removes all related rows automatically.

---

## Task 3: Run Full Migration

**Files:** no changes — run from GAS console

- [ ] **Step 1: Run `migrateAll()` in GAS console**

1. Select function `migrateAll` from the dropdown.
2. Click Run. This will take several minutes (300ms sleep per row × number of rows).
3. Watch the execution log.

Expected log:
```
Chi phí map entries: <N>
Starting Bình Tân...
binh_tan → <N> ok, 0 failed
Starting Quận 6...
quan_6 → <N> ok, 0 failed
=== Done: <total> ok, 0 failed ===
```

If any rows fail, the log shows the row number and error. Fix and re-run only those rows manually (or re-run `migrateAll` — duplicate detection is NOT built in, so fix errors before re-running to avoid duplicates).

- [ ] **Step 2: Verify row counts in Supabase**

Run these queries in Supabase SQL Editor:

```sql
-- Total shifts per location
SELECT l.name, COUNT(*) as shift_count
FROM shifts s JOIN locations l ON s.location_id = l.id
GROUP BY l.name;

-- Compare against Google Sheets row count:
-- binh_tan sheet last row minus 3 header rows = expected count
-- quan_6 sheet last row minus 3 header rows = expected count

-- Total revenue sanity check
SELECT l.name, SUM(total_sales) as total_revenue
FROM shifts s JOIN locations l ON s.location_id = l.id
GROUP BY l.name;
-- Compare this against the SUM of the "Tổng DT" column in each Google Sheet

-- Expense items migrated
SELECT COUNT(*) FROM shift_expenses;

-- Shifts with no products (data issue)
SELECT s.id, s.date, l.name
FROM shifts s JOIN locations l ON s.location_id = l.id
LEFT JOIN shift_products sp ON sp.shift_id = s.id
WHERE sp.id IS NULL;
-- Expected: 0 rows
```

- [ ] **Step 3: Spot-check a specific shift**

Pick a shift from the Google Sheet (note its date and staff name). Query it in Supabase:

```sql
SELECT s.*, l.name as location
FROM shifts s JOIN locations l ON s.location_id = l.id
WHERE s.date = '2026-05-01' AND s.staff_name = 'Tên nhân viên'
LIMIT 1;
```

Compare `total_sales`, `cash_diff`, `expenses` against the values in the original Google Sheet row.

---

## Task 4: Cleanup

- [ ] **Step 1: Remove `migrate.gs` from old project directory**

```bash
rm migrate.gs
clasp push --force
```

Verify in script.google.com that `migrate.gs` no longer appears in the project.

- [ ] **Step 2: Confirm `report.html` shows historical data**

Open `report.html` in browser. Set date range to cover historical data. Confirm:
- Summary cards show non-zero totals.
- Revenue by product table is populated.
- Shifts table shows historical shifts.
- Cash discrepancy section shows shifts with non-zero `cash_diff`.

- [ ] **Step 3: Commit**

```bash
# In the NEW project repo
git add docs/superpowers/plans/2026-05-12-data-migration-sheets-to-supabase.md
git commit -m "docs: add data migration plan (Google Sheets → Supabase)"
```

---

## Troubleshooting

**"Unknown location: Bình Tân"** — The `locations` table was not seeded. Run `supabase/seed.sql` first.

**"Unknown location: Quận 6"** — Same. Check the exact name in the sheet matches the `locations` table exactly (watch for trailing spaces or different Unicode).

**Revenue totals don't match** — The Worker recomputes `tieu_thu` and `revenue` from raw counts. If `cuoi_thuc` is present, it uses the actual count; otherwise it uses `xuat`. The sheet's stored `Tiêu thụ` value may differ if data was entered differently. This is expected — the recomputed values are more accurate.

**Duplicate rows after re-running** — Supabase has no deduplication. If you re-run `migrateAll` after a partial run, you will get duplicate shifts. Before re-running: delete all migrated shifts with `DELETE FROM shifts WHERE created_at > 'YYYY-MM-DD'`.

**GAS execution timeout** — GAS scripts time out after 6 minutes. If you have many rows, split the migration:
```js
// Migrate only Bình Tân first
function migrateBinhTan() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var map = buildChiPhiMap(ss);
  migrateSheet(ss, 'binh_tan', 'Bình Tân', BINH_TAN_GLOBAL, map);
}
// Then run migrateQuan6 separately
function migrateQuan6() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var map = buildChiPhiMap(ss);
  migrateSheet(ss, 'quan_6', 'Quận 6', QUAN_6_GLOBAL, map);
}
```
