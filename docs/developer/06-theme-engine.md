# 06 · Theme Engine

> **Audience:** anyone changing how the app looks, or building white-label theming.
> **The single most important engine in the platform.** There is exactly **one** theme engine — never build a
> second.

## Purpose
Turn a `DesignConfig` object into live CSS variables on `:root` so every surface (customer/driver/merchant/admin)
re-skins instantly, with **no rebuild and no per-surface edits**. This is what makes White-Label possible.

## Architecture
```
DesignConfig  ──applyDesign()──▶  40+ CSS variables on :root  ──▶  every component reads var(--…)
   (object)                        (--color-primary, --card-radius, --font-family, …)
```
- [`src/design/designSystem.ts`](../../src/design/designSystem.ts) — the engine:
  - `DesignConfig` — the token schema (branding, colors, glass, typography, cards, buttons, icons, layout,
    animations).
  - `DEFAULT_DESIGN` — defaults that **equal the current production values**, so applying the default changes
    nothing (purely additive / backward compatible).
  - `applyDesign(config)` — writes every token to `:root` as a CSS variable.
  - `mergeDesign(base, patch)` — deep-merges a partial override onto a base config.
- [`src/design/DesignContext.tsx`](../../src/design/DesignContext.tsx) — `DesignProvider` applies the design on
  boot and on every change; persists `haat_design_store_v1` (published + draft). Exposes `applyPreset(config)`
  for atomic base+publish updates.
- [`src/index.css`](../../src/index.css) — Tailwind v4 `@theme` + the CSS variables the tokens feed.

## Flow: applying a theme
```
Design Center edits draft → publish() → DesignContext.applyDesign(published) → :root vars update → UI re-skins
Boot: DesignProvider reads haat_design_store_v1.published → applyDesign() before first paint
Tenant: tenant.service.applyTheme(t) → applyDesign(tenantTheme(t))  (reuses the SAME engine)
```

## Dependencies
- Consumers: `DesignProvider` (boot), Design Center UI, `tenant.service.applyTheme`, `themePresets.service`.
- `themePresets.service` stores reusable `DesignConfig` snapshots (`haat_crud_theme_presets`) and is the base a
  tenant's flat brand overrides merge onto (`mergeDesign`). See [24-how-to-create-new-theme.md](24-how-to-create-new-theme.md).

## Extension points
- **Add a new token** → add the field to `DesignConfig` + `DEFAULT_DESIGN` (default = current hardcoded value),
  write it in `applyDesign()`, and consume it as `var(--your-token)` in CSS/components. Additive only.
- **New theme preset** → `themePresets.service` (data), not a code change.

## Reuse rules
- **One engine.** All theming goes through `applyDesign`. `tenant.service`, presets, and Design Center all reuse
  it — do not write CSS variables from anywhere else.
- A tenant stores only a **preset id + flat overrides**, never a full preset copy (`tenantTheme()` resolves the
  preset then merges overrides).

## Files involved
- [`src/design/designSystem.ts`](../../src/design/designSystem.ts) ·
  [`src/design/DesignContext.tsx`](../../src/design/DesignContext.tsx) ·
  [`src/index.css`](../../src/index.css) ·
  [`src/services/themePresets.service.ts`](../../src/services/themePresets.service.ts) ·
  [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts) (`tenantTheme`, `applyTheme`).

## Do's
- ✅ Read colors/radii/fonts as `var(--token)`. ✅ Keep new token defaults equal to today's hardcoded value.
- ✅ Use `applyPreset()` for atomic base+publish changes (avoids stale-draft closures).

## Don'ts
- ❌ Don't hardcode a hex color, radius, or font in a component. ❌ Don't write to `:root` outside `applyDesign`.
- ❌ Don't build a second theming path. ❌ Don't store a full theme copy on a tenant — store id + overrides.

## Example
```ts
import { applyDesign, mergeDesign, DEFAULT_DESIGN } from '../design/designSystem';
// Live re-skin to a green brand — no rebuild:
applyDesign(mergeDesign(DEFAULT_DESIGN, { colors: { ...DEFAULT_DESIGN.colors, primary: '#0f9d58' } }));
```
```css
/* consume a token */
.cta { background: var(--color-primary); border-radius: var(--button-radius); }
```

## Next
[07-brand-assets.md](07-brand-assets.md) · [14-design-center.md](14-design-center.md) ·
[24-how-to-create-new-theme.md](24-how-to-create-new-theme.md)
