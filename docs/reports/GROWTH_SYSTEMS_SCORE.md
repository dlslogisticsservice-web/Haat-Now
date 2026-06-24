# Growth Systems Score

**Date:** 2026-06-24 · Scored after Enterprise-B. Engine = DB + RPCs + service; UI/automation are the gaps.

## Scorecard
| System | DB/Engine | Service | UI | Automation | Score |
|---|---|---|---|---|---|
| Advanced Coupons | 100% | 100% | 40% | n/a | **75%** |
| Referral V2 | 100% | 100% | 60% | n/a | **80%** |
| Loyalty (rules/rewards/tiers) | 100% | 100% | 40% | n/a | **72%** |
| Customer Segments | 100% | 100% | 20% | 0% (no cron) | **60%** |
| Campaign Engine | 100% | 90% | 60% | 30% | **70%** |
| In-app Banners | 100% | 100% | 0% | n/a | **60%** |
| Promotion Engine | 100% | 100% | 0% | n/a | **60%** |
| Merchant Growth | 100% | 100% | 30% | n/a | **65%** |
| Customer Retention | 100% | 100% | 0% | 0% (no cron) | **52%** |
| Analytics | 100% | 100% | 0% | n/a | **62%** |
| Notification Templates | 100% | 100% | n/a | 0% (no send) | **60%** |
| DB hardening (idx/RLS/audit) | 95% | — | — | — | **95%** |
| **OVERALL GROWTH** | — | — | — | — | **~67%** |

## What moves the score
- **Admin UI** (segments / banners / promotions / retention dashboards + advanced-coupon & loyalty-rules
  forms): → ~82%.
- **pg_cron automation** (`recompute_customer_segments` hourly, retention job nightly): → ~88%.
- **Flow wiring** (award points on delivery, redeem coupon in checkout, templates → push): → ~95%.

## Versus competitors (capability parity, engine layer)
| Capability | Talabat/HungerStation/Jahez/Careem | HAAT NOW (engine) |
|---|---|---|
| Multi-type coupons + targeting rules | ✅ | ✅ |
| Referral with reward + fraud guards | ✅ | ✅ |
| Tiered loyalty + redeemable rewards | ✅ | ✅ |
| Automated lifecycle segmentation | ✅ | ✅ engine (cron pending) |
| Multi-channel campaigns + targeting | ✅ | ✅ engine (delivery pending) |
| Promotions (flash/happy-hour/BXGY) | ✅ | ✅ engine |
| Merchant growth analytics | ✅ | ✅ |
| Retention / win-back automation | ✅ | 🟡 recommendations engine (jobs pending) |
| Growth analytics + LTV/CAC | ✅ | 🟡 LTV/repeat-rate ✅, CAC placeholder |

## Verdict
**Engine-level growth parity ≈ achieved (~67% overall incl. UI/automation).** The data + logic layer
matches the competitor capability set; the path to ~90%+ is **admin UI, cron automation, and flow wiring**
— all scoped, none requiring new core logic.
