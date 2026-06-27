# Tenant Isolation Roadmap — HAAT NOW

Design-only. **No production tables are modified by this document.** It specifies the complete rollout
from the current single-tenant schema to full multi-tenant isolation, grounded in an audit of the real
schema (~40 tables), ~43 services, 4 edge functions, and the existing auth model.

## Chosen ownership model
A single denormalized **`tenant_id uuid references tenants(id)`** on every tenant-owned table (direct
RLS — avoids deep policy joins), resolved via the **same pattern the codebase already uses for country
scoping** (`admin_users.country_code` + `auth_admin_country()` + RLS). Reuse, don't reinvent:

- **Tenant resolution:** request host → tenant. `*.haatnow.app` subdomain or a `custom_domain` maps to a
  `tenants` row → `tenant_id`. Injected as a **JWT claim** (`app_metadata.tenant_id`) at auth and/or set
  as a Postgres session GUC for RLS.
- **`current_tenant()`** SQL function (mirrors `auth_admin_country()`): reads the claim/GUC. Super-admins
  (`auth_admin_scope() = 'super'`) get `null` → policies allow cross-tenant access.
- Existing ownership keys (`customer_id`/`merchant_id`/`branch_id`/`driver_id`/`zone_id`/`city_id`/
  `country_id`) are **retained** — `tenant_id` is added alongside them.

## Table classification (audited)
### Tenant-scoped — add `tenant_id` (≈34 tables)
| Cluster | Tables | Backfill source |
|---|---|---|
| Commerce | merchants, merchant_branches, products, product_variants, product_images, categories | root = merchants; children via FK join to parent |
| Orders | orders, order_items, order_status_history, payment_methods, payment_transactions, payment_idempotency | orders from branch→merchant; children = orders.tenant_id |
| Customers | customers, addresses, favorites, reviews, subscriptions | root = customers; children via customer_id |
| Drivers/Fleet | drivers, driver_locations, driver_earnings, vehicles, driver_shifts, attendance | root = drivers |
| Geo | zones, cities | via country→tenant mapping (or default tenant) |
| Money | wallets, wallet_transactions | via owner (customer/driver/merchant).tenant_id |
| Growth | coupons, coupon_usages, campaigns, offers, banners | default tenant (brand-owned) |
| Engagement | notifications, support_tickets, support_messages, operation_events | via target user / default tenant |

### Global / shared — **NO `tenant_id`**
`countries`, `currencies`, `roles`, `permissions`, `role_permissions`, `user_roles`, `admin_users`
(cross-tenant operators), `tenants` itself, `app_config`/global `settings`, `audit_logs` (platform-level).

### Per-table specification (representative; same pattern applies cluster-wide)
| Table | Current ownership | Future ownership | Migration risk | Indexes | RLS change | Backfill | Rollback |
|---|---|---|---|---|---|---|---|
| **orders** | customer_id, branch_id, driver_id | +tenant_id | **High** (hot table, many readers) | `(tenant_id,status)`, `(tenant_id,created_at desc)` | add `tenant_id=current_tenant()` to all policies | `tenant_id = (select tenant_id from merchant_branches b where b.id = orders.branch_id)`, fallback default | drop policy predicate, drop column |
| **drivers** | zone_id, owner_user_id | +tenant_id | Med | `(tenant_id,is_online)` | scope read/write | default tenant (or by zone→country→tenant) | drop predicate/column |
| **vehicles** | driver_id | +tenant_id | Low (new table) | `(tenant_id,status)` | scope | via driver.tenant_id | drop column |
| **customers** | — | +tenant_id | **High** (auth-linked) | `(tenant_id)` | scope; keep self-access by auth.uid | default tenant | drop predicate/column |
| **merchants** | owner_user_id | +tenant_id (root) | Med | `(tenant_id,status)` | scope | default tenant | drop predicate/column |
| **merchant_branches** | merchant_id, zone_id | +tenant_id | Med | `(tenant_id)` | scope | via merchant.tenant_id | drop |
| **wallets** | owner_type/owner_id | +tenant_id | **High** (financial) | `(tenant_id,owner_id)` | scope; service-role bypass | via owner.tenant_id | drop |
| **wallet_transactions / payment_transactions** | wallet/order ref | +tenant_id | **High** (financial, append-only) | `(tenant_id,created_at desc)` | scope | via parent | drop |
| **coupons / campaigns** | — | +tenant_id | Low | `(tenant_id)` | scope; public-read active within tenant | default tenant | drop |
| **notifications** | user_id (target) | +tenant_id | Med (realtime filter) | `(tenant_id,target_user_id)` | scope | via target user | drop |
| **reviews** | order_id, customer_id | +tenant_id | Low | `(tenant_id)` | scope | via customer/order | drop |
| **support_tickets / support_messages** | — | +tenant_id | Low | `(tenant_id)` | scope | default tenant | drop |
| **Finance (settlements/commissions)** | period refs | +tenant_id | **High** (payout correctness) | `(tenant_id,period)` | scope; admin-only | via merchant/driver | drop |
| **Storage (buckets)** | path | per-tenant key prefix `tenant/<id>/…` | Med | n/a | bucket policy by path prefix | move/copy objects under prefix | revert policy + path |

## Services audit — queries to make tenant-scoped (≈43 services)
Once RLS enforces `tenant_id`, **most reads need no code change** (RLS filters automatically) — but every
**write must set `tenant_id`**, and every **service-role / edge path must filter manually**.
- **Writes that must set tenant_id:** `order.service.createOrder`, `merchant.service.upsertProduct`,
  `checkout.service.*`, `customer.service.createAddress`, `admin-crud.service.create` (generic — add a
  tenant-injecting wrapper), `tenant.service` (control plane, exempt), `ops-execution.service`,
  `notification.service.sendNotification/broadcast`.
- **Aggregations to scope:** `analytics.service`, `finance.service` (revenue/settlements),
  `command.service` (ops summary/zone analytics), `growth*.service`, `loyalty.service`.
- **Generic engine:** `adminCrud(table)` — add an optional `tenantId` and stamp it on `create`; reads
  rely on RLS. Single change covers all CRUD pages + workspaces.
- **No change:** `monitoring`, `release`, `country-detection`, `auth` (identity), `storage` (path change only).

## Edge functions — tenant resolution
All 4 (`payment-initiate/verify/refund/webhook`) use the **service-role client (bypass RLS)** → they
**must resolve and filter by tenant explicitly**:
- `payment-initiate` — derive `tenant_id` from the order (`orders.tenant_id`); select the tenant's
  provider keys/branding; pass `tenant_id` in gateway metadata.
- `payment-webhook` — resolve tenant from the attempt/order; scope all writes.
- Add a shared `_shared/tenant.ts` resolver (host header or order lookup).

## Authentication — tenant context
1. **Subdomain** (`acme.haatnow.app`) and **custom domain** → look up `tenants` by `subdomain`/
   `custom_domain` (already unique-indexed) → `tenant_id`.
2. **JWT** — on login, set `app_metadata.tenant_id` (Supabase admin API / an auth hook). `current_tenant()`
   reads `auth.jwt() -> 'app_metadata' -> 'tenant_id'`.
3. **Headers** — edge/server reads `x-tenant-id` (set by the edge from host) as a fallback for service-role.
4. **Session GUC** — `set_config('app.tenant_id', …)` per request for RLS where JWT claim is absent.

## Migration roadmap (5 phases)
**Phase 1 — Schema (additive, zero downtime).** Add **nullable** `tenant_id` to all tenant-scoped tables +
composite indexes (CONCURRENTLY). Add `current_tenant()` + a `default tenant` row. *No RLS change yet.*
**Phase 2 — Backfill.** Set `tenant_id` (root tables → default tenant; child tables → parent's tenant_id
via batched UPDATEs). Verify zero nulls. Move Storage objects under `tenant/<id>/` prefixes.
**Phase 3 — RLS.** Add `tenant_id = current_tenant() or current_tenant() is null` to every policy
(permissive `is null` keeps single-tenant working during cutover). Make `tenant_id` NOT NULL once
backfilled. Edge functions add explicit tenant filters.
**Phase 4 — Application layer.** `adminCrud` + write services stamp `tenant_id`; auth sets the JWT claim;
edge `_shared/tenant.ts` resolver; host→tenant middleware; per-tenant branding/keys.
**Phase 5 — Production rollout.** Enable per-tenant signups; tighten RLS (drop the `is null` escape);
load-test policy performance; monitor; provision real tenants.

## Estimates
| Phase | Complexity | Execution time | Downtime |
|---|---|---|---|
| 1 Schema | Medium | 0.5–1 day (+ index build on large tables) | none (additive, CONCURRENTLY) |
| 2 Backfill | Medium-High | 1–2 days (batched) | none |
| 3 RLS | **High** | 2–3 days + review | none (permissive escape) → brief at tighten |
| 4 App layer | High | 3–5 days | none |
| 5 Rollout | Medium | 2–3 days incl. load test | none |
| **Total** | **High** | **≈ 9–14 engineering days** | **effectively zero** if staged |

## Critical risks
1. **RLS lockout** — a policy with `tenant_id = current_tenant()` and a null claim hides all rows. **Mitigation:** the `or current_tenant() is null` escape until Phase 5; super-admin bypass.
2. **Financial mis-scoping** — wallets/transactions/settlements crossing tenants. **Mitigation:** backfill via verified parent joins + reconciliation counts before NOT NULL.
3. **Edge service-role bypass** — RLS does not protect service-role; missing a manual filter leaks cross-tenant. **Mitigation:** centralize in `_shared/tenant.ts`; audit every edge query.
4. **Realtime channels** (notifications) — subscriptions must include `tenant_id` in the filter.
5. **Index/perf regression** — every hot query gains a `tenant_id` predicate. **Mitigation:** composite indexes in Phase 1, EXPLAIN before Phase 5.
6. **Storage** — public bucket URLs leaking across tenants. **Mitigation:** path-prefix policies + signed URLs.

## Recommended rollout order
Geo/reference (zones, cities) → Commerce roots (merchants → branches → products) → Customers → Drivers/
Vehicles → Orders + children → Money (wallets/transactions/settlements, last & most carefully) →
Growth/Engagement → Storage → Edge functions → Auth claim → tighten RLS.

## Overall production impact
- Single-tenant production is **unaffected** through Phase 4 (additive, permissive escape).
- True isolation goes live at Phase 5; until then HAAT NOW runs as one tenant with the control plane ready.
- **Verification (this design sprint):** Typecheck/Lint 0 · Build OK (doc-only change; no schema touched).

## Next sprint
Execute **Phase 1 (Schema)** behind a feature flag: additive nullable `tenant_id` + indexes + the
`default tenant` row + `current_tenant()` — committed as one reviewable migration, no RLS yet.
