# 01 — Enterprise Capability Audit (inspection-only)

Evidence-based. No code modified. Paths/line refs are the evidence.

## Architecture facts
- **Routing:** NO react-router. Single-page **role-based conditional render** in `src/App.tsx`
  (`session.role === 'customer'|'merchant'|'driver'|'admin'` at lines 303/618/619/620). Customer
  in-app navigation is `currentScreen` React state (`'home'|'restaurant'|'checkout'|'orders'|
  'wallet'|'profile'|'discover'`), not URLs.
- **Backend:** Supabase. 38 SQL migrations (`supabase/migrations/*.sql`), 37 service modules
  (`src/services/*.ts` + `src/services/ops/*.ts`).
- **Auth modes:** `VITE_AUTH_MODE` = `sandbox` (demo, localStorage-backed) or `supabase` (real OTP).
- **Markets:** 8 countries in `src/config/countries.ts` (EG/SA/AE/KW/QA/BH/OM/JO) with currency,
  dialCode, locale, dialect, default city.
- **i18n:** i18next (`src/i18n/index.ts`) + per-component `L(ar,en)`. Customer/Driver/Merchant apps +
  admin chrome + Dashboard/Growth/Finance/Operations/KYC modules fully bilingual (verified earlier).

## Capability summary (evidence)
| Capability | Status | Evidence |
|---|---|---|
| Theme Engine | ✅ Implemented | `src/design/designSystem.ts` (`DesignConfig`, `applyDesign()` writes CSS vars on `:root` at runtime), `src/design/DesignContext.tsx` (draft/published/versions, preview, per-country) |
| Design Center | ✅ Implemented + reachable | `src/features/admin/DesignCenter.tsx` (sections: theme/fonts/cards/buttons/icons/layout/branding + device preview). Sidebar `design` key (super-only) → renders at `AdminDashboard.tsx:319` |
| Experience Builder | ✅ Implemented + reachable | `src/experience/*` (`ExperienceContext`, `experience.service` → Supabase `screen_experiences` table, `blocks/` Lottie+Video+Media). `DesignCenter.tsx:157` renders `<ExperienceBuilder/>` |
| Country Branding | ✅ Implemented | `src/features/admin/CountryBranding.tsx` per-country splash brand/tagline/logo/accent, draft+publish per country. `DesignCenter.tsx:159` |
| Assets Manager | ✅ Implemented | `src/features/admin/AssetsManager.tsx` + `src/experience/assets.service.ts`. `DesignCenter.tsx:158` |
| Multi-country config | ✅ Implemented | `countries.ts` (8 markets), `AppConfigContext`, design `byCountry` layers |
| Multi-tenant / White-label (multi-brand) | ❌ Not implemented | NO tenant/organization/company/brand DB table (grep of migrations = none). Single `appId: com.haatnow.app`. Closest is `admin_users.scope` = `super`/`country` |
| Feature flags | ❌ Not found | No `featureFlag`/`feature_flags` module in `src/` |
| PWA / Service worker | ✅ Present | `public/sw.js` (network-first shell cache), registered in `src/main.tsx`; `public/manifest.webmanifest` |
| Native shells (Android/iOS) | ❌ Not generated | `capacitor.config.ts` exists but NO `android/` or `ios/` folders; `public/icons/` has only README (icon PNGs missing) |

See companion reports 02–07 for module matrix, white-label detail, design-system detail,
navigation IA, mobile readiness, and ranked production blockers.
