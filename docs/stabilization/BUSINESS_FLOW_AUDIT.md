# Business Flow Audit — HaaT Now

> **Independent Enterprise CTO Audit · Phase 8 · Documentation only**
> Date: 2026-07-05 · Branch: `feat/website-platform-architecture`
> Method: source + migration evidence only (live DB not queried). Every claim is cited `file:line`.

## 0. The single most important fact about this platform

HaaT Now is a **dual-mode** application:

| Mode | Trigger | Data path | Ships as |
|---|---|---|---|
| **Sandbox** | `VITE_AUTH_MODE=sandbox` (default) | 100% client-side `localStorage` (`src/services/sandboxStore.ts`) + a recursive no-op Supabase stub (`src/lib/supabase.ts:19-35`) | **The default production build** |
| **Live** | `HAAT_LIVE_BACKEND=1` at build | Real Supabase (50 migrations, RLS, RPCs) + 4 payment edge functions | Opt-in only |

Evidence: `vite.config.ts:6-16` — *"The platform ships as a SELF-CONTAINED DEMO … Force sandbox at build time … A real backend deploy opts in explicitly with `HAAT_LIVE_BACKEND=1`."*

**Consequence for this audit:** Almost every business flow has *two* implementations. The sandbox path is a convincing, fully-wired **demo**; the live path is a **partially-wired backend**. Many flows that "work" end-to-end in the shipped build work **only because** they run against localStorage. This audit reports the **live-mode** readiness, because that is what "production" means for an enterprise buyer. Where a flow exists only in sandbox, it is marked **Sandbox-only**.

Risk legend: 🟢 Ready · 🟡 Partial / manual · 🟠 Weak · 🔴 Missing / broken for production.

---

## 1. Flow inventory & readiness

### 1.1 Customer Registration & Authentication — 🟡 Partial
- **Actors:** Customer · Supabase GoTrue (live) / demo store (sandbox).
- **Entry:** `src/features/auth/LoginScreen.tsx`. **Exit:** authenticated `User` + role.
- **Live:** real phone OTP — `authService.sendOtp`→`supabase.auth.signInWithOtp` (`auth.service.ts:96`), `verifyOtp`→`supabase.auth.verifyOtp` (`:118`). First login auto-creates a `customers` row (`:124-127`).
- **Sandbox:** 10 hard-coded accounts, fixed OTP `123456` (`auth.service.ts:15,21-32`).
- **Missing links:** No email/password, no magic-link, no social login. The Apple/Google buttons are **dead UI with no handler** (`LoginScreen.tsx:298-313`). Role resolution is client-side highest-priority (`resolveHighestRole` `:45-77`).
- **Manual steps:** first admin must be bootstrapped by direct SQL (`20260614000006_role_provisioning.sql:89-91`).
- **Production readiness:** 🟡 — OTP is real but SMS provider must be configured in Supabase; alternative login methods advertised in UI do not exist.

### 1.2 Address Management — 🟢 (live) / 🟢 (sandbox)
- Tables + RLS in `20260614000009_customer_profile_addresses.sql`. Repositories `customer.repository.ts`. Owner-scoped RLS (`customer_id = auth.uid()`). Readiness 🟢.

### 1.3 Browse / Search / Restaurant / Merchant / Product — 🟢 read, 🟡 catalog authority
- Storefront `HomeScreen.tsx`, `DiscoverScreen.tsx`, `RestaurantScreen.tsx`. Catalog RLS `20260614000007_catalog_rls.sql`, CRUD `20260627000004_catalog_crud.sql`.
- **Caveat:** merchant/driver rows are readable by **any authenticated user** via a permissive `using(true)` SELECT policy that was never dropped (`20260614000004_security_hardening.sql:167-177`) — see SECURITY_REVIEW §PII.

### 1.4 Cart → Checkout → Order Creation — 🟠 Not atomic
- **Cart** is `localStorage`-authoritative even in live mode; remote sync is a sandbox no-op (`cart.service.ts:23-35,133,191`). Totals computed **client-side** and re-computed in the page (`cart.service.ts:107-129`, `CheckoutPage.tsx:287-290`).
- **Order creation** is **three un-transacted writes**: `insertOrder`→`insertOrderItems`→`insertStatusHistory` + merchant notification (`order.service.ts:25-77`). There is **no `create_order` RPC**. "Atomicity" is a best-effort compensating `deleteOrder` (`:59-61`) — a crash between steps leaves an **orphan order with no items**.
- `total_amount` and `delivery_fee` are **authored by the client** at insert (`CheckoutPage.tsx:335`→`order.service.ts:38-40`). No server-side price authority.
- **Production readiness:** 🟠 — money-bearing write with no transaction and client-trusted totals.

### 1.5 Coupon — 🟢 redemption atomic, 🟡 abuse
- `redeem_coupon` RPC is race-safe: `SELECT … FOR UPDATE`, per-order idempotency via `UNIQUE(coupon_id, order_id)`, re-validates active/expiry/limit (`20260614000029_coupon_redemption.sql:13-40`).
- **Gap:** only a **global** `max_uses`; **no per-user cap** anywhere. One customer can farm a coupon across unlimited orders until the global cap. Readiness 🟡.

### 1.6 Payment — 🟢 gateway, 🟡 server-side dedup
- Real **Moyasar** charge via edge function; amount taken from **DB order total**, not client (`payment-initiate/index.ts:122-126`); order re-checked for paid/cancelled (`:96-104`); caller identity verified (`:74-77`).
- Webhook is **genuinely enterprise-grade**: HMAC-SHA256, constant-time compare, **fail-closed** if secret missing, idempotency via `webhook_events.idempotency_key` UNIQUE + 23505 race catch, no-downgrade guards (`payment-webhook/index.ts:62-209`).
- **Gap:** the per-attempt idempotency key is a **random UUID** (`payment-initiate:168`), so server-side double-charge protection depends on a **client-side** lock (`payment-orchestrator.service.ts:25-33`) plus a non-locked "reuse pending attempt" read. A caller hitting the edge function directly can bypass it. Readiness 🟡.

### 1.7 Wallet — 🟢 Atomic
- `adjust_wallet_balance` uses `SELECT … FOR UPDATE`, auth guard, negative-balance guard, update + ledger insert in one `SECURITY DEFINER` txn (`20260614000003_wallet_atomic_rpc.sql:4-61`). Client never does balance math. Readiness 🟢. (Latent: no `UNIQUE(owner_type, owner_id)` on `wallets`; `getWallet` uses `.single()`.)

### 1.8 Dispatch / Driver Assignment — 🔴 for production default; 🟡 live
- A **real dispatch engine** exists: `find_nearest_drivers` (haversine + workload − priority), `auto_dispatch_order`, `respond_dispatch` (race-safe), `manual_dispatch_order`, `reassign_order`, `expire_dispatch_offers` (`20260614000028_operations_engine.sql:159-284`).
- **But:** (a) it is **entirely no-op in sandbox** — the shipped build has no dispatch (`dispatch.service.ts:34,55,64,73`); (b) it is **never auto-triggered on order creation** — the only caller is an admin clicking buttons (`OperationsCenter.tsx:118-154`); (c) there is **no scheduler** — `expire_dispatch_offers`/`reassign_order` run only when an admin clicks (no pg_cron, no cron edge function).
- **Two disconnected assignment systems:** the DriverApp uses a *separate* direct-claim path (`driver.repository.ts:47-52 acceptDeliveryAtomic`) that does **not** touch `dispatch_assignments` or increment `drivers.active_orders`. The post-delivery finalizer `finalize_driver_delivery` (which frees workload) is **dead code — zero callers** (verified). Result: `active_orders` inflates permanently and corrupts future scoring.
- **Production readiness:** 🔴 — no automatic dispatch, no timeout automation, inconsistent bookkeeping between two paths.

### 1.9 Pickup → Delivery → Completion & Payout — 🟢 Atomic (strongest flow)
- `complete_delivery()` wraps the whole finalization in one txn: order `FOR UPDATE`, driver-match, transition validation (`on_the_way→delivered`), status + history, `driver_earnings` insert (`UNIQUE(order_id)` backstop), wallet `FOR UPDATE` + balance + ledger (`20260614000012_delivery_atomicity.sql:49-169`). Idempotent. Called single-shot (`DriverApp.tsx:330`). Readiness 🟢.
- **Gap:** does not free dispatch workload (see 1.8).

### 1.10 Tracking — 🟢 customer pipeline (live), 🟡 location store, 🔴 sandbox
- Customer tracking is real: `order_tracking` RPC computes `remaining_km`/ETA (`20260614000034_customer_parity.sql:101-128`); realtime subscriptions on `orders` + `driver_locations` with 15s poll fallback (`cx.service.ts:107-113`, `OrderTrackingMap.tsx:34`).
- **Gap:** GPS writes to `driver_locations.coords` (`tracking.repository.ts:18-24`) but `order_tracking`/`find_nearest_drivers` read `drivers.current_lat/lng`, written only by `set_driver_status` which the GPS loop **never calls** → **stale coordinates**. Route line is a straight geodesic, not road routing (`OrderTrackingMap.tsx:10-23`). Sandbox has no tracking.

### 1.11 Cancellation — 🟠 pending-only
- `cancelOrder` rejects anything past `pending` (`order.service.ts:133-152`). Once a driver has the order there is **no customer cancellation path**. Merchant reject is a bare status write with no side effects (`MerchantApp.tsx:290-300`).

### 1.12 Refund — 🔴 no in-app path, non-atomic edge
- **Nothing in the application inserts a refund** — the only reference is a read (`finance.service.ts:162`). Refunds are edge-function only (`payment-refund`), and that path is **not atomic**: read-then-write TOCTOU on the ceiling with no lock/unique constraint on `refunds`, and it marks the order refunded **before** calling Moyasar (`payment-refund/index.ts:131-213`). Cancelling a paid order therefore triggers **no automatic money-back** anywhere.

### 1.13 Settlement / Finance Posting — 🟢 engine, 🔴 reconciliation
- Real **double-entry ledger**: `post_ledger` enforces `Σdebit=Σcredit`, idempotent on `txn_id`; commission/settlement engines locked + idempotent (`20260614000031_finance_engine.sql:30-46,73,221-268`).
- **Gap:** gateway **captures and refunds never post to the ledger** — the ledger is a *model* fed only by commission/settlement/adjustment/compensation RPCs, not reconciled to real cash. Refund flow never calls `post_ledger`. Finance is **sandbox-only** in the demo (`finance.service.ts:13`).

### 1.14 Notifications — 🟡 in-app only
- In-app DB rows only; `sendNotification`→insert (`notification.service.ts:15-18`). `push_tokens` registered but **nothing consumes them** — no FCM/APNs/SMS/email worker (only payment edge functions exist). Order events fire notifications via **service calls** (`order.service.ts:74,120-126`; `wallet.service.ts:38-40`) — but any status change **outside** `orderService` (e.g. the ops console) fires **nothing**.

### 1.15 Analytics — 🟢 real aggregation, cosmetic deltas
- Real aggregation queries on `orders`/`driver_earnings` (`analytics.service.ts:13-51`); admin dashboard uses real RPCs (`AdminDashboardHome.tsx:88-91`). **But** KPI trend deltas/sparklines are **hard-coded decorations** (`AdminDashboardHome.tsx:101-106`).

### 1.16 CRM / Campaign / Loyalty / Subscriptions
- **CRM/CX:** support tickets use real RPCs but are **never auto-created** from order/payment failures — manual only (`cx.service.ts:116`).
- **Campaigns:** impressions/clicks fire from storefront (`HomeScreen.tsx:106,165`), but **conversion attribution has no caller** — checkout never calls `campaignService.track('conversion')` (`campaign.service.ts:85`) → campaign ROI is structurally always zero. Message campaigns only mark `status='sent'` — *"actual push/SMS/email delivery requires provider integration (not present)"* (`20260614000033_growth_engine.sql:250-251`). Segment recompute is manual (no pg_cron despite the comment).
- **Loyalty:** 🔴 **disconnected** — `awardPoints` has **zero callers** (verified); `complete_delivery` awards no points; only the sandbox grants points (`sandboxStore.ts:173-178`). Production customers can **redeem** points they can never legitimately **earn**.
- **Subscriptions:** UI + service exist but persist to `adminCrud`/localStorage in sandbox; no real recurring billing engine (see WHITE_LABEL_READINESS).

### 1.17 Website Builder / White Label Provisioning
- See dedicated report `WHITE_LABEL_READINESS.md`.

---

## 2. Readiness summary

| Flow | Live readiness | Blocker |
|---|---|---|
| Auth (OTP) | 🟡 | No email/pw; dead social buttons; SMS provider config |
| Address / Browse | 🟢 | PII SELECT leak (drivers/merchants) |
| Cart → Order create | 🟠 | Not transactional; client-authored totals |
| Coupon | 🟡 | No per-user cap |
| Payment | 🟡 | Server double-charge dedup is client-dependent |
| Wallet | 🟢 | — |
| Dispatch | 🔴 | No auto-trigger, no scheduler, two inconsistent systems |
| Delivery + payout | 🟢 | Workload not freed |
| Tracking | 🟡 | Stale location store; no road routing |
| Cancellation | 🟠 | Pending-only |
| Refund | 🔴 | No in-app path; non-atomic edge |
| Settlement/Finance | 🟡 | Ledger not reconciled to gateway cash |
| Notifications | 🟡 | In-app only; no push/SMS/email delivery |
| Analytics | 🟢 | Cosmetic fake deltas |
| Loyalty | 🔴 | Earning disconnected |
| Campaign attribution | 🔴 | Conversion never tracked |

**Bottom line:** The **money spine** (payment capture, wallet, delivery payout, finance ledger) is genuinely strong and atomic where it matters. The **fulfillment spine** (order-create atomicity, automatic dispatch, refund/compensation, cross-module reactions) is where business integrity breaks. The shipped default build is a **demo**, not the live backend.
