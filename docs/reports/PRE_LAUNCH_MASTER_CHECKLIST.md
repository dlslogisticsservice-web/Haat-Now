# Pre-Launch Master Checklist — HAAT NOW

**Date:** 2026-06-24 · Derived from the forensic gap analysis. Framed for the realistic near-term launch:
a **controlled COD-only, Saudi-only WEB soft launch** with seeded merchants/drivers. App-store and
self-onboarding paths are explicitly P2 (see note). Effort: S < 1d · M 1–3d · L 3–7d · XL > 7d.

---

## P0 — MUST complete before launch
| # | Item | Business impact | Complexity | Effort | Dependencies |
|---|---|---|---|---|---|
| P0-1 | Real Twilio + clear Test OTP `123456` | No real users can log in; demo numbers hijackable | Low | M | Twilio account |
| P0-2 | Confirm Vercel prod env (`VITE_AUTH_MODE=supabase`, URL, anon key) + redeploy | App may run wrong mode / not reach backend | Low | S | Vercel access |
| P0-3 | Set Supabase `site_url` + redirect allow-list to prod domain | Recovery/redirect links broken | Low | S | domain |
| P0-4 | Rotate Supabase management token (`.mcp.json`) | Full project takeover if leaked | Low | S | — |
| P0-5 | Payment: confirm live Moyasar key + 1 test charge **or lock COD-only** | Fake "captured" / no real card revenue | Med | M | provider |
| P0-6 | Remove customer-facing mock/hardcoded data: `SAMPLE_TRANSACTIONS` (wallet), `MOCK_RESTAURANTS` (home), `ProfileScreen` stats, dashboard fake KPIs | Users/ops shown fabricated financial + activity data | Low | M | — |
| P0-7 | Hide/disable non-functional UI: merchant payout `alert()` stub, wallet top-up no-op, social-login + country-selector no-ops | Dead buttons erode trust; merchant thinks payout sent | Low | S | — |
| P0-8 | Run real-mode 4-role E2E on the deployed build with real OTP | Real prod path never validated | Med | M | P0-1..P0-3 |
| P0-9 | Enable PITR backups + wire `ErrorBoundary.onError`/edge logs to monitoring | Data-loss + blind to incidents | Low | S | Pro tier |
| P0-10 | CDN-cache public catalog | API saturates ~577 RPS / ~2.5–4.6k users without it | Med | M | — |

## P1 — SHOULD complete before launch
| # | Item | Business impact | Complexity | Effort | Dependencies |
|---|---|---|---|---|---|
| P1-1 | Merchant earnings/settlement basics — replace `total − 10` with real `delivery_fee` + a settlement record (even manual) | Wrong merchant payouts / no money trail | Med | M | finance model |
| P1-2 | Device push for order updates (FCM web push at minimum) | Users miss order status when app closed | High | L | FCM project |
| P1-3 | Reorder + Favorites-to-DB + real product search | Core UX completeness vs competitors | Med | M | — |
| P1-4 | Admin refund workflow UI (table + edge fn exist) | Refunds only via direct DB today | Med | M | — |
| P1-5 | Merchant **business hours** + manual availability toggle | Orders placed to closed branches | Med | M | — |
| P1-6 | Reassign button in OperationsCenter (RPC exists) | Stuck orders need manual ops action | Low | S | — |
| P1-7 | Replace OperationsCenter `alert()/prompt()` with real toasts/modals | Admin UX quality | Low | M | — |
| P1-8 | Verify/raise Realtime concurrency (measured ceiling ~376) | Driver/tracking sockets drop early | Low | S | tier |

## P2 — AFTER launch
| # | Item | Business impact | Complexity | Effort | Dependencies |
|---|---|---|---|---|---|
| P2-1 | **Native mobile app** (Capacitor Android+iOS) + store submission | No app-store presence (web-only today) | High | XL | full native setup |
| P2-2 | Merchant & driver **self-onboarding + KYC + documents + approval workflow** | Cannot scale supply without manual seeding | High | XL | storage + review UI |
| P2-3 | **Finance: commission + settlement engine + scheduler + merchant payouts + accounting exports** | Required for real multi-merchant economics | High | XL | finance design |
| P2-4 | **Growth: referral / invite / affiliate / cashback engine** | Acquisition/retention loops | Med | L | — |
| P2-5 | Live maps (orders/drivers) + heat maps + batch dispatch | Ops visibility at scale | High | L | Maps key |
| P2-6 | Marketing delivery: push/SMS/email campaigns + audience segmentation + loyalty tiers | Lifecycle marketing | Med | L | providers |
| P2-7 | Suspension / ban / risk / fraud management | Trust & safety at scale | Med | L | — |
| P2-8 | Support escalation + SLA tracking + complaint workflow | Support ops at scale | Med | M | — |
| P2-9 | Analytics: cohort / geographic / customer + materialized-view pre-aggregation | Decision-making + dashboard perf at scale | Med | L | — |
| P2-10 | Admin CRUD screens: country/city/user/customer/role/permissions/reports | Operability without DB access | Med | L | — |
| P2-11 | 50k→100k/day scale: realtime zone-channels + queue + Redis + compute upgrade | Throughput beyond ~10k/day | High | XL | infra |

## Launch-scope note (read this)
- **Web COD/Saudi soft launch:** P0 + (ideally) P1 → viable. The MISSING enterprise features are P2.
- **If app-store launch is required:** P2-1 (native shell) becomes a **P0/XL** and adds weeks — there is
  *no* native project today.
- **If self-service merchant/driver supply is required at launch:** P2-2 becomes P0/XL. Current model only
  works with **manually-seeded** merchants/drivers.

## Roll-up
- **P0:** 10 items (~mostly config + mock removal) — ~1 week.
- **P1:** 8 items — ~2–3 weeks.
- **P2:** 11 program-level items — multi-month (`POST_LAUNCH_ROADMAP.md`).
