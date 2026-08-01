# Final Security Remediation Report

Closes every confirmed finding from the Final Independent Red Team Re-Validation
(`FINAL_RED_TEAM_REPORT.md` / `FINAL_SECURITY_SCORECARD.md`): the three exploits
**F-1 (High)**, **F-2 (Medium)**, **F-3 (Medium)**, and the five Low findings **F-4…F-8**.
Scope was strictly these findings — no features, no unrelated refactors. One DB migration
(applied to prod `haat-now-prod`), five client read repoints, and a regression suite.

## Fixes

### F-1 (HIGH) — `complete_delivery` caller authorization
The function verified only `orders.driver_id = p_driver_id`, so any customer who could see
an on-the-way order could force it `delivered` and trigger the driver payout. It now enforces:
- `auth.uid()` present;
- the caller **is** the assigned driver (`drivers.id = auth.uid()` **or** `owner_user_id = auth.uid()`) — i.e. `auth.uid()` matches `p_driver_id`;
- `p_driver_id` matches the order's assigned driver (`v_driver = p_driver_id`, unchanged);
- **only Ops Admin** (`is_ops_admin()`) may bypass.

Every other caller is rejected with `42501`. **Live proof:** a customer's
`complete_delivery(own_order, driver)` now raises; the assigned driver's call still succeeds
(order → `delivered`, one `driver_earnings` row).

### F-2 (MEDIUM) — `finalize_driver_delivery` bound to a real delivered order
The RPC let a driver reset their own `active_orders`/`status` with any `p_order_id`,
bypassing `drivers_guard`. It now requires **all** of:
- the caller owns the driver record (`id`/`owner_user_id = auth.uid()`), or is ops;
- `p_order_id` is a **real** order with `driver_id = p_driver_id` **and** `status = 'delivered'`.

**Live proof:** finalize with a fake/non-delivered order now raises; `active_orders` is
untouched by the rejected call.

### F-3 (MEDIUM) — merchant KYC/PII no longer world-readable
The `merchants_discovery_read USING(true)` policy exposed the whole row (tax number, CR
number, contacts, owner) to any authenticated user. Replaced with:
- **base table** `merchants`: SELECT restricted to owner + ops
  (`merchants_owner_admin_read`: `auth_is_admin() OR owner_user_id = auth.uid() OR id = auth.uid()`);
- **public-safe projection** `public.merchants_public` (view) exposing **only**
  `id, business_name, logo_url, business_type, tenant_id` — **never** tax number, registration
  number, contacts, or owner. Granted to `anon`/`authenticated` for storefront discovery.
- **Client repoints** (5 customer-facing reads → `merchants_public`, aliased back to
  `merchants` so no consumer contract changed): `catalog.repository`, `orders.repository`
  (order detail + list), `reviews.repository`, `merchant.repository.getMerchant`.

Admin/ops and merchant-owner reads are **unchanged** (they hit the base table and pass the
owner/admin policy). **Live proof:** a non-owner reading `merchants.tax_number` returns 0
rows; `merchants_public` returns the storefront row; the view has no sensitive column.

### F-4 (LOW) — no unauthenticated / client execution of maintenance & dispatch jobs
`EXECUTE` revoked from `anon`/`public` on `expire_dispatch_offers`, `recalc_driver_performance`,
`auto_dispatch_order`, `batch_auto_dispatch`, `reassign_order`, `generate_driver_settlement`,
`generate_merchant_settlement`, `submit_driver_application`; and from `anon`/`public`/`authenticated`
on `cron_dispatch_sweep`, `cron_daily_settlements`, `cron_payment_reconcile` (cron runs as the
scheduler/owner). Ops keeps `authenticated` where it legitimately calls these.

### F-5 (LOW) — always-true INSERT policies scoped
- `order_status_history`: insert only for the order's **customer**, its **assigned driver**, its **branch merchant**, or **ops**.
- `campaign_events`: non-order events, or events for the caller's **own** order only.
- `search_analytics`: a row may be attributed only to the caller (`customer_id = auth.uid()`) or left anonymous.

### F-6 (LOW) — public buckets no longer listable
Dropped the six `*_public_read` object-**listing** SELECT policies on `storage.objects`
(`avatars, banners, experience-assets, merchant-logos, offer-images, product-images`). Public
URL downloads (via `public = true`) are unaffected; `kyc-documents` remains private.

### F-7 (LOW) — function `search_path` pinned
`SET search_path = public, pg_temp` on all 13 flagged functions (verified: 13/13 now pinned).

### F-8 (LOW) — `pg_trgm` relocated
Moved out of `public` into the `extensions` schema (verified). `ilike` acceleration via
existing GIN indexes is unaffected.

## Files
- **Migration added:** `supabase/migrations/20260801000003_final_security_remediation.sql` (applied to prod; history reconciled to a single canonical row `20260801000003`).
- **Regression suite added:** `supabase/tests/final_security_remediation_regression.sql` (F-1…F-8).
- **App (F-3 repoints, read-only, contract-preserving via `merchants:merchants_public` alias):**
  `src/repositories/catalog.repository.ts`, `src/repositories/orders.repository.ts`,
  `src/repositories/reviews.repository.ts`, `src/repositories/merchant.repository.ts`.

## Verification
| Gate | Result |
|---|---|
| Migration apply (prod) | ✅ clean |
| F-1…F-8 regression (impersonated + structural, on prod) | ✅ **F-1..F-8 closed** |
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Architecture / demo-isolation | ✅ clean |
| Unit + integration tests | ✅ **777 pass / 0 fail** |
| Production build | ✅ |
| Guardian | ✅ **544 files · 0 cycles · 0 violations** |

**Live exploit re-checks (fresh, self-cleaned):** F-1 customer forgery → blocked (driver still
works); F-2 fake/non-delivered finalize → blocked; F-3 non-owner tax_number read → 0 rows,
discovery view intact; F-4 anon maintenance exec → revoked; F-5 → no always-true INSERT
remains; F-6 → 0 listing policies; F-7 → 13/13 pinned; F-8 → pg_trgm in `extensions`.

## Notes
- The `merchants_public` view is an intentional `SECURITY DEFINER`-style projection (it must
  bypass base RLS to serve the public storefront directory) and exposes only non-sensitive
  columns; the Supabase linter will report one expected `security_definer_view` WARN for it —
  this is the deliberate public projection, not a regression.
- No Red Team was re-run (per instructions). No deploy performed; database migration applied to
  prod consistent with prior hardening passes. Stop after remediation.
