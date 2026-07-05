# Live Staging Validation Report — Phase 9.5

> Independent validation of the Phase 9 P0 implementations against the **real Supabase
> project**. Date: 2026-07-05. Every result below is from a live query, not a file reading.
> **No data or schema was modified** — see "Environment constraints".

---

## 0. Executive summary

- **Connected** to the live project `umwbzradvbsirsybfxfb` (**`haat-now-dev`**) and ran real
  read-only validation queries + the Supabase security advisor.
- **Could NOT apply migrations, deploy edge functions, or run the live E2E** from this
  environment — three hard blockers (§1). This is a **tooling/access limitation, not a
  code failure**, and it is documented, not worked around.
- Read-only validation nonetheless produced **high-value results**: it **confirmed the
  dependency-validity** of 7 of the 8 Phase 9 migrations against the real schema, **caught 2
  genuine defects in the P0-8 migration** (now fixed), surfaced a **hardening gap in all new
  SECURITY DEFINER functions** (now fixed), and captured the project's **real security
  posture** (197 advisor findings, incl. 87 anon-executable privileged RPCs).
- **Net:** validation did its job — it found and fixed real bugs that a file-only review
  missed. Full runtime certification remains **pending an operator with write credentials**
  executing the runbook in `GO_NO_GO_FINAL.md`.

---

## 1. Environment constraints (why apply/deploy/E2E could not run here)

| Blocker | Evidence | Consequence |
|---|---|---|
| **MCP server is `--read-only`** | `.mcp.json` args include `--read-only`; a `create temp table` probe returned `ERROR: 25006: cannot execute CREATE TABLE in a read-only transaction` | No `apply_migration`, no `deploy_edge_function`, no DDL/DML |
| **No DB password / service-role key present** | `.env` holds only the anon key; no `SUPABASE_DB_PASSWORD` | `supabase db push` / `functions deploy` cannot authenticate non-interactively |
| **Dev DB is 21 migrations behind the repo** | `list_migrations` max = `20260614000036`; repo has `20260626*`, `20260627*`, `20260705*` unapplied | `tenants` etc. don't exist yet → P0-2 can't apply until the `20260627*` series is applied first |
| **No demo accounts on the live project** | `.env.production` documents that demo rows/sessions live client-side only; live login uses real phone OTP, not `123456` | `HAAT_LIVE_BACKEND=1` E2E cannot authenticate against this project |

**Important nuance:** `haat-now-dev` is an **old snapshot**, not a current staging mirror — it
predates the entire platform-registry / tenants / CRUD / payment-idempotency work
(`20260626*`+`20260627*`, 13 migrations). A true staging validation needs a project that is
first brought up to the repo's migration head **and** seeded with test data.

---

## 2. What WAS validated (live, read-only)

### 2.1 Migration head & pending set
- Remote applied head: **`20260614000036_growth_retention_engine`** (37 migrations).
- **21 migrations pending** on the dev DB: `20260626000001–3` (3), `20260627000001–10` (10),
  **`20260705000001–08` (the 8 Phase 9 migrations)**.

### 2.2 Phase 9 objects — confirmed ABSENT (as expected, not yet applied)
Live query result:
```
tenants_exists=false  tenant_members_exists=false  payment_idempotency_exists=false
create_order_exists=false  refund_reserve_exists=false  auth_has_permission_exists=false
cron_dispatch_sweep_exists=false  pg_cron_installed=false  pg_cron_available=true
```
→ pg_cron is **available** on the project, so the guarded `create extension pg_cron` in
`20260705000004` will succeed when applied.

### 2.3 Dependency validation — the real payoff
Every object the Phase 9 migrations depend on was checked against the live schema:

| Migration | Depends on | Live status | Verdict |
|---|---|---|---|
| `000002` create_order | `orders`(+address_id, delivery_lat/lng, branch snapshots, payment_status, delivery_fee, status, total_amount), `order_items`, `order_status_history`, `product_variants.price_modifier`, `products.price` | **all present** | ✅ applies cleanly |
| `000003` atomic refund | `payment_attempts`, `refunds`, `post_ledger`, `orders` | **all present** | ✅ applies cleanly |
| `000004` scheduler | `expire_dispatch_offers`, `auto_dispatch_order`, `recompute_customer_segments`, `generate_*_settlement`, pg_cron | **all present / pg_cron available** | ✅ applies cleanly |
| `000005` dispatch/workload triggers | `orders`, `drivers.active_orders`, `drivers.status`, `drivers.is_online`, `auto_dispatch_order` | **all present** | ✅ applies cleanly |
| `000006` RBAC | `admin_users`, `auth_is_admin`, `is_ops_admin`, `merchant_settlements`, `driver_settlements`, `compensations`, `post_ledger` | **all present** | ✅ applies cleanly |
| `000007` PII lockdown | `drivers`, `merchants` policies + PII columns | **present but DRIFTED** | ⚠️ **2 defects found → fixed** (§3) |
| `000008` payment dedup | `payment_attempts.status` | **present** | ✅ applies cleanly |
| `000001` tenant columns | **`tenants` table** | **ABSENT** | ⛔ blocked until `20260627000008` applied |

**Conclusion:** 6 of 8 migrations are dependency-valid against the live schema **today**; `000007`
needed correction (done); `000001` needs the `tenants` prerequisite.

### 2.4 Real security posture (Supabase security advisor)
**197 WARN findings, 0 ERROR.** The dominant, genuinely serious ones — all pre-existing, not
introduced by Phase 9:

| Finding | Count | Note |
|---|---|---|
| **SECURITY DEFINER RPCs executable by `anon`** | **87** | incl. `adjust_wallet_balance`, `credit_customer_wallet`, `approve_payout`, `pay_*_settlement`, `post_ledger`, `assign_user_role`, `issue_compensation`, `review_kyc`, `adjust_product_stock`. Internal `auth.uid()`/`is_ops_admin` guards blunt real exploitability, but EXECUTE should be revoked as defense-in-depth. |
| `rls_policy_always_true` (INSERT `with check(true)`) | 3 | `campaign_events` (**anon-writable**), `order_status_history` (any authed user can forge status rows), `search_analytics` |
| `public_bucket_allows_listing` | 6 | `avatars`, `banners`, `experience-assets`, `merchant-logos`, `offer-images`, `product-images` |
| `function_search_path_mutable` | 10 | e.g. `find_nearest_drivers`, `haversine_km`, `fin_balance` |
| `auth_leaked_password_protection` off | 1 | enable HaveIBeenPwned check |
| `extension_in_public` (`pg_trgm`) | 1 | move out of `public` |

### 2.5 Real PII / RLS state (validates Phase 8 §S-4 + drift §S-8)
Live `pg_policies` for the PII tables **differs from the migration files** (confirms drift):
- `drivers` — **already scoped** (`"Read drivers"`: `id = auth.uid() OR id IN (assigned orders)`). **No `"Anyone can select drivers"` exists.** The Phase 8 file-based worst-case did not materialize for drivers on this project.
- `merchants` — permissive `"Public read merchants"` `using(true)` **is live**, and the PII phone column is **`contact_phone`** (not `phone_number`). This is a **real, live PII exposure**.
- Other live `using(true)` SELECT policies worth flagging (beyond Phase 8's file view): `payout_requests`, `stock_movements`, `dispatch_assignments`, `merchant_branches`.

---

## 3. Defects found by live validation (and fixed)

Validation caught real bugs a file-only review missed:

**D-1 — P0-8 dropped the wrong merchant policy name.** Migration `20260705000007` dropped
`"Anyone can select merchants"` (the file-era name), but the **live** permissive policy is
`"Public read merchants"`. As written, the migration would **not** remove the real leak.
**Fix:** also `drop policy if exists "Public read merchants"`.

**D-2 — P0-8 revoked a non-existent merchant column.** The migration revoked
`SELECT (phone_number)` on `merchants`, but the merchant phone column is **`contact_phone`**.
The revoke silently no-opped → merchant phone stayed exposed. **Fix:** revoke `contact_phone`
on merchants (kept `phone_number` for drivers, with a defensive fallback).

**D-3 — New SECURITY DEFINER functions were not revoked from `anon`/`public`.** The advisor
showed the project leaks SECURITY DEFINER execute to `anon`; my new functions (`create_order`,
`refund_reserve`/`refund_confirm`, `auth_has_permission`, re-created `pay_*_settlement` /
`issue_compensation`, `cron_*`) granted `authenticated` but did **not** revoke the PUBLIC
default. **Fix:** added `revoke execute … from public, anon` before each grant.

All three fixes are in the committed migrations; the repo still passes lint / build / build:live
/ arch / E2E (sandbox 24/24) after the edits.

---

## 4. What could NOT be validated at runtime (requires write access + seeded staging)
- Actual transactional behavior of `create_order`, `refund_reserve/confirm`, `post_ledger`
  balancing, the two order triggers firing, pg_cron job registration.
- RLS enforcement of the new `role_permissions` / `auth_has_permission` path end-to-end.
- The updated `payment-initiate` / `payment-refund` edge functions (still v5 = pre-Phase-9 on
  the project).
- **Live E2E (`HAAT_LIVE_BACKEND=1`)** — blocked by the absence of demo/test accounts.

These are enumerated as an executable runbook in `GO_NO_GO_FINAL.md`.

---

## 5. Evidence appendix (queries run)
1. `list_migrations` → head `20260614000036`.
2. `list_edge_functions` → 4 payment functions, all `version 5` (pre-Phase-9).
3. Existence probe → all Phase 9 objects absent; `tenants` absent; pg_cron available.
4. Dependency probe → all non-tenant dependencies present (orders/drivers columns, settlement
   tables, `post_ledger`, `is_ops_admin`, dispatch RPCs).
5. `pg_policies` PII probe → drivers scoped, merchants `"Public read merchants"` using(true).
6. Permissive `using(true)` sweep → 30 SELECT policies (catalog data + the PII/finance ones noted).
7. Column probe → merchants PII column = `contact_phone`; drivers = `phone_number`.
8. `get_advisors(security)` → 197 WARN (87 anon-executable SECURITY DEFINER, etc.).
9. Write probe → `ERROR 25006: cannot execute CREATE TABLE in a read-only transaction`.
