# Security Review — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Adversarial review. Evidence cited `file:line`. **Caveat:** migration *source* was reviewed, not the live `pg_policies` state; findings marked ⚠️VERIFY must be confirmed against the running DB with `select … from pg_policies` and Supabase `get_advisors`.

Severity: 🔴 High · 🟠 Medium · 🟡 Low · 🟢 Strength.

---

## Strengths (credit where due)

- 🟢 **Webhook security is genuinely enterprise-grade** — HMAC-SHA256, constant-time compare, **fail-closed** when the secret is absent, idempotency + race handling (`payment-webhook/index.ts:62-140`).
- 🟢 **Payment amount authority is server-side** — charge amount derived from DB order total, client amount only cross-checked ±0.01 (`payment-initiate:109-126`); caller identity verified against `customerId` (`:74-77`).
- 🟢 **Money tables are read-only to clients; writes go through `SECURITY DEFINER` RPCs** with `SELECT FOR UPDATE` (wallet, delivery, finance).
- 🟢 **Privilege tables are locked** — `user_roles` is SELECT-only own-row with no INSERT/UPDATE policy (`enterprise_upgrade.sql:206-208`); `admin_users` SELECT-only via grants (`authenticated_grants.sql:40`). **Clients cannot self-assign roles/admin.**
- 🟢 Role assignment RPCs hard-check caller is admin and forbid revoking the base `customer` role (`role_provisioning.sql:98-169`).

---

## Findings

### 🔴 S-1 — Granular RBAC is not enforced server-side
Two disconnected RBAC systems. The rich 35-permission matrix (`rbac.service.ts:30-66`, 9 templates) lives **only in the browser / localStorage** (`RBAC_KEY` `:116-123`) and only hides UI. Server-side RLS collapses all admin authority to a single boolean `auth_is_admin()` / `is_ops_admin()` (`operations_engine.sql:10-13`). **There is no server check for `finance.pay` vs `support.view`.** Any admin row in `admin_users` can perform **every** admin-gated write. The permission UI implies least-privilege the backend does not enforce.
**Impact:** a "Support Agent" admin can execute settlements, KYC approvals, refunds, RBAC edits. **Fix:** move permissions into a `role_permissions` table and gate RLS/RPCs on specific permissions.

### 🔴 S-2 — Country isolation not applied to money/operations tables
Country scoping (`auth_admin_country()`, `auth_admin_scope()`) is applied to **only two tables** — `orders` and the `admin_users` roster (`admin_country_scoping.sql:52-69`). The migration itself flags the rest as TODO (`:71-72`). Finance and Operations engines gate on `is_ops_admin()` with **no country predicate** (`finance_engine.sql:352`, `operations_engine.sql:404`). **A country-scoped EG admin can read/write settlements, commissions, payouts, dispatch, KYC and campaigns for ALL countries.**

### 🔴 S-3 — Tenant isolation absent (multi-tenant leakage by design)
`tenant_id` exists but is **nullable, unreferenced by any RLS policy**; `auth_tenant()` resolver exists but is used by nothing (`tenant_isolation_foundation.sql:1-59`). If two brands' data ever share the DB, **all tenants share one RLS namespace** governed only by per-user ownership + coarse admin scope. Latent today (single brand), but the control is **Missing**. See MULTI_TENANCY_AUDIT.

### 🟠 S-4 — Permissive `using(true)` PII policies were never dropped ⚠️VERIFY
`20260614000004_security_hardening.sql` created `"Anyone can select drivers"` (`:167-168`) and `"Anyone can select merchants"` (`:176-177`), both `for select using (true)`. **No migration drops these** (verified: grep for a drop of `"Anyone can select"` returns nothing). Later scoped policies are **OR-combined** with them, so the permissive policy wins → **driver/merchant PII (phone numbers) readable by any authenticated user.** Confirm against live `pg_policies`; if present, drop the permissive policies and keep the scoped ones.

### 🟠 S-5 — Refund flow is not atomic (money integrity)
No lock, no `UNIQUE` on `refunds` → concurrent partial refunds can both pass the ceiling check and **over-refund**. Order is marked refunded **before** the gateway call (`payment-refund:131-213`) → gateway failure leaves a persistent inconsistency. See FLOW_RESILIENCE §3.

### 🟠 S-6 — Server-side double-charge protection depends on the client
The per-attempt idempotency key is a random UUID (`payment-initiate:168`); the real dedup is a **browser-side** lock (`payment-orchestrator:25-33`) plus an unlocked "reuse pending attempt" read. A direct edge-function caller can create a second charge. **Fix:** derive the key from `order_id`.

### 🟠 S-7 — KYC status is not a gate
`account_status` (approved/suspended/banned) is never checked by order/checkout/driver-assignment code. A banned merchant/driver can still transact. See CROSS_MODULE.

### 🟡 S-8 — Applied-vs-declared migration drift
`rls_recovery.sql:5-8` documents a prior P0 where **21 tables had RLS enabled with zero policies** (full lockout) and that 0018's admin policies "never landed". This proves the applied policy set has diverged from the files before. **The live policy set must be audited directly, not inferred from migrations.**

### 🟡 S-9 — Client-trusted inputs
- Order `total_amount`/`delivery_fee` authored by client at insert (`order.service.ts:38-40`) — only re-validated at payment.
- First-login `customers` insert trusts client `full_name` (`auth.service.ts:126`).
- No per-user coupon cap (`redeem_coupon`) → coupon farming.

### 🟡 S-10 — Auth surface gaps
Dead Apple/Google buttons (`LoginScreen.tsx:298-313`); only phone OTP exists. Rate limiting on OTP send relies on Supabase defaults (not configured in-repo).

---

## Category ratings

| Area | Rating | Note |
|---|---|---|
| Authentication | 🟠 | Real OTP; no MFA options; dead social UI |
| Authorization (coarse) | 🟢 | Admin-gated RPCs, locked privilege tables |
| Authorization (granular) | 🔴 | Client-only (S-1) |
| RLS coverage | 🟠 | Broad but permissive-leak + drift (S-4, S-8) |
| Multi-tenant isolation | 🔴 | Not enforced (S-3) |
| Country isolation | 🔴 | Money/ops unscoped (S-2) |
| Secrets / env | 🟢 | Gateway secrets server-side only; `.env*` gitignored |
| Webhook validation | 🟢 | Best-in-class (fail-closed HMAC) |
| Payment integrity | 🟡 | Strong capture, weak refund + client-dependent dedup |
| Input validation | 🟡 | Client-trusted totals |
| Injection | 🟢 | Parameterized RPCs / PostgREST; no raw SQL from client |
| Rate limiting | 🟡 | Supabase defaults only |
| Sensitive logging | 🟢 | Edge logs avoid card data; payloads stored server-side |

**Overall security posture:** Strong at the **payment/money core**, weak at **authorization granularity, tenant/country isolation, and refund integrity**. None of S-1..S-3 are safe for a true multi-tenant, multi-country production launch without remediation. Priority: verify S-4 against the live DB immediately (potential live PII exposure).
