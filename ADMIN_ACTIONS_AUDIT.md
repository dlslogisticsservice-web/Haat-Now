# ADMIN_ACTIONS_AUDIT.md

Static audit of every interactive element under `src/features/admin/` (+ `EnterpriseSidebar`).

## Root causes found (now fixed)
1. **No logout existed** anywhere — `App.tsx` passed only `adminId` (no `onLogout`); no logout button in the dashboard or sidebar. → **Added.**
2. **Navigation invisible on mobile** — `EnterpriseSidebar` is `hidden md:flex`, so on phones the entire nav disappeared → "buttons don't work / static page." The sidebar buttons themselves had working `onClick`. → **Added a mobile tab nav (`md:hidden`).**
3. No language switch / profile in the admin portal (customer header is customer-only). → **Added language toggle.**

## Action matrix
| Component | Button / element | Expected action | Implementation | onClick? | Route/handler | PASS/FAIL |
|---|---|---|---|---|---|---|
| AdminDashboard | **Logout** `#admin_logout_btn` (NEW) | sign out → LoginScreen | `onClick={onLogout}` → `App.handleLogout` → `authService.signOut()` + `setSession(null)` | ✅ | handler ✅ | **PASS** |
| AdminDashboard | **Language** `#admin_lang_btn` (NEW) | toggle AR↔EN | `onClick={toggleLang}` (AppConfig) | ✅ | handler ✅ | **PASS** |
| AdminDashboard | **Refresh** `#admin_refresh_btn` | re-fetch admin data | `onClick={fetchAdminModuleData}` | ✅ | handler ✅ | **PASS** |
| AdminDashboard | **Mobile tabs** `#admin_mtab_{kpi,config,support}` (NEW) | switch tab on mobile | `onClick={()=>setActiveTab(id)}` | ✅ | handler ✅ | **PASS** |
| EnterpriseSidebar | Nav items (kpi/config/support) | switch tab (desktop) | `onClick={()=>onSelect(item.id)}` → `setActiveTab` | ✅ | handler ✅ | **PASS** |
| Config tab | Fee input `#config_fee_input` | edit delivery fee | controlled `onChange` | ✅ | state ✅ | **PASS** |
| Config tab | **تحديث الرسوم** | save MIN_DELIVERY_FEE | `onClick={()=>handleSaveConfig('MIN_DELIVERY_FEE',…)}` | ✅ | handler ✅ | **PASS** |
| Config tab | Welcome-SMS textarea `#config_msg_input` | edit message | controlled `onChange` | ✅ | state ✅ | **PASS** |
| Config tab | **حفظ الرسالة** | save WELCOME_SMS_MESSAGE | `onClick={()=>handleSaveConfig('WELCOME_SMS_MESSAGE',…)}` | ✅ | handler ✅ | **PASS** |
| Support tab | Ticket item `#ticket_item_*` | open conversation | `onClick={()=>handleSelectTicket(id)}` | ✅ | handler ✅ | **PASS** |
| Support tab | **تحديد كـ محلول** | resolve ticket | `onClick={()=>handleCloseTicket(id)}` | ✅ | handler ✅ | **PASS** |
| Support tab | Reply form `#ticket_reply_form` | send reply | `onSubmit={handleSendAdminReply}` | ✅ | handler ✅ | **PASS** |
| Support tab | **رد** submit | submit reply | `type="submit"` | ✅ | form handler ✅ | **PASS** |

## Detector checks (z-index / overlay / pointer-events / disabled / hidden)
| Check | Result |
|---|---|
| Missing onClick handlers | none (every action has a handler) |
| Empty / TODO handlers | none |
| Disabled buttons (stuck) | none (only `loading` disables during async, which resolves) |
| Hidden buttons | **was** the sidebar nav on mobile → fixed with mobile tabs; logout was absent → added |
| Broken routes | n/a (tab-state app, not router); all `setActiveTab` targets render |
| Overlays blocking clicks | none — logout `elementFromPoint` returns the button itself (top of stack) |
| z-index issues | none |
| `pointer-events:none` | none on actionable elements (logout `pointerEvents:true`) |

## Actions the user listed that are NOT separate pages (honest)
- **Orders / Merchants / Drivers / Customers pages:** not implemented as dedicated pages — the **KPI tab** shows aggregate counts only. Not "broken buttons"; features not built in the current admin scope.
- **Settings page:** = the **Config tab** (exists, works).
- **Country switch:** intentionally absent in admin (admins are country-scoped by `admin_users.country_code`; switching an admin's country is not a valid action). **Language switch** added instead.
- **Admin profile:** the sidebar shows the admin's name/role (display only); no dedicated profile page.

## Files changed
- `src/App.tsx` — pass `onLogout={handleLogout}` to `AdminDashboard`.
- `src/features/admin/AdminDashboard.tsx` — `onLogout` prop; visible **logout** + **language** + **refresh** header cluster; **mobile tab nav** (`md:hidden`); `useAppConfig` → `lang, toggleLang`.
