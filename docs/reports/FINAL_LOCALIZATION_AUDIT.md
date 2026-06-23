# Final Localization Audit

**Date:** 2026-06-23
**Method:** static key-integrity check + Arabic-classifier over customer screens + build/lint.

---

## ⚠️ Verdict: localization is NOT complete
The gate is **0 missing keys AND 0 untranslated customer UI strings**.
- Missing keys: **0** ✅
- Untranslated customer UI strings: **~55 remain** ❌ (listed below)

So we may **not** declare localization complete yet. ProfileScreen and the Notifications drawer are
done; Home / Restaurant / Checkout / Orders / Wallet / Login still contain visible Arabic that does
not switch to English.

## Task 5 — Key existence (every `t('…')` resolves)
- Bundle keys: **332** · distinct `t()` references: **123**.
- **Missing keys: 0.** The only flag is the dynamic prefix `t('cats.' + cat.cat)` whose targets
  (`cats.restaurant/market/pharmacy/…`) all exist. ✅

## Task 6 — Arabic classification (customer screens)
Across `App, Home, Restaurant, Checkout, Orders, Wallet, Profile, Login`:

| Class | Count | Notes |
|---|---|---|
| Bilingual (`t()` / `T(ar,en)` / `labelKey`) | 94 | already switches |
| Regex matchers | 15 | e.g. `/صيدلية|دواء/` — **must stay Arabic** (match Arabic branch names) |
| Comments | 0 | — |
| Mock/seed/brand **data** | 38 | restaurant names, sample cards, `'مدى'`, point numbers — DB-sourced in prod |
| **Untranslated UI chrome** | **~55** | the real remaining work (raw classifier 101 includes ~46 logic/data false positives such as the Restaurant tab-ID array and `activeTab === '…'` comparisons) |

## Task 7 — ProfileScreen — ✅ COMPLETE
Converted: settings cards (titles/subtitles/hints via `settings.*` keys + render `t()`), payment-method
labels (`PM_META` → keys + `tt()`), `validateAvatar` (returns keys → caller `t()`), notification prefs,
privacy, support, language sub-page, profile fields, address form, stats, header back/logout, empty
states. The **only** remaining Arabic (`['المنزل','العمل','موقع آخر']`, line 971) is the **stored value
array** for address-type chips — display is already translated via a conditional `T(...)`; the values
are intentionally canonical (translating them would corrupt saved data).

## Task 8 — Notifications — ✅ COMPLETE
Added a `notifications` namespace (title/empty/emptySub/markAllRead). Converted the notification drawer
title and empty-state, plus the side-menu Notifications label.

## Task 9 — Missing keys — ✅ 0

## Screen × remaining (the work to reach 0)

| Screen | Remaining Arabic UI (chrome) | Remaining English | Missing keys |
|---|---|---|---|
| Home | promo-card CTA `اطلب الآن`, `المزيد`, `عرض الكل`, no-results text, min-order/clock labels | — | 0 |
| Restaurant | offer card (`%`/`اطلب الآن`), reviews empty-state, About rows (`الاسم`/`الفئة`), modal `إضافة للسلة` | — | 0 |
| Product modal | (same component as Restaurant) `إضافة للسلة` | — | 0 |
| Cart | ✅ done (drawer) | — | 0 |
| Checkout | `عنوان التوصيل`, `إلغاء/تعديل`, no-address empty-state, `ملخص الطلب`, `رسوم الرفاهية`, `تطبيق`, `تم تأكيد الطلب`, `تتبع الطلب`, `+N أصناف` | — | 0 |
| Orders | `طلباتي الأخيرة`, empty-state, `اطلب الآن`, `طلب #…`, `الوقت المتوقع`, `إلغاء الطلب…`, `مركز الدعم` | — | 0 |
| Wallet | `txTypeLabel()` types (إيداع/سحب/استرداد/مكافأة), `الرصيد المتاح`, `جاري…`, `آخر…`, `إعادة المحاولة` | — | 0 |
| Profile | ✅ done (only chip data values) | — | 0 |
| Addresses | ✅ done (in Profile) | — | 0 |
| Notifications | ✅ done | — | 0 |
| Login | `أو المتابعة عبر`, sandbox hint, `لم يصلك الرمز؟`, terms text | — | 0 |

## Build / lint
- `npm run build`: ✅ passes (~8s).
- `npm run lint` (`tsc`): ✅ clean on app `src` (Deno edge fns excluded).

## What's needed to declare complete
Convert the ~55 chrome strings above (each is a known string; no missing keys — most map to existing
namespaces, a few need 1–2 new keys each). `txTypeLabel` must receive `t`/be inlined. Then re-run this
audit until **untranslated chrome = 0**. Until then, **localization is not complete** and the E2E sprint
should not start.
