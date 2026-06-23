# Localization Inventory

**Date:** 2026-06-23
**Method:** scanned all `src/**/*.tsx` for Arabic-containing lines (Node script) + manual classification.

---

## Headline numbers
- **Arabic-bearing lines at start:** 804 across 23 files.
- **Important distinction:** a large share are **seed/mock catalogue DATA** (restaurant names like
  `جليلة`/`الباشا`, product samples, category match-keywords like `شاورما`/`دجاج`) and the Arabic
  **translation values inside `src/i18n/index.ts`** — these are **not** translatable UI chrome.
  In production the catalogue comes from the database.
- **Translatable UI chrome** is the real target.

## i18n resource namespaces created (`src/i18n/index.ts`) — AR + EN
`nav, common, auth, home, restaurant, product, cart, checkout, wallet, profile, addresses, orders,
errors, success, onboarding, cats` (≈ 190 key/value pairs per language).

## Converted this pass (chrome → `t()` keys)

| File | Component | Example strings | Keys |
|---|---|---|---|
| `App.tsx` | Cart drawer / header | سلة وجباتي, المجموع الفرعي, رسوم التوصيل, المتابعة وإتمام الدفع, كود الخصم, switch-store confirm, notifications aria | `cart.title/subtotal/deliveryFee/checkout/couponPlaceholder/switchStore`, `common.notifications` |
| `App.tsx` | Bottom nav | (already) الرئيسية/طلباتي/سلتي/المحفظة/حسابي | `nav.*` |
| `features/auth/LoginScreen.tsx` | Login | tagline, sign-in/confirm titles, enter-phone, code-sent, phone label, send-code, OTP title, change number, verify, all messages | `auth.*` |
| `features/wallet/WalletScreen.tsx` | Wallet | المحفظة, شحن الرصيد, العمليات الأخيرة, عرض كل المعاملات, redeem/insufficient/success/load-fail/unexpected, aria-labels | `wallet.*`, `common.more` |
| `features/home/HomeScreen.tsx` | Home | (already uses `useTranslation` for section headers) | `home.*`, `cats.*` |

## Remaining user-facing chrome (proposed keys ready in the bundle)

| File | Approx Arabic lines | Category | Proposed namespace |
|---|---|---|---|
| `features/profile/ProfileScreen.tsx` | 98 | profile/addresses/payment | `profile.*`, `addresses.*` |
| `features/checkout/CheckoutPage.tsx` | 55 | checkout/payment | `checkout.*` |
| `features/orders/OrdersList.tsx` | 66 | orders/tracking | `orders.*` |
| `features/restaurant/RestaurantScreen.tsx` | 31 | restaurant/product (+ tabs) | `restaurant.*`, `product.*` |
| `features/home/HomeScreen.tsx` | 47 | promo cards + some chrome (rest is sample data) | `home.*` |
| **Internal portals** (`merchant/MerchantApp` 118, `admin/AdminDashboard` 76, `admin/DesignCenter` 67, `driver/DriverApp` 42, `admin/ExperienceBuilder` 39, `admin/CampaignCenter` 25, `admin/CountryBranding`, `admin/AssetsManager`, `experience/admin/MediaPicker`) | ≈ 380 | admin/merchant/driver/design_center/experience_builder | new namespaces `portal.*` |

## Notes
- Section headers and nav already localize via `t()`; the remaining work is **mechanical extraction**
  of literals in the files above into the (already-defined) namespaces and routing them through
  `useTranslation().t()`.
- `txTypeLabel()` in Wallet (transaction type words) is a standalone helper outside the component — to
  localize it must receive `t` or be inlined; flagged for the follow-up.
