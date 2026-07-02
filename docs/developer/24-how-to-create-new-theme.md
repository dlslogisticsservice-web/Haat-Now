# 24 · How To: Create a New Theme

> **Goal:** create a reusable theme (a `DesignConfig` snapshot / preset) that tenants and templates can adopt.
> **Read first:** [06-theme-engine.md](06-theme-engine.md) · [14-design-center.md](14-design-center.md).

## Purpose
Package a look — colors, typography, glass, cards, buttons, layout, branding — as a **theme preset** so it can be
applied live to the platform or assigned to any tenant/template, without code changes.

## Architecture recap
```
DesignConfig snapshot  ──save──▶  themePresets.service (haat_crud_theme_presets)  ──assign──▶  tenant.theme_preset_id
        │                                                                                          │
        └──apply/applyPreset()──▶ applyDesign() → :root vars → live re-skin        tenantTheme() merges tenant overrides on top
```
Engine: [`src/design/designSystem.ts`](../../src/design/designSystem.ts). Presets:
[`src/services/themePresets.service.ts`](../../src/services/themePresets.service.ts). UI:
[`ThemePresetsPanel.tsx`](../../src/features/admin/ThemePresetsPanel.tsx) (inside the Design Center).

## Flow: step by step
1. **Open the Design Center** ([14](14-design-center.md)) and edit tokens with live preview
   (`applyDesign(draft)`).
2. **Save as a preset:** `themePresetsService.save(name, currentDesignConfig)` → stored in
   `haat_crud_theme_presets` with an id.
   ```ts
   const preset = themePresetsService.save('Warm Bakery', mergeDesign(DEFAULT_DESIGN, {
     colors: { ...DEFAULT_DESIGN.colors, primary: '#C8873B', accent: '#E0A458' },
     typography: { ...DEFAULT_DESIGN.typography, fontFamily: 'Tajawal' },
     cards: { ...DEFAULT_DESIGN.cards, radius: 18 },
   }));
   ```
3. **Apply it live (optional):** `design.applyPreset(preset.config)` — atomic base+publish (avoids stale-draft
   closures).
4. **Assign it to a tenant/template:** set `theme_preset_id = preset.id` on the tenant (via the Tenant Control
   Center) or reference it in a template manifest ([21](21-how-to-create-new-template.md)). The tenant keeps only
   the **preset id + flat overrides**, never a full copy.
5. **Verify:** confirm the brand applies across all four surfaces (theme cascade).

## Dependencies
- `designSystem` (`DesignConfig`, `DEFAULT_DESIGN`, `applyDesign`, `mergeDesign`), `DesignContext`
  (`applyPreset`), `themePresets.service` (persist/duplicate/export/import/getConfig), `tenant.service`
  (`tenantTheme` resolves the preset as the base).

## Extension points
- **New token in the theme** → add it to `DesignConfig` + `DEFAULT_DESIGN` + `applyDesign` (default = current
  value) before you can set it in a preset ([06](06-theme-engine.md)).
- **Share a preset across environments** → `export`/`import` on `themePresets.service`.

## Reuse rules
- A theme is a **preset** (data), applied through the **one** engine. Never write CSS variables outside
  `applyDesign`. Never store a full theme copy on a tenant — store `theme_preset_id` + overrides.
- Keep presets built from `DEFAULT_DESIGN` via `mergeDesign` so unset fields inherit sane defaults.

## Files involved
- [`src/services/themePresets.service.ts`](../../src/services/themePresets.service.ts) ·
  [`src/design/designSystem.ts`](../../src/design/designSystem.ts) ·
  [`src/design/DesignContext.tsx`](../../src/design/DesignContext.tsx) ·
  [`src/features/admin/ThemePresetsPanel.tsx`](../../src/features/admin/ThemePresetsPanel.tsx) ·
  [`src/services/tenant.service.ts`](../../src/services/tenant.service.ts) (`tenantTheme`).

## Do's
- ✅ Build presets from `DEFAULT_DESIGN` + `mergeDesign`. ✅ Use `applyPreset()` for atomic apply.
- ✅ Assign by `theme_preset_id`; verify across surfaces.

## Don'ts
- ❌ Don't hardcode styles or write `:root` outside `applyDesign`. ❌ Don't copy a full theme onto a tenant.
- ❌ Don't build a second theming path.

## Example
```ts
// Save, apply live, then assign to a tenant:
const preset = themePresetsService.save('Aqua', mergeDesign(DEFAULT_DESIGN, { colors: { ...DEFAULT_DESIGN.colors, primary: '#12b5c9' } }));
design.applyPreset(preset.config);
await tenantService.update(tenant.id, { theme_preset_id: preset.id });
tenantService.applyTheme({ ...tenant, theme_preset_id: preset.id });
```

## Next
[25-how-to-create-new-white-label.md](25-how-to-create-new-white-label.md)
