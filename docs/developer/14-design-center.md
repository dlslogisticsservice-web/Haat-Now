# 14 · Design Center

> **Audience:** developers working on the visual design admin surface.
> **Frozen:** the Design Center is a frozen system — extend additively; don't rewrite it.

## Purpose
The admin surface for editing the platform/tenant look — colors, typography, glass, cards, buttons, layout,
branding — with live preview, then publish. It is the operator front-end to the
[Theme Engine](06-theme-engine.md) and [Theme Presets](06-theme-engine.md).

## Architecture
```
DesignCenter (admin UI)  ──edits──▶  DesignContext draft  ──publish──▶  applyDesign(published) → :root vars → live re-skin
      │                                     │
      │ save/apply preset                   └─ persisted haat_design_store_v1 { draft, published, rollback }
      ▼
ThemePresetsPanel  ──▶  themePresets.service (haat_crud_theme_presets)  ← reusable DesignConfig snapshots
```
- [`src/features/admin/DesignCenter.tsx`](../../src/features/admin/DesignCenter.tsx) — the editor UI.
- [`src/features/admin/ThemePresetsPanel.tsx`](../../src/features/admin/ThemePresetsPanel.tsx) — save/apply/
  duplicate/export/import presets (Phase 0.2).
- [`src/design/DesignContext.tsx`](../../src/design/DesignContext.tsx) — draft/published state + `applyPreset()`
  (atomic base+publish; fixes stale-draft closures).
- All output goes through the **one** engine `applyDesign()` — no separate styling path.

## Flow: edit → preview → publish (and presets)
```
Edit token in Design Center → DesignContext draft updates → live preview (applyDesign(draft))
Publish → published = draft → persisted → boot uses published
Apply preset → DesignContext.applyPreset(preset.config) → base+published set atomically
Save as preset → themePresets.service stores the current DesignConfig snapshot
```

## Dependencies
- `design/designSystem` (`applyDesign`, `mergeDesign`, `DesignConfig`), `DesignContext`, `themePresets.service`,
  `tenant.service` (a tenant's theme preset is its base). Consumed indirectly by every surface via `:root`.

## Extension points
- **New editable token** → add it to `DesignConfig` + `DEFAULT_DESIGN` (default = current value) + `applyDesign`
  ([06-theme-engine.md](06-theme-engine.md)), then add a control in `DesignCenter`.
- **New preset operation** → extend `themePresets.service` (data ops), not a new store.

## Reuse rules
- Design Center writes design **only** through `DesignContext`/`applyDesign`. Presets are the reuse unit — don't
  copy full configs around; store id + overrides on tenants.
- Additive + backward compatible: default config = today's look (no behavior change until used).

## Files involved
- [`src/features/admin/DesignCenter.tsx`](../../src/features/admin/DesignCenter.tsx) ·
  [`src/features/admin/ThemePresetsPanel.tsx`](../../src/features/admin/ThemePresetsPanel.tsx) ·
  [`src/design/DesignContext.tsx`](../../src/design/DesignContext.tsx) ·
  [`src/services/themePresets.service.ts`](../../src/services/themePresets.service.ts).

## Do's
- ✅ Preview with `applyDesign(draft)`, persist with publish. ✅ Use `applyPreset()` for atomic base changes.
- ✅ Keep new controls additive.

## Don'ts
- ❌ Don't rewrite the Design Center or theme engine (frozen). ❌ Don't apply design outside `applyDesign`.
- ❌ Don't publish a draft that hasn't been previewed.

## Example
```ts
// Apply a saved preset as the live base (atomic — no stale draft):
const preset = themePresetsService.get(presetId);
design.applyPreset(preset.config);
```

## Next
[06-theme-engine.md](06-theme-engine.md) · [24-how-to-create-new-theme.md](24-how-to-create-new-theme.md)
