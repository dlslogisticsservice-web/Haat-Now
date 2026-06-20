# LOCALIZATION_REPORT.md

## Country / language / currency system
- **Config:** `src/config/countries.ts` — Egypt + Saudi (+6 more Gulf/Levant) with `currency{code,symbolAr,symbolEn,decimals}`, `locale`, `dialect`, `dialCode`, `flag`, `defaultCity`.
- **Default country:** **Egypt** (`DEFAULT_COUNTRY='EG'`) — changed this sprint.
- **Detection:** `src/services/country-detection.service.ts` — provider abstraction + fallback chain: manual override → persisted → GPS (bounding-box) → timezone/locale → default. User override always wins and is persisted (`haat_country` + `haat_country_manual`).
- **On country change:** currency symbol+decimals, dial code (E.164), locale, flag, and dialect all switch via `AppConfigContext`.

## Currency
`formatPrice(amount, country, lang)` — symbol side + decimals per country (EGP/SAR=2, KWD/BHD/OMR/JOD=3). Wired across Home, Restaurant, Cart, Checkout, Wallet, Orders, Driver, Merchant, Admin. **Zero hardcoded `ر.س`/`SAR` in `.tsx`** (verified earlier by grep).

## Language (i18next)
- AR ↔ EN, instant switch (`toggleLang`), persisted (`haat_lang`), document `dir` RTL/LTR toggled.
- **Egyptian dialect** default for Egypt via `DIALECT.eg` (e.g. "اطلب أكلك", "أقرب مطعم ليك"); Saudi uses `DIALECT.sa` ("اطلب وجبتك").
- Coverage: nav, home (categories incl. new `perfume`, headers, search, hero), header. Remaining: body text of Checkout/Wallet/Orders/Driver/Merchant/Admin (infrastructure in place).

## Evidence
- Sandbox login aligns active country to the demo account's country (EG accounts → EG, SA accounts → SA).
- Prior runtime screenshots showed EN mode (nav/categories/hero translated) and currency switching (Kuwait → KWD `د.ك`, 3 decimals).

## Status
| Item | Status |
|---|---|
| Egypt + Saudi | ✅ |
| Currency/dial/locale/flag switch | ✅ |
| Default Egypt | ✅ |
| Manual override + persistence | ✅ |
| AR↔EN instant + persisted | ✅ |
| Egyptian Arabic for Egypt | ✅ |
| Full body-text i18n on back-office screens | ⚠ partial (documented) |
