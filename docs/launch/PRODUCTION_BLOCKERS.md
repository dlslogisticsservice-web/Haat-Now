# Production Blockers — Production Launch Sprint

Classification: **P0** (blocks launch), **P1** (important, not blocking a COD-only launch),
**P2** (nice-to-have). Code blockers are marked [CODE]; the rest are operational/config/secret.

## P0 — Launch blocking

| # | Blocker | Type | Resolution | Status |
|---|---|---|---|---|
| P0-1 | Production build ships **sandbox** (`vite.config.ts:12` forces sandbox unless `HAAT_LIVE_BACKEND=1`; `npm run build` → sandbox stub, no backend) | CONFIG | Build with `npm run build:live` (`HAAT_LIVE_BACKEND=1`) + real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | ⛔ Open (ops) |
| P0-2 | No provisioned Supabase project / 63 migrations not applied (RLS, RBAC, RPCs, storage buckets) | OPS | Provision project; apply `supabase/migrations/**` incl. `20260707000001_cod_payment_method.sql` | ⛔ Open (ops) |
| P0-3 | Auth is phone-OTP; **live login/registration needs an SMS provider** configured in Supabase Auth | SECRET/CONFIG | Configure Supabase Auth SMS (Twilio/etc.) + provider secret | ⛔ Open (secret) |
| P0-4 | **No first-class COD checkout path** (live checkout forced Moyasar) | [CODE] | Implemented: `paymentOrchestrator.recordCod` + website COD checkout + `orders.payment_method` migration + tests | ✅ **Fixed this sprint** |

**After P0-1..3 (operational) the COD journey is fully functional.** No code P0 remains.

## P1 — Important (not blocking COD-only launch)

| # | Item | Type | Note |
|---|---|---|---|
| P1-1 | Moyasar secrets + deploy `payment-{initiate,verify,webhook,refund}` | SECRET/OPS | Only for **card** payments; COD does not need it |
| P1-2 | App (mobile) `CheckoutPage` still card-only in live | [CODE] | Website is the COD launch surface; add COD branch to the app checkout post-launch |
| P1-3 | COD cash reconciliation: flip `orders.payment_status→paid` + call `capture_order_commission` at delivery | [CODE] | Reporting/ledger completeness; settlement already pays out method-agnostic |
| P1-4 | `pg_cron` / `scheduler-tick` for dispatch, reconcile, settlements (`20260705000004_scheduler.sql`; the fallback edge fn does not exist) | CONFIG | Enable pg_cron on the project, or add the scheduler-tick function |
| P1-5 | Push notifications provider (FCM/APNs) not wired (`registerPushToken` stores tokens only) | MISSING | In-app + realtime notifications work without it |
| P1-6 | `VITE_GOOGLE_MAPS_API_KEY` absent → tracking map degraded | SECRET | Tracking status/ETA/timeline still work without the map tiles |

## P2 — Nice to have

| # | Item | Type |
|---|---|---|
| P2-1 | Application-level rate limiting (none; relies on Supabase Auth defaults + idempotency) | MISSING |
| P2-2 | Email provider (none in code) | MISSING |
| P2-3 | Stripe / Paymob providers (config-catalog only) | Not needed for COD |
| P2-4 | Legacy unused `payment_transactions` table | Cleanup |

## Secrets to provision (report, per RULES)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client, live)
- `SUPABASE_SERVICE_ROLE_KEY` (edge functions)
- Supabase Auth SMS provider secret (OTP) — **required for login/registration**
- `PAYMENT_WEBHOOK_SECRET` (only if enabling gateway webhooks; not COD)
- `MOYASAR_SECRET_KEY`, `MOYASAR_CALLBACK_URL` (only for card; not COD)
- `VITE_GOOGLE_MAPS_API_KEY` (tracking map)

**COD requires none of the payment-gateway secrets.**
