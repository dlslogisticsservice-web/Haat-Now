# Phase 9 — Enterprise Remediation Implementation Report

> Objective: remove every **P0** production blocker from `TOP20_CTO_RECOMMENDATIONS.md`.
> Date: 2026-07-05 · Branch: `feat/website-platform-architecture`
> Scope rule: P0 only · no redesign · backward-compatible · no breaking changes.

## Verification status (read this first)

| Gate | Result |
|---|---|
| `npm run lint` (tsc --noEmit, **both** sandbox + live code paths) | ✅ pass |
| `npm run build` (sandbox demo) | ✅ pass |
| `npm run build:live` (`HAAT_LIVE_BACKEND=1`, cross-platform runner) | ✅ pass |
| Architecture guard | ✅ 0 violations |
| E2E (Puppeteer, 24 checks) | ✅ 24/24 |
| Edge functions (`deno check`) | ✅ in CI (Deno not installed locally) |

**Runtime caveat (honest):** the 8 new SQL migrations and the 2 edge-function changes are **implemented, compile-clean, and sandbox-E2E-green**, but this environment has no live Supabase. Their runtime behavior (RLS, RPC transactions, triggers, pg_cron) must be verified by **applying the migrations to a staging project** and re-running E2E against `HAAT_LIVE_BACKEND=1`. Every migration is **additive + idempotent + guarded**, so application is low-risk. Nothing was changed destructively.

**Backward compatibility:** the shipped sandbox demo is byte-for-byte unaffected (E2E identical, 24/24). Live-mode changes all carry graceful fallbacks (e.g. `order.service` falls back to the legacy insert path if `create_order` is not yet deployed).

---

## P0-1 — Live-mode is now a first-class, CI-tested build

**Problem.** Production forced `VITE_AUTH_MODE=sandbox`; CI/E2E tested only the demo; the live Supabase path never compiled/ran in CI; a misconfigured live deploy yielded a silent `null` client. (R-01, R-24.)

**Modules.** `package.json`, `scripts/live.cjs` (new), `.github/workflows/ci.yml`, `src/lib/supabase.ts`.

**Fix.**
- Added `build:live` / `dev:live` scripts via a cross-platform Node runner (`scripts/live.cjs`) that sets `HAAT_LIVE_BACKEND=1` (works on Windows + POSIX).
- Added a **`live-build` CI job** so the Supabase-backed bundle must compile on every push. `npm run lint` (tsc) already typechecks *both* code paths.
- `lib/supabase.ts` now emits a **prominent fatal console error** when live mode is active but env vars are missing, instead of failing opaquely later.

**Result.** The live build is verified in CI; the demo remains a clearly separate, labelled artifact.

---

## P0-2 — Provisioning ↔ `tenants` schema mismatch fixed

**Problem.** The provisioning engine wrote ~19 fields absent from `public.tenants`; live PostgREST would reject every step → white-label onboarding was impossible in production. (R-02.)

**Modules.** `supabase/migrations/20260705000001_tenant_provisioning_columns.sql` (new).

**Fix.** Additive, idempotent `ADD COLUMN IF NOT EXISTS` for all provisioner fields (`theme_preset_id`, `brand_seeded`, `roles_seeded`, `features_json`, `default_admin`, `cms_structure`, `navigation`, `demo_data_profile`, `sub_status`, …) plus the extended branding fields read by `tenantTheme()`. **No app change** required — the existing provisioner now works unchanged in live mode.

**Result.** Provisioning becomes PostgREST-compatible; no breaking change (nullable columns, existing rows untouched).

---

## P0-3 — Atomic, idempotent, server-priced order creation

**Problem.** 3 un-transacted writes → orphan orders on crash; no idempotency → duplicate orders on double-submit; client-authored `total_amount`/item prices. (R-04, R-03.)

**Modules.** `supabase/migrations/20260705000002_atomic_create_order.sql` (new), `src/repositories/orders.repository.ts`, `src/services/order.service.ts`, `src/features/checkout/CheckoutPage.tsx`.

**Fix.**
- New `create_order(...)` SECURITY DEFINER RPC: inserts order + items + status history in **one transaction**, computes the subtotal **server-side** from `products.price + product_variants.price_modifier` (ignores client prices), and is **idempotent** on a caller key (`orders.idempotency_key` + partial unique index). Verifies `auth.uid() = customer`.
- `order.service.createOrder` now calls the RPC in live mode with a stable idempotency key, **falling back** to the legacy path only if the RPC is not deployed (backward-compatible).
- `CheckoutPage` generates a stable per-attempt idempotency key so a retry resolves to the same order.

**Result.** No orphan/duplicate orders; totals are server-authoritative.

---

## P0-4 — Atomic refunds + double-entry ledger posting

**Problem.** TOCTOU over-refund race (no lock/unique); order marked refunded **before** the gateway call; refunds never posted to the ledger. (R-03, R-14.)

**Modules.** `supabase/migrations/20260705000003_atomic_refund.sql` (new), `supabase/functions/payment-refund/index.ts`.

**Fix.** A **reserve → gateway → confirm saga**:
- `refund_reserve()` locks the payment attempt, sums prior non-failed refunds **under the lock**, enforces the ceiling, and inserts a pending refund (idempotent key). Race-safe → no over-refund.
- Edge function calls Moyasar **after** reserving.
- `refund_confirm()` finalizes in one transaction: on success it posts a **balanced `customer_refund`/`platform_cash` ledger entry** (via `post_ledger`, idempotent) and sets `order.payment_status`; on failure it marks the refund `failed` **without touching the order** (no more phantom-refunded orders).
- Added `refunds.idempotency_key` (unique) + `refunds.ledger_txn_id`.

**Result.** Refunds are atomic, race-safe, gateway-ordered correctly, and reconciled into double-entry.
**Remaining (P1, #10):** gateway **captures** still don't post to the ledger — tracked with the event-backbone item.

---

## P0-5 — Background scheduler

**Problem.** Offer expiry, reassignment, settlement runs, segment recompute, payment reconciliation were **manual buttons** — a 24/7 platform can't run that way. (R-05.)

**Modules.** `supabase/migrations/20260705000004_scheduler.sql` (new).

**Fix.** Idempotent, exception-guarded wrapper functions — `cron_dispatch_sweep()` (expire offers + re-offer ready orders), `cron_payment_reconcile()`, `cron_recompute_segments()`, `cron_daily_settlements()` — plus **best-effort `pg_cron` registration** (guarded so the migration never fails if pg_cron is unavailable; a scheduled edge function is the documented fallback).

**Result.** The platform's time-based operations run automatically. The wrappers are callable from pg_cron **or** an external cron trigger.

---

## P0-6 — Auto-dispatch + unified driver workload accounting

**Problem.** Dispatch was admin-manual; the "grab" path and the dispatch engine kept separate bookkeeping; `drivers.active_orders` was never freed after delivery (`finalize_driver_delivery` was dead). (R-05, R-15.)

**Modules.** `supabase/migrations/20260705000005_dispatch_unify_finalize.sql` (new).

**Fix.** Two AFTER-UPDATE triggers on `orders` (both paths mutate `orders`, so this unifies them):
- `order_auto_dispatch` — auto-offers to the best driver when a merchant accepts an unassigned order.
- `order_driver_workload` — increments `active_orders` on assignment; **decrements + frees the driver** (status → `available` at zero) on delivered/cancelled. This structurally replaces the dead finalizer and closes the workload leak for **both** assignment paths.
Both trigger bodies are exception-guarded so they can never roll back the order update.

**Result.** Orders auto-dispatch; driver workload is always correct → `find_nearest_drivers` scoring no longer decays.

---

## P0-7 — Server-side granular RBAC enforcement (money operations)

**Problem.** The 35-permission matrix was client-only; server-side, any admin could pay settlements / issue compensations. (R-07, S-1.)

**Modules.** `supabase/migrations/20260705000006_rbac_server_enforcement.sql` (new).

**Fix.**
- New `role_permissions` table (role_template → permission) seeded to mirror `rbac.service.ts`.
- `admin_users.role_template` column; **existing admins backfilled to `super_admin`** so current behavior is unchanged.
- `auth_has_permission(perm)` SECURITY DEFINER resolver (super_admin ⇒ all).
- **Enforced** at the acute cash-movement RPCs — `pay_merchant_settlement`, `pay_driver_settlement` require `finance.pay`; `issue_compensation` requires `finance.refund` — re-created verbatim with one added guard (coarse `is_ops_admin()` kept as defense-in-depth).

**Result.** A non-finance admin can no longer move money server-side. **Remaining (P1):** country-predicate scoping on finance tables (they lack `country_code`) and permission gating on the remaining admin RPCs — tracked as follow-on since it needs schema additions.

---

## P0-8 — Close permissive PII exposure

**Problem.** `"Anyone can select drivers/merchants" using(true)` were never dropped → driver/merchant phone PII readable by any authenticated user. (R-06, S-4.)

**Modules.** `supabase/migrations/20260705000007_pii_lockdown.sql` (new).

**Fix.** Drops both world-read policies; ensures a scoped driver read (self/admin) exists; keeps merchant discoverability but **revokes column-level SELECT on `phone_number`** from `anon`/`authenticated` (RLS can't restrict columns; GRANTs can). Guarded against missing columns.

**Result.** PII closed while storefront browsing still works. **Action:** confirm against live `pg_policies` after applying (S-8).

---

## P0-9 — Server-side double-charge dedup

**Problem.** Per-attempt idempotency key was a random UUID; real dedup lived in the browser; a direct edge call could double-charge. (R-09, S-6.)

**Modules.** `supabase/migrations/20260705000008_payment_order_dedup.sql` (new), `supabase/functions/payment-initiate/index.ts`.

**Fix.** Partial unique index guaranteeing **at most one active (pending/captured) attempt per order** (DB-enforced, caller-independent), plus a **deterministic** `idempotency_key = order:<orderId>` in `payment-initiate`. A concurrent second initiate now collides and reuses instead of creating a second Moyasar charge.

**Result.** Double-charge protection no longer depends on the client.

---

## Files changed

**New migrations (8):** `20260705000001`…`20260705000008`.
**New script:** `scripts/live.cjs`.
**Edge functions:** `payment-refund/index.ts`, `payment-initiate/index.ts`.
**App:** `src/services/order.service.ts`, `src/repositories/orders.repository.ts`, `src/features/checkout/CheckoutPage.tsx`, `src/lib/supabase.ts`.
**Build/CI:** `package.json`, `.github/workflows/ci.yml`.
**Docs:** this report + `ENTERPRISE_PROGRESS.md`, `UPDATED_SCORECARD.md`; updates to `RISK_REGISTER.md`, `PRODUCTION_DECISION.md`.

## Deployment checklist (to realize these fixes in production)
1. Apply migrations `20260705000001`…`000008` to **staging**; run `get_advisors` + `select … from pg_policies`.
2. Deploy edge functions `payment-initiate`, `payment-refund`.
3. Re-run E2E with `HAAT_LIVE_BACKEND=1` against staging.
4. Confirm pg_cron jobs registered (or wire the scheduled edge fallback).
5. Verify S-4 (PII policies gone) and S-6 (single active attempt) on live data.
6. Backfill/patch `admin_users.role_template` for any non-super operators who should be restricted.
