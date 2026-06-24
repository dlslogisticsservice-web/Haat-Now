# PWA Audit (Task D)

**Date:** 2026-06-24 · Implemented this phase + remaining items.

## Implemented (build-safe, in `dist/`)
| Item | Status | File |
|---|---|---|
| Web App Manifest | ✅ added | `public/manifest.webmanifest` (name, theme `#060a0e`, `display: standalone`, RTL/ar) |
| Manifest linked | ✅ | `index.html` `<link rel="manifest">` + theme-color + apple-mobile meta |
| Service worker | ✅ added | `public/sw.js` — conservative network-first; **never caches** `/rest`,`/auth`,`/realtime`,`/functions` |
| SW registration | ✅ prod-only | `src/main.tsx` (`import.meta.env.PROD` guard → no dev/E2E interference) |
| Offline shell | ✅ | navigations fall back to cached `/index.html` when offline (live data stays fresh) |
| Installability | ✅ structurally | manifest + SW + start_url + icons declared → meets install criteria once icons exist |
| Shortcuts | ✅ declared | orders / discover / wallet quick actions in manifest |
| Maskable icons | ✅ declared | `maskable-192/512` referenced (purpose: maskable) |
| Splash compatibility | ✅ | `background_color`/`theme_color` set; iOS uses apple-touch-icon + status-bar meta |

## Pending (branding only)
| Item | Status | Note |
|---|---|---|
| Icon PNGs | ⬜ | drop `icon-192/512`, `maskable-192/512`, `apple-touch-icon` into `public/icons/` (paths already wired) |
| Lighthouse PWA pass | ⬜ | will pass once icons present + served over HTTPS (prod) |

## Runtime-safety notes
- SW is **opt-in to production** — local dev and the E2E runner (dev server) never register it, so there's
  zero risk of stale-cache flakiness in tests.
- SW explicitly **bypasses Supabase REST/Auth/Realtime/Edge** requests → no risk of serving stale
  orders/wallet/auth data.

## Verdict
**PWA foundation is real and installable-ready**; the only gap is the icon set (a branding deliverable),
whose exact paths are already referenced. **PWA readiness: high.**
