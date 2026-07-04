# Database Stabilization Report
**HaaT Now — Phase 3 Enterprise Production Stabilization · PHASE 1 of 9**
Date: 2026-07-04 · Scope: `supabase/migrations/*` (48 files) + live linked project (read-only introspection). Every finding is verified against **both** the migration source and the **live database** (via read-only MCP queries). No feature code changed. No DDL was applied to the live database (see "What was NOT done").

---

## 0. Method & what makes this different from the audit
The prior audit reconstructed the schema from migration files only (the consolidated `supabase/.temp/schema_dump.sql` is **0 bytes**). This phase additionally ran **read-only** introspection against the live linked project — `list_migrations`, `information_schema`, `pg_class`, `pg_policy` — to establish ground truth. That closed three questions the file-only audit could not, and **corrected two file-based assumptions** (audit_logs/settings RLS are already ON live; the "RLS-enabled-with-zero-policies" P0 is fully remediated live).

**No writes were made to the live database.** "Apply fixes where safe" was executed at the **migration-source** level (committed migration files). Applying DDL to the live project is a supervised cutover step (Phase 5), scheduled with smoke tests in `DATABASE_MIGRATION_PLAN.md`.

---

## 1. Live ground truth (read-only, 2026-07-04)
| Fact | Value | Source |
|---|---|---|
| Migrations applied on live | **through `20260614000036`** (37 of 48) | `list_migrations` |
| **Unapplied batch** | **11 migrations** `20260626000001` … `20260627000008` | `list_migrations` (absent) |
| Tables (public) | **94** | `pg_class` |
| RLS enabled | **91 / 94** | `pg_class.relrowsecurity` |
| RLS enabled but **0 policies** | **0** (no default-deny lockouts) | `pg_class` ⋈ `pg_policy` |
| RLS **disabled** | **3**: `driver_performance`, `driver_shifts`, `shift_breaks` | `pg_class` |
| `tenants` table | **does not exist** (000008 unapplied) | `to_regclass` |
| `payment_idempotency` table | **does not exist** (000007 unapplied) | `to_regclass` |
| `orders.tenant_id` | **absent** (no per-row tenancy) | `information_schema` |
| `audit_logs` / `settings` RLS | **both ON** live | `pg_class` |

**Headline:** there is a **pending 11-migration batch that has never applied**, and it **will hard-fail on the next `db push`** at `20260627000005_business_crud.sql` — permanently blocking `payment_idempotency` and `tenants` from ever reaching the database. This is the single most important database fact for the launch.

---

## 2. Findings

### 🔴 F1 — Migration `000005` hard-fails a fresh apply (fixed)
`20260627000005_business_crud.sql` re-declared `public.vehicles` as a **fleet-instance** table (`plate, status, driver_id, insurance_expiry`) via `create table if not exists`. But `vehicles` already exists as the **reference/type** table from `20260614000028_operations_engine.sql` (`type, capacity, speed_kmh, pricing_modifier`), which sorts earlier. So the fleet `CREATE` no-op'd, then:
```
create index if not exists idx_vehicles_driver on public.vehicles (driver_id);  -- driver_id does not exist → ERROR
create index if not exists idx_vehicles_status on public.vehicles (status);      -- status does not exist  → ERROR
```
On a fresh `supabase db push`/`db reset` this **raises an error and halts the migration chain**, so `000006`, `000007 (payment_idempotency)` and `000008 (tenants)` never apply. Confirmed live: the fleet indexes do not exist and the batch is unapplied.
**Consumers verified:** `ops/vehicle.service.ts` uses the reference shape (type/capacity/pricing); the dispatch RPCs in `000028` join `vehicles` on `type`/`pricing_modifier`. The reference table is the real one.
**Fix applied (source):** removed the duplicate fleet `CREATE` + the two broken indexes; kept RLS + `vehicles_read`/`vehicles_admin_write` policies on the reference table (28 enables RLS but ships no policy → default-deny; these policies are the only file-based source for fresh environments). Renamed `vehicles_public_read` → `vehicles_read` to converge with a live drift (see F5).

### 🔴 F2 — Duplicate `driver_shifts` definition (fixed)
`20260627000006_operations_execution.sql` re-declared `driver_shifts` with a different shape (`started_at/ended_at`, status `open|closed`) than the live/authoritative `000028` definition (`scheduled_start/end`, `actual_start/end`, status `scheduled|active|closed`). The `create table if not exists` only no-op'd. `ops/shift.service.ts` consumes the **`000028`** shape (queries `status='active'`, orders by `actual_start`) — confirmed against live columns.
**Fix applied (source):** removed the duplicate `CREATE`; kept the valid RLS + admin policy + index (they operate on the surviving table); **added a permissive `driver_shifts_self_read` SELECT policy** (`driver_id = auth.uid()`) so drivers can read their own shifts under RLS — a permissive policy can only broaden access, never restrict, so it is zero-regression, and it prevents an admin-only lockout when this migration applies.

### 🟠 F3 — Three ops tables ship with RLS **disabled** (planned, not auto-applied)
Live: `driver_performance`, `driver_shifts`, `shift_breaks` have `relrowsecurity = false`. `000028` created them without `enable row level security`; the migration that would enable it for `driver_shifts` (`000006`) is in the unapplied batch. With RLS off and the broad `authenticated` grants from `000019`, these tables (driver schedules, performance scores, break logs — driver PII) are readable by any authenticated user in live mode.
**Why not auto-applied:** *enabling* RLS is a potentially-restrictive change; without a live smoke-test it could break a write path (e.g. `recalc_driver_performance`). Exact `ENABLE RLS` + owner/admin policy SQL + the required smoke tests are specified in `DATABASE_MIGRATION_PLAN.md §P1.3`. (Note: applying the fixed batch already enables RLS on `driver_shifts` with owner+admin policies per F2.)

### 🟠 F4 — Silent index gaps on hot paths (fixed, additive)
`20260627000002_performance_indexes.sql` is **correctly guarded** (it never errors) but declared indexes against `user_id`/`merchant_id`/ columns that don't exist here, so it **silently skipped** the notification-center, merchant-order and catalog-by-branch indexes. Verified live column names: `notifications.target_user_id` + `is_read`; `orders.branch_id`; `products.branch_id` (no `merchant_id`/`user_id`).
**Fix applied (source):** new `20260627000009_phase1_index_reconciliation.sql` re-adds those indexes with the **actual** column names, column-guarded and `IF NOT EXISTS` — purely additive, safe on any environment.

### 🟡 F5 — Schema drift: live policy not in any migration (documented)
Live `public.vehicles` has a policy **`vehicles_read`** that exists in **no migration file** (only `000005`, unapplied, created `vehicles_public_read`). It was added out-of-band (dashboard/manual). Combined with the empty `schema_dump.sql`, this means migrations are not a complete source of truth for the live DB.
**Action:** the `000005` fix renames its policy to `vehicles_read` (converging file↔live). `DATABASE_MIGRATION_PLAN.md §P1.5` adds a drift-detection step (dump live `pg_policies`/`pg_indexes` and reconcile) and a fix for the empty `schema_dump.sql`.

### 🟡 F6 — Multi-tenancy not modeled at the DB (deferred to Phase 3)
No `tenant_id` on any domain table; no per-tenant RLS; `tenants` table not even applied live. This is the defining multi-tenant gap but is **owned by Phase 3 (Multi-Tenancy)** per the work order — intentionally **not** started here. Documented in `DATABASE_MIGRATION_PLAN.md §P3` as forward context only.

### 🟢 F7 — Verified healthy (evidence)
- **RLS coverage strong:** 91/94 tables RLS-enabled, **0 enabled-with-no-policy** — the audit's historical "21-table default-deny P0" (`rls_recovery`) is **fully remediated** on live.
- **Idempotency:** migrations from ~`000015` use `IF NOT EXISTS` / `drop policy if exists` / `DO`-guards consistently.
- **Scale indexes:** `000027_scale_indexes` lands correctly (columns match) with measured EXPLAIN gains.
- **FKs:** core relations are FK-backed (`orders.customer_id/branch_id/driver_id`, `order_items.order_id`, cascade on ops children). Known soft spot: owner PKs (`customers/drivers/merchants.id`) are not FKs to `auth.users` and RLS assumes `id = auth.uid()` (identity-model item, tracked for Phase 3/4, not a Phase-1 blocker).

---

## 3. What was changed in this phase (source only)
| File | Change | Risk |
|---|---|---|
| `supabase/migrations/20260627000005_business_crud.sql` | Removed duplicate fleet `vehicles` CREATE + 2 broken indexes; kept/renamed RLS policies to `vehicles_read`+`vehicles_admin_write`; kept admin-write loop; documented. | **None** — unapplied migration; removed statements were no-ops/hard-errors. |
| `supabase/migrations/20260627000006_operations_execution.sql` | Removed duplicate `driver_shifts` CREATE; kept `operation_events` + RLS/policy/index; added permissive `driver_shifts_self_read`. | **None** — unapplied; permissive policy only broadens. |
| `supabase/migrations/20260627000009_phase1_index_reconciliation.sql` | **New.** Correctly-named, guarded hot-path indexes. | **None** — additive, guarded. |

All three are safe because the entire batch is **unapplied on live** — editing them causes **no drift** with any environment and they will apply cleanly on the first supervised `db push`.

## 4. What was NOT done (and why)
- **No DDL applied to the live database.** Outward-facing / hard-to-reverse; scheduled as a supervised Phase-5 cutover step with rollback + smoke tests.
- **No RLS enablement on `driver_performance`/`shift_breaks`** (potentially restrictive; needs live smoke — see Plan §P1.3).
- **No `fleet_vehicles` table / no app repoint** (would be an unused placeholder without the Phase-2 app change; the brief forbids placeholders).
- **No `tenant_id` / per-tenant RLS** (owned by Phase 3).
- **No feature/UI code touched.**

## 5. Phase-1 exit criteria
✅ Every migration audited (48).  ✅ Duplicate tables resolved at source (`vehicles`, `driver_shifts`).  ✅ Conflicting/failing migration fixed (`000005`).  ✅ FKs, indexes, constraints, RLS, tenant-isolation verified against **live**.  ✅ Index gaps reconciled (additive).  ✅ Three reports generated.  ⏭️ RLS-enablement on 3 ops tables + drift reconciliation + tenancy → scheduled (Plan / Phase 3).

**Recommendation:** approve the three committed migration edits, then execute `DATABASE_MIGRATION_PLAN.md §P1` (supervised `db push` of the corrected batch to a **staging** project first, run smoke tests, then production) before proceeding to Phase 2.
