# i18n Audit Report

**Date:** 2026-06-23
**Scope:** language switching (AR↔EN), direction (RTL/LTR), translation coverage.

---

## System architecture (as found)

| Layer | File | Role |
|---|---|---|
| i18next init | `src/i18n/index.ts` | `resources` bundle (only `nav`, `common`, `home`, `cats`), `lng` from `localStorage['haat_lang']`, fallback `ar`. |
| Language state | `src/contexts/AppConfigContext.tsx` | `lang` state; `setLang`/`toggleLang` persist to localStorage; **`useEffect([lang])` calls `i18n.changeLanguage(lang)` and sets `document.documentElement.dir`**. |
| Switch UI | `src/App.tsx` header | `onClick={toggleLang}` toggling `EN`/`ع`. |
| Consumers | components | Mix of `useTranslation().t()` (only **2 files**) and **inline `lang === 'ar' ? … : …` ternaries**, plus a large body of **hardcoded Arabic strings**. |

## Root causes of the reported bug

### Bug A — Direction did not fully update (FIXED)
`AppConfigContext` correctly sets `document.documentElement.dir`, **but 23 customer-screen containers
had a hardcoded `dir="rtl"` attribute** that overrides the inherited document direction. So when
switching to English (`document.dir='ltr'`), those containers stayed **RTL** → "direction does not
fully update" and right-aligned layout persisted in English.

**Fix applied:** bound every hardcoded `dir="rtl"` to the language in the customer screens:
`dir="rtl"` → `dir={lang === 'ar' ? 'rtl' : 'ltr'}` in
`App.tsx` (10), `CheckoutPage.tsx` (8), `HomeScreen.tsx` (3), `WalletScreen.tsx` (1),
`ProfileScreen.tsx` (1, + added the missing `useAppConfig` hook to the main component). Direction now
flips automatically with the language, with no refresh.

### Bug B — Many labels remain Arabic / mixed-language (ROOT CAUSE IDENTIFIED — scoped)
The app was built **Arabic-first**: the i18next `resources` bundle only covers `nav`, `common`,
`home`, and `cats`. The **vast majority of UI strings are hardcoded Arabic literals** inside the
components (e.g. `إضافة للسلة`, `مراحل التحضير`, `عنوان التوصيل`, `شحن الرصيد`, …) with **no English
counterpart**. Only **2 files** (`App.tsx`, `HomeScreen.tsx`) use `useTranslation().t()`.

Therefore switching to English renders English nav + the inline-ternary strings, but leaves all
hardcoded-Arabic UI in Arabic → "many labels remain Arabic" and "mixed-language screens."

**This is a localization-coverage gap, not a switching-mechanism defect.** Making every label
translate requires extracting all hardcoded strings into the i18n `resources` bundle (AR + EN keys)
and routing them through `t()` — a sizeable, screen-by-screen effort that is **out of scope for a
stabilization sprint** and is recommended as a dedicated follow-up. It is documented here honestly
rather than claimed "done."

## Requirement compliance

| # | Requirement | Status |
|---|---|---|
| 1 | Switch updates immediately | ✅ `lang` state change re-renders consumers synchronously |
| 2 | No page refresh required | ✅ confirmed — pure React state + `i18n.changeLanguage` |
| 3 | Arabic → English works | ✅ for translated strings + direction |
| 4 | English → Arabic works | ✅ |
| 5 | RTL updates automatically | ✅ **fixed** (document `dir` + dynamic `dir` on containers) |
| 6 | LTR updates automatically | ✅ **fixed** |
| 7 | All labels translated | ⚠️ **not met** — most UI strings are hardcoded Arabic (Bug B). Requires a localization pass. |
| 8 | No mixed-language screens | ⚠️ **not met** for the same reason (Bug B). |

## What changed in this sprint
- ✅ Direction is now fully dynamic across all customer screens (Bug A fixed; build + tsc clean).
- ⚠️ Full string translation (req 7 & 8) is documented as a scoped follow-up — the switching engine,
  persistence, re-render and direction are all working; the remaining work is **content extraction**,
  not engine repair.

## Recommended follow-up (to satisfy req 7 & 8)
1. Extract hardcoded Arabic UI strings per screen into `src/i18n/index.ts` `resources` (add `en`).
2. Replace literals with `t('…')` via `useTranslation()` in each screen component.
3. Prioritize: Restaurant (covers pharmacy/flowers/market/electronics), Checkout, Profile, Wallet, Orders.
4. Add an automated check that flags raw Arabic literals in `.tsx` to prevent regressions.
