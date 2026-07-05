# Theme Engine — Design Tokens & Theming

> HaaT Now · Phase 10 · Design only (Part 6). Reuses the platform's existing theme engine
> (`designSystem` / `tenantTheme`, `src/services/tenant.service.ts:20-36`) rather than inventing a
> parallel one — the current site runtime already re-skins per tenant via CSS variables
> (`runtime.ts:53-58`). Website OS turns that into a full, persisted, per-site token system.

## 1. Principles
- **Tokens → CSS variables.** Every design decision is a token resolved to a CSS custom property at
  render. No hard-coded colors in blocks (the platform already uses `var(--color-*)` throughout).
- **One engine, two consumers.** The admin app and the edge renderer resolve the same
  `website_theme_tokens` into the same CSS variables → preview == production.
- **Per-site, per-mode.** A site has one active theme; each theme carries light + dark token sets.
- **Extends a base preset.** Themes `base_preset` onto the platform's system presets (Default/Ocean/
  Sunset/Royal already exist in `themePresets.service`), overriding only what differs.

## 2. Token groups (Part 6 coverage)

| Group | Tokens (examples) |
|---|---|
| **Color** | primary, secondary, accent, surface, on-surface, outline, success/warn/error, gradient stops (full Material-style role set, matching the app's `--color-*`) |
| **Typography** | font-family (heading/body), scale (xs…display), weight, line-height, letter-spacing |
| **Spacing** | spacing scale (0…24), section padding, container max-width, gutter |
| **Radius** | none/sm/md/lg/pill per element (buttons, cards, inputs, images) |
| **Shadow** | elevation levels 0–5, focus ring |
| **Glass** | blur intensity, opacity, border (the app already has `glass.intensity`) |
| **Dark / Light mode** | full parallel token set; `prefers-color-scheme` + explicit toggle |
| **Fonts** | self-hosted + Google Fonts; subsetted; `font-display: swap` |
| **Icons** | icon set + default size/stroke (lucide already in-app) |
| **Animations** | motion presets (fade/slide/scale), duration, easing, reduced-motion respect |
| **Button styles** | variants (primary/secondary/ghost/link), size, radius, shadow, hover |
| **Cards** | radius, border, shadow, padding, hover elevation |
| **Navbar** | height, background, blur, sticky behavior, logo size, link style |
| **Footer** | columns, background, link style, social row |
| **Global variables** | any custom token an agency wants to reference across blocks |

## 3. Resolution pipeline
```
website_themes(active) + website_theme_tokens(group,key,value,mode)
  → compiled at PUBLISH into the snapshot as a { light:{…}, dark:{…} } CSS-var map
  → edge renderer emits <style>:root{ --color-primary: …; } :root[data-theme=dark]{ … }</style>
  → blocks reference var(--…) only
```
Dark/light is a `data-theme` attribute on `:root` (the app already uses this pattern for artifacts/
theme toggle). The visitor's OS preference sets the default; a site toggle overrides.

## 4. Theme import / export / marketplace
- **Export**: serialize the active theme + tokens to a versioned JSON document
  (`{ version, kind:'haat-theme', base_preset, tokens:{light,dark} }`) — mirrors the existing
  tenant export pattern (`tenant.service.exportTenant`).
- **Import**: validate + install as a new saved theme (never overwrite silently).
- **Marketplace-ready**: `website_templates`/theme entries with `visibility='marketplace'`,
  preview URL, install counter. Installing clones the token set into the tenant (isolated copy).

## 5. Theme Builder UX
- Live token editing with instant canvas re-skin (CSS-var swap, no rebuild — the current runtime
  already does live re-skin).
- Contrast/accessibility checker (WCAG AA) on color pairs — a11y gate before publish.
- Font picker with live preview + performance hint (subset size).
- "Reset to preset" and per-group override indicators.

## 6. Multi-tenant & white-label guarantees
- Themes are `tenant_id`-scoped (RLS). A tenant can never read/apply another tenant's private theme.
- The edge renderer resolves theme from the **published snapshot** (already tenant-bound), so a
  visitor to `brandA.com` can never receive brandB tokens.
- The platform's system presets are the only shared, read-only base.

## 7. What we reuse vs build
| Reuse (exists) | Build (new) |
|---|---|
| `designSystem` CSS-var application, `tenantTheme()` merge, `applyDesign` (`tenant.service.ts`) | `website_themes` / `website_theme_tokens` persistence + per-site scoping |
| System presets + `themePresets.service` | Full token editor (spacing/shadow/animation/navbar/footer groups) |
| Live re-skin on the public runtime (`runtime.ts:55`) | Dark/light dual token compile into the published snapshot |
| Tenant brand fields (colors/logo) | Theme import/export/marketplace + a11y gate |
