# 06 — Android / iOS Readiness (inspection-only)

## Verdict: **NOT release-ready.** Web/PWA + Capacitor *config* exist; native shells + assets do not.

## Present (evidence)
| Item | Status | Evidence |
|---|---|---|
| Capacitor config | ✅ | `capacitor.config.ts` — `appId: com.haatnow.app`, appName `HAAT NOW`, webDir `dist`, splash + PushNotifications plugin config |
| PWA manifest | ✅ | `public/manifest.webmanifest` (name, display standalone, orientation portrait, theme/bg color, 4 icon entries, 3 shortcuts) |
| Service worker | ✅ | `public/sw.js` (network-first shell cache, registered in `src/main.tsx`) |
| Splash plugin config | ✅ | `capacitor.config.ts` `SplashScreen` (1200ms, bg `#060a0e`) |
| HTTPS-only | ✅ | `android.allowMixedContent: false` |

## Missing / blocking (evidence)
| Item | Status | Evidence |
|---|---|---|
| Native `android/` shell | ❌ | folder does not exist (generated via `npx cap add android`) |
| Native `ios/` shell | ❌ | folder does not exist (`npx cap add ios`) |
| App icon PNGs | ❌ | `public/icons/` contains only `README.md` — manifest references `/icons/icon-192.png`, `icon-512.png`, `maskable-192/512.png` which **do not exist** |
| Android adaptive icons | ❌ | no `android/` res (no native folder) |
| iOS app icons / `Info.plist` | ❌ | no `ios/` |
| `AndroidManifest.xml` / permissions | ❌ | no native folder |
| Associated Domains / Universal Links | ❌ | none configured |
| Android App Links / `assetlinks.json` | ❌ | none |
| Deep-link handler (`appUrlOpen`) | ❌ | no listener in `src/` |
| Firebase config (`google-services.json` / `GoogleService-Info.plist`) | ❌ | none; no `FirebaseMessaging` code |
| Push notification client code | ❌ | only Capacitor *plugin config*; no register/handler in app |
| Google Maps key (runtime) | ⚠️ | `VITE_GOOGLE_MAPS_API_KEY` read; live map shows fallback when unset |
| Signing config / keystore | ❌ | no native project |
| Store assets (screenshots/listing) | ❌ | none in repo |
| App Transport Security (iOS) | ❌ | no `Info.plist` |

## Path to release (sequence, not implemented)
1. Generate icon set (192/512 + maskable + adaptive + iOS set) into `public/icons/` + native res.
2. `npm run build` → `npx cap add android` / `npx cap add ios` → `npx cap sync`.
3. Add Firebase projects + `google-services.json` / `GoogleService-Info.plist`; wire
   `@capacitor/push-notifications` register/handlers.
4. Configure deep links + Associated Domains + `assetlinks.json`.
5. Signing configs (keystore / provisioning), store metadata, screenshots.
6. Env separation (`.env.production`), Maps key, ATS.

**Completion estimate: ~25%** (config + PWA shell done; native projects, assets, push, deep links,
signing all remaining).
