# HAAT NOW — Business Abuse Matrix

Every abuse scenario tested, with Probability (1–5 = how easy/likely to exploit),
Impact (1–5 = business damage), and Risk = P × I (max 25). Band: **≥15 Critical**,
10–14 High, 5–9 Medium, <5 Low. "Defended" = control verified present (see the
penetration report for evidence).

## Exploitable (must-fix / track)
| Scenario | Verdict | Prob | Impact | Risk | Ref |
|---|---|---|---|---|---|
| Self-mark order `payment_status='paid'` (payment bypass) | EXPLOITABLE | 5 | 5 | **25** | C1 |
| Lower `total_amount` before card charge (pay-what-you-want) | EXPLOITABLE | 5 | 5 | **25** | C1 |
| Loyalty-point minting → cash to wallet | EXPLOITABLE | 5 | 5 | **25** | C3 |
| `redeem_advanced_coupon` self wallet-credit | EXPLOITABLE | 4 | 5 | **20** | C4 |
| `complete_delivery_payout` inflated driver payout | EXPLOITABLE | 4 | 5 | **20** | C2 |
| Coupon max-uses / per-customer / one-time bypass | EXPLOITABLE | 5 | 3 | **15** | H1 |
| Referral farming (fake accounts, fake qualify) | EXPLOITABLE | 4 | 3 | 12 | H3 |
| `set_driver_status` GPS/presence forge (win/sabotage dispatch) | EXPLOITABLE | 3 | 4 | 12 | H2 |
| Country-admin acts cross-country / cross-role | EXPLOITABLE | 3 | 4 | 12 | H5 |
| `driver_earnings` fabrication (inflate payable) | EXPLOITABLE | 4 | 3 | 12 | H4 |
| `respond_dispatch` IDOR (reject/accept rivals' offers) | EXPLOITABLE | 3 | 3 | 9 | H6 |
| Forge order `status='delivered'` (skip lifecycle) | EXPLOITABLE | 4 | 3 | 12 | C1 |
| Accept dispatch offer after timeout | EXPLOITABLE | 3 | 2 | 6 | H6 |
| SVG upload → stored XSS on storage origin | EXPLOITABLE | 3 | 3 | 9 | M2 |
| Cross-tenant catalog read; `tenant_id` spoof on insert | EXPLOITABLE | 3 | 3 | 9 | M1 |
| Complete delivery w/o proof-of-delivery (collusion farm) | EXPLOITABLE | 3 | 3 | 9 | M4 |
| Earn rewards then refund order, keep rewards | EXPLOITABLE | 3 | 3 | 9 | M5 |
| Driver self-edits `priority_score`/`rating` | EXPLOITABLE | 3 | 3 | 9 | M7 |
| `website_outbox_append` cross-tenant event injection | EXPLOITABLE | 2 | 3 | 6 | M9 |
| Loyalty cross-reward race → negative balance | EXPLOITABLE | 2 | 3 | 6 | M6 |
| INSERT arbitrary `payment_attempts` (poison ceiling/reporting) | PARTIAL | 3 | 2 | 6 | M8 |
| `order_items` direct edit post-order | EXPLOITABLE | 3 | 3 | 9 | M11 |
| Admin builder raw-HTML richtext stored XSS (builder only) | EXPLOITABLE | 2 | 2 | 4 | M10 |
| `role_permissions` any-admin self-grant (latent, no GRANT today) | LATENT | 1 | 5 | 5 | M3 |
| search_analytics / status_history poisoning + `customer_id` spoof | EXPLOITABLE | 4 | 1 | 4 | L1 |
| Shift/break RPC sidelines a rival driver | EXPLOITABLE | 2 | 2 | 4 | L3 |
| Storefront shows pending/suspended merchant | EXPLOITABLE | 3 | 1 | 3 | L2 |
| Theme-token CSS injection (self-inflicted) | EXPLOITABLE | 2 | 1 | 2 | L4 |
| `website_reorder_pages` cross-tenant reorder (needs UUIDs) | EXPLOITABLE | 1 | 2 | 2 | L5 |
| Suspend/ban leaves driver in dispatch pool | WEAKNESS | 2 | 2 | 4 | L6 |
| Public storage bucket enumeration | INFO | 3 | 1 | 3 | L7 |
| Email-alias duplicate accounts | EXPLOITABLE | 4 | 1 | 4 | L9 |

## Defended (verified — residual risk Low)
| Scenario | Verdict | Control |
|---|---|---|
| Order price manipulation (client prices) | DEFENDED | `create_order` recomputes from `products.price`+variant; ignores client |
| Duplicate order / double checkout / replay | DEFENDED | unique `idempotency_key`; returns original |
| Negative / zero quantity | DEFENDED | `create_order` rejects `qty<=0` |
| Create order for another customer | DEFENDED | `p_customer_id = auth.uid()` |
| Double payment / double charge | DEFENDED | deterministic key + `uq_payment_attempts_active_order` + idempotency lock |
| Webhook forgery / replay | DEFENDED | HMAC-SHA256 fail-closed, constant-time, `webhook_events` dedup |
| Double refund / over-refund | DEFENDED | `refund_reserve` ceiling under `FOR UPDATE`, idempotent, ops-permission |
| Direct wallet self-credit (`adjust_wallet_balance`/`credit_customer_wallet`) | DEFENDED | EXECUTE revoked from anon/public/authenticated |
| Direct wallet-balance UPDATE | DEFENDED | no write RLS policy on `wallets` |
| Delivery double-payout | DEFENDED | `UNIQUE(driver_earnings.order_id)` + idempotent + lock |
| Multiple drivers accept same order | DEFENDED | single conditional-update winner; losers `lost` |
| Settlement double-pay / commission tamper | DEFENDED | ops-only + `FOR UPDATE` + `status='paid'` short-circuit; commission idempotent |
| Manual/auto/reassign dispatch abuse | DEFENDED | `is_ops_admin()` guards + anon revoke |
| Payout request/approve abuse | DEFENDED | request = owner; approve/reject = ops-only |
| Customer → admin privilege escalation | DEFENDED | `user_roles` deny-by-default; `admin_users` no client write |
| Anon-executable privileged RPCs (assign_user_role, ban, settle…) | DEFENDED (defense-in-depth) | internal `is_ops_admin`/admin guards |
| KYC self-approval | DEFENDED | `account_status` write = `is_ops_admin()` |
| Cross-tenant website read/write / section override | DEFENDED | `tenant_id = auth_tenant()` reads + writes |
| Publish / preview / draft bypass | DEFENDED | tenant RLS + signed expiring preview token |
| Forged / spam notifications; read others' | DEFENDED | `broadcast_notification` admin-only; no client INSERT; read own only |
| Search enumeration of hidden/inactive/other-merchant | DEFENDED | `search_catalog` returns active-catalog only |
| Upload executable/HTML/oversized; path traversal | DEFENDED | bucket `allowed_mime_types`+`file_size_limit`; folder scoping (SVG exception = M2) |
| Audit-log tampering | DEFENDED | admin-only, no DELETE policy |
| OTP replay / expired-OTP bypass / session fixation | DEFENDED | Supabase server-authoritative OTP; fresh session; consumed flag |
| `custom_code` script injection | DEFENDED (dormant) | table never read by renderer |

## Risk concentration
The five Risk-≥15 scenarios (C1×2, C3, C4, C2, H1) all stem from **two root causes**:
direct table writes bypassing RPCs, and the incomplete SECURITY DEFINER hardening pass.
Both close with one migration (Hardening Pass #2). No abuse survives customer→admin
escalation, wallet-primitive access, payment double-charge, webhook forgery, or
refund/settlement tampering — those are already defended.
