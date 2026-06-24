# Capacitor Foundation Audit (Task A)

**Date:** 2026-06-24 · Web stack: Vite 6 + React 19 + TS, `webDir: dist`.

## Current state
| Item | Status | Evidence |
|---|---|---|
| Capacitor installed | ✅ **YES** | `@capacitor/{core,cli,android,ios}@^8.4.1` in package.json |
| Capacitor version | **8.4.1** | latest major (8.x) |
| `capacitor.config.ts` | ✅ present | appId `com.haatnow.app`, appName `HAAT NOW`, `webDir: dist` |
| Android target compatibility | ✅ supported | Capacitor 8 → Android `minSdk 23`, `compileSdk 35`, AGP 8.x, JDK 21 |
| iOS target compatibility | ✅ supported | Capacitor 8 → iOS 14.0+, Xcode 16, Swift |
| Web build compatibility | ✅ passes | `npm run build` green; `dist/` produced and consumed by `webDir` |
| Native projects (`android/`, `ios/`) | ⬜ not generated | run `npx cap add android` / `npx cap add ios` (needs Android SDK / Xcode+Mac) |
| `package.json` name | ⚠️ `react-example` | rename to `haat-now` (cosmetic; pre-store) |

## Remaining commands (one-time, on a dev machine)
```bash
npm run build                 # produce dist/
npx cap add android           # generates android/ (needs Android SDK to build)
npx cap add ios               # generates ios/ (needs macOS + Xcode)
npx cap sync                  # copy web assets + plugins into native
# plugins to add when wiring features:
npm i @capacitor/app @capacitor/push-notifications @capacitor/geolocation \
      @capacitor/splash-screen @capacitor/status-bar @capacitor/preferences
```

## Verdict
Capacitor **core foundation is in place and build-safe**. Generating the native shells is a deterministic
2-command step requiring platform tooling (Android SDK / macOS+Xcode) — intentionally deferred so
day-to-day web dev is unaffected. **Capacitor readiness: high.**
