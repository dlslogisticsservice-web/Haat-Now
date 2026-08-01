# Hardening Pass #3 — Report

Eliminates the **two** exploits that survived the Independent Red Team Validation
(`RED_TEAM_VALIDATION_REPORT.md`):

| # | Exploit | Vector |
|---|---------|--------|
| **RT-1** | Driver self-spoofs **own GPS** | direct `PATCH /rest/v1/drivers?id=eq.<self>` → `current_lat`/`current_lng` |
| **RT-2** | Driver self-inflates **own priority** | direct `PATCH /rest/v1/drivers?id=eq.<self>` → `priority_score` |

Scope was **strictly** RT-1/RT-2. No other subsystem was touched; the dispatch engine was
not redesigned; no unrelated refactors. One DB migration + one client one-liner + a
regression suite.

## Root cause
Identical to B1/B6 from Hardening Pass #2: the `drivers` table has a table-wide `UPDATE`
grant to `authenticated` (`20260614000019_authenticated_grants.sql:50`) plus an own-row RLS
policy (`Drivers update own profile`), and **no column lock**. A driver could therefore PATCH
their own operational/scoring columns. Pass #2 applied the column-lock model to `orders` and
`driver_earnings` but not to `drivers`. This pass applies the **same** model to `drivers`.

## Fix
### 1. `drivers_guard` — operational/scoring columns are not client-writable
A `BEFORE INSERT OR UPDATE` trigger, `SECURITY INVOKER` (so `current_user` reflects the real
writer — matching `orders_guard`). Direct PostgREST writes run as `authenticated`/`anon` and
are constrained; `SECURITY DEFINER` RPCs (owner role), `service_role`, and the ops-admin path
(`is_ops_admin()`) pass through.

- **UPDATE** — a client changing any of these raises `42501`:
  `current_lat`, `current_lng`, `priority_score`, `rating`, `active_orders`,
  `max_concurrent_orders`, `status`, `is_online`, `last_seen_at`, `zone_id`, `tenant_id`,
  `owner_user_id`. (Covers RT-1, RT-2, and the rest of the operational/scoring + isolation set
  the same PATCH could have reached — `status`/`is_online` = presence hijack, `zone_id` =
  dispatch steering, `tenant_id`/`owner_user_id` = isolation/identity.)
- **INSERT** — a client can still self-register, but the operational/scoring columns are
  **force-reset to their table defaults** (`current_lat/lng`→null, `priority_score`→0,
  `active_orders`→0, `rating`→5.0, `max_concurrent_orders`→1, `status`→`offline`,
  `is_online`→false), so the same exploit can't be performed via an INSERT.

### 2. Ownership-validated operational RPCs (the secure write path)
Three `SECURITY DEFINER` RPCs replace the direct operational writes; each verifies
**auth.uid() present · driver ownership (`id = auth.uid()` OR `owner_user_id = auth.uid()`,
`FOR UPDATE`) · tenant isolation · rate limit**, and location additionally validates
**coordinates**:

| RPC | Writes | Extra checks |
|-----|--------|--------------|
| `driver_update_location(p_lat, p_lng)` | `current_lat`, `current_lng`, `last_seen_at` | lat ∈ [-90,90], lng ∈ [-180,180], not null |
| `driver_set_presence(p_is_online)` | `is_online`, `status`*, `last_seen_at` | — |
| `driver_set_availability(p_status)` | `status`, `is_online`, `last_seen_at` | whitelist `{available, offline}` — never `busy` |

\* presence never overrides a system-managed `busy` (set by `respond_dispatch` on accept); it
only flips `available`/`offline`.

**Design notes (verified against the live schema, not assumed):**
- **Ownership is the binding isolation check** — a caller can only ever touch their own driver
  row. **Tenant is defense-in-depth**: `drivers.tenant_id` is nullable and is **not** set by
  the registration path (`submit_driver_application` never writes it), so the check rejects only
  a *mismatched* forged cross-tenant token and never hard-fails a legitimate null-tenant driver.
  `drivers` has no per-row country column (country derives from the tenant).
- **Rate limit** is measured on `clock_timestamp()` (real wall-clock), not `now()` (frozen at
  transaction start), so it measures true elapsed time and never falsely limits two legitimate
  calls in one transaction: **≤ 1 operational write/sec/driver**.
- EXECUTE granted to `authenticated`, revoked from `anon`/`public`.

### 3. Profile fields stay client-editable
Non-operational columns (`full_name`, `phone_number`, `vehicle_plate`, licence/national-id,
`vehicle_id`, `submitted_at`, …) remain directly updatable by the owning driver — the guard
only blocks the operational/scoring set. Verified.

## Files modified / added
- **Migration added:** `supabase/migrations/20260801000002_hardening_pass_3.sql` (applied to
  prod `haat-now-prod`; migration history reconciled to a single canonical row
  `20260801000002 / hardening_pass_3`, consistent with Pass #2's convention).
- **Regression suite added:** `supabase/tests/hardening_pass_3_regression.sql`.
- **App code (one line):** `src/repositories/driver.repository.ts` — `setOnline()` now calls
  `rpc('driver_set_presence', …)` instead of a direct `drivers.update({ is_online })` (the one
  legitimate client path that touched an operational column). Return shape (`{ data, error }`)
  is unchanged, so `driver.service.toggleOnline` is unaffected. No signature change.
- **Report added:** this file.

## Policies changed
- **None dropped or altered.** The existing RLS policies (`Drivers update own profile`, etc.)
  are intentionally left in place — the column-level guard is layered on top, exactly as
  `orders_guard` sits on top of the orders policies. The admin write path
  (`drivers_admin_write` / `adminCrud`) is preserved via the `is_ops_admin()` bypass in the
  guard.

## RPCs changed
- **Added:** `driver_update_location`, `driver_set_presence`, `driver_set_availability`.
- **Unchanged:** `set_driver_status` remains revoked from clients (Pass #2 / B7);
  `respond_dispatch` and `recalc_driver_performance` (owner role) pass the guard and are
  untouched.

## Tests added — RT-1 & RT-2 permanently reproduced as regressions
`supabase/tests/hardening_pass_3_regression.sql` (impersonates `authenticated`, self-cleans):
- **RT-1:** direct `update drivers set current_lat=24.7, current_lng=46.7 where id=self` →
  must be rejected; `current_lat` must not hold the attacker value.
- **RT-2:** direct `update drivers set priority_score=9999 where id=self` → must be rejected;
  `priority_score` must remain `0`.
- **Legit paths intact:** all three operational RPCs succeed and `driver_update_location`
  persists `30.0444/31.2357`.
- **Profile edit** still allowed; **INSERT-seeding** of operational columns neutralized;
  **structural** — trigger present, RPCs not anon-executable.

## Evidence — RT-1 and RT-2 are now blocked (live, on prod)
Re-ran the **exact** two exploit scenarios (no new tests invented) as an impersonated
authenticated driver against a self-owned row, reading back the stored values:

```
RT-1 blocked = true    (current_lat after attack = 30.0444  ← only the legit RPC value, never 24.7)
RT-2 blocked = true    (priority_score after attack = 0)
legit RPCs ok: location = true   availability = true   presence = true
HARDENING_PASS_3_REGRESSION: RT-1 + RT-2 closed
```

- RT-1: the direct GPS PATCH raised `42501`; `current_lat` never held `24.7`.
- RT-2: the direct priority PATCH raised `42501`; `priority_score` stayed `0`.
- INSERT-seeding attempt (`priority_score=9999, current_lat=24.7, status='available'` at insert)
  → stored as `0 / null / offline`.
- All test rows deleted — **0 driver residue** on prod.

## Quality gates
| Gate | Result |
|------|--------|
| Migration apply (prod) | ✅ clean |
| RT-1/RT-2 regression (impersonated + structural) | ✅ **RT-1 + RT-2 closed** |
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Architecture / demo-isolation | ✅ clean |
| Unit + integration tests | ✅ **777 pass / 0 fail** |
| Production build | ✅ |
| Guardian | ✅ **544 files · 0 cycles · 0 violations** |

## Status
**RT-1 and RT-2 are fully eliminated and verified on production.** The `drivers` table now
enforces the same column-lock model as `orders`/`driver_earnings`; operational writes flow
through ownership-validated RPCs; profile edits and the admin path are preserved.

Not deployed (no Vercel/frontend change). Awaiting approval to re-run the full Independent
Red Team Validation.
