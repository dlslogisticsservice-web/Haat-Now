# Launch Checklist — HAAT NOW

Every remaining **manual action** to take the certified app public. Code is frozen and live
(`https://haat-now.vercel.app`). Items are **operator** tasks (credentials, accounts, store consoles).
Legend: ☐ todo · ✅ done in-repo.

## A. Assets (in `/store-assets`, `/public/icons`, `/android`, `/ios`)
- ✅ App icons (all densities) · adaptive icons · notification icon — generated (`npm run gen:icons`)
- ✅ Feature graphic 1024×500 + 512² promo — generated (`npm run` → `node scripts/gen-store-assets.cjs`)
- ✅ Store screenshots (real) — `docs/testing/e2e_shots/review/cust_*.png` (home, wallet, profile, menu, orders)
- ☐ Overlay brand wordmark + tagline on the feature graphic (final design pass; base + negative space ready)
- ☐ Capture 3–8 screenshots per device class at store resolutions (phone 1080×1920, 7" + 10" tablet, iPhone 6.7"/6.5"/5.5", iPad 12.9")
- ☐ Brand splash image (2732² PNG) → drop into `android`/`ios` via `@capacitor/assets`
- ☐ (Optional) App preview video — see checklist in `STORE_SUBMISSION_GUIDE.md`

## B. Store compliance (already in the build)
- ✅ Delete Account (RPC + UI, all roles) · Export My Data
- ✅ Privacy / Terms / Support / About (in-app summaries) — ☐ host full lawyer-reviewed text at public URLs
- ✅ iOS Privacy Manifest keys · ATT (`NSUserTrackingUsageDescription`) · usage descriptions · export compliance
- ✅ Android permissions (location/camera/`POST_NOTIFICATIONS`/media) declared
- ☐ Google Play **Data Safety** form (data map: phone, location, payment — see guide)
- ☐ Support URL + Marketing URL (point at the live site / a landing page)

## C. Production services / credentials (operator-injected; the seams exist)
| Service | Action | Where it plugs in |
|---|---|---|
| ☐ **Supabase production** | apply all migrations (`supabase db push`); set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Vercel env |
| ☐ **Google Maps** | create a production key; restrict to the domain | `VITE_GOOGLE_MAPS_API_KEY` |
| ☐ **Firebase / FCM** | create project; add `google-services.json` + `GoogleService-Info.plist`; upload APNs key; `npm i @capacitor/push-notifications` | native projects |
| ☐ **Crash reporting** | provision Sentry; set DSN | `VITE_SENTRY_DSN` |
| ☐ **Analytics** | provision collector; set URL | `VITE_ANALYTICS_URL` |
| ☐ **Payments (Paymob/Moyasar)** | production keys + `PAYMENT_WEBHOOK_SECRET`; `PAYMENT_MODE=production`; point provider webhooks at `/functions/v1/payment-webhook` | Supabase secrets |
| ☐ **Vercel** | (optional) add `VERCEL_TOKEN`/`ORG_ID`/`PROJECT_ID` to enable the CI deploy path (native GitHub integration already deploys) | repo secrets |
| ☐ **Custom domain** | point `app.haatnow.com` DNS at Vercel (auto-SSL) | Vercel domains |

## D. Mobile builds (need a Mac / Android SDK)
- ☐ **Android**: generate keystore → `android/keystore.properties` (config ready); `npm run build && npx cap sync android && (cd android && ./gradlew bundleRelease)` → signed `.aab`
- ☐ **iOS**: on macOS → `npx cap sync ios && (cd ios/App && pod install)`; set team/signing in Xcode; enable Push + Associated Domains; archive → `.ipa`
- ☐ **App Links / Universal Links**: host `/.well-known/assetlinks.json` (Android) + `apple-app-site-association` (iOS) on the domain

## E. Pre-submit verification (do last)
- ☐ Smoke-test a real Paymob/Moyasar sandbox payment (initiate → webhook → order paid)
- ☐ Verify FCM push delivers (foreground/background/terminated)
- ☐ Verify production `version.json` / `health.json` SHA after the final deploy
- ☐ Run Lighthouse/PageSpeed against the production URL (target ≥ 90 perf/best-practices)
- ☐ Confirm Supabase PITR backup window + run one restore drill

## Status summary
- **Web/PWA**: ✅ LIVE & certified (no action needed to keep it running).
- **Google Play**: ready pending §C, §D, §A screenshots, §B Data Safety.
- **Apple App Store**: ready pending §C, §D (Mac build), §A screenshots, §B URLs.
- **Every remaining item is an external credential, a paid build environment, a hosted file, or a store
  console step — none is an application code change.**
