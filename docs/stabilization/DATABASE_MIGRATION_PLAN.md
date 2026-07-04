# Database Migration Plan
**HaaT Now — Phase 1 (Database Stabilization) · execution & rollout plan**
This plan turns the findings in `DATABASE_STABILIZATION_REPORT.md` into an ordered, testable rollout. Items marked **[APPLIED-SOURCE]** are committed migration edits (this phase). Items marked **[PLANNED]** carry exact SQL but are **not** auto-applied — they need a live smoke-test and supervised deploy.

> Golden rule for every step: apply to a **staging Supabase project first** (`supabase db reset` from zero to prove the full chain applies clean), run the smoke tests, only then production. Take a snapshot/backup before the production `db push`.

---

## P1.0 — Pre-flight (run once, read-only)
```sql
-- Confirm live is at 20260614000036 and the 000626/000627 batch is unapplied
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;
-- Snapshot live policy/index state to reconcile drift (F5)
select schemaname, tablename, policyname from pg_policies where schemaname='public' order by 2,3;
select indexname, tablename from pg_indexes where schemaname='public' order by 2,1;
```
Expected: newest applied = `20260614000036`; `vehicles_read` present live (drift); fleet `idx_vehicles_*` absent.

## P1.1 — Apply the corrected pending batch **[APPLIED-SOURCE → deploy PLANNED]**
The three committed edits make the 11-migration batch apply cleanly:
- `20260627000005_business_crud.sql` — duplicate fleet `vehicles` CREATE + broken `idx_vehicles_driver/status` removed; reference-table RLS + `vehicles_read`/`vehicles_admin_write` kept.
- `20260627000006_operations_execution.sql` — duplicate `driver_shifts` CREATE removed; permissive `driver_shifts_self_read` added.
- `20260627000009_phase1_index_reconciliation.sql` — **new**, correctly-named guarded hot-path indexes.

**Deploy procedure:**
1. Staging: `supabase db reset` (applies all 48 from zero) → **must succeed with no error** (this is the core proof — previously it failed at 000005).
2. Smoke test on staging (see P1.6).
3. Production: back up → `supabase db push` (applies the 11 pending, in order) → verify `tenants`, `payment_idempotency`, `operation_events`, `vehicles_read` policy, and the new indexes exist.

**Rollback:** the batch is additive (new tables/policies/indexes). If a step misbehaves, `drop table … / drop policy …` the newly-created objects; no existing data is mutated by these migrations.

## P1.2 — Verify tenants + payment_idempotency landed **[PLANNED]**
After P1.1 on production:
```sql
select to_regclass('public.tenants'), to_regclass('public.payment_idempotency');   -- both non-null
```
`payment_idempotency` is referenced by the payment edge functions (webhook idempotency) — it must exist before live payments.

## P1.3 — Enable RLS on the 3 exposed ops tables **[PLANNED — needs live smoke]**
Live: `driver_performance`, `shift_breaks` have RLS **off** (and `driver_shifts` until P1.1 applies). Exact SQL, to run **after** confirming the write paths (below):
```sql
-- shift_breaks: driver reads breaks of their own shifts; admin full
alter table public.shift_breaks enable row level security;
drop policy if exists shift_breaks_admin on public.shift_breaks;
create policy shift_breaks_admin on public.shift_breaks for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());
drop policy if exists shift_breaks_self_read on public.shift_breaks;
create policy shift_breaks_self_read on public.shift_breaks for select
  using (exists (select 1 from public.driver_shifts s where s.id = shift_breaks.shift_id and s.driver_id = auth.uid()));

-- driver_performance: driver reads own; admin full
alter table public.driver_performance enable row level security;
drop policy if exists driver_performance_admin on public.driver_performance;
create policy driver_performance_admin on public.driver_performance for all
  using (public.auth_is_admin()) with check (public.auth_is_admin());
drop policy if exists driver_performance_self_read on public.driver_performance;
create policy driver_performance_self_read on public.driver_performance for select
  using (driver_id = auth.uid());
```
**Smoke BEFORE production apply (on staging):** confirm `recalc_driver_performance()` still writes (it must be `SECURITY DEFINER` or called by admin/service_role to bypass RLS) and `start_shift/end_shift/start_break/end_break` RPCs still work as a driver. If `recalc_driver_performance` is `SECURITY INVOKER` and triggered by a non-admin driver action, add a matching `for insert/update … with check` policy or make the function `SECURITY DEFINER`. **Do not apply to production until the driver clock-in/out + performance-recalc smoke passes on staging.**

## P1.4 — Fleet-vehicles separation **[PLANNED — Phase 2, app-coupled]**
`vehicles` is the reference/type table. The admin "Vehicles" CRUD (`AdminDashboard.tsx:416`, fields plate/insurance/driver_id) and `DriverWorkspace.tsx:34` expect fleet-instance rows. Today those run through `adminCrud` (localStorage) and never touch the DB. To make fleet management real:
1. New migration — `fleet_vehicles(id, plate, vehicle_type, status, driver_id → drivers, insurance_expiry, license_expiry, created_at)` + RLS (`auth_is_admin` write, admin/self read) + `idx_fleet_vehicles_driver`.
2. App repoint (Phase 2): `CrudManager table="vehicles"` → `"fleet_vehicles"`; `DriverWorkspace` `adminCrud('vehicles')` → `adminCrud('fleet_vehicles')`.
Deferred to Phase 2 because it requires the app change to avoid an unused placeholder table (brief: no placeholders).

## P1.5 — Drift reconciliation & schema snapshot **[PLANNED]**
- Reconcile any live policy/index not represented in migrations (F5: `vehicles_read`). Author a `sync` migration for anything legitimately added out-of-band, or drop stray objects.
- Fix the empty `supabase/.temp/schema_dump.sql`: run `supabase db dump --schema public > supabase/schema.sql` and commit a canonical schema so CI can diff. Add a CI check that `db reset` from zero succeeds (would have caught F1).

## P1.6 — Smoke test suite (staging, after P1.1)
| Check | Expectation |
|---|---|
| `supabase db reset` from zero | Completes with **no error** (proves F1 fixed) |
| Ops: list vehicle types (`vehicleService.list`) | Returns 4 rows (RLS `vehicles_read` allows) |
| Ops: admin edits a vehicle type | Succeeds (`vehicles_admin_write`) |
| Driver: clock in/out, view own shift history | Works (`driver_shifts_self_read` + RPCs) |
| Notification center query by user | Uses `idx_notifications_target_created` (EXPLAIN) |
| Merchant kitchen queue by branch+status | Uses `idx_orders_branch_status` (EXPLAIN) |
| `tenants`, `payment_idempotency` exist | Yes |

## P3 — Forward context: per-tenant isolation (owned by Phase 3, NOT here)
For millions of users across countries, the eventual model (Phase 3): add `tenant_id uuid` to every domain table (denormalized for index-ability, as `000018` itself recommends), backfill, index `(tenant_id, …)` on hot paths, and add per-tenant RLS (`tenant_id = auth_tenant()`), replacing today's country-scoped admin RLS as the isolation boundary. Listed here only so Phase 1's index/RLS choices stay compatible with it. **Do not implement in Phase 1.**

---

## Ordered execution checklist
1. ☐ P1.0 pre-flight snapshot (read-only)
2. ☐ Review & approve the 3 committed migration edits (this phase)
3. ☐ Staging `db reset` → **must pass** (P1.1 step 1)
4. ☐ P1.6 smoke suite on staging
5. ☐ P1.3 add RLS to `driver_performance`/`shift_breaks` on staging + smoke
6. ☐ Backup prod → `db push` the corrected batch (P1.1 step 3) → P1.2 verify
7. ☐ P1.5 commit canonical `schema.sql` + CI `db reset` gate
8. ☐ Phase 2 backlog: P1.4 fleet-vehicles separation
