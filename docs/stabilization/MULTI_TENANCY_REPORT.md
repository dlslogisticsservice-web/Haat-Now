# Multi-Tenancy Report
**HaaT Now — Phase 3 of the Enterprise Production Stabilization Program**
Date: 2026-07-05. Objective: complete true tenant isolation — everything must resolve from tenant context. Method: code audit + **live** introspection (read-only). Every claim is evidence-backed. **No restrictive RLS was enabled** in this phase (see "Why staged").

---

## 0. Executive finding
**True per-tenant data isolation does not exist yet.** Live introspection confirms:
- **No `tenant_id` (or any tenant-linking column) on any domain table** (`information_schema` → 0 matches).
- **No `auth_tenant()` resolver** (only `auth_is_admin`, `auth_admin_country`, `order_country_code` exist).
- The `tenants` table is a **control/registry table** (`…000008`), not yet applied live, and **owns no domain data**.
- Domain rows are scoped by **owner** (`merchants.owner_user_id`, `customers/drivers.id = auth.uid()`) and admins by **country** (`admin_users.scope` + `auth_admin_country()`), **never by tenant**.

The original authors deferred this explicitly: *"full row-level data isolation (a tenant_id on every domain table + scoped RLS) is the separate isolation rollout"* (`…000008:6-7`). Phase 3 begins that rollout — **safely and in stages**.

## 1. Tenant-context resolution by surface (verified)

| Surface | Resolves from tenant context today? | Evidence | Gap |
|---|---|---|---|
| **Tenant** | Partial — control table only | `tenants` table `…000008`; `tenant.service.ts` (adminCrud CRUD + lifecycle + branding). Not applied live. | Owns no domain data; provisioning creates a brand, not a data boundary. |
| **Country** | ✅ Yes (this is the real isolation axis) | `auth_admin_country()`, `order_country_code()`, `admin_users.{scope,country_code}` (`…000018`). | Country ≠ tenant; multiple tenants can share a country with no separation. |
| **Brand** | Partial — website only | `tenant.service.tenantTheme()` + `applyDesign`; per-tenant brand tokens. | In-product apps (customer/merchant/driver/admin) use a **single global** brand — no login-time `applyTheme(tenant)` (Phase-2 white-label finding H4). |
| **Website** | ✅ Yes (the one true tenant-scoped surface) | `runtime.ts` `resolvePublicRequest` → custom domain / subdomain / `?site=` → `website.service.resolveTenantByDomain` → `applyBrand`. Mounted outside DesignProvider (`main.tsx:56`). | Content is localStorage-persisted (Phase-1 C4), not server-shared. |
| **Merchant** | ❌ No — scoped by owner, not tenant | `merchants.owner_user_id` (live); no `tenant_id`. | A merchant belongs to a user, not a brand/tenant. |
| **Driver** | ❌ No — scoped by identity | RLS assumes `drivers.id = auth.uid()`; no `tenant_id`. | No tenant membership. |
| **Customer** | ❌ No — scoped by identity | `customers.id = auth.uid()`; no `tenant_id`. | No tenant membership. |
| **Admin** | Partial — country-scoped, not tenant | `super` vs `country` scope (`…000018`). | No tenant-admin role; a country admin sees all tenants in the country. |

**Verdict:** 2 of 8 surfaces resolve from real tenant context (Website fully; Brand/Tenant/Admin partially via country/website). The 4 data-bearing surfaces (Merchant/Driver/Customer + cross-cutting Orders/Catalog) have **no tenant boundary** in the database.

## 2. Target model
```
tenants (brand)  ──<  tenant_members (user_id → tenant_id, role)
      │
      └──<  merchants / drivers / customers / orders / products  (tenant_id FK)

auth_tenant()  = the calling user's tenant  (SECURITY DEFINER, via tenant_members)
Per-tenant RLS =  USING (tenant_id = public.auth_tenant())   -- added in Stage C, staged
```
This mirrors the existing, proven `auth_admin_country()` pattern — a resolver + a scoped predicate — so it is consistent with the codebase, not a new paradigm.

## 3. Staged rollout (each stage independently gated; enforcement last)

### Stage A — Foundation (APPLIED at source, this phase) ✅
Migration `20260627000010_tenant_isolation_foundation.sql` (additive, non-breaking, **no RLS change**):
- `tenant_members(tenant_id, user_id, role)` + self-read/admin RLS.
- `auth_tenant()` SECURITY DEFINER resolver (returns the caller's tenant or NULL).
- **Nullable** `tenant_id` (+ FK to `tenants` + index) on `merchants, merchant_branches, drivers, customers, orders, products` — guarded, no default, no not-null.
Because the columns are nullable and unread, existing rows/queries are unaffected. **Authored + committed; not applied to production** (deploy with the Phase-1 batch on staging first).

### Stage B — Backfill + app tenant-context (PLANNED)
1. **Backfill** `tenant_id`: assign every existing merchant/branch/driver/customer/order/product to its owning tenant (via `owner_user_id` → tenant, or a default tenant for the current single-brand data). Populate `tenant_members` from existing role assignments.
2. **App**: services stamp `tenant_id` on inserts (via `auth_tenant()` / the provisioning context); resolve the logged-in user's tenant at session start and call `tenantService.applyTheme(tenant)` for the in-product apps — closing white-label finding **H4** (per-tenant brand for customer/merchant/driver/admin, not just the website).
3. Make `tenant_id` `NOT NULL` only **after** backfill is verified complete.

### Stage C — Per-tenant RLS enforcement (PLANNED — the dangerous step, staged)
Add, per domain table, a tenant predicate **alongside** existing owner/country policies, e.g.:
```sql
create policy orders_tenant_isolation on public.orders for all
  using (tenant_id = public.auth_tenant()) with check (tenant_id = public.auth_tenant());
```
**Preconditions (hard gates):** Stage B backfill 100% complete (no NULL `tenant_id`); validated on a **staging** project seeded with ≥2 tenants proving zero cross-tenant read/write; a rollback migration prepared. Only then enforce in production. This is the step that, done before backfill, would default-deny the entire transactional surface — exactly the P0 that `…000021_rls_recovery` had to undo — so it is **explicitly gated and not done here.**

## 4. Why staged (not a big-bang)
Per the program's non-negotiables (never break UI, never introduce regressions, backward compatible) and the platform's own history (two `security_hardening` + one `rls_recovery` migrations show RLS enforced-before-ready causes outages), tenant isolation must land **additively first, enforced last, validated on staging in between.** Stage A is safe today; Stages B–C require data backfill + staging and are sequenced above.

## 5. What was applied in Phase 3
| Item | Type | Risk |
|---|---|---|
| `…000010_tenant_isolation_foundation.sql` | new migration — `tenant_members`, `auth_tenant()`, nullable `tenant_id` + indexes on 6 core tables | **None at source** (additive, guarded, no RLS change); deploy on staging first |
| `MULTI_TENANCY_REPORT.md` | this report | — |

No production DDL applied. No app/UI code changed. No RLS enforced.

## 6. Recommendation
Approve Stage A (foundation). Then execute Stage B (backfill + app tenant-context, which also fixes the in-product white-label gap H4) as its own gated pass, and only afterwards Stage C (RLS enforcement) on staging → production. Until Stage C lands and is validated, **the platform must not onboard a second real tenant** — the database cannot yet isolate them (Launch Blocker C3).
