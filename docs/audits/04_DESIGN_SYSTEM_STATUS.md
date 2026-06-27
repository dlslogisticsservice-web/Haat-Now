# 04 — Design System Status (inspection-only)

## Verdict: **Implemented and reachable (~85%).** A real runtime theme engine + visual editor exist.

## Token system — `src/design/designSystem.ts`
`DesignConfig` interface defines tokens for:
- **branding**: appLogo, splashLogo, favicon, darkLogo, lightLogo
- **colors**: primary, secondary, accent, success, warning, danger
- **glass**: intensity, borderOpacity, gradient
- **typography**: fontFamily (default `Cairo`), fontScale, headerScale, bodyScale, weight, letterSpacing, lineHeight
- **cards**: radius, shadow, padding, density (compact|standard|premium)
- **buttons**: radius, height, density
- **icons**: size, weight
- **layout**: spacing, sectionGap, containerWidth, density
- **animations**: enabled, speed

`DEFAULT_DESIGN` mirrors current production values (from `index.css`) → applying defaults changes
nothing (purely additive). `mergeDesign()` deep-merges patches. `applyDesign(config)` writes CSS
variables on `:root` at runtime → **live re-theme, no rebuild**.

## Theme engine / provider — `src/design/DesignContext.tsx`
- `DesignProvider` + `useDesign()` hook.
- Two-layer store: **published** (live) vs **draft** (editing), each with `base` + `byCountry[code]`.
- `effective(layer, country) = mergeDesign(base, byCountry[country])`.
- `patchDraft(scope: 'base'|'country', patch)`, `previewing` toggle, `versions` history.
- Persistence: `localStorage` key `design_settings` (PHASE-A note: a `design_settings` DB table is
  the documented next step). Country comes from `useAppConfig().country.code`.

## Visual editor — `src/features/admin/DesignCenter.tsx` (super-admin, sidebar `design`)
- Sections (Arabic-labeled): الثيم (theme), الخطوط (fonts), البطاقات (cards), الأزرار (buttons),
  الأيقونات (icons), التخطيط (layout), الهوية (branding) + scope toggle base/country + device
  preview (Smartphone/Tablet/Monitor) + Save/Publish/Reset.
- Sub-tools rendered in-panel: `<ExperienceBuilder/>` (منشئ التجارب), `<AssetsManager/>` (الأصول),
  `<CountryBranding/>` (هوية الدول).

## Experience system — `src/experience/*`
- `experience.service.ts`: Supabase `screen_experiences` table (production) + localStorage (sandbox).
- `experienceTypes.ts`: `EXPERIENCE_COUNTRIES`, `ExperienceSet`, `DEFAULT_EXPERIENCE`.
- `blocks/`: `LottieBlock`, `VideoBackgroundBlock`, `MediaRenderer`. `admin/MediaPicker`.
- Per-country draft/publish of splash/onboarding experience.

## Dark/Light, motion, illustrations
- Dark theme is the production baseline (CSS vars in `index.css`). `branding.darkLogo`/`lightLogo`
  exist in tokens but a full light-theme switch was not found as a runtime toggle.
- Motion: `animations.enabled/speed` token present; applied via `applyDesign`.
- Illustrations: media/Lottie blocks via Experience system; no separate illustration library.

## Gaps (evidence)
- DesignCenter / ExperienceBuilder / AssetsManager / CountryBranding **UI is Arabic-hardcoded**
  (not yet `L(ar,en)`) — they do not flip to English.
- Design store persists to `localStorage`, not yet a `design_settings` DB table (so it is
  per-browser, not per-user/server-published except the experience layer which IS DB-backed).
