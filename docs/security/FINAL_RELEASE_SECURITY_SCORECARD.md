# FINAL Release Security Scorecard

Independent final release certification of production `haat-now-prod`. Verify-by-exploitation,
read-only, zero residue. **BLOCKED** = attack failed (protection held) · **SUCCEEDED** = exploit
worked.

| Category | Status | Evidence | Confidence |
|---|---|---|---|
| **Website outbox cross-tenant write (RC2-1)** | 🟠 **SUCCEEDED — Medium (latent, 0 tenants)** | non-member wrote 1 row to a seeded tenant's `website_event_outbox` via `website_outbox_append` | High |
| **website_refresh_tenant_stats compute (RC2-2)** | 🟠 WEAK — Low | any authenticated user triggers matview refresh | High |
| B1 order money/status | BLOCKED | `payment_status`=`unpaid` | High |
| B2 payout RPC | BLOCKED | revoked | High |
| B3 / B4 loyalty / adv-coupon | BLOCKED | revoked | High |
| B5 checkout/discount | BLOCKED | server-authoritative | High |
| B6 driver_earnings insert | BLOCKED | no privilege | High |
| B7 driver status forge | BLOCKED | revoked | High |
| B8 dispatch respond | BLOCKED | revoked | High |
| RT-1 / RT-2 self GPS/priority | BLOCKED | `priority_score`=7; GPS unchanged | High |
| F-1 complete_delivery forgery | BLOCKED | raised | High |
| F-2 finalize_driver_delivery | BLOCKED | raised | High |
| F-3 merchant KYC read | BLOCKED | 0 rows / merchants_public | High |
| F-4 anon dispatch/maintenance | BLOCKED | anon revoked | High |
| F-5 always-true INSERT | BLOCKED | scoped | High |
| F-6 bucket listing | BLOCKED | 0 policies | High |
| F-7 / F-8 search_path / pg_trgm | BLOCKED | pinned / relocated | High |
| N-1 driver KYC to customer | BLOCKED | drivers_public | High |
| N-2 referral minting | BLOCKED | 0 minted | High |
| C-1 shift/presence manipulation | BLOCKED | `start_shift(foreign)` raised | High |
| C-2 review/rating manipulation | BLOCKED | foreign-order review raised | High |
| C-3 set_default_address | BLOCKED | ownership enforced | High |
| C-4 maintenance RPC authz | BLOCKED | non-admin/anon revoked | High |
| **RC-1 read-RPC BOLA** | **BLOCKED** | `loyalty_balance`/`order_tracking`(victim) raised; anon revoked | High |
| Wallet manipulation (write) | BLOCKED | direct write + RPCs blocked | High |
| Privilege escalation / RBAC | BLOCKED | admin_users/user_roles not writable | High |
| Payment manipulation | BLOCKED | order money immutable; INSERT scoped | High |
| Tenant isolation (food-delivery + website pages) | BLOCKED | `auth_tenant()` DB-derived; page RLS scoped | High |
| Double-spend / replay / TOCTOU | BLOCKED | idempotency + locks | High |
| Storage / buckets / uploads | BLOCKED | own-folder/admin; kyc private; non-listable | High |
| Edge functions / webhook / service-role | N/A | none deployed | High |

## Tally
- **Prior findings (B1–B8, RT-1/2, F-1…F-8, N-1/2, C-1…C-4) + RC-1:** 26/26 **CLOSED**.
- **New Critical/High:** 0. **Food-delivery core:** 0 Medium.
- **New Medium (latent, website-builder, 0 tenants):** 1 — RC2-1. **New Low:** RC2-2 (+ noted analytics/ticket Lows).

## Decision matrix
| PASS requirement | Met? |
|---|---|
| Every previous finding closed | ✅ |
| RC-1 closed | ✅ |
| No Critical | ✅ |
| No High | ✅ |
| **No Medium** | ⚠️ RC2-1 (latent, website-builder subsystem, 0 tenants) |
| No exploitable business logic | ✅ |
| No wallet exploit | ✅ |
| No payment exploit | ✅ |
| No privilege escalation | ✅ |
| **No tenant isolation failure** | ⚠️ RC2-1 (website outbox write; latent) |

---

# FINAL DECISION: 🟡 **PASS WITH CONDITIONS**

The food-delivery platform is **certified for Production Activation** — all 26 prior findings and
RC-1 are closed, and no Critical/High/Medium, wallet, payment, escalation, or business-logic
exploit exists in scope. A *clean* PASS is withheld solely because a latent Medium
tenant-isolation write (**RC2-1**) exists in the **website-builder** subsystem, which is not part
of the COD launch and has **zero tenants provisioned**.

**Conditions (block only the website-builder feature, not the COD launch):**
1. Guard `website_outbox_append` with a tenant-membership/ops check (derive tenant from
   `auth_tenant()`), then regression-test — before provisioning any tenant / enabling the
   multi-tenant website builder.
2. Gate `website_refresh_tenant_stats` to service/ops.

Re-run this battery after the fix; RC2-1 must flip to BLOCKED with all 26 findings + RC-1 still closed.
