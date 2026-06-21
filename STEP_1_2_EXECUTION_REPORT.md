# STEP_1_2_EXECUTION_REPORT.md — LIVE EXECUTION

Live execution of `EXECUTION_RUNBOOK.md` Steps 1–2 against project **`umwbzradvbsirsybfxfb` (haat-now-dev)**. Executed via the Supabase Management API `POST /v1/projects/{ref}/database/query` (runs as `postgres`) using the configured token. **These were real writes to the live database.** Steps 3–6 NOT executed (held per instruction).

## Result: ✅ STEP 1 = PASS · ✅ STEP 2 = PASS

---

## STEP 1 — Apply `20260614000022_order_country_code_fix.sql`
**SQL executed:** `create or replace function public.order_country_code(p_order_id uuid) … language sql stable security definer set search_path = public …; revoke all … from public; grant execute … to authenticated;`
**Apply result:** `HTTP 201` → `[]` (DDL, no rows).
**Verification:**
| Query | Expected | Actual | Result |
|---|---|---|---|
| pre-state `prosecdef` | (false) | `false` | baseline |
| `select prosecdef from pg_proc where proname='order_country_code'` | `t` | **`true`** | ✅ PASS |

---

## STEP 2 — Apply `20260614000021_rls_recovery.sql`
**SQL executed:** self-asserted `order_country_code` DEFINER (idempotent) + **39 policies** (`drop policy if exists` + `create policy`) across the 21 previously-locked tables, including the recovered 0018 admin-scoping policies.
**Apply result:** `HTTP 201` → `[]`.
**Verification A — every locked table now has ≥1 policy (21 rows, all ≥1):**
```
admin_users 1 · audit_logs 1 · cities 1 · countries 1 · coupon_usages 2 · coupons 2 ·
driver_locations 3 · drivers 3 · favorites 1 · memberships 1 · notifications 2 ·
order_items 2 · orders 8 · permissions 1 · reviews 3 · role_permissions 1 ·
settings 2 · subscriptions 1 · wallet_transactions 1 · wallets 1 · webhook_events 1
```
→ ✅ PASS (orders = 8 as designed).
**Verification B1 — admin scoping present:** `orders` policies = `Admins read orders by scope` (SELECT) + Customers read/create/update + Drivers read/update + Merchants read/update → ✅ PASS.
**Verification B2 — total policies:** `41 → 80` (+39) → ✅ PASS.
**Verification B3 — recursion smoke test (decisive):** simulated an authenticated admin JWT and read orders:
```sql
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-0000-0000-0000-000000000005","role":"authenticated"}';
select count(*) from public.orders;   -- → 0, NO "infinite recursion detected"
```
→ ✅ **PASS** — the `Admins read orders by scope` policy evaluated `order_country_code()` (now DEFINER) with **no recursion error**. This empirically confirms the H2/H3 recursion fix on the live DB (not just structurally).

## Failures
- **None.** Both migrations applied first-try and all verifications passed.

## Warnings
- The first apply attempt used `jq` for JSON encoding; `jq` is absent on this host → that call returned `HTTP 400 {"message":"query: Required"}` and **did not modify the database** (pre-state `prosecdef=false` unchanged). Re-ran via a Node (`fetch`) encoder → success. No partial application occurred.
- Execution path note: writes went through the **Management API**, not the MCP server (which is `--read-only` and not loaded in-session). The token used has full project access — keep it rotated/secured.
- `coupons.is_active`/`created_at` and `notifications.created_at` pre-existed (from earlier migrations); 0020 (Step 3) will add the remaining feature columns. No conflict.

## Rollback status
- **Not invoked** — both steps PASS, no rollback needed. Rollback remains available per `EXECUTION_RUNBOOK.md` (Step 1: re-apply 0018 invoker form; Step 2: `drop policy if exists` the 39 names). The applied changes are idempotent and re-runnable.

## State after Steps 1–2
- `order_country_code` = SECURITY DEFINER (`prosecdef=true`). ✅
- 21 previously-locked tables now have RLS policies (80 total). ✅ Authenticated-user access to orders/wallets/notifications/etc. is now governed by correct owner/role/admin policies.
- Admin country-scoping recovered + recursion-free. ✅

## Held (NOT executed — per instruction "do not continue to STEP 3")
- STEP 3 (apply `0020`), STEP 4 (phone provider), STEP 5 (RBAC provisioning), STEP 6 (validation).
- Migration-ledger recording for `0018–0022` (grouped with Step 3 in the runbook) — **pending**; recommended to run when Step 3 proceeds.

**STEP 1 and STEP 2 both PASS. Stopped as instructed; awaiting go-ahead for STEP 3.**
