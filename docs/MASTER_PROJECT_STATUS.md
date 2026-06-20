# MASTER PROJECT STATUS — HAAT NOW

_Last updated: 2026-06-20 (Phase-2 consolidation sprint)._

## 1. Architecture
- **Frontend:** React 19 + Vite 6 + TypeScript, Tailwind v4. RTL/Arabic-first, dark "Luminous Precision" theme (HAAT green `#a3f95b`).
- **Backend:** Supabase (Postgres + RLS + PostgREST + Auth + Edge Functions). Project `umwbzradvbsirsybfxfb` ("haat-now-dev").
- **Auth:** dual-mode via `VITE_AUTH_MODE` — `sandbox` (local demo OTP `123456` + `DEMO_ACCOUNTS`) and `supabase` (real phone OTP). **All** `supabase.auth.*` is centralized in `src/services/auth.service.ts` (login, logout, session restore, `getAccessToken`, `subscribeToAuthChanges`). Roles resolved from `user_roles` (supabase) or `DEMO_ACCOUNTS` (sandbox).
- **Country/i18n:** `AppConfigContext` + `config/countries.ts` (8 markets, default **EG**) + i18next (AR/EN, Egyptian dialect default). Currency via `formatPrice`. Country detection service with provider + fallback chain.
- **Images:** `utils/categoryImages.ts` — per-category fallback (restaurant/coffee/market/pharmacy/flowers/electronics/sweets/gifts/perfume); never food for non-food.
- **Portals:** Customer (bottom nav), Merchant (`EnterpriseSidebar` + mobile tabs), Driver, Admin (sidebar + mobile tabs).

## 2. Current status
- **Build:** `npm run build` exit 0; `tsc --noEmit` clean.
- **Auth:** dual-mode working; sandbox login verified for all 6 demo accounts (30/30 checks). Supabase mode is code-complete but **phone provider is disabled** on the project.
- **Portals:** all four render with data and are navigable on mobile + desktop; logout present everywhere (30/30 runtime PASS).

## 3. Completed features
- Dual-mode auth + centralized wiring; demo accounts (customer/merchant/driver + Egypt/Saudi/Super admin).
- Country/language/currency/dialect system (EG + SA live; 8 configured).
- Marketplace home (hero carousel, compact 4×2 category grid, offers).
- Category-specific product imagery (+ perfume).
- Safe-area handling (`viewport-fit=cover`, nav inset).
- Admin/Merchant/Driver portals: logout + mobile navigation + language; driver/merchant sandbox data.
- DB schema deployed: catalog seeded, RLS policies, core RPCs (`complete_delivery`, `complete_delivery_payout`, `adjust_wallet_balance`), edge functions (payments), admin country-scoping (`admin_users.scope/country_code` + helper fns).

## 4. Remaining work
- Enable Supabase **Phone provider** (+ Test OTP numbers) — unblocks `supabase` mode login.
- Apply `authenticated` GRANTs migration (`0019`) so logged-in users can read owner-scoped tables.
- Full i18n body-text coverage on Checkout/Wallet/Orders/Merchant/Driver/Admin.
- Real backend mutation testing (orders/wallet/delivery) in `supabase` mode.
- Push notifications end-to-end (token registration + FCM).
- Mobile drawer for the desktop sidebar (merchant/admin) — currently mobile uses a tab bar.

## 5. Known issues
- `order_country_code()` is `SECURITY INVOKER` → potential RLS recursion in the admin orders policy (fix SQL prepared, not applied — needs DB access).
- `payment.service.ts` retains `PAYMENT_MODE=sandbox` dry-run (intentional).
- Some admin "pages" (Orders/Merchants/Drivers/Customers) are aggregate KPIs only, not dedicated pages.

## 6. Production blockers
1. 🔴 Phone provider disabled → no real login in `supabase` mode (dashboard config).
2. 🔴 `authenticated` GRANTs (migration `0019`) not applied → logged-in users hit `42501` (SQL ready).
3. 🟠 RLS recursion fix for `order_country_code` (SQL ready, unapplied).
4. 🟡 Push notifications not end-to-end.

> DB-side blockers (1–3) require Supabase dashboard / service-role access not available to the build environment; SQL/migrations are prepared in `supabase/migrations` + `docs/`.
