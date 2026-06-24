# iOS Production Readiness (Task C)

**Date:** 2026-06-24 · Target: Apple App Store (IPA) via Capacitor 8 (iOS 14+). Requires macOS + Xcode 16.

## Bundle & versioning
| Item | Value | Where |
|---|---|---|
| Bundle identifier | `com.haatnow.app` | matches `capacitor.config.ts` + App Store Connect |
| Marketing version (`CFBundleShortVersionString`) | 1.0.0 | `ios/App/App/Info.plist` |
| Build (`CFBundleVersion`) | 1 (+1 per upload) | Info.plist |
| Deployment target | iOS 14.0 | Capacitor 8 minimum |
| Signing | Apple Developer team + provisioning profile | Xcode → Signing & Capabilities |

## Info.plist — required usage strings (Apple rejects missing/empty strings)
| Key | Value (AR/EN) | Trigger |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | "لتحديد عنوان التوصيل وتتبع الطلب." | customer address / tracking |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | "لمشاركة موقع المندوب أثناء التوصيل." | **driver** background tracking |
| `NSCameraUsageDescription` | "لالتقاط صور المنتجات والمستندات." | merchant photos / KYC |
| `NSPhotoLibraryUsageDescription` | "لرفع صور المنتجات من المعرض." | merchant gallery |
| `NSPhotoLibraryAddUsageDescription` | "لحفظ الإيصالات." | optional |
| `NSUserTrackingUsageDescription` | "لتحسين العروض والإعلانات." | **only if** ATT/IDFA used |
| `NSMicrophoneUsageDescription` | (omit unless in-app calls/voice added) | not used today |

## App Transport Security (ATS)
- **Keep ATS ON** (default, secure). No `NSAllowsArbitraryLoads`. All endpoints (Supabase `*.supabase.co`,
  Moyasar, Google Maps) are HTTPS/TLS 1.2+, so **no ATS exceptions are required**.

## Capabilities
- [ ] **Push Notifications** capability + **Background Modes → Remote notifications** (APNs).
- [ ] **Background Modes → Location updates** (driver build only).
- [ ] Associated Domains → `applinks:haatnow.app` (Universal Links — see DEEP_LINK_ARCHITECTURE).

## Tracking readiness (ATT)
The app does **no IDFA/cross-app tracking today** → App Privacy "Data Used to Track You" = none; **no ATT
prompt needed**. If an ad SDK is added later, add `NSUserTrackingUsageDescription` + call
`AppTrackingTransparency` before any IDFA read, and update App Privacy.

## Checklist
- [ ] `npx cap add ios` + `npx cap sync` (on macOS)
- [ ] Set bundle id, versions, team/signing
- [ ] Add all required Info.plist usage strings (above)
- [ ] Add Push + Background Modes + Associated Domains capabilities
- [ ] App icons (asset catalog) + LaunchScreen storyboard (see BRANDING_ASSETS)
- [ ] App Privacy "nutrition label" + privacy policy URL
- [ ] Archive → upload to App Store Connect via Xcode/Transporter

## Status
**Config-ready, native project pending (needs macOS).** No code blockers.
