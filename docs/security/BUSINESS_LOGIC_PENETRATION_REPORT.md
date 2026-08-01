# HAAT NOW — Business-Logic Penetration Report

Adversarial READ-ONLY review of the entire business logic (SQL RPCs, RLS, edge functions,
services) against the production migration set. Nothing was modified. Every finding is
grounded in file:line evidence and cross-verified across five domain reviews.

## Root cause (one theme drives most Criticals/Highs)
The platform's happy-path RPCs are genuinely well-built (server-authoritative pricing,
idempotency, HMAC webhooks, atomic refunds). Two systemic gaps let attackers **bypass**
them:
1. **Direct PostgREST table writes** — `authenticated` holds table-wide `UPDATE`/`INSERT`
   on financially-sensitive tables (`orders`, `order_items`, `driver_earnings`,
   `search_analytics`) with only **row-level** RLS and **no column or state-transition
   guard** (`20260614000019_authenticated_grants.sql:22,50`). Postgres RLS is row-level,
   so a row owner can rewrite *any* column, sidestepping `create_order`/`complete_delivery`.
2. **Incomplete SECURITY DEFINER hardening** — the final pass
   `20260722000001_secure_definer_functions.sql` guarded a *subset* (wallet primitives,
   dispatch, payout, settlement, `redeem_coupon`) but **missed a parallel set** of
   money/points/dispatch RPCs that remain caller-trusting and broadly executable.

Net decision: **NOT READY** — multiple Critical financial-fraud vectors are exploitable by
any authenticated user. Fix = a focused "Hardening Pass #2" (~1–2 weeks), no features.

---

## CRITICAL

### C1 — Direct `orders` write: self-mark paid / lower total / forge status
- **Severity:** Critical (direct financial loss + payment bypass).
- **Attack scenario:** an authenticated customer creates a real order, then `PATCH /rest/v1/orders?id=eq.<own>` with `{"payment_status":"paid"}` (COD collected nothing) or `{"total_amount":1}` before calling `payment-initiate` (Moyasar then charges 1). A driver on an assigned order sets `{"status":"delivered"}` skipping the lifecycle.
- **Business impact:** unpaid orders treated as paid; pay-what-you-want on card; false completions; commission/settlement computed on tampered totals.
- **Technical cause:** table-wide `UPDATE` grant (`authenticated_grants.sql:22`) + ownership-only RLS `with check (customer_id = auth.uid())` (`20260721000003_rls_go_live_hardening.sql:58-64`) + **no BEFORE-UPDATE trigger** (the only `orders` triggers are AFTER + exception-guarded, "never block the transition" — `dispatch_unify_finalize.sql:16-17`). `payment_status` CHECK permits `'paid'` (`payment_status.sql:17`).
- **Reproduction:** login → create order → `PATCH orders {payment_status:'paid'}` → observe order paid, no ledger/webhook.
- **Recommended fix:** revoke blanket UPDATE; add a BEFORE-UPDATE trigger rejecting non-service changes to `payment_status,total_amount,delivery_fee,status,driver_id,branch_id,customer_id`, and enforce legal status transitions there. Route mutations through SECURITY DEFINER RPCs.
- **Estimated fix time:** 1–2 days.

### C2 — `complete_delivery_payout` payout inflation
- **Severity:** Critical (direct theft from platform).
- **Attack scenario:** driver sets `orders.status='delivered'` via the direct path (so no `driver_earnings` row exists), then calls `complete_delivery_payout(order, self, 999999)` — fee is caller-supplied and credited to the wallet.
- **Technical cause:** the safe `complete_delivery` (server-derived fee) superseded it, but the legacy RPC was left deployed & granted (`delivery_payout_rpc.sql:60-153`, `authenticated_grants.sql:54`); it has no `auth.uid()=driver` binding and was **not** in the hardening pass. The migration `0012` header literally names this "caller-supplied fee" risk as the thing it fixed — additively, not by removal.
- **Reproduction:** as an assigned driver, PATCH status→delivered, then `rpc complete_delivery_payout(orderId, myDriverId, 999999)`.
- **Recommended fix:** `REVOKE EXECUTE … FROM anon, public, authenticated` (or DROP it); `complete_delivery` already replaces it.
- **Estimated fix time:** 1 hour.

### C3 — Loyalty-points minting → wallet cash-out
- **Severity:** Critical (unlimited free money).
- **Attack scenario:** `award_points_for_event(me,'order',1e9,null)` — idempotency only fires when `p_ref` is non-null (`growth_retention_engine.sql:122`), so `p_ref=null` mints points every call; or `redeem_loyalty_points(me,-1000000,'x')` — `if balance < p_points` with a negative arg passes and inserts `+1,000,000` points (`feature_persistence.sql:82-88`); or unguarded `award_loyalty_points`. Points are then cashed via `redeem_loyalty_reward` (wallet_credit reward → internal `credit_customer_wallet`).
- **Technical cause:** these RPCs trust `p_customer`/`p_amount`, lack positivity/identity checks, and were **not** in the hardening pass (`20260722000001` only locked `credit_customer_wallet`/`award_cashback`).
- **Recommended fix:** require `p_ref` (mandatory idempotency) + `p_amount>0` + `p_customer=auth.uid()`; derive amount from the server order; revoke direct EXECUTE and re-expose via a guarded wrapper.
- **Estimated fix time:** 1 day.

### C4 — `redeem_advanced_coupon` self wallet-credit
- **Severity:** Critical (free wallet money).
- **Attack scenario:** call `redeem_advanced_coupon` with caller-supplied `p_customer`/`p_order_amount` and a `wallet_credit` coupon code → credits the caller's wallet directly (`growth_retention_engine.sql:47-89`); geo/merchant guards are skipped by passing `null`; fresh `order_id` each call.
- **Technical cause:** caller-trusted params + `wallet_credit` path + missed by hardening. *(Row-lock makes max_uses race-safe — the hole is identity/param trust, not concurrency.)*
- **Recommended fix:** `p_customer=auth.uid()`; derive amount/merchant/geo from the server order; enforce guards regardless of client nulls.
- **Estimated fix time:** 0.5 day.

---

## HIGH

### H1 — Coupon limits bypassed (unlimited reuse of capped/one-time codes)
`create_order` applies the discount but checks only `is_active`+`expires_at`, ignoring `max_uses/used_count/per_customer_limit/first_order_only/start_date/end_date` (`order_total_authoritative.sql:92-101`); the real `redeem_coupon` runs separately, client-side, best-effort, **after** the order (`CheckoutPage.tsx:123`), so a malicious client simply never calls it. **Fix:** fold `redeem_coupon` into `create_order` in one transaction; ~0.5 day.

### H2 — `set_driver_status` forges any driver's GPS/presence
SECURITY DEFINER, caller-supplied `p_driver_id`, no ownership/admin check, missed by hardening (`operations_engine.sql:385-391`). Self-spoof lat/lng onto every branch to win all dispatch, or `set_driver_status(rival,'offline',…)` to sabotage. Feeds `find_nearest_drivers` scoring. **Fix:** `p_driver_id=auth.uid() or is_ops_admin()` + revoke anon/public; ~1 h.

### H3 — Referral farming / qualify without a real order
`qualify_referral(p_referee,p_order_id)` never validates a real delivered/paid order for the referee (`growth_engine.sql:75-92`); `apply_referral_code` doesn't check `p_referee=auth.uid()`; default `max_uses=0` (unlimited). Farm accounts → self-code → fake-qualify → reward per account. *(Direct self-referral, duplicate-qualify, and double-referral ARE defended.)* **Fix:** tie qualification to a verified delivered order; per-referrer caps + anti-farming; ~1 day.

### H4 — `driver_earnings` fabrication
`"Drivers can insert own earnings"` INSERT policy (`enterprise_upgrade.sql:232`) + INSERT grant lets a driver insert arbitrary `driver_earnings` rows (inflate the balance `request_payout` reads). *(Payout still needs ops `approve_payout` — mitigates realization.)* **Fix:** drop the direct INSERT policy; earnings only via `complete_delivery`; ~1 h.

### H5 — Coarse admin tier: no country scoping on privileged actions
`is_ops_admin()`/`auth_is_admin()` carry no country or role filter; country scoping is applied to exactly one predicate (orders SELECT) and granular RBAC to only 3 money RPCs (`rbac_server_enforcement.sql:104-147`). A country=EG admin (or a `support_agent`/`marketing_manager` admin) can `review_kyc`/`ban_entity`/`generate_*_settlement`/`manual_dispatch` against any country/any domain. *(No customer→admin escalation exists — `admin_users` is uncrackable from the client.)* **Fix:** add country-scope + `auth_has_permission(...)` checks inside each privileged RPC; ~2–3 days.

### H6 — `respond_dispatch` IDOR + accept-after-timeout
Acts on `a.driver_id` without checking caller ownership, and `dispatch_assignments` is world-readable to authenticated (`operations_engine.sql:247-267,400-404`) → reject/accept any driver's offers (tanks rivals' acceptance-rate → priority score) or force-assign; also no `timeout_at` check, so an expired offer is acceptable until the sweeper runs. **Fix:** ownership guard + `if a.timeout_at<now() then return 'timeout'`; ~2 h.

---

## MEDIUM
| # | Finding | Cause / evidence | Fix |
|---|---|---|---|
| M1 | Core-table tenant isolation not enforced (cross-tenant catalog reads; `tenant_id` client-spoofable) | `tenant_isolation_foundation.sql` foundation-only; `merchants_discovery_read using(true)` | Complete staged RLS rollout + scope discovery to tenant |
| M2 | SVG upload → stored XSS on storage origin | `merchant-logos` public + allows `image/svg+xml` (`storage_foundation.sql:37`) | Remove SVG mime / sanitize + `Content-Disposition` |
| M3 | `role_permissions` write policy = any-admin (latent) | `rbac_server_enforcement.sql:53-55` (inert: no GRANT today) | Scope to `scope='super'` |
| M4 | No proof-of-delivery; customer can call `complete_delivery` | `delivery_atomicity.sql:49-169` (status+assigned-id only) | Require POD token + `auth.uid()` binding |
| M5 | Refund doesn't claw back points/cashback/referral | `atomic_refund.sql:92-144` | Reverse growth entries on `refund_confirm` |
| M6 | Loyalty cross-reward race → negative balance | reward-row lock, not customer lock (`:136-148`) | Per-customer advisory lock / balance constraint |
| M7 | Driver self-UPDATE `drivers` (priority_score/rating) | broad UPDATE grant + own-row policy | Column lockdown / RPC-only |
| M8 | Client INSERT arbitrary `payment_attempts` | `payment_attempts.sql:74-77` (no bounds) | Constrain to `provider='cod' AND amount=order total` |
| M9 | `website_outbox_append` cross-tenant event injection | no `auth_tenant()`/perm check (`website_persistence_runtime.sql:109-121`) | Guard `p_tenant=auth_tenant()` + `website.edit` |
| M10 | Admin builder raw-HTML richtext stored XSS (builder canvas only) | `components.tsx:60` unsanitized | Sanitize (DOMPurify) |
| M11 | `order_items` direct write (modify contents post-order) | broad grant + own-order policy | Column lockdown / RPC-only |

## LOW
- **L1** always-true INSERT on `search_analytics`/`campaign_events`/`order_status_history` → poisoning/audit-noise/`customer_id` spoof (`customer_parity.sql:276`, `enterprise_upgrade.sql:213`). Scope `with check` to `auth.uid()`.
- **L2** approval/KYC not gated at storefront (pending/suspended merchant discoverable/orderable). Gate discovery on `account_status='approved'`.
- **L3** shift/break RPCs operate on any driver (competitor sidelining). Ownership guard.
- **L4** theme-token CSS injection (tenant self-inflicted). CSS-escape token values.
- **L5** `website_reorder_pages` cross-tenant reorder (needs victim UUIDs). Enforce `p_tenant=auth_tenant()`.
- **L6** suspend/ban leaves driver in dispatch. Force offline on ban.
- **L7** public bucket object enumeration. Signed URLs if undesired.
- **L8** colliding driver-identity model (`drivers.id` vs `owner_user_id`). Reconcile.
- **L9** email-alias duplicate accounts (referral/coupon-farming enabler). Fingerprinting.

---

## Strong defenses confirmed (do not regress)
Server-authoritative + idempotent `create_order` (qty>0, `auth.uid()` ownership, fee cap); payment double-charge dedup + `payment_idempotency` lock; **HMAC fail-closed** webhook (constant-time, replay-dedup); atomic refund ceiling under `FOR UPDATE` + ops permission; wallet/ledger primitives **revoked** from `authenticated` (internal-only) + wallets have no direct-write policy; settlement pay = ops-only + lock + status guard; `redeem_coupon` race-safe; delivery **double-payout defended**; **multi-driver accept race defended** (single conditional-update winner); **NO customer→admin escalation** (`user_roles` deny-by-default, `admin_users` no client write); all privileged admin RPCs internally guarded (the "78 anon" advisory is defense-in-depth); **`website_*` tenancy fully enforced**; publish/preview signed + tenant-scoped; notifications admin-gated + no client INSERT; search returns active-catalog only; **storage MIME/size server-enforced** + path-traversal blocked; audit logs tamper-resistant (no delete policy); RBAC/`getAdminScope` fail-closed.

## Consolidated remediation (Hardening Pass #2)
1. **Lock financial tables:** revoke blanket UPDATE/INSERT on `orders`/`order_items`/`driver_earnings`/`search_analytics`; add BEFORE-UPDATE trigger enforcing column immutability + legal order-status transitions. (C1, M7, M8, M11, H4, L1)
2. **Finish the SECURITY DEFINER pass:** DROP/revoke `complete_delivery_payout`; guard/positivity-check `award_points_for_event`, `award_loyalty_points`, `redeem_loyalty_points`, `redeem_loyalty_reward`, `redeem_advanced_coupon`, `qualify_referral`, `set_driver_status`, `respond_dispatch`, shift/break, `website_outbox_append`, `website_reorder_pages`. (C2, C3, C4, H2, H3, H6, M9, L3, L5)
3. **Coupons:** fold redemption limits into `create_order`. (H1)
4. **Admin scoping:** country + granular-permission checks in privileged RPCs; scope `role_permissions` writes to super. (H5, M3)
5. **Tenant + misc:** complete core-table tenant RLS; remove SVG from `merchant-logos`; POD on delivery; refund reward clawback; sanitize builder richtext. (M1, M2, M4, M5, M10)

**Estimated total:** ~1–2 weeks, no feature work.
