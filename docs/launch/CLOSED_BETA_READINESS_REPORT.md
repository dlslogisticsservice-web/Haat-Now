# Phase B — Closed Beta Readiness Report

**Objective:** bootstrap the certified production backend `haat-now-prod` (`ckmqxhjdrfztkunqprax`)
with the minimum operational data for a **COD Closed Beta**, and verify workflows + a full
end-to-end journey. **Date:** 2026-08-04. **Method:** live seed + impersonated verification against
prod (read/write to operational tables; **no payments, no SMS, no user invites, no deploy**).

Legend: **PASS** · **WARNING** (ready, confirm/complete at bring-up) · **BLOCKER**.

> Bootstrap identities use the operator's Gmail with `+tag` subaddresses (all deliver to one
> inbox) so a single operator can log in as **admin / merchant / driver** via email OTP. Seed is
> reproducible at `supabase/seed/closed_beta_bootstrap.sql`. Production starts with **0 orders /
> 0 customers** (the E2E test transaction was cleaned up).

---

## STEP 1 — First Operations Admin — **PASS**
- Created super admin `dls.logistics.service@gmail.com` (login-capable, email-OTP).
- Verified (impersonated): `is_ops_admin()=true`, `auth_is_admin()=true`, `auth_admin_scope()='super'`,
  `auth_admin_country()='EG'`, roles `[customer, admin]`.
- **Dashboard access:** the admin console gates on `is_ops_admin`/`auth_is_admin` → granted.

## STEP 2 — Launch reference data — **PASS**
| Item | Status | Detail |
|---|---|---|
| Launch country | **PASS** | Egypt (EG) — matches legal/CSP/Paymob |
| Cities | **PASS** | Cairo |
| Delivery zones | **PASS** | Nasr City, Maadi (active) with valid polygons (`[lng,lat]`) |
| Fees | **PASS** | base_fee/per_km_fee/min_fee + ETA per zone (e.g. Nasr City 20/3/15, ETA 35) |
| Settings | **PASS** | `app_config`: launch_country=EG, currency=EGP, cod_only=true, min_order=30, service_fee_cap=25 |

## STEP 3 — First merchant + catalog — **PASS**
| Item | Status | Detail |
|---|---|---|
| Merchant | **PASS** | "Cairo Eats" — **approved** (`account_status`), owner login-capable (`+merchant1`) |
| Branch | **PASS** | Cairo Eats — Nasr City (zone-linked, active, lat/lng 30.06/31.34) |
| Categories | **PASS** | reference categories present (مطاعم / سوبر ماركت / صيدلية) |
| Products | **PASS** | Koshari 45, Grilled Chicken 90, Soft Drink 15 (active, stocked) + 4 variants |
| Operating hours | **PASS** | stored in `branch.settings.operating_hours` (Sat–Fri) + `prepTimeMinutes=20` |

## STEP 4 — Production email (OTP / verification / password reset) — **PASS** (path) / **WARNING** (SMTP)
- Auth email provider **enabled** (`email:true`, `phone:false`, `mailer_autoconfirm:false` — OTP
  verification enforced). A live OTP request for the admin returned **HTTP 200** (send path
  functional). OTP, sign-in verification, and password reset share this email transport.
- **WARNING:** delivery currently uses Supabase's **built-in sender** (strict rate limits, weaker
  deliverability). Configure **Resend/custom SMTP** (Auth → SMTP) before beta volume, and have the
  operator confirm inbox receipt of the test OTP. Not blocking a single-operator smoke, blocking
  for a multi-user beta.

## STEP 5 — Production workflows / role routing — **PASS**
| Identity | Resolves to | Evidence |
|---|---|---|
| Admin | Ops console | `is_ops_admin=true`, scope super/EG, role `admin` |
| Merchant | Merchant app | roles `[customer, merchant]`, owns 1 merchant + 3 products (F-3 owner read) |
| Driver | Driver app | roles `[customer, driver]`, owns driver row (status offline) |
| Customer | Customer app | authenticated catalog read: 1 branch, 3 products, 3 categories, 2 zones (login-first) |

## STEP 6 — Complete end-to-end journey — **PASS**
Full lifecycle executed live through real RPCs + RLS (then cleaned up):
```
Customer places COD order (Koshari + Soft Drink)      → order total 80.00
Merchant accepts                                       → accepted
Admin dispatches to driver (manual_dispatch_order)     → preparing + driver assigned
Driver → on_the_way                                    → on_the_way
Driver completes delivery (complete_delivery)          → DELIVERED
  driver_earnings rows = 1 · driver wallet +20.00 · ledger balanced (0)
```
✓ Customer → Merchant → Driver → Delivery → Completion works end-to-end on production data.
Post-test state verified clean: **0 orders, 0 customers, 0 earnings, 0 wallets**; seed intact
(1 admin, 1 merchant + branch + 3 products, 1 driver, Cairo + 2 zones).

---

## Subsystem summary

| Subsystem | Status |
|---|---|
| Operations Admin + dashboard access | **PASS** |
| Launch geography + fees + settings | **PASS** |
| Merchant + branch + catalog + hours | **PASS** |
| Email OTP / verification / reset (path) | **PASS** |
| Production SMTP (Resend) for volume | **WARNING** |
| Role routing (admin/merchant/driver/customer) | **PASS** |
| End-to-end order journey | **PASS** |
| Wallet / earnings / ledger integrity | **PASS** |

## Remaining before customers are invited (not part of this "prepare-only" phase)
1. **Deploy the live build** (`build:live` → Vercel, closed URL) — Phase A verified the bundle
   targets `haat-now-prod`; deployment is a later step. **BLOCKER for serving users.**
2. **Configure Resend/custom SMTP** on `haat-now-prod` + confirm OTP receipt. **BLOCKER (multi-user).**
3. Provision `VITE_GOOGLE_MAPS_API_KEY` (live tracking) + `VITE_SENTRY_DSN` (monitoring). **WARNING.**
4. (Deferred, non-beta) fill legal-entity placeholders; host Universal/App-Link files; payment
   webhook + Paymob; settlement-cron authorization; FCM/APNs push.

## Conclusion
**The production backend is OPERATIONALLY BOOTSTRAPPED and verified end-to-end for a COD Closed
Beta.** Admin, geography, a live merchant catalog, a driver, launch settings, role routing, email
OTP, and the full order→delivery journey (with correct wallet/earnings/ledger) all **PASS** on
`haat-now-prod`. The only items left to actually run the beta are **deploy + production SMTP +
Maps/Sentry keys** — none of which are in this "prepare only" phase. No payments, SMS, user
invites, or public deploy were performed.
