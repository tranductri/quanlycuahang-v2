# CLAUDE.md

## What this project is

Mobile-first PWA for shift inventory management at a small bakery (~2 locations, ~10 staff).
Staff use it on phones each shift to count stock, track sales, count cash, and hand over.
`report.html` is a manager-facing dashboard for revenue and discrepancy reports.

## Stack

| Layer | Tech |
|---|---|
| Frontend | `index.html` — React 18 via CDN + Babel standalone (no build step) |
| Auth | Google Identity Services (GIS) — client-side sign-in |
| CORS proxy / API | Cloudflare Worker (`worker/index.js`) |
| Database | Supabase (PostgreSQL + PostgREST) |
| Reports | `report.html` — React 18 via CDN + Supabase JS v2 via CDN (no build step) |
| Hosting | GitHub Pages |
| Offline | PWA: `manifest.json` + `sw.js` (cache-first) |

## Deploy workflow

**Frontend** — push to `main`, GitHub Pages deploys automatically.
Always bump the cache version in `sw.js` (`kiem-ke-ca-vN`) when deploying changes to `index.html`.

**Worker** — from `worker/` directory:
```bash
wrangler deploy
```

**Supabase schema changes** — run SQL in Supabase SQL Editor. No migration tooling.

## IDs and endpoints

| Resource | Value |
|---|---|
| Worker URL | `https://quanlycuahang-v2.tdtri281090.workers.dev` |
| Supabase project URL | `https://YOUR_PROJECT_REF.supabase.co` (update after project creation) |
| GIS OAuth client ID | `570458211298-ogrk61hf89ou38l8q6lt9pba0qi2p969.apps.googleusercontent.com` |

## Architecture

### Request flow

```
Browser (index.html) → Cloudflare Worker → Supabase REST API (service_role key)
Browser → oauth2.googleapis.com/tokeninfo (direct, CORS-safe)
report.html → Supabase PostgREST (anon key, RLS: public read on all tables except users)
```

### Key files

| File | Purpose |
|---|---|
| `index.html` | Staff shift management PWA |
| `report.html` | Manager reporting dashboard |
| `sw.js` | Service worker — cache-first PWA offline |
| `worker/index.js` | Cloudflare Worker: CORS proxy + Supabase API |
| `worker/wrangler.toml` | Worker config — update `SUPABASE_URL` here |
| `supabase/schema.sql` | Full DB schema + RLS policies |
| `supabase/seed.sql` | Locations, products, product→location mapping, users |

### Product indexing (critical)

`getProducts` returns all active products ordered by `sort_order ASC`.
The frontend assigns `idx` = position in this array (0-based).
`submitShift` payload uses `data.products[idx]` for per-product data.
The Worker uses the same `sort_order ASC` query to resolve `idx → product_id`.

**Never change `sort_order` values after seeding** — it breaks existing cached browser state.

### Sheet columns (binh_tan / quan_6) — legacy reference

The old Google Sheets used **14 cols per product**: H1, H2, Kho, Hộp, Xuất, Nhập, Hư, KM, Chuyển, Cuối TT, Dự kiến, Lệch, Tiêu thụ, Doanh thu. The data migration script (`docs/superpowers/plans/2026-05-12-data-migration-sheets-to-supabase.md`) depends on this layout.

## Security notes

- `SUPABASE_SERVICE_KEY` is a wrangler secret — never committed to the repo
- `SUPABASE_ANON_KEY` is embedded in `report.html` (public). RLS uses `USING (true)` — anyone with the key can read shift data via the REST API directly. Accepted trade-off for this small bakery.
- OAuth app is in **testing mode** — only emails in Google Cloud Console "Test users" list can complete login

## Adding a new staff member

1. Add email to `users` table in Supabase
2. Add email to Google Cloud Console → OAuth consent screen → Test users

## Wrangler setup (first time)

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler secret put SUPABASE_SERVICE_KEY   # paste service_role key when prompted
# Update SUPABASE_URL in wrangler.toml, then:
wrangler deploy
```
