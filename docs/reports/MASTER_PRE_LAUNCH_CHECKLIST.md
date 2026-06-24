# Master Pre-Launch Checklist — HAAT NOW

**Date:** 2026-06-24 · Consolidates every open item from the bug, blocker, security, scale, feature, auth,
payment, and deployment reports. **No new tests run.** Companion detail:
`CRITICAL_BUGS_REPORT.md` · `MISSING_FEATURES_REPORT.md` · `GO_LIVE_PLAN.md`.

**Legend** — Priority: **P0** must-before-launch · **P1** should-before-launch · **P2** after-launch.
Effort: S < ½d · M ½–2d · L 2–5d · XL > 5d. Risk = blast radius if wrong.

---

## P0 — Must be completed before launch

| # | Task | Effort | Risk | User impact | Dependencies |
|---|---|---|---|---|---|
| P0-1 | **Verify live `schema_migrations`** covers 0019–0027; apply any missing (esp. 0019 grants, 0020 feature persistence) | S | **Critical** | Without 0019 grants, all logged-in users get `42501` → app dead post-login | live DB access |
| P0-2 | **Verify `order_country_code` proc is SECURITY DEFINER** (not INVOKER) | S | **Critical** | Admin order reads recurse/crash if INVOKER | P0-1 |
| P0-3 | **Replace Test OTP `123456` with real Twilio**; clear `sms_test_otp` | M | **Critical** | No real-user login; demo numbers are guessable | Twilio account |
| P0-4 | **Set Vercel prod env** (`VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, anon key) | S | **High** | App boots in wrong mode / can't reach backend | Vercel access |
| P0-5 | **Set Supabase `site_url` + redirect allow-list** to prod domain | S | Med | Email/recovery/OAuth redirects broken | domain |
| P0-6 | **Rotate Supabase management token** (`.mcp.json`, gitignored but un-rotated, shared in docs) | S | **High** | Full project takeover if leaked | none |
| P0-7 | **Lock launch scope: COD-only + Saudi-only** (EG unseeded though default; cards not wired) | S | **Critical** | EG users can't transact; fake card "success" | business decision |
| P0-8 | **Run real-mode E2E on the deployed build** (4 roles, real OTP) | M | **High** | Real prod path never validated | P0-1..P0-4 |
| P0-9 | **Enable DB backups / PITR** | S | **High** | Data loss, no recovery | Supabase Pro |
| P0-10 | **Wire monitoring** (`ErrorBoundary.onError` + edge logs → Sentry/Logflare) | S–M | Med | Blind to production incidents | none |
| P0-11 | **Confirm sandbox/demo tree-shaken** in the prod build (DEV=false) + no demo accounts reachable | S | Med | Demo login / fake data in prod | P0-4 |

## P1 — Should be completed before launch

| # | Task | Effort | Risk | User impact | Dependencies |
|---|---|---|---|---|---|
| P1-1 | **Replace mock wallet transactions** with a real empty-state | S | High | Customers shown 5 fake transactions | none |
| P1-2 | **Replace mock home restaurants** with a real empty-state | S | Med | Users tap non-orderable fake cards | none |
| P1-3 | **Point portal analytics at `analyticsService`** (not localStorage) | M | High | Admin/merchant/driver see fabricated KPIs | P0-1 |
| P1-4 | **Hide or wire merchant "Withdraw Earnings"** (currently `alert()`) | M | Med | Merchants think payout requested | payout provider |
| P1-5 | **Fix hardcoded delivery-fee payout math** (`total - 10` → real `delivery_fee`) | S | Med | Wrong merchant earnings | P0-1 |
| P1-6 | **Persist notification read-state** (wire markRead/getUnreadCount) | M | Med | Unread badge resets; missed updates | P0-1 |
| P1-7 | **CDN-cache the public catalog** (caps the measured 577-RPS API wall) | M | Med | API timeouts past ~2.5–4.6k concurrent users | none |
| P1-8 | **Verify/raise Realtime concurrency** (measured ceiling ~376 < expected online) | S | High | Driver/tracking sockets dropped early | tier |
| P1-9 | **Wire coupons/loyalty/inventory UI to real tables** (if in launch scope) | L | Med | Features don't persist real data | P0-1 |
| P1-10 | **Set `VITE_GOOGLE_MAPS_API_KEY`** (else static map fallback) | S | Low | Degraded address picker | Google key |
| P1-11 | **Remove misleading "any 6-digit code" login hint** under real OTP | S | Low | Confusing login UX | P0-3 |
| P1-12 | **Fix `PAYMENT_ACTIVATION_GUIDE` provider mismatch** (Moyasar vs Stripe/Paymob) | S | Med | Wrong gateway configured at activation | none |
| P1-13 | **Add `.range()` pagination** to home/orders lists | S | Low | Slows as catalog grows | none |

## P2 — Can be completed after launch

| # | Task | Effort | Risk | User impact | Dependencies |
|---|---|---|---|---|---|
| P2-1 | Real card payment gateway (Moyasar/Stripe live) | M | Med | Card payments (COD covers launch) | provider |
| P2-2 | Egypt market: seed geography + catalog | L | Med | Unlocks EG (default country) | content |
| P2-3 | Push notification delivery (FCM/APNs) | L | Med | Device push | credentials + SW |
| P2-4 | Driver location off REST → Realtime broadcast + batched persist | M | Med | Location at 5k-driver scale | queue/edge |
| P2-5 | Zone-scoped realtime channels | M | Med | Realtime past ~376 sockets | tier |
| P2-6 | Background queue (dispatch / notifications / location) | M | Med | 50k+ orders/day | broker |
| P2-7 | Redis cache (admin aggregates 0.1–0.9s + hot catalog) | M | Low | Dashboard speed at scale | Redis |
| P2-8 | Pre-aggregated analytics (materialized views) | M | Low | Dashboard scans (927ms) at scale | P0-1 |
| P2-9 | Security mediums ME-1/ME-2 (`order_status_history`, `campaign_events` INSERT) | S | Low | Audit/analytics integrity | none |
| P2-10 | Delete orphaned stubbed `payment.service.ts`; rename `package.json` | S | Low | Dead-code hygiene | none |
| P2-11 | Compute upgrade (Large/XL → 2XL) per volume | $ | Med | API headroom | tier |

## Roll-up
- **P0:** 11 items — ~3–5 engineer-days (mostly config + verification, not new code).
- **P1:** 13 items — ~5–8 days (mock-data removal + analytics wiring + CDN).
- **P2:** 11 items — ongoing, scale/feature driven.

**Status:** code & schema are launch-grade; the gate is **config + migration verification + mock-data
removal + scope lock (COD/Saudi)**. Sequenced in `GO_LIVE_PLAN.md`.
