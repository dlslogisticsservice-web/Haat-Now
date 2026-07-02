# Store Submission Guide — HAAT NOW

Step-by-step submission to **Google Play Console** and **Apple App Store Connect**. Prereqs: complete
`LAUNCH_CHECKLIST.md` §C (credentials) and §D (signed builds).

App identity: **HAAT NOW** · bundle/app id **`com.haatnow.app`** · version **1.0.0** (versionCode 1).

---
## Part 1 — Google Play Console

### 1. Create the app
1. Play Console → **Create app** → name "HAAT NOW", default language Arabic (or English), **App**, Free.
2. Accept declarations (Developer Program Policies, US export laws).

### 2. Store listing
- **App name**: HAAT NOW · **Short description** (≤80): "اطلب من مطاعمك ومتاجرك المفضلة بتوصيل سريع".
- **Full description**: features (multi-vertical delivery, live tracking, wallet, loyalty).
- **App icon**: `public/icons/icon-512.png`.
- **Feature graphic**: `store-assets/feature-graphic-1024x500.png` (add wordmark in final pass).
- **Phone screenshots** (2–8): from `docs/testing/e2e_shots/review/` (recapture at 1080×1920).
- **Tablet screenshots** (7"/10"): recapture from the admin/desktop view.

### 3. Policy & content
- **Privacy policy URL**: the hosted Privacy page (must be public).
- **Data Safety**: declare collected data — **Phone** (account), **Approx/Precise location** (delivery),
  **Payment info** (orders, processed by gateway), **App activity**. Mark encrypted-in-transit; provide
  the **account deletion URL/flow** (in-app Delete Account + Profile→Settings).
- **App access**: provide demo login (sandbox OTP `123456`, phone `+201000000001`) for review.
- **Content rating**: complete the questionnaire (likely PEGI 3 / Everyone).
- **Target audience**: 18+ (or per policy); **Ads**: declare if any.
- **Government/Financial**: declare payment handling.

### 4. Release
1. **Production → Create release** → upload the signed **`.aab`** (`android/app/build/outputs/bundle/release/`).
2. Play App Signing: accept Google-managed signing.
3. Release name `1.0.0 (1)`, add release notes.
4. **Review release** → fix any policy warnings → **Start rollout to Production** (or staged %).
5. (Recommended) Internal testing track first → then promote.

### 5. Play Integrity (optional hardening)
- App Integrity → enable Play Integrity API; (optional) wire the token check server-side later.

---
## Part 2 — Apple App Store Connect (requires macOS + Apple Developer Program)

### 1. App ID & certificates
1. developer.apple.com → Certificates, Identifiers → register App ID `com.haatnow.app` with
   **Push Notifications** + **Associated Domains** capabilities.
2. Create an APNs key (for FCM) and a Distribution certificate + App Store provisioning profile.

### 2. Build & upload
1. `npx cap sync ios && (cd ios/App && pod install)`; open `ios/App/App.xcworkspace` in Xcode.
2. Signing & Capabilities → select Team; add **Push Notifications** + **Associated Domains**
   (`applinks:app.haatnow.com`).
3. Set version 1.0.0 / build 1. **Product → Archive** → **Distribute App → App Store Connect → Upload**.

### 3. App Store Connect listing
1. **My Apps → +** → New App; bundle id `com.haatnow.app`, SKU, name "HAAT NOW".
2. **App Privacy**: complete the nutrition label — Phone, Location, Payment, Usage data; map purposes;
   declare **ATT** (the app shows the ATT prompt; `NSUserTrackingUsageDescription` is set).
3. **Privacy Policy URL** + **Support URL** + **Marketing URL**.
4. **App Review Information**: demo account (sandbox phone `+201000000001`, OTP `123456`), notes.
5. **Screenshots**: 6.7" (1290×2796), 6.5", 5.5", iPad 12.9" — recapture from the app.
6. **Export compliance**: `ITSAppUsesNonExemptEncryption=false` is set → answer "No".

### 4. Submit
1. Select the uploaded build → complete all metadata → **Add for Review** → **Submit**.
2. Respond to any reviewer questions (deletion flow, payment, permissions are all in place).

---
## Demo / review credentials (sandbox)
| Role | Phone | OTP |
|---|---|---|
| Customer | `+201000000001` | `123456` |
| Merchant | `+201000000002` | `123456` |
| Driver | `+201000000003` | `123456` |
| Super Admin | `+201000000005` | `123456` |

> For production review, point the build at the **production** Supabase (not sandbox) and provide a
> real reviewer account, or keep `VITE_AUTH_MODE=sandbox` for a self-contained demo build.

## Common rejection causes — already addressed
- ✅ Account deletion present (Apple 5.1.1(v)) · ✅ permission usage strings · ✅ ATT · ✅ privacy labels ·
  ✅ no private APIs · ✅ export compliance. Ensure the **hosted** Privacy/Terms URLs resolve before submit.
