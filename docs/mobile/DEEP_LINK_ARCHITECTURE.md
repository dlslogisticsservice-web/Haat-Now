# Deep Linking Architecture (Task E)

**Date:** 2026-06-24 · Design only (no business logic changed).

## Schemes
| Type | Value | Use |
|---|---|---|
| Custom scheme | `haatnow://` | in-app/QR/SMS fallback |
| Universal/App Links | `https://haatnow.app/...` | preferred (verified domain, no scheme prompt) |

## Route map (canonical paths → in-app screen)
| Path | Custom scheme | Screen / param | Auth |
|---|---|---|---|
| `/merchant/:branchId` | `haatnow://merchant/:branchId` | restaurant (`selectedBranchId`) | public |
| `/product/:productId` | `haatnow://product/:productId` | restaurant → open product | public |
| `/offer/:offerId` | `haatnow://offer/:offerId` | discover/offer | public |
| `/order/:orderId` | `haatnow://order/:orderId` | orders detail | customer |
| `/tracking/:orderId` | `haatnow://tracking/:orderId` | orders detail → tracking map | customer |
| `/wallet` | `haatnow://wallet` | wallet | customer |
| `/referral/:code` | `haatnow://referral/:code` | apply referral code (E4 `apply_referral_code`) | customer |

## Native verification files (host on `https://haatnow.app`)
- **Android App Links:** `/.well-known/assetlinks.json`
  ```json
  [{ "relation": ["delegate_permission/common.handle_all_urls"],
     "target": { "namespace": "android_app", "package_name": "com.haatnow.app",
                 "sha256_cert_fingerprints": ["<release-signing-SHA256>"] } }]
  ```
- **iOS Universal Links:** `/.well-known/apple-app-site-association` (no extension, `application/json`)
  ```json
  { "applinks": { "details": [{ "appID": "<TEAMID>.com.haatnow.app", "paths": ["/merchant/*","/product/*","/offer/*","/order/*","/tracking/*","/wallet","/referral/*"] }] } }
  ```

## Native config
- **Android:** `AndroidManifest.xml` intent-filters (`autoVerify="true"`) for `haatnow` scheme + `https://haatnow.app` host.
- **iOS:** Associated Domains capability → `applinks:haatnow.app` + custom URL Type `haatnow`.
- **Capacitor:** `@capacitor/app` `appUrlOpen` listener → parse URL → route via the existing screen state
  (`setCurrentScreen` / `setSelectedBranchId` / `setSelectedTrackingOrderId`). One small router util maps
  path → screen; **no existing flow changes**, just an entry point.

## Implementation steps (future, ~0.5 day)
1. `npm i @capacitor/app`; add a `deepLinkRouter(url)` util mapping the table above to App screen state.
2. Register `App.addListener('appUrlOpen', …)` in `App.tsx` (mount-time effect).
3. Host the two `.well-known` files; add intent-filters / associated domains.
4. Add `?screen=` query handling for PWA shortcuts (already declared in the manifest).
