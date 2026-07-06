# Website Platform · Migration Guide (Wave 0)

> How to apply the Wave 0 foundation safely, and how to roll it back. Zero-downtime,
> additive, reversible.

## 1. What ships in Wave 0
- One migration: `supabase/migrations/20260705000100_website_platform_foundation.sql` (all
  `website_*` tables; additive + idempotent).
- One additive TypeScript module: `src/website-platform/` (unwired — not imported by the app).
- Feature flags, all **disabled** by default.

## 2. Prerequisites (migration ordering)
The migration references platform functions that must already exist on the target DB:
- `public.tenants` — `20260627000008_tenants.sql`
- `public.auth_tenant()` — `20260627000010_tenant_isolation_foundation.sql`
- `public.auth_is_admin()` — `20260614000018_admin_country_scoping.sql`
- `public.auth_has_permission()` — `20260705000006_rbac_server_enforcement.sql`

> **Phase 9.5 note:** the `haat-now-dev` project was 21 migrations behind the repo (no `tenants`).
> Apply the full pending set in order (`supabase db push`) on a staging project at head first, then
> run `get_advisors(security)` + `pg_policies` review before production.

## 3. Apply
```
supabase db push          # applies 20260705000100 after its prerequisites
# verify:
#   select count(*) from information_schema.tables where table_name like 'website\_%';  -- expect 27
#   select * from pg_policies where tablename like 'website\_%';                          -- tenant RLS present
```
Because nothing reads these tables until `website.db_backend` is enabled per tenant, applying the
migration is a **zero-behavior-change** operation.

## 4. Enable per tenant (later waves — not Wave 0)
1. Seed the tenant's site rows (one-time import from the legacy blob via `planLegacyImport`).
2. Set `website.db_backend = enabled` for that tenant (a `website_feature_flags` row / resolver rule).
3. The compat selector (`selectWebsiteBackend`) flips that tenant to the platform backend; all
   others stay on legacy. Monitor, then widen.

## 5. Migration risk assessment
| Risk | Level | Mitigation |
|---|---|---|
| Breaks existing tables/data | **None** | additive only; no `alter`/`drop` of existing objects |
| Breaks the running app | **None** | module unwired (tree-shaken); flags default off; E2E 24/24 unchanged |
| RLS misconfiguration | Low | tenant policies use `auth_tenant()`; **no `using(true)`** on tenant tables (Phase 8/9.5 lesson); verify with `pg_policies` |
| Prerequisite missing on target | Medium | apply the full pending migration set at head first (staging) |
| Anon exposure | **None** | no `to anon` grants (asserted by a migration test) |
| Optimistic-lock correctness | Low | `version` column + version-guarded UPDATE; covered by repository tests |

## 6. Rollback strategy
Wave 0 is fully reversible with zero data loss:
- **Code**: `src/website-platform/` is unwired — reverting the commit removes it with no app impact.
- **Flags**: disabling `website.db_backend` (the default) instantly returns any tenant to the legacy
  Website Center.
- **Schema**: the tables are empty and unreferenced by the app. To fully remove them (only if
  required), a down-migration `drop table if exists public.website_* cascade` is safe because
  nothing depends on them. Normally they are simply left in place (harmless, empty).
- **No destructive step** is ever taken against legacy data (`haat_sb_website_v1` localStorage is
  untouched until a tenant is explicitly migrated in a later wave).

## 7. Verification checklist (post-apply, staging)
- [ ] `website_*` tables exist (27) with RLS enabled.
- [ ] `pg_policies` shows tenant read + write(perm) policies; no `using(true)` on tenant tables.
- [ ] `get_advisors(security)` clean for the new tables (no anon-executable, no RLS-disabled).
- [ ] App unchanged: build + E2E green; no tenant on the platform backend yet.
