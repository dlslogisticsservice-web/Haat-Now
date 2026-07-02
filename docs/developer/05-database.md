# 05 · Database & Storage

> **Audience:** developers who need to read/write persistent data.
> **Frozen:** the Supabase migration/DB architecture is a frozen system — change it only for a critical bug and
> only via a new migration, never by editing an existing one.

## Purpose
Explain the two storage backends (localStorage sandbox vs Supabase Postgres), the table/namespace layout, and
the rule that keeps them interchangeable: **components never touch storage directly — services do.**

## Architecture: two backends, one service API
| Mode (`VITE_AUTH_MODE`) | Storage | Used when |
|---|---|---|
| `sandbox` (default) | Browser `localStorage` (`haat_sb_*`, `haat_crud_*`) | Demo — what production ships as |
| `supabase` | Postgres + Auth + Storage + Realtime | Live backend (`HAAT_LIVE_BACKEND=1`) |

The **`admin-crud.service`** generic engine abstracts both: `adminCrud('tenants')` gives `.list/.create/.update/
.remove` that hit localStorage in sandbox or Supabase in live mode. Most services build on it.

## Architecture: localStorage namespaces (sandbox)
| Namespace | Owner | Holds |
|---|---|---|
| `haat_sb_*` | `sandboxStore` | orders, wallets, notifs, reviews, products, stock, coupons, loyalty, push, addresses, seq |
| `haat_crud_*` | `adminCrud` | drivers, vehicles, merchants, merchant_branches, **orders**, customers, categories, zones, tenants, operation_events |
| `haat_sb_rbac_roles` / `_acting` | `rbac.service` | roles + permissions, acting role |
| `haat_platform_registry` / `haat_webhook_logs` | `platform.service` | providers/flags/brands/envs, webhook logs |
| `haat_design_store_v1` | `DesignContext` | published/draft design config |
| `haat_crud_theme_presets` | `themePresets.service` | reusable theme presets |
| `haat_crud_templates` | `templates.service` | business template manifests |
| `haat_sb_provision_runs` | `provisioning.service` | provisioning run state (resume/retry) |
| `haat_sb_kyc` · `haat_sb_tickets` · `haat_sb_fin_*` · `haat_sb_campaigns` · `haat_sb_screen_experiences_v1` | onboarding / cx / finance / campaign / experience | domain stores |
| `haat_sandbox_session` | `auth.service` | demo session |

## Architecture: Supabase schema (live)
~41 tables via [`supabase/migrations/`](../../supabase/migrations/) (48 migration files). Domains:
- **Commerce** — orders, order_items, order_status_history, customers, addresses, favorites, customer_carts,
  cart_items, merchants, merchant_branches, products, product_variants, product_images, categories.
- **Fleet/ops** — drivers, driver_locations, driver_earnings, zones, countries, cities.
- **Finance** — wallets, wallet_transactions, payment_transactions, payment_methods.
- **Growth** — coupons, coupon_usages, memberships, subscriptions, offers, banners.
- **Experience** — support_tickets, support_messages, reviews, notifications, push_tokens.
- **Identity/RBAC** — roles, permissions, role_permissions, user_roles, admin_users.
- **Config** — audit_logs, app_config, settings.

The sandbox mirrors the needed tables as localStorage namespaces above.

## Flow: reading/writing data
```
Component → service method → adminCrud(entity)  → localStorage (sandbox)
                                                 → supabase.from(entity) (live)
```
The **orders bridge**: `sandboxStore` mirrors every order into `haat_crud_orders`, so Admin Orders, Finance, and
Analytics all see live orders in sandbox mode.

## Dependencies
- [`src/services/admin-crud.service.ts`](../../src/services/admin-crud.service.ts) — the CRUD abstraction.
- [`src/services/sandboxStore.ts`](../../src/services/sandboxStore.ts) — demo backend + finance bridge.
- [`src/lib/supabase.ts`](../../src/lib/supabase.ts) — the mode-gated client (no-op realtime in sandbox).

## Extension points
- **New entity** → use `adminCrud('<entity>')` from a service; add a Supabase migration for live mode.
- **New live table/column** → a **new** migration file in `supabase/migrations/` (timestamped). Never edit an
  existing migration.

## Reuse rules
- Persist through `adminCrud` or the owning service — not raw `localStorage.setItem`/`supabase.from` in a
  component.
- One namespace per concern; document it in [SYSTEM_DEPENDENCY_MAP.md](../architecture/SYSTEM_DEPENDENCY_MAP.md).

## Files involved
- [`supabase/migrations/`](../../supabase/migrations/), [`supabase/seed.sql`](../../supabase/seed.sql),
  [`supabase/seed_demo_accounts.sql`](../../supabase/seed_demo_accounts.sql).
- [`src/services/demoSeed.ts`](../../src/services/demoSeed.ts) — idempotent sandbox seeder.

## Do's
- ✅ Add a new migration for schema changes; keep it additive.
- ✅ Keep sandbox + live parity: if you add a live table, mirror it in the sandbox store.
- ✅ Use valid UUIDs for demo ids (so uuid-typed queries never `22P02`).

## Don'ts
- ❌ Don't edit a committed migration (frozen DB architecture). ❌ Don't drop/rename columns casually.
- ❌ Don't read `localStorage`/Supabase from a component. ❌ Don't assume realtime in sandbox.

## Example
```ts
// A service persists an entity in both modes with one line:
import { adminCrud } from './admin-crud.service';
const zones = adminCrud('zones');
await zones.create({ name: 'North', country_code: 'EG' });   // localStorage OR supabase, transparently
```

## Next
[04-service-architecture.md](04-service-architecture.md) · [18-multi-tenancy.md](18-multi-tenancy.md)
