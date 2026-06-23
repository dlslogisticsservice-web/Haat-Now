# Customer Journey Localization Report

**Date:** 2026-06-23
**Branch:** `feat/auth-recovery-frontend-sprint` (continues `7d12af7`)
**Scope:** customer-facing only. Admin / Merchant / Driver / Design Center / Experience Builder were
**not touched**, as instructed.

---

## Honest status
The order-journey screens were converted to i18n and **language switching is proven working** in a real
browser (AR↔EN, screenshots below). The success criterion (literal **100%** with zero Arabic in EN
everywhere) is **not fully reached**: `ProfileScreen` (Task 6) and some `HomeScreen` content were not
finished, and a residue of non-chrome Arabic remains (code comments, category-matching regexes, canvas
map labels, and **mock promo/catalogue data** that in production comes from the database).

## Work completed this sprint (Tasks 1–6)

### Bundle (Task 1–2)
Expanded `src/i18n/index.ts` namespaces with full AR + EN for **restaurant, product, checkout, orders**
(statuses, timeline, tracking, payment, coupons, address/card forms, dialogs, errors, success).

### Screens converted to `t()`
| Screen | What was localized | Audit task |
|---|---|---|
| **RestaurantScreen** (covers Pharmacy/Flowers/Market/Electronics) | tabs (via stable-id `tabLabel`), open-now badge, delivery/min-order info, section headers, view-cart / add-to-cart CTA, premium-item text, back-to-home | Task 3 |
| **CheckoutPage** | payment status messages, coupon (apply/invalid/error), address + card forms & placeholders, order-steps, swipe-to-confirm states, totals/labels, all alerts & errors, success note | Task 4 |
| **OrdersList** | order statuses, timeline/step flows (config → `labelKey` + render `t()`), tracking labels, cancel dialog + result, rating UI, complaint/ticket, driver/store labels | Task 5 |
| (prev sprint) Login, Wallet, Cart drawer, Navigation, Home headers | — | — |

**`useTranslation` adoption: 4 → 7 files** (App, Login, Home, Wallet, Restaurant, Checkout, Orders).

### Technique notes
- Status/step labels lived in **module-level config** (no `t` in scope) → refactored to `labelKey`
  strings, translated at render (`t(cfg.labelKey)`, `t(step.labelKey)`), preserving the stable status
  **keys** used for logic.
- Restaurant **tab identifiers** are Arabic state values (`activeTab === 'العروض'`); kept as IDs and
  translated **display only** via a `tabLabel(id)` helper — no logic broken.

## Task 7 — Browser validation (AR → EN → AR ×3)
Ran `docs/testing/localization/loc_validate.cjs` (real headless Chrome, customer `+201000000001`):
logged in, toggled language **3 consecutive AR→EN→AR cycles** — no crash, UI re-rendered each time,
direction flipped. Confirmed visually that converted chrome switches.

## Task 8 — Screenshots
Stored under `docs/testing/localization/`:
- `home_AR.png` / `home_EN.png` — header ("Deliver to / Cairo, Egypt"), category labels
  (Restaurants/Supermarket/Pharmacy/Coffee/Desserts/Perfume/Flowers/Electronics), search placeholder,
  "Exclusive Offers", CTAs all switch to English.
- `wallet_EN.png` / `wallet_AR.png`.

## Task 9 — Metrics
- **Arabic-bearing lines:** 804 → **689** (this sprint −115; cumulative across both i18n sprints).
- **Strings extracted into i18n this sprint:** ~110 (restaurant/checkout/orders namespaces).
- **Files modified:** `src/i18n/index.ts`, `RestaurantScreen.tsx`, `CheckoutPage.tsx`, `OrdersList.tsx`
  (+ HomeScreen lang plumbing from prior).
- **Screens verified:** Home, Restaurant, Wallet, Checkout, Orders (switching), Login (prev).
- **Screenshots generated:** 4 (home AR/EN, wallet AR/EN).

## Remaining (not 100% — honest)
| Area | Remaining | Type |
|---|---|---|
| ProfileScreen + Addresses | ~98 lines | chrome — **Task 6 not completed** |
| Notifications drawer (App.tsx) | a few | chrome |
| HomeScreen promo cards, filter chip, order-CTA | ~10 | mostly **mock promo data** + a little chrome |
| RestaurantScreen/Checkout/Orders residue (~20 ea) | comments, **category-match regexes** (`/صيدلية|دواء/`), canvas map labels (`المتجر`/`البيت`), 1–2 minor labels | non-chrome / data |

## Build / lint (Task 10)
- `npm run build`: ✅ passes (~8s).
- `npm run lint` (`tsc`): ✅ clean on app `src` (only pre-existing Deno edge-function files, excluded).

## Path to true 100%
1. Convert `ProfileScreen` + Addresses + Notifications drawer (chrome).
2. Localize Home promo CTA/filter; treat promo/catalogue text as DB data (not i18n).
3. Translate canvas map labels (`المتجر`/`البيت`) via `t` inside the draw fn.
4. Keep category-matching regexes Arabic (they match Arabic branch names — must not be translated).
