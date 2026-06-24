# Production Go-Live Audit — HAAT NOW (Backend / DB)

**Date:** 2026-06-24 · Scope: **production database readiness + launch blockers only** (no UI/styling/
localization/refactor). Evidence: live DB inspection + RPC execution this session
(`CUTOVER_EXECUTION_REPORT.md`, `FEATURE_VERIFICATION_MATRIX.md`).

## Headline
**The database cutover is COMPLETE and verified.** Migrations 0018–0022 applied + recorded; all 0020
objects present; all six feature RPC/table sets execute live; RLS recovered (recursion fixed). The
remaining go-live blockers are **auth/payment config** and **one coupon data-integrity gap** — not schema.

---

## 🔴 CRITICAL blockers
| ID | Blocker | Evidence | Fix |
|---|---|---|---|
| **C-1** | **OTP is Supabase Test code `123456`, not real SMS** — `sms_twilio_account_sid` empty; 6 demo numbers mapped to `123456` until 2030 | live `GET /config/auth` | Configure real Twilio (SID/token/messaging SID); **clear `sms_test_otp` + `sms_test_otp_valid_until`** |

## 🟠 HIGH blockers
| ID | Blocker | Evidence | Fix |
|---|---|---|---|
| **H-1** | **Vercel prod env unverified** (`VITE_AUTH_MODE=supabase`, URL, anon key) — not inspectable from DB/repo (`.env*` gitignored) | VERCEL_ENV_SETUP | Confirm/set in Vercel Production; redeploy |
| **H-2** | **Payment gateway value unverified** — `MOYASAR_SECRET_KEY`/`MOYASAR_CALLBACK_URL`/`PAYMENT_WEBHOOK_SECRET` edge secrets **exist** but values not inspectable (live vs test); `payment-initiate` fails closed if invalid | edge secrets list | Confirm live Moyasar keys + run one real test charge, OR ship **COD-only** |
| **H-3** | **`site_url=http://localhost:3000` + empty redirect allow-list** | live `GET /config/auth` | Set prod domain + redirect URLs (phone OTP unaffected; recovery/OAuth/email links broken until fixed) |
| **H-4** | **Real-mode E2E never run on the deployed build** | POST_DEPLOY_VERIFICATION | Run 4-role smoke on the Vercel URL with real OTP after C-1/H-1 |

## 🟡 MEDIUM blockers
| ID | Blocker | Evidence | Fix |
|---|---|---|---|
| **M-1** | `order_status_history` INSERT open to any authenticated user (audit-trail pollution) | MEDIUM_SECURITY ME-1; live RLS | Restrict INSERT to a SECURITY DEFINER status-writer or service path |
| **M-2** | `campaign_events` INSERT open (analytics inflation) | MEDIUM_SECURITY ME-2; live RLS | Restrict INSERT or rate-limit |
| **M-3** | **Coupon `used_count` never incremented** → `max_uses` unenforceable; no `coupon_usages` recording in order flow (no trigger/RPC) | live: no coupon trigger/`redeem_coupon` fn; `validate_coupon` only reads | Add `redeem_coupon(order_id, code)` DEFINER RPC (increment `used_count` + insert `coupon_usages` atomically) and call on order placement |
| **M-4** | `checkout.service` validates coupons via direct `.from('coupons')` read, bypassing `validate_coupon` guards | `checkout.service.ts:8` | Point checkout validation at the `validate_coupon` RPC |

## 🔒 SECURITY risks
| ID | Risk | Evidence | Fix |
|---|---|---|---|
| **S-1** | **Supabase management token un-rotated** — full project control, plaintext in `.mcp.json` (gitignored) + shared in reports | SUPABASE_PRODUCTION_CONFIG §5 | **Rotate before launch** |
| **S-2** | Open INSERT RLS on `order_status_history` / `campaign_events` (= M-1/M-2) | live RLS | as above |
| — | Verified SAFE: 0 Critical/High RLS vulns; `app_config`/`payment_transactions`/`support_messages` locked; all feature RPCs `SECURITY DEFINER` with `search_path=public` | SECURITY_AUDIT | — |

## 🧮 DATA-INTEGRITY risks
| ID | Risk | Status |
|---|---|---|
| **D-1** | Coupon over-redemption past `max_uses` (= M-3) | **Open** — needs usage-recording RPC |
| — | Stock cannot go negative (`greatest(0,…)`) | ✅ verified |
| — | Loyalty cannot overdraw (balance guard) | ✅ verified live (−1) |
| — | Order-assignment race (atomic guarded UPDATE / dispatch RPCs) | ✅ verified |
| — | Admin order-read RLS recursion | ✅ fixed (DEFINER) |

---

## Remaining launch checklist — ranked by severity
**P0 (must, before any real traffic)**
1. **C-1** Configure real Twilio + clear Test OTP `123456`. *(effort S–M)*
2. **S-1** Rotate the Supabase management token. *(S)*
3. **H-1** Set/confirm Vercel prod env (`VITE_AUTH_MODE=supabase`, URL, anon key) + redeploy. *(S)*
4. **H-3** Set Supabase `site_url` + redirect allow-list to the prod domain. *(S)*
5. **H-4** Run real-mode 4-role E2E on the deployed build with real OTP. *(M)*
6. **H-2** Confirm live Moyasar keys + 1 real test charge **or** lock scope to **COD-only**. *(M)*

**P1 (should, before launch)**
7. **M-3 / D-1** Add `redeem_coupon` RPC (increment `used_count` + record `coupon_usages`); wire into order placement. *(M)*
8. **M-4** Point `checkout.service` coupon validation at `validate_coupon` RPC. *(S)*
9. Enable PITR backups + wire error monitoring (Sentry/Logflare). *(S)*

**P2 (after launch)**
10. **M-1 / M-2** Lock `order_status_history` / `campaign_events` INSERT policies. *(S)*
11. Seed Egypt geography/catalog (only Saudi seeded; EG is default country) — or keep SA-only scope. *(L)*
12. Pre-aggregate analytics (full-scan dashboards at scale) — see `SCALING_ROADMAP.md`. *(M)*

## Verdict
**Database: GO.** Cutover complete, features verified, integrity guards in place (except coupon usage).
**Overall: CONDITIONAL GO** for a **COD-only, Saudi-only** soft launch once the **P0 config items
(C-1, S-1, H-1, H-3, H-4)** are cleared. No schema work remains.
