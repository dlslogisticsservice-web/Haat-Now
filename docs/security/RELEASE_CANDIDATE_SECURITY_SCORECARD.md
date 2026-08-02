# Release Candidate — Security Scorecard

Independent RC certification of production `haat-now-prod`. Verify-by-exploitation, read-only,
zero residue. **BLOCKED** = attack failed (protection held) · **SUCCEEDED** = exploit worked.

| Category | Status | Evidence | Confidence |
|---|---|---|---|
| **BOLA / IDOR on read RPCs (RC-1)** | 🔴 **SUCCEEDED — Medium** | `loyalty_balance(victim)`=250; `order_tracking(victim)` returned driver name/phone/GPS+destination; `reorder_items(victim)` returned items; `driver_wallet_summary`/`cashback_balance` cross-account | High |
| B1 order money/status | BLOCKED | `payment_status` stayed `unpaid` | High |
| B2 payout RPC | BLOCKED | revoked | High |
| B3 loyalty mint | BLOCKED | revoked | High |
| B4 advanced coupon | BLOCKED | revoked | High |
| B5 checkout/discount | BLOCKED | server-authoritative | High |
| B6 driver_earnings insert | BLOCKED | no privilege | High |
| B7 driver status forge | BLOCKED | revoked | High |
| B8 dispatch respond | BLOCKED | revoked | High |
| RT-1 self-GPS spoof | BLOCKED | unchanged | High |
| RT-2 self-priority | BLOCKED | `priority_score`=7 | High |
| F-1 complete_delivery forgery | BLOCKED | raised | High |
| F-2 finalize_driver_delivery | BLOCKED | raised | High |
| F-3 merchant KYC read | BLOCKED | 0 rows | High |
| F-4 anon dispatch/maintenance | BLOCKED | anon revoked | High |
| F-5 always-true INSERT | BLOCKED | scoped | High |
| F-6 bucket listing | BLOCKED | 0 policies | High |
| F-7 search_path | BLOCKED | pinned | High |
| F-8 pg_trgm | BLOCKED | relocated | High |
| N-1 driver KYC to customer | BLOCKED | base 0 / projection safe | High |
| N-2 referral minting | BLOCKED | 0 minted | High |
| C-1 shift/presence manipulation | BLOCKED | `start_shift(foreign)` raised | High |
| C-2 review/rating manipulation | BLOCKED | foreign/forged/pre-delivery rejected | High |
| C-3 set_default_address | BLOCKED | foreign rejected | High |
| C-4 maintenance RPC authz | BLOCKED | non-admin/anon rejected | High |
| Wallet manipulation (write) | BLOCKED | direct write + RPCs blocked | High |
| Privilege escalation / RBAC | BLOCKED | admin_users/user_roles not writable | High |
| Payment manipulation | BLOCKED | order money immutable; INSERT scoped | High |
| Tenant isolation | BLOCKED | `auth_tenant()` DB-derived | High |
| Double-spend / replay / TOCTOU | BLOCKED | idempotency + locks | High |
| Storage / buckets / uploads | BLOCKED | own-folder/admin; kyc private; non-listable | High |
| Edge functions / webhook / service-role | N/A | none deployed | High |
| Email / SMS / Push / Queues | N/A | no provider integration (delivery no-op) | Medium |
| Audit-log / analytics integrity | WEAK (Low) | `g_audit`/`log_approval`/`track_banner` self-attributed noise | High |
| Ticket IDOR (add_ticket_message) | WEAK (Low, latent) | write to ticket by id, UUID-gated | High |

## Tally
- **Prior findings (B1–B8, RT-1/2, F-1…F-8, N-1/2, C-1…C-4):** 24/24 **CLOSED**.
- **New Medium:** 1 systemic — RC-1 BOLA on read RPCs (multiple functions).
- **New Critical/High:** 0. **Write-side financial/wallet/payment/escalation/tenant:** 0.
- **New Low:** audit/analytics self-noise; latent ticket IDOR.

## Decision matrix (RC bar)
| PASS requirement | Met? |
|---|---|
| Every previous finding closed | ✅ |
| No Critical | ✅ |
| No High | ✅ |
| **No Medium** | ❌ (RC-1) |
| No financial manipulation | ✅ |
| No privilege escalation | ✅ |
| No tenant isolation failure | ✅ |
| No wallet exploit | ✅ |
| No payment exploit | ✅ |
| No business-logic exploit | ✅ (write-side) |

---

# FINAL DECISION: 🔴 **FAIL**

One Medium finding (RC-1, BOLA on read RPCs) is reproducible; the RC bar admits no Medium.
**Remediation to reach PASS (small, well-scoped):** add ownership guards (`p_* = auth.uid()` /
caller-owns-driver / order-belongs-to-caller, ops bypass) to `loyalty_balance`,
`cashback_balance`, `driver_wallet_summary`, `recently_ordered`, `reorder_items`; minimize and
scope `order_tracking` (drop driver phone; gate to the order's customer or a signed tracking
token). Then re-run this exact battery — RC-1 must flip to BLOCKED with all 24 prior findings
still closed.
