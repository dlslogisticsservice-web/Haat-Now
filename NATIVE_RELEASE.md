# Native Release — HAAT NOW

What was generated this sprint, and the exact operator steps that still need credentials/SDKs.

## Done (real, committed)
- **App icons** — generated from the brand (green `#a3f95b` tile + dark "layers" mark) by a pure-JS
  renderer (`scripts/gen-icons.cjs`, `scripts/gen-android-icons.cjs`; `npm run gen:icons`). No
  placeholders.
  - PWA: `public/icons/{icon-192,icon-512,maskable-192,maskable-512,apple-touch-icon,icon-1024,
    notification-icon}.png` — the manifest's previously-missing icons now exist (PWA installable).
  - Android: `ic_launcher` / `ic_launcher_round` / `ic_launcher_foreground` at mdpi→xxxhdpi +
    adaptive background colour `#A3F95B`.
- **Native projects** — `npx cap add android` and `npx cap add ios` both succeeded; `android/` and
  `ios/` are committed (build outputs are gitignored; source is in the repo).
- **iOS `Info.plist`** — usage descriptions (location/camera/photos), `NSUserTrackingUsageDescription`
  (ATT), `ITSAppUsesNonExemptEncryption=false` (export compliance), `CFBundleURLTypes` (`haatnow://`).
- **AndroidManifest** — custom-scheme deep links (`haatnow://`), Android App Links intent-filter
  (`https://app.haatnow.com`, `autoVerify`), permissions (location/camera/`POST_NOTIFICATIONS`/
  `READ_MEDIA_IMAGES`). RTL already on.
- **Capacitor config** — `capacitor.config.ts` (appId `com.haatnow.app`, splash, push plugin config).
- **App version** — `package.json` `version: 1.0.0` aligned with `APP_VERSION`.

## Operator steps that need credentials / a Mac / Android SDK (cannot be done in this CI env)
1. **Firebase / Push (FCM)** — `npm i @capacitor/push-notifications`, then add
   `android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist` from your Firebase
   project; upload the APNs key in Firebase. Register handlers in app startup (token/refresh/click/
   badge). *(Plugin not pre-installed because it requires the google-services file to sync cleanly.)*
2. **Android build** — install the Android SDK; `npm run build && npx cap sync android && (cd android
   && ./gradlew assembleRelease)`. Add a signing keystore (`keystore.properties`) for the release.
3. **iOS build** — on macOS: `npx cap sync ios && (cd ios/App && pod install)`, open in Xcode, set
   the team/signing, enable Push + Associated Domains capabilities, build/archive.
4. **App Links / Universal Links** — host `/.well-known/assetlinks.json` (Android) and
   `apple-app-site-association` (iOS) on `app.haatnow.com`; set the iOS Associated Domains entitlement.
5. **Store assets** — feature graphic + screenshots are produced from the running app per store specs.

## Regenerate icons
`npm run gen:icons` (re-renders PWA + Android icons from the brand renderer).
