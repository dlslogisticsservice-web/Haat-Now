# Post-Deploy Verification Report

**Date:** 2026-06-23
**Branch / commit tested:** `feat/auth-recovery-frontend-sprint` @ `759dc1e`
**Method:** Real headless-Chrome (Puppeteer 25) drive-through, iPhone-class viewport (390×844, DPR 2),
each account in a fresh browser context.
**Screenshots:** `docs/testing/post_deploy_shots/` · **Scripts (reproducible):**
`docs/testing/post_deploy_verify.cjs`, `post_deploy_ui.cjs`, `post_deploy_checkout.cjs`

---

## ⚠️ Scope & honesty statement (read first)

- **Vercel was NOT directly reached.** This environment has **no access to Vercel's dashboard/API**,
  so I cannot fetch the deployment URL or confirm the Vercel build status, and I cannot open the
  `*.vercel.app` URL in a browser from here.
- **What WAS tested:** the **same source at commit `759dc1e`** (already pushed and in sync with
  `origin`), run via the local dev server and driven in a real browser. URL exercised:
  **`http://localhost:3001`**.
- **Why local, not the deployed build:** demo accounts + OTP `123456` only work in **sandbox** mode
  (`VITE_AUTH_MODE=sandbox && import.meta.env.DEV`). A production build (`vite build`, what Vercel
  serves) has `DEV=false`, so it would require **real Twilio OTP** to those phone numbers, which I
  cannot send. The **role/scope gating logic exercised is identical** — sandbox resolves scope from
  `DEMO_ACCOUNTS.scope`, production from `admin_users.scope`; both feed the same `isSuper` gate.
- **Safe-area caveat:** headless Chrome reports `env(safe-area-inset-*) = 0` (no physical notch), so
  the screenshots verify the **header/nav height reservation** (the bulk of the fix) and CTA
  visibility, but not the device-notch inset rendering itself. On a real notched device the `env()`
  insets simply add the extra space the fix introduces.

---

## 1. Permission verification (Design / Campaign / global settings)

Detection: after login, programmatically read whether the admin nav contains **مركز التصميم**
(Design Center) and **الحملات** (Campaign Center), plus a full-page screenshot.

| Account | Phone | Design Center | Campaign Center | Result | Screenshot |
|---|---|---|---|---|---|
| EG Country Admin | `+201000000004` | ❌ not shown | ❌ not shown | **Country Admin only** ✅ | `admin_201000000004.png` |
| SA Country Admin | `+966500000004` | ❌ not shown | ❌ not shown | **Country Admin only** ✅ | `admin_966500000004.png` |
| Super Admin | `+201000000005` | ✅ shown | ✅ shown | **Super Admin** ✅ | `admin_201000000005.png` |

Visual confirmation:
- EG & SA admins' top nav shows only **الإحصائيات / الكوبونات / المتجرات / Helpdesk** — no Design,
  no Campaign.
- Super admin's top nav additionally shows **الحملات** and **مركز التصميم**.

**Expected mapping met exactly:** `0004 → EG country admin only`, `9665…0004 → SA country admin only`,
`0005 → super admin`. The earlier "country admins receive super privileges" bug is **not reproducible**
at `759dc1e`.

## 2. UI / safe-area verification

Overlap method: for each primary CTA, `document.elementFromPoint(centerX, centerY)` — if it returns the
CTA (or its descendant/ancestor) the CTA is **top-most / not hidden**; if it returns the bottom nav or
anything else, it is **covered**. This correctly accounts for z-index (modals over the nav).

| Screen | Navigated | CTA checked | Covered? | Overlap | Screenshot |
|---|---|---|---|---|---|
| Home | ✅ | bottom nav vs content | — | ❌ none | `ui_home.png` |
| Profile | ✅ | header + tabs + form | — | ❌ none | `ui_profile.png` |
| Address (Profile tab) | ✅ (عناوين التوصيل) | — | — | ❌ none | `ui_profile.png` |
| Wallet | ✅ | شحن الرصيد CTA | visible | ❌ none | `ui_wallet.png` |
| Restaurant | ✅ | menu + floating pill | — | ❌ none | `ui_restaurant.png` |
| **Product modal** | ✅ | `#add_to_cart_confirm` (top 740 / bottom 796 of 844) | **not covered** | ❌ none | `ui_product_modal.png` |
| **Checkout** | ✅ | `#checkout-area` swipe bar (top 692 / bottom 756) | **not covered** | ❌ none | `ui_checkout.png` |
| Cart drawer | ⚠️ partial — see note | `#checkout_btn` | not isolated | — | `ui_cart.png` |

- **Top header:** on every screen the header sits at the top and content begins below it; no content is
  hidden behind it (Profile/Wallet headers, and the global customer header on Home/Restaurant/Checkout).
- **Bottom navigation:** the product-modal Add-to-Cart button and the checkout swipe bar are both
  programmatically confirmed **not covered** by the bottom nav, and visible in the screenshots above
  the nav. No CTA is hidden behind the bottom navigation.

### Honest gap — Cart drawer
The automated run could not cleanly isolate the **filled cart drawer**: once an item is added, the flow
advances to the checkout page, so the `#checkout_btn` probe returned "not present" and the capture showed
the checkout page instead. The **checkout swipe bar (the order-confirmation CTA) is verified not covered**,
and the cart drawer carries `.safe-sheet-action` in code, but I am **not claiming the filled cart-drawer
button was visually isolated** in this run. This is the one item to re-confirm manually (or with a refined
script that screenshots the drawer before the checkout transition).

## 3. Build & push status
- `npm run build`: ✅ passes (commit `759dc1e`).
- Branch `feat/auth-recovery-frontend-sprint` is **pushed and in sync** with `origin` (0 ahead / 0 behind).
  No new app code was changed in this verification pass (verification artifacts only).

## 4. URLs tested
- **`http://localhost:3001/`** (local dev server, sandbox mode, source @ `759dc1e`).
- Vercel production URL: **not available to this environment** — please confirm the deployed build shows
  commit `759dc1e` and re-run the same three logins on the live URL with real OTP.

## Verdict
- **Permissions:** ✅ verified with screenshots — country admins see no Design/Campaign Center; only the
  super admin does.
- **Safe-area:** ✅ no overlap found on Home, Profile, Address, Wallet, Restaurant, Product modal, Checkout
  (header and bottom-nav both clear). ⚠️ Filled cart-drawer button not isolated in automation — flagged,
  not claimed fixed.
