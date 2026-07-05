# Multi-Tenancy Audit — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Evidence cited `file:line`. **Caveat:** source/migration review; confirm applied state against live `pg_policies`.

## Headline

**Multi-tenant data isolation is NOT implemented.** The platform is marketed as an "Enterprise Multi-Tenant SaaS Platform", but at the enforcement layer it is a **single-tenant application** (the one HaaT Now brand) with an **additive, non-enforcing foundation** for future tenancy. A live multi-tenant deployment today **would leak data across tenants**.

---

## What exists

| Layer | State | Evidence |
|---|---|---|
| `tenants` table | ✅ real (thin, ~22 cols) | `20260627000008_tenants.sql:9-33` |
| `tenant_members` (user→tenant) | ✅ real | `20260627000010:23-32` |
| `auth_tenant()` resolver | ✅ real (SECURITY DEFINER) | `20260627000010:41-45` |
| `tenant_id` on core tables | ✅ column added — **nullable, no default, unused** | `20260627000010:49-59` (merchants, merchant_branches, drivers, customers, orders, products) |
| RLS referencing `tenant_id` / `auth_tenant()` | ❌ **none anywhere** | verified — used only in the foundation migration + unrelated localStorage code |
| Platform registry (brands/apps/providers/flags) | 🟠 additive, read-only, localStorage fallback | `20260626000002` (write policies "intentionally omitted"), `platform.service.ts:14` |

The foundation migration is **explicit and honest** about this: *"does NOT enforce it yet… Enforcement is a SEPARATE, staged rollout that must run only after (a) backfilling tenant_id and (b) validating on staging… Turning on tenant RLS before backfill would lock every existing row out"* (`20260627000010:1-17`). The `TenantWorkspace` UI itself admits totals "become per-tenant once data isolation (tenant_id + RLS) is enabled" (`TenantWorkspace.tsx:365`).

---

## Isolation dimensions

| Dimension | Enforced? | Evidence |
|---|---|---|
| **Tenant isolation** | ❌ No | no RLS uses `tenant_id` |
| **Country isolation** | ⚠️ Partial — `orders` + `admin_users` only | `admin_country_scoping.sql:52-69`; finance/ops **unscoped** (`finance_engine.sql:352`, `operations_engine.sql:404`) |
| **Organization isolation** | ❌ No | merchant sub-org / branch-manager scoping absent |
| **Per-user ownership** | ✅ Yes | `customer_id/driver_id = auth.uid()` patterns |
| **Data ownership / provisioning** | 🟠 sandbox/localStorage | `tenant.service.ts:13`, provisioning schema mismatch |
| **Soft delete** | ⚠️ `status` flags (draft/archived) | `tenants.status`; account deletion `20260627000001` |
| **Hard delete / cascade** | ⚠️ FK `on delete cascade` on `tenant_members`, `commission_rules` | but domain tables not tenant-linked |
| **Cross-country permissions** | ⚠️ super vs country only | money/ops ignore it |

---

## Cross-tenant leakage assessment

**If two brands' data shared this database today: HIGH risk.**

1. No domain table filters by `tenant_id` in RLS → all tenants' merchants, orders, products, customers live in one global RLS namespace.
2. Admin scope resolves to "any row in `admin_users`" for ops/finance → an admin of Brand A could read Brand B's settlements, drivers, KYC.
3. The permissive `using(true)` SELECT on `drivers`/`merchants` (SECURITY_REVIEW S-4) would expose every tenant's merchant/driver PII to any authenticated user of any tenant.
4. `subscription.service.usage()` counts **global** localStorage rows, not per-tenant (`subscription.service.ts:86-87`) — quota enforcement is not tenant-aware.

**Why it is only *latent* today:** the app runs as a single brand with `NO mandatory tenant_id` (`platformModel.ts:4`), so there is no second tenant's data to leak — yet.

---

## Provisioning & backfill readiness

- **Provisioning would fail in live Supabase** — the engine writes ~19 fields absent from the `tenants` table (`provisioning.service.ts:43-57` vs `tenants` columns) → PostgREST rejects. Verified. It only "works" against localStorage.
- **No backfill script** for `tenant_id` on existing rows exists. Stage C (enforcement) is therefore blocked on both a working provisioner and a backfill.

---

## Verdict & path to real multi-tenancy

**Current multi-tenancy grade: Foundation only (not production multi-tenant).** To become genuinely multi-tenant:
1. Fix the `tenants` schema ↔ provisioning field mismatch (or the provisioner).
2. Backfill `tenant_id` on all domain rows for the existing brand.
3. Make `tenant_id` NOT NULL + add per-tenant RLS (`tenant_id = auth_tenant()`) on every domain table — staged, validated on staging first.
4. Scope admin authority by tenant (and fix country scoping on money/ops — S-2).
5. Drop the permissive PII policies (S-4).
6. Make quota/usage tenant-aware.

Until then, **do not deploy a second tenant into the same project.**
