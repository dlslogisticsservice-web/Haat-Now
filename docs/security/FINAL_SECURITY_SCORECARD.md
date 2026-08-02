# FINAL Security Scorecard

Independent external red-team of production `haat-now-prod`. Live impersonated attacks with
read-back evidence; zero residue. **Status:** BLOCKED = attack failed (protection held) ·
**SUCCEEDED** = exploit worked. Confidence reflects strength of reproducible evidence.

| Category | Status | Evidence | Confidence |
|---|---|---|---|
| **Referral / cashback economy (N-2)** | 🔴 **SUCCEEDED — CRITICAL** | `generate_referral_code`+`apply_referral_code`+`qualify_referral` minted **1,000,000.00** into two wallets; fake order id accepted | High |
| **Driver KYC/PII exposure (N-1)** | 🟠 **SUCCEEDED — Medium** | ordering customer read driver `national_id_number=NATID-XYZ`, `license_number=LIC-XYZ` | High |
| B1 order money/identity/status | BLOCKED | `payment_status` stayed `unpaid`; totals immutable | High |
| B2 driver payout RPC | BLOCKED | `complete_delivery_payout` revoked | High |
| B3 loyalty minting | BLOCKED | award/redeem revoked; direct insert 0 rows | High |
| B4 advanced coupon self-credit | BLOCKED | `redeem_advanced_coupon` revoked | High |
| B5 coupon/checkout tampering | BLOCKED | server-authoritative; totals immutable | High |
| B6 driver_earnings fabrication | BLOCKED | client INSERT privilege = false | High |
| B7 driver status impersonation | BLOCKED | `set_driver_status` revoked | High |
| B8 dispatch IDOR/accept | BLOCKED | `respond_dispatch` revoked anon+authed | High |
| RT-1 driver self-GPS spoof | BLOCKED | `current_lat` read-back `null` | High |
| RT-2 driver self-priority | BLOCKED | `priority_score` read-back `0` | High |
| F-1 complete_delivery caller-authz | BLOCKED | customer call raises; driver call works | High |
| F-2 finalize_driver_delivery | BLOCKED | fake/non-delivered order rejected | High |
| F-3 merchant KYC exposure | BLOCKED | non-owner tax_number = 0 rows; `merchants_public` safe | High |
| F-4 anon maintenance RPCs | BLOCKED | anon execute revoked (expire/recalc/auto_dispatch) | High |
| F-5 always-true INSERT policies | BLOCKED | scoped; no `with_check=true` remains | High |
| F-6 public bucket listing | BLOCKED | listing policies removed | High |
| F-7 mutable search_path | CLOSED | 13/13 pinned | High |
| F-8 pg_trgm in public | CLOSED | relocated to `extensions` | High |
| Wallet manipulation (direct) | BLOCKED | direct write + adjust/credit RPCs revoked | High |
| Privilege escalation (RBAC/admin) | BLOCKED | admin_users/user_roles not client-writable; assign_user_role admin-only | High |
| Payments (forge attempt/transaction) | BLOCKED | INSERT `with_check` = own customer/order | High |
| Refund / settlement / payout RPCs | BLOCKED | `is_ops_admin`/permission/self-only guards | High |
| Customer isolation (IDOR/BOLA) | BLOCKED | cross-customer reads 0 rows; order-cancel blocked | High |
| Merchant isolation | BLOCKED | cross-merchant writes rejected | High |
| Tenant isolation | BLOCKED | `auth_tenant()` from `tenant_members`; website_* scoped | High |
| Notifications | BLOCKED | own-only; no client INSERT grant | High |
| Storage / buckets / uploads | BLOCKED | own-folder/admin scoped; kyc private; non-listable | High |
| RLS / views / triggers coverage | BLOCKED | 0 RLS-disabled tables; 0 unintended definer views | High |
| Double-spend / replay / TOCTOU | BLOCKED | idempotency keys + unique constraints + row locks | High |
| Edge Functions / webhook / service-role | N/A | none deployed on prod | High |
| JWT / session / claims | N/A | GoTrue-signed; identity DB-derived | High |
| Country-admin / deep-links / SMS / push / rate-limiting | NOT FULLY EXERCISED | assessed by definition; deferred to post-fix re-validation | Low–Med |

## Tally
- **CRITICAL succeeded:** 1 (N-2). **Medium succeeded:** 1 (N-1).
- **Prior exploits (B1–B8, RT-1/2, F-1…F-8):** 18/18 **HELD**.
- **Isolation, escalation, payments, wallet-direct, double-spend:** all **HELD**.

**A reproducible CRITICAL financial exploit exists → the gate result is FAIL.**
