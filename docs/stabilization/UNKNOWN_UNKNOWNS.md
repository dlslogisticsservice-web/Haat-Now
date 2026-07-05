# Unknown Unknowns — Risks We Weren't Asked About

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Things that surfaced while auditing, outside the requested scope. Evidence cited `file:line` where applicable.

## U-1 — "Production" is the demo 🔴
The most dangerous unknown for a buyer: the shipped default build is the **sandbox demo** (`vite.config.ts:6-16`). Anyone evaluating "the live product" by visiting the deployed URL is evaluating **localStorage**, not the backend. A due-diligence team could sign off on flows that have no server behind them. This should be stated in bold in any sales/DD material.

## U-2 — Redeemable-but-unearnable loyalty = free money leak 🟠
Production customers can **redeem** loyalty points (`WalletScreen.tsx:84`) but can never **earn** them (accrual disconnected — verified). If any earning path is ever partially enabled, or balances are seeded, this becomes a direct wallet-credit leak. The redemption path is live; the earning path is not.

## U-3 — No idempotency on order creation + client-authored totals 🟠
Combined, these enable a scripted client to (a) create many orders cheaply and (b) submit arbitrary `total_amount`/`delivery_fee` at the order row (`order.service.ts:38-40`). Payment re-derives the amount, but any flow that trusts `orders.total_amount` downstream (finance commission uses `gross_amount`, analytics revenue) inherits the client value.

## U-4 — GPS privacy & battery 🟠
`watchPosition` streams driver location with no debounce/throttle (`DriverApp.tsx:193-212`), writing every tick. Beyond the scaling storm (SCALABILITY §2), this is a **driver-privacy and battery** concern with no documented retention/consent policy for `driver_locations`.

## U-5 — Storage bucket / upload safety 🟡
Uploads go to Supabase Storage (`storage.service.ts:38`). Not audited here: content-type validation, size limits, malware scanning, and whether brand-asset buckets are correctly private vs public. KYC docs use a private bucket (`20260614000030`) — good — but general asset upload policy is unverified.

## U-6 — Secrets & `.env` handling 🟡
`.env`, `.env.production` exist in the working tree and are gitignored (per `.gitignore`), but `.env` (191 bytes) is present locally. The webhook/gateway secrets model is server-side (good), but there is no documented secret-rotation process, and `MISSING_SUPABASE_VARS`/`null` client fallback (`lib/supabase.ts:38-42`) means a misconfigured live deploy silently yields a `null` supabase client → runtime crashes rather than a clear config error.

## U-7 — Realtime as an availability dependency 🟡
Live tracking and ops depend on Supabase Realtime websockets. No documented degradation plan if Realtime is throttled/unavailable beyond a 15s poll fallback on one screen (`OrderTrackingMap.tsx:34`). At 10k drivers this dependency is load-bearing and single-vendor.

## U-8 — No rate limiting on OTP / expensive endpoints 🟡
OTP send relies on Supabase defaults; no app-level rate limiting on `sendOtp` or on order creation. SMS-pumping abuse (cost attack) is possible if Supabase limits aren't tuned.

## U-9 — i18n coverage & RTL correctness 🟡
Only AR/EN (`i18n/index.ts:151`); RTL is hand-wired per component (`dir=` scattered). Untranslated strings would fall back silently; no pseudo-locale test. For a 20-country ambition, the localization surface is narrower than advertised.

## U-10 — Mobile (Capacitor) parity unknown 🟡
iOS/Android wrappers exist (`capacitor.config.ts`, `android/`, `ios/`). Native concerns (push registration actually delivering, deep links, geolocation permissions, store compliance) are **not** validated by the sandbox E2E (which is web/puppeteer only). Push tokens are registered but unused (no delivery) — so mobile push is effectively non-functional.

## U-11 — Data deletion / GDPR completeness 🟡
`20260627000001_account_deletion` exists, but whether it cascades to orders, wallet, ledger (which must be retained for finance), locations, and KYC docs — and how that reconciles with immutable audit trails — is unverified. Right-to-erasure vs financial-record-retention is an unresolved tension.

## U-12 — Single Supabase project blast radius 🟡
100 tenants / 20 countries on one project (SCALABILITY §7) means one misapplied migration, one RLS mistake, or one outage affects **everyone**. No tenant-level isolation at the infrastructure layer, and (per MULTI_TENANCY) none at the data layer either.

## U-13 — Webhook secret shared across providers 🟡
One `PAYMENT_WEBHOOK_SECRET` for all providers (`payment-webhook:80`); Moyasar's real signing scheme may differ from raw-body HMAC — verify against Moyasar's actual webhook docs before go-live, or a valid Moyasar webhook could be rejected (or a wrong scheme accepted).

---

**Meta-observation:** The recurring pattern across all unknowns is the same as the known findings — **the demo is complete, the backend is partial, and the gap is invisible from the outside.** The highest-value action is to make live-mode the thing that is actually tested and shipped, so these unknowns surface in CI rather than in production.
