# Database Final Schema (post-stabilization)
**HaaT Now — canonical schema reference after Phase-1 corrections**
Basis: 48 migration files + live introspection (2026-07-04). Reflects the state **after the corrected `000626/000627` batch applies** (F1/F2 fixes). This is a reference summary, not a substitute for the canonical dump that Plan §P1.5 will commit (`supabase/schema.sql`).

---

## 1. Snapshot metrics (live-verified)
- **94 tables** in `public` (→ 96 once `tenants` + `payment_idempotency` land from the pending batch).
- **RLS:** 91/94 enabled; **0** enabled-with-no-policy; **3** disabled today (`driver_performance`, `driver_shifts`, `shift_breaks` — closed by Plan §P1.3 + F2).
- **Tenancy:** country-scoped (admin) — **no `tenant_id`** on domain tables (Phase 3).
- **Idempotency/guards:** consistent `IF NOT EXISTS`, `drop policy if exists`, column-guarded indexes.

## 2. Tables by domain
| Domain | Tables |
|---|---|
| **Tenancy / geo** | `countries`, `cities`, `zones`, `addresses`, `tenants`* , `platform_organizations`, `platform_brands`, `platform_applications`, `platform_providers`, `platform_feature_flags`, `platform_environments` |
| **Catalog** | `merchants`, `merchant_branches`, `merchant_store_settings`, `categories`, `products`, `product_variants`, `product_images`, `offers`, `banners`, `stock_movements` |
| **Orders** | `orders`, `order_items`, `order_status_history`, `customer_carts`, `cart_items`, `coupons`, `coupon_usages`, `coupon_redemptions`, `reviews`, `review_reports`, `favorites`, `favorite_branches`, `search_analytics` |
| **Customers / identity** | `customers`, `memberships`, `subscriptions`, `notifications`, `notification_templates`, `push_tokens` |
| **Wallet / payments** | `wallets`, `wallet_transactions`, `payment_methods`, `payment_transactions`, `payment_attempts`, `refunds`, `webhook_events`, `payment_idempotency`* |
| **Finance** | `ledger_entries`, `commission_rules`, `commissions`, `driver_adjustments`, `settlements`, `merchant_settlements`, `driver_settlements`, `compensations`, `accounting_exports` |
| **Delivery / ops** | `drivers`, `driver_locations`, `vehicles` (reference/types), `driver_shifts`, `shift_breaks`, `driver_performance`, `payout_requests`, `dispatch_assignments`, `operation_events` |
| **CMS / design** | `design_settings`, `screen_experiences`, `screen_experience_history`, `campaigns`, `campaign_events`, `app_config`, `settings` |
| **Growth / loyalty** | `referral_codes`, `referrals`, `cashback`, `cashback_campaigns`, `loyalty_tiers`, `loyalty_transactions`, `loyalty_rules`, `loyalty_rewards`, `affiliates`, `influencers`, `audience_segments`, `customer_segments`, `message_campaigns`, `promotions`, `growth_audit_log` |
| **Trust / KYC** | `account_status`, `kyc_reviews`, `merchant_documents`, `driver_documents`, `approval_history`, `suspensions`, `bans` |
| **Auth / RBAC** | `roles`, `permissions`, `role_permissions`, `user_roles`, `admin_users` |
| **Audit / support** | `audit_logs`, `support_tickets`, `support_messages` |

\* `tenants`, `payment_idempotency` exist as migrations but are **unapplied on live** until the corrected batch is pushed (Plan §P1.1).

## 3. Key entities (authoritative shapes)
### `vehicles` — reference / vehicle-**type** table (NOT fleet instances)
`id, type (unique: motorcycle|car|van|truck), name_en, name_ar, capacity, speed_kmh, pricing_modifier, is_active, created_at`. Consumed by `ops/vehicle.service.ts` + dispatch RPCs. RLS: enabled; `vehicles_read` (select true), `vehicles_admin_write` (auth_is_admin). Fleet **instances** (plate/insurance/driver assignment) will live in a future `fleet_vehicles` table (Plan §P1.4) — **not** on this table.

### `driver_shifts` — attendance (single source: migration 000028)
`id, driver_id → drivers, zone_id, scheduled_start, scheduled_end, actual_start, actual_end, status (scheduled|active|closed), created_at`. RLS (after batch): `driver_shifts_admin` (all, admin), `driver_shifts_self_read` (select, `driver_id = auth.uid()`). RPCs: `start_shift`, `end_shift`, `start_break`, `end_break`.

### `orders`
`id, customer_id → customers, branch_id → merchant_branches, driver_id → drivers, address_id, status, payment_status, total_amount, delivery_fee, delivery_lat/lng, branch_lat/lng_snapshot, created_at`. Merchant linkage is via **`branch_id`** (there is no `orders.merchant_id`). Indexes incl. `idx_orders_customer_created`, `idx_orders_branch_created`, `idx_orders_branch_status`* (new), `idx_orders_status_created`.

### `notifications`
`id, target_user_id, type, message, is_read, created_at`. New indexes: `idx_notifications_target_created`, `idx_notifications_target_unread`.

## 4. Referential integrity
FK-backed core: `orders.{customer_id,branch_id,driver_id}`, `order_items.order_id`, `cart_items.cart_id`, ops children (`driver_shifts.driver_id`, `shift_breaks.shift_id`, `dispatch_assignments.{order_id,driver_id}`) with `on delete cascade`. **Known soft spots (Phase 3/4):** `wallets.owner_id`, `notifications.target_user_id`, `audit_logs.record_id` are polymorphic (no FK by design); owner PKs (`customers/drivers/merchants.id`) are not FKs to `auth.users` while RLS assumes `id = auth.uid()`.

## 5. Index coverage (hot paths)
- Orders: customer history, branch+created, branch+status*, status+created, driver+status.
- Order items: `order_id`. Catalog: `category_id`, `branch_id`*. Wallet: `wallet_id+created`.
- Notifications: `target_user_id+created`*, `target_user_id+is_read`*. Dispatch: `order_id`, `driver_id+status`. Zones, addresses, push_tokens covered.
- `*` = added/reconciled in Phase 1 (`20260627000009`). `000027_scale_indexes` provides the measured-gain core set.

## 6. RLS coverage
- **91/94 enabled, 0 default-deny.** Pattern: owner policies (`= auth.uid()`), admin policies (`auth_is_admin()`), country-scoped admin (`auth_admin_country()` + `order_country_code()`), public-read on reference data.
- **Closed in Phase 1:** `driver_shifts` (self-read added). **Scheduled (Plan §P1.3):** `driver_performance`, `shift_breaks` (currently RLS-off).
- **Not yet modeled:** per-tenant RLS (`tenant_id`) — Phase 3.

## 7. Multi-tenancy (current vs target)
- **Current:** isolation axis = `country_code` for admin scoping (`admin_users.scope ∈ {super,country}`); `tenants` is a control/registry table (unapplied live). No per-row `tenant_id`, no per-tenant RLS.
- **Target (Phase 3):** `tenant_id` on every domain table + `(tenant_id, …)` composite indexes + per-tenant RLS as the isolation boundary. Phase-1 indexes/policies were chosen to remain compatible with this.

## 8. Open items carried forward
| Item | Owner phase |
|---|---|
| Push corrected batch to staging→prod (`tenants`, `payment_idempotency` land) | P1 deploy |
| Enable RLS on `driver_performance`, `shift_breaks` (+ smoke) | P1 §P1.3 |
| `fleet_vehicles` table + app repoint | Phase 2 |
| Canonical `schema.sql` dump + CI `db reset` gate | P1 §P1.5 |
| `tenant_id` + per-tenant RLS | Phase 3 |
| Identity model (`*.id = auth.uid()` vs FK to `auth.users`) | Phase 3/4 |
