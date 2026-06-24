# App Store Compliance Audit (Task G)

**Date:** 2026-06-24 · Pre-submission compliance for Apple App Store + Google Play.

## Apple App Store
| Requirement | Status | Action |
|---|---|---|
| Real account / login works | ⚠️ | replace Test OTP `123456` with real Twilio before review (Apple tests login) |
| Demo account for reviewers | ⬜ | provide a working demo phone + OTP in App Review notes |
| Privacy "nutrition label" | ⬜ | declare: phone, name, address, location, order history (linked to identity; not tracking) |
| Privacy policy URL (reachable) | ⬜ | host `https://haatnow.app/privacy` |
| ATS (no arbitrary loads) | ✅ | all HTTPS; no exception needed |
| Permission usage strings | ⬜ | all `NS*UsageDescription` present (see IOS_READINESS) |
| Payments compliance | ✅ | physical goods/delivery → external PSP (Moyasar) allowed; **no Apple IAP required** |
| ATT (if IDFA) | ✅ N/A | no tracking SDK today |
| Sign in with Apple | ✅ N/A | only required if other social logins exist; app is phone-OTP only |
| Background location justification | ⬜ | driver build only; explain in review notes + Info.plist Always string |

## Google Play
| Requirement | Status | Action |
|---|---|---|
| targetSdk ≥ 35 | ✅ | Capacitor 8 default |
| Data safety form | ⬜ | mirror Apple privacy declarations |
| Privacy policy URL | ⬜ | same as above |
| Background location declaration | ⬜ | **driver app**: Play permissions declaration form + video justification |
| Permissions minimization | ✅ planned | declare only per PERMISSIONS_MATRIX |
| Account deletion (in-app + URL) | ⬜ | required by Play: add "delete my account" flow + web URL |
| Foreground service type | ⬜ | `location` type + persistent notification (driver) |
| App content / ads / target audience forms | ⬜ | complete in Play Console |

## Cross-store (legal / data)
- **Privacy policy + Terms of Service**: write + host (`/privacy`, `/terms`). Required by both stores.
- **User data**: phone, name, addresses (+notes), order/payment history, optional location. Stored in
  Supabase (RLS-scoped); not sold; not used for cross-app tracking.
- **Account deletion**: required by Play (and good practice) — needs an in-app deletion request + backend
  purge/anonymize routine. **Not built yet.**
- **Location**: foreground for customers (address/tracking), background for **drivers only** (must be
  clearly justified to both stores).
- **Notifications**: opt-in; runtime permission; no notifications before consent.

## Blockers before submission (compliance)
1. Real Twilio OTP (Apple/Play test logins).
2. Privacy policy + Terms hosted + linked.
3. Privacy/Data-safety forms completed.
4. **Account-deletion flow** (Play hard requirement) — not implemented.
5. Background-location declaration + foreground-service (driver build).

## Status
No code regressions; compliance is **documentation + legal + a few flows (account deletion, real OTP)**.
