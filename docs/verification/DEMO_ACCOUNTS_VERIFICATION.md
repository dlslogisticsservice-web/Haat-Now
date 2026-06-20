# DEMO_ACCOUNTS_VERIFICATION.md

**Mode:** sandbox (`VITE_AUTH_MODE=sandbox`) · OTP `123456` · viewport 393×852 · Puppeteer drove the real app.
**Result: 30 / 30 PASS (6 accounts × 5 checks).**

| Account | Phone | Login + Role Routing | Data Visible / No Blank | Session Persist (refresh) | Logout → Login | No Runtime Errors |
|---|---|---|---|---|---|---|
| Customer | `+201000000001` | ✅ `#stitch_bottom_nav` | ✅ (982 chars) | ✅ | ✅ | ✅ |
| Merchant | `+201000000002` | ✅ `#merchant_main_content` | ✅ (636 chars) | ✅ | ✅ | ✅ |
| Driver | `+201000000003` | ✅ `#driver_app_container` | ✅ (523 chars, not "not registered") | ✅ | ✅ | ✅ |
| Egypt Admin | `+201000000004` | ✅ `#admin_mobile_tabs` | ✅ (512 chars) | ✅ | ✅ | ✅ |
| Super Admin | `+201000000005` | ✅ `#admin_mobile_tabs` | ✅ (512 chars) | ✅ | ✅ | ✅ |
| Saudi Admin | `+201000000006` | ✅ `#admin_mobile_tabs` | ✅ (512 chars) | ✅ | ✅ | ✅ |

## Notes
- **Role routing** resolved from `DEMO_ACCOUNTS` in `auth.service.ts` (sandbox) — customer→Customer app, merchant→Merchant portal, driver→Driver portal, admin→Admin dashboard.
- **Data visibility:** Driver and Merchant now render sandbox demo data (previously blank/"not registered"). Admin renders KPI/Config/Support. Customer renders the real catalog (5 branches).
- **No blank screens / no stuck loaders:** checks explicitly fail on `#driver_not_registered` or `#admin_module_loader`; none triggered.
- **Logout:** every portal has a visible logout that returns to `LoginScreen` (customer via Profile; merchant/driver/admin via header `*_logout_btn`).
- **Runtime errors:** `pageerror` listener captured **zero** uncaught errors for all 6 accounts. (Background cart-sync/network 401s are expected in sandbox and are not JS errors.)

## Evidence
- `screenshots/PORTAL_driver.png` — driver dashboard with online status + earnings (`30 ريال`) + available orders.
- `screenshots/PORTAL_merchant.png` — merchant dashboard with branch + orders.
- `screenshots/ADMIN_fixed_mobile.png` — admin with logout + mobile tabs.
