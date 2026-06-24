# Pre-Launch Hardening Report — HAAT NOW

**Date:** 2026-06-24 · Live project `umwbzradvbsirsybfxfb`. Backend hardening + production audit.
Evidence = live DB / Management API inspection this session. No UI/styling/localization changes.

---

## 1. Coupon Usage Integrity — ✅ FIXED & VERIFIED
**Problem:** `validate_coupon` only READ; nothing incremented `used_count`, so `max_uses` was
unenforceable, and the frontend inserted `coupon_usages` directly (not race-safe, no increment).

**Implemented** (`20260614000029_coupon_redemption.sql`, applied live + recorded):
- `redeem_coupon(p_coupon_id, p_order_id)` — SECURITY DEFINER, `SELECT … FOR UPDATE` lock;
  **idempotency check first** (same-order re-redeem returns silently — survives webhook-poll retries),
  then active/expiry/`max_uses` checks, then **atomic** `used_count++` + `coupon_usages` insert.
- `uq_coupon_usages_coupon_order` unique index (hard idempotency).
- `checkout.service.redeemCoupon()` wraps the RPC; `CheckoutPage` direct insert → RPC call.

**Live verification (test rows cleaned up):**
| Step | Result |
|---|---|
| redeem (max_uses=1) | `used_count` 0→1 ✅ |
| re-redeem SAME order | idempotent no-op, `used_count` stays 1 ✅ |
| redeem 2nd order | `coupon usage limit reached` ✅ |
| final state | `used_count=1`, exactly 1 usage row ✅ |

Build + lint clean.

## 2. Vercel Production Environment — ⚠️ PARTIALLY VERIFIABLE
| Item | Finding | Status |
|---|---|---|
| Required vars (from code) | `VITE_AUTH_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` | identified |
| Local `.env.production` | `VITE_AUTH_MODE=supabase`, URL = `…supabase.co`, anon = `sb_publishable_…` (public), `PAYMENT_MODE=production` | ✅ correct locally |
| `VITE_GOOGLE_MAPS_API_KEY` | absent → static-map fallback (no hard failure) | ⚠️ optional |
| Build output | `npm run build` ✓ (dist produced) | ✅ |
| **Actual Vercel dashboard values** | **not inspectable from this environment** (no Vercel token/CLI; `.env*` gitignored and NOT what Vercel builds from) | ❗ **MUST confirm manually** |

## 3. Authentication Production Setup — ❌ NOT PRODUCTION-READY
Live `GET /config/auth`:
| Field | Value | Verdict |
|---|---|---|
| `sms_provider` | `twilio` | ok |
| `external_phone_enabled` | `true` | ok |
| **`sms_twilio_account_sid`** | **EMPTY** | ❌ no real SMS credentials |
| **`sms_twilio_message_service_sid`** | **EMPTY** | ❌ |
| **`sms_test_otp`** | **SET — 6 demo numbers → `123456`** | ❌ test override active |
| `sms_test_otp_valid_until` | `2030-12-31` | ❌ effectively permanent |
| **`site_url`** | **`http://localhost:3000`** | ❌ wrong for prod |
| **`uri_allow_list`** (redirects) | **EMPTY** | ❌ |
| `rate_limit_otp` | 30/h | ok |

→ **Real users cannot log in; demo numbers are guessable.** Blocker C-1.

## 4. Payment Setup — ⚠️ UNVERIFIED (secrets present, mode unconfirmable)
| Item | Finding | Status |
|---|---|---|
| Edge secrets | `MOYASAR_SECRET_KEY`, `MOYASAR_CALLBACK_URL`, `PAYMENT_WEBHOOK_SECRET` all **present** (names) | ✅ wired (won't fail `PROVIDER_NOT_CONFIGURED`) |
| Secret **values** (live `sk_live` vs test) | **not inspectable** via Management API (names only) | ❗ **MUST verify** |
| `PAYMENT_MODE` | `production` in `.env.production` | ⚠️ frontend var; edge uses the key directly |
| Callback / webhook | `MOYASAR_CALLBACK_URL` + `PAYMENT_WEBHOOK_SECRET` present | ✅ present (HMAC verify in edge fn) |

→ Cannot confirm **live** card processing from here. Verify the key is `sk_live` + run one real test
charge, **or** launch **COD-only**.

## 5. Production Smoke Test — ✅ PASS (RLS / per-role, DB layer)
Simulated each role's JWT (`set role authenticated` + `request.jwt.claims`) and ran core reads:
| Role | Query | Result |
|---|---|---|
| **Customer** | products / own orders / notifications / wallet | PASS (21 / 0 / 0 / 1) — no recursion |
| **Driver** | orders feed / driver_earnings | PASS (0 / 0) |
| **Merchant** | products / orders | PASS (21 / 0) |
| **Admin (super)** | orders **by scope** / coupons / admin_users | PASS (0 / 3 / 3) — **no recursion** |

All RLS policies evaluate cleanly for all 4 roles (catalog reads return data; order counts 0 = empty dev
data, not an error). **Note:** a full **deployed-app UI** smoke (real OTP, Vercel URL) is **blocked by the
auth gap (item 3)** and was not run — flagged honestly, not claimed.

---

## FINAL LAUNCH VERDICT
| Layer | Verdict |
|---|---|
| **Coupon integrity** | ✅ **FIXED & verified** |
| **Database / RLS (all 4 roles)** | ✅ **GO** |
| **Authentication (real users)** | ❌ **BLOCKER** — Twilio empty, Test OTP `123456`, `site_url=localhost` |
| **Payment (live cards)** | ⚠️ **UNVERIFIED** — secrets present, live-mode unconfirmed |
| **Vercel env (actual)** | ⚠️ **CONFIRM MANUALLY** — not inspectable here |

**Verdict: NO-GO for real-user launch until (a) real Twilio + clear Test OTP + set `site_url`/redirects,
(b) confirm Vercel prod env, and (c) confirm live Moyasar key (or lock COD-only).**
The **database, RLS, and coupon-integrity layers are production-ready.** Once (a)–(c) clear, this is a
**CONDITIONAL GO for a COD-only, Saudi-only soft launch.**

### Exact remaining (severity-ranked)
1. 🔴 Configure real Twilio + clear `sms_test_otp` (C-1).
2. 🔴 Confirm Vercel `VITE_AUTH_MODE=supabase` + URL + anon key (item 2).
3. 🟠 Set Supabase `site_url` + redirect allow-list (item 3).
4. 🟠 Verify live `MOYASAR_SECRET_KEY` + 1 test charge, or COD-only (item 4).
5. 🟠 Rotate Supabase management token (carried from go-live audit S-1).
6. 🟡 Run deployed-app 4-role UI smoke with real OTP (after 1–2).
