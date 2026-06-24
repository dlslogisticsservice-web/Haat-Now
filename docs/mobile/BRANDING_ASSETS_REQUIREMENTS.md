# Branding Assets Requirements (Task J)

**Date:** 2026-06-24 · Exact production specs. Generate everything from **one 1024×1024 master logo**
(transparent PNG) + a brand background `#060a0e`.

## Recommended generator
```bash
npm i -D @capacitor/assets
# place master at: assets/icon-only.png (1024x1024), assets/icon-foreground.png, assets/icon-background.png,
#                  assets/splash.png (2732x2732), assets/splash-dark.png
npx @capacitor/assets generate --iconBackgroundColor '#060a0e' --splashBackgroundColor '#060a0e'
```
This emits the full Android `mipmap`/adaptive set, iOS asset catalog, and splash images.

## PWA (manifest already references these exact paths in `public/icons/`)
| File | Size | Notes |
|---|---|---|
| `icon-192.png` | 192×192 | any |
| `icon-512.png` | 512×512 | any |
| `maskable-192.png` | 192×192 | maskable, ≥20% safe-zone padding |
| `maskable-512.png` | 512×512 | maskable |
| `apple-touch-icon.png` | 180×180 | iOS, opaque (no alpha) |
| `favicon.ico` / `favicon.svg` | 32/scalable | browser tab |

## Android
| Asset | Spec |
|---|---|
| Adaptive icon foreground | 432×432 in 108dp canvas, logo within 66dp safe circle |
| Adaptive icon background | solid `#060a0e` or brand shape |
| Legacy `mipmap` | 48/72/96/144/192 px (mdpi→xxxhdpi) |
| Play Store listing icon | 512×512 PNG (32-bit) |
| Feature graphic | 1024×500 |
| Splash (Splash Screen API / drawable) | centered logo on `#060a0e`, 320–640dp |

## iOS
| Asset | Spec |
|---|---|
| App icon (asset catalog) | 1024×1024 marketing + all device sizes (auto via generator) |
| LaunchScreen | storyboard: centered logo on `#060a0e` (no text — Apple guideline) |

## Splash / launch (Capacitor)
- `capacitor.config.ts` already sets SplashScreen `backgroundColor #060a0e`, `launchShowDuration 1200`,
  `androidScaleType CENTER_CROP`, `showSpinner false`.
- Provide `splash.png` (2732×2732, logo centered within the middle ~1200×1200 safe area).

## Deliverable to unblock packaging
Drop the PWA icon PNGs into `public/icons/` (paths pre-wired) and run `@capacitor/assets generate` for the
native sets. **No code changes needed** — purely brand artwork.
