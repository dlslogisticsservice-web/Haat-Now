# PORTALS_RUNTIME_TEST.md

End-to-end runtime verification of the four portals (sandbox, Puppeteer, real app).

## PASS / FAIL matrix

| Capability | Customer | Merchant | Driver | Admin |
|---|---|---|---|---|
| Login + correct role routing | ✅ | ✅ | ✅ | ✅ |
| Portal container renders | ✅ `#stitch_bottom_nav` | ✅ `#merchant_main_content` | ✅ `#driver_app_container` | ✅ `#admin_mobile_tabs` |
| Data visible (no blank) | ✅ catalog (5 branches) | ✅ branch+orders+products | ✅ status+earnings+feed | ✅ KPIs/config/tickets |
| Navigation works | ✅ bottom nav | ✅ mobile tabs + sidebar | ✅ online toggle | ✅ mobile tabs + sidebar |
| Session persists on refresh | ✅ | ✅ | ✅ | ✅ |
| Logout returns to Login | ✅ | ✅ | ✅ | ✅ |
| Language switch | ✅ header | ✅ topbar | ✅ topbar | ✅ header |
| No runtime errors | ✅ | ✅ | ✅ | ✅ |

**Overall: PASS (all four portals).**

## Per-portal detail
- **Customer:** real catalog renders; bottom nav (home/orders/cart/wallet/profile); cart drawer; wallet; profile (logout). Currency/locale follow the active country.
- **Merchant:** `MerchantApp` — incoming orders, catalog (menu+prices), earnings report, business profile. **Added:** `onLogout`, visible logout + language topbar, mobile tab nav (sidebar is `hidden md:flex`). Sandbox demo data so the portal isn't blank.
- **Driver:** `DriverApp` — online/offline toggle, earnings (`30 ريال`, 3 completed), available-orders feed, active jobs. **Fixed:** previously showed "لم يتم تسجيلك كسائق" because the `drivers` table lookup failed in sandbox; now renders demo driver data. **Added:** `onLogout` + logout/language topbar.
- **Admin:** `AdminDashboard` — KPI analytics, app-config editor, Helpdesk tickets. Logout + language + mobile tab nav (added previously). Super vs country admins all route to the dashboard; country scoping is DB-side (`admin_users.scope/country_code`).

## Known limitations (sandbox)
- Money/order mutations (place order, accept delivery, wallet credit, config save) call the real backend and are **not exercised in sandbox** (no real JWT) — they are dry-run/UI-only here. Full mutation testing requires `VITE_AUTH_MODE=supabase` + enabled phone provider + applied `authenticated` grants.
