# Android Production Readiness (Task B)

**Date:** 2026-06-24 · Target: Google Play (AAB) + sideload APK via Capacitor 8.

## Identity & versioning
| Item | Value | Where |
|---|---|---|
| Application ID | `com.haatnow.app` | `capacitor.config.ts` → `android/app/build.gradle` `applicationId` |
| Package naming | reverse-DNS, lowercase, stable forever | ✅ conventional |
| versionCode | **1** (integer, +1 every store upload) | `android/app/build.gradle` `versionCode` |
| versionName | **1.0.0** (semver, user-visible) | `android/app/build.gradle` `versionName` |
| Min / Compile / Target SDK | 23 / 35 / 35 | Capacitor 8 defaults (Play requires targetSdk ≥ 35 from Aug 2025) |

## Network security & cleartext
- **Cleartext disabled:** `capacitor.config.ts` `android.allowMixedContent: false`. Add
  `android:usesCleartextTraffic="false"` in `AndroidManifest.xml` + a `res/xml/network_security_config.xml`
  with `<base-config cleartextTrafficPermitted="false">`. All backends are HTTPS (Supabase, Moyasar) so no
  cleartext exception is needed.
- **`network_security_config.xml`** template (drop into `android/app/src/main/res/xml/`):
  ```xml
  <network-security-config>
    <base-config cleartextTrafficPermitted="false">
      <trust-anchors><certificates src="system" /></trust-anchors>
    </base-config>
  </network-security-config>
  ```

## Permissions audit (declare ONLY what a role uses — see PERMISSIONS_MATRIX)
| Permission | Needed by | Notes |
|---|---|---|
| `INTERNET` | all | default |
| `ACCESS_FINE_LOCATION` | customer (address pick), driver (tracking) | runtime prompt |
| `ACCESS_COARSE_LOCATION` | customer | runtime prompt |
| `ACCESS_BACKGROUND_LOCATION` | **driver only** | separate prompt + Play "background location" declaration form |
| `POST_NOTIFICATIONS` | all (Android 13+) | runtime prompt |
| `CAMERA` | merchant (product photos), driver/merchant (KYC docs) | runtime prompt |
| `READ_MEDIA_IMAGES` | merchant (gallery upload) | Android 13+ |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` | driver (live tracking) | with a foreground-service notification |

## Build & signing checklist
- [ ] `npx cap add android` + `npx cap sync`
- [ ] Set `applicationId`, `versionCode`, `versionName` in `android/app/build.gradle`
- [ ] Add `network_security_config.xml` + manifest `usesCleartextTraffic="false"`
- [ ] Declare runtime permissions per the matrix (don't over-declare → Play rejection risk)
- [ ] Generate upload keystore (`keytool`) → configure Play App Signing
- [ ] `./gradlew bundleRelease` → signed `.aab`; `assembleRelease` → `.apk`
- [ ] Adaptive icons + splash (see BRANDING_ASSETS_REQUIREMENTS)
- [ ] Data-safety form + privacy policy URL (see STORE_COMPLIANCE_AUDIT)

## Status
**Config-ready, native project pending.** No code blockers; remaining work is `cap add` + signing +
branding + the Play declarations.
