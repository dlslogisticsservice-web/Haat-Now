# E2E Test Plan — HAAT NOW

**Date:** 2026-06-23 · **Branch:** `feat/auth-recovery-frontend-sprint` (from `b5fe436`)
**Harness:** Puppeteer (headless Chrome) against the local dev server (sandbox auth, OTP `123456`).
**Accounts:** customer `+201000000001`, merchant `+201000000002`, driver `+201000000003`,
super-admin `+201000000005`.

> Scope: testing, validation and bug-fixing only. No new features, no refactors of working code.

---

## 1. Customer journeys

| # | Journey | Steps | Expected |
|---|---|---|---|
| C1 | **Login** | phone → send OTP → `123456` → verify | reaches customer home (`#customer_main`) |
| C2 | **Browse stores** | home renders | category grid + restaurant list; bottom nav present |
| C3 | **Search** | type in search box | results filter; no-results state for gibberish |
| C4 | **Product details** | open restaurant → tap product | `#product_modal` opens with price + add button |
| C5 | **Add to cart** | tap `#add_to_cart_confirm` | item added; cart count increments |
| C6 | **Cart** | open `#nav_cart` | drawer shows item, totals, `#checkout_btn` |
| C7 | **Checkout** | `#checkout_btn` → checkout | address + payment + summary + swipe bar (`#checkout-area`) |
| C8 | **Payment** | swipe to confirm | order placed (sandbox) → success; cart cleared |
| C9 | **Order tracking** | `#nav_orders` → open order | timeline + status render |
| C10 | **Wallet** | `#nav_wallet` | balance, points, transactions, top-up CTA |
| C11 | **Profile** | `#nav_profile` | profile fields, tabs |
| C12 | **Addresses** | profile → addresses tab | address list + add form |
| C13 | **Notifications** | open notif drawer | title + list/empty state |

## 2. Merchant journeys
| # | Journey | Expected |
|---|---|---|
| M1 | Login (merchant) | reaches Merchant Portal (`#merchant_portal_full`/`#merchant_main_content`) |
| M2 | Dashboard renders | branch header + KPIs, no crash |
| M3 | No role leakage | merchant sees only the merchant portal |

## 3. Admin / Driver journeys
| # | Journey | Expected |
|---|---|---|
| A1 | Login (super admin) | reaches Admin Dashboard (`#admin_dashboard_full`) |
| A2 | Super tabs visible | Design Center + Campaign Center present |
| A3 | Tab switching | KPI / coupons / config / support render without crash |
| D1 | Driver login | reaches Driver Portal (`#driver_app_container`) |

## 4. Cross-cutting checks
- **No uncaught console / React errors** during any journey.
- **Safe-area**: primary CTAs (`#add_to_cart_confirm`, `#checkout-area`, `#checkout_btn`) not covered by nav.
- **Role routing**: each role lands on exactly its portal.

## 5. Execution
`docs/testing/e2e_runner.cjs` drives C1–C13, M1–M3, A1–A3, D1, collecting per-step PASS/FAIL +
console-error capture + screenshots on failure. Findings triaged into `CRITICAL_BUGS.md` /
`HIGH_PRIORITY_BUGS.md` / `MEDIUM_PRIORITY_BUGS.md`. Critical + High fixed immediately; build after each.

## 6. Severity definitions
- **Critical:** blocks a core journey (cannot login, checkout fails, a portal crashes / white-screens).
- **High:** core action fails/throws but a workaround exists; data-loss risk; visibly broken state.
- **Medium:** cosmetic, non-blocking, or edge-case.
