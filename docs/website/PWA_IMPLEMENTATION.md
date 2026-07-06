# PWA Implementation (Wave 3, Part 9)

> Config-driven, per-tenant Progressive Web App: manifest + service worker + install prompt +
> offline / push-ready / background-sync-ready. `pwa/pwa.ts`. Flag: `website.pwa`. Reusable by every
> tenant (brand-driven manifest/theme). Pure + isomorphic (Node + browser).

## Manifest
`buildManifest(config)` produces a `manifest.webmanifest` object: name, short_name, description,
start_url, `display: standalone`, theme/background colors, lang/dir, and icons (**App Icons** — pass
the brand's 192/512 + maskable). Splash is derived by the browser from the manifest (icons +
theme/background). Config-driven → each tenant ships its own branded manifest.

## Service worker
`buildServiceWorker(config)` generates a SW source that:
- **precaches** the app shell + critical assets (`install`),
- cleans old caches (`activate`),
- serves **cache-first** for static GETs and **network-first with an offline fallback** for
  navigations (`fetch`) → **Offline** support,
- is **Push-ready**: a `push` listener shows a notification (wire a provider later),
- is **Background-sync-ready**: a `sync` listener drains a queued action tag when connectivity returns.

Versioned `cacheName` per deploy guarantees clean upgrades.

## Install prompt
`InstallPromptController(config)` manages the deferred `beforeinstallprompt` event:
- `capture(event)` stores it (after `preventDefault`),
- `shouldShow(ctx)` gates on `enabled` + `minVisits` + `minSecondsOnSite` + not-already-installed +
  a captured event (value-based, non-nagging),
- `prompt()` triggers the native install from a user gesture and returns the outcome
  (`accepted`/`dismissed`/`unavailable`/`ineligible`).

`pwaCapabilities()` feature-detects serviceWorker / PushManager / SyncManager, Node-safe.

## Integration
The install prompt is a natural companion to the App Growth Engine (`APP_GROWTH_ENGINE.md`): the
growth engine drives *app-store* conversion; the PWA install prompt drives *installable-web*
conversion — both configurable, both measured by analytics (`app_download_click`, `app_open`).

## Reusability
Every input is config; the manifest/SW/prompt are generated per tenant brand. No HaaT-specific values.

## Tests
`__tests__/checkout-marketing-pwa.test.ts` — manifest fields, SW markers (install/fetch/push/sync),
install-prompt eligibility + prompt lifecycle, capability detection.
