# FINAL Release Security Certificate

**System:** HAAT NOW production `haat-now-prod` (`ckmqxhjdrfztkunqprax`)
**Assessment:** Final independent release certification — verification by exploitation,
**strictly read-only** (no code, migration, deploy, or infrastructure change). Every result is
fresh, reproducible evidence from live impersonated attacks (`SET ROLE` + forged
`request.jwt.claims`) with read-back of the stored value/row; all probes self-cleaned to zero
residue. Nothing was trusted — not prior reports, not regression suites.

## Result: 🟡 **PASS WITH CONDITIONS**

- **Every previous finding (B1–B8, RT-1/2, F-1…F-8, N-1/2, C-1…C-4) and RC-1 remains CLOSED** —
  re-attacked live.
- The **food-delivery core** (auth, wallet, payments, checkout, orders, dispatch, drivers,
  merchants, coupons, referral, storage, RLS) has **no Critical, no High, no Medium**, and no
  exploitable wallet / payment / privilege-escalation / business-logic issue.
- **One new Medium** was found, confined to the **website-builder** subsystem and **latent** in
  production (zero tenants provisioned): a cross-tenant write via `website_outbox_append`. Because
  a tenant-isolation write gap exists in the codebase, a *clean* PASS is withheld; it is the
  **condition** below. Plus one Low (`website_refresh_tenant_stats` compute/DoS).

The certified **food-delivery platform is approved for Production Activation**; the website-builder
multi-tenant subsystem must not be enabled / no tenant provisioned until the condition is fixed.

---

## Part 1 — All previous findings + RC-1 re-tested: CLOSED (fresh evidence)

| Finding | Live re-attack | Result |
|---|---|---|
| B1 | order payment/total tamper | CLOSED — `payment_status` = `unpaid` |
| B2 | `complete_delivery_payout` | CLOSED — revoked |
| B3 / B4 | loyalty / advanced-coupon RPCs | CLOSED — revoked |
| B5 | checkout/discount forgery | CLOSED — server-authoritative |
| B6 | `driver_earnings` insert | CLOSED — no privilege |
| B7 | `set_driver_status` | CLOSED — revoked |
| B8 | `respond_dispatch` | CLOSED — revoked |
| RT-1 / RT-2 | driver self-GPS / self-priority | CLOSED — `priority_score` = `7`, GPS unchanged |
| F-1 | customer forges `complete_delivery` | CLOSED — raised |
| F-2 | `finalize_driver_delivery` fake order | CLOSED — raised |
| F-3 | merchant KYC read | CLOSED — 0 rows / `merchants_public` |
| F-4 | anon dispatch/maintenance | CLOSED — anon revoked |
| F-5 | always-true INSERT policies | CLOSED — scoped |
| F-6 | public bucket listing | CLOSED — 0 policies |
| F-7 / F-8 | search_path / pg_trgm | CLOSED |
| N-1 | driver KYC to customer | CLOSED — `drivers_public` |
| N-2 | referral wallet minting | CLOSED — arbitrary owner blocked; **0 minted** |
| C-1 | shift/presence manipulation | CLOSED — `start_shift(foreign)` raised |
| C-2 | review/rating manipulation | CLOSED — foreign-order review raised |
| C-3 | `set_default_address` | CLOSED — ownership enforced |
| C-4 | maintenance RPC authz | CLOSED — non-admin/anon revoked |
| **RC-1** | **read-RPC BOLA** | **CLOSED — `loyalty_balance(victim)` & `order_tracking(victim)` both raised** |

Also re-verified: wallet direct write blocked; privilege escalation (`admin_users`/`user_roles`)
blocked; 0 RLS-disabled public tables. **26/26 findings closed.**

---

## Part 2 — NEW findings

### RC2-1 — Cross-tenant write via `website_outbox_append` (MEDIUM, latent)
- **Category:** OWASP API1 (BOLA) / tenant-isolation write — website-builder subsystem.
- **Root cause:** `website_outbox_append(p_tenant, …)` is `SECURITY DEFINER`, `EXECUTE`-granted to
  `authenticated`, and inserts into `website_event_outbox` with the **client-supplied
  `p_tenant`** and **no tenant-membership check** (it bypasses the table's tenant RLS).
- **Evidence (live):** a plain customer (not a member of the tenant) called
  `website_outbox_append(<real tenant>, 'attack', …)` and **1 row** was written to that tenant's
  outbox. (With a *non-existent* tenant the FK blocks it — so the guard today is only the FK, not
  authorization.)
- **Latency / exposure:** production currently has **0 tenants provisioned** (`tenants` is empty)
  and the website-builder multi-tenancy is not part of the COD closed-beta scope, so the write is
  **not exploitable against real data today**. The defect is the unguarded mechanism: the first
  provisioned tenant would be immediately targetable for cross-tenant event injection.
- **Impact:** an authenticated user could enqueue outbox events (async processing / publish /
  webhook triggers) for another tenant's site. No food-delivery, wallet, payment, or PII impact.
- **Business risk:** Medium — tenant-isolation/integrity within the website builder, gated behind
  it being enabled.
- **Recommended fix (next sprint — do NOT fix in this read-only cert):** require the caller to
  belong to `p_tenant` (`exists (select 1 from tenant_members where tenant_id = p_tenant and
  user_id = auth.uid())` or ops); prefer deriving the tenant from `auth_tenant()` rather than a
  client argument. Add a regression test.

### RC2-2 — `website_refresh_tenant_stats` unauthenticated compute (LOW)
Any authenticated user can trigger a full `REFRESH MATERIALIZED VIEW` (compute/DoS). No data
exposure. Fix: gate to service/ops.

**Also noted (Low, accepted):** `order_country_code(p_order_id)` returns an order's country by id
(auth-only; used by the admin-scope RLS policy — low sensitivity); `add_ticket_message` writes to
a ticket by id without ownership (UUID-gated latent); `g_audit`/`log_approval`/`track_banner`
self-attributed analytics/audit noise.

---

## Part 3 — Coverage assessed with no additional finding

Authentication/JWT/OTP (GoTrue-managed; identity/tenant/admin DB-derived) · Authorization/RBAC
(role RPCs admin-gated; `admin_users`/`user_roles` not client-writable) · **BOLA/IDOR** read-side
(RC-1 closed — all owner/ops read RPCs guarded) and write-side (C-1/C-2/C-3 closed) · Wallet
(mutators revoked; direct write blocked) · Payments (order money immutable; payment INSERT scoped;
refund ops/service-only) · Checkout/Coupons (server-authoritative) · Dispatch/Drivers (RT/F/C
closed) · Merchants/Inventory (ownership-enforced) · CMS/Website Builder (pages tenant-scoped via
`auth_tenant()`; **outbox RPC gap = RC2-1**) · Storage/Buckets (own-folder/admin; kyc private;
non-listable) · Edge Functions (none deployed) · Queues (`website_event_outbox` — RC2-1) ·
Analytics/Audit logs (self-attributed only) · Business logic / race / replay / double-spend
(idempotency + locks). **Tenant isolation (food-delivery + website pages): intact.** The single
gap is the website-builder outbox write (RC2-1), latent behind an unprovisioned subsystem.

---

## Conditions (mandatory before the website-builder subsystem is activated / any tenant provisioned)
1. **RC2-1 (Medium):** add a tenant-membership/ops guard to `website_outbox_append` (block
   cross-tenant writes; derive tenant from `auth_tenant()`).
2. **RC2-2 (Low):** gate `website_refresh_tenant_stats` to service/ops.

Neither blocks the **COD food-delivery** Production Activation (website builder is out of that
scope and has zero tenants). They **do** block enabling the multi-tenant website builder.

## Decision
🟡 **PASS WITH CONDITIONS** — the food-delivery platform is certified for Production Activation
(all 26 prior findings + RC-1 closed; no Critical/High/Medium in scope; no wallet/payment/
escalation/business-logic/tenant-isolation exploit). One latent Medium (RC2-1) and one Low
(RC2-2) in the not-yet-enabled website-builder subsystem are conditions to remediate before that
subsystem goes live. See `FINAL_RELEASE_SECURITY_SCORECARD.md`.
