# Permissions Matrix (Task I)

**Date:** 2026-06-24 · Per-role native permission requirements. Principle: **request the minimum, at the
moment of use, with a pre-prompt rationale.** Over-declaring triggers store rejections.

## Matrix
| Permission | Customer | Merchant | Driver | Admin | When requested |
|---|---|---|---|---|---|
| **Location (foreground)** | ✅ pick address / track order | ◻ optional (branch geo) | ✅ go-online | ◻ ops map (web) | at address-pick / driver online |
| **Background Location** | ❌ | ❌ | ✅ **required** (live tracking) | ❌ | after foreground granted, separate prompt + justification |
| **Camera** | ❌ | ✅ product photos / KYC | ✅ KYC docs | ❌ | at photo/doc capture |
| **Photos / Media** | ◻ avatar (optional) | ✅ gallery upload | ◻ doc upload | ❌ | at picker open |
| **Notifications** | ✅ order updates | ✅ new orders | ✅ dispatch offers | ◻ alerts | post-login pre-prompt |
| **Microphone** | ❌ | ❌ | ❌ | ❌ | not used (reserve for future in-app calls) |

✅ required · ◻ optional/contextual · ❌ not requested

## Platform declarations (only for the permissions actually used by a build)
| Permission | Android (`AndroidManifest.xml`) | iOS (`Info.plist`) |
|---|---|---|
| Location FG | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | `NSLocationWhenInUseUsageDescription` |
| Location BG (driver) | `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | `NSLocationAlwaysAndWhenInUseUsageDescription` + Background Modes: Location |
| Camera | `CAMERA` | `NSCameraUsageDescription` |
| Photos | `READ_MEDIA_IMAGES` (A13+) | `NSPhotoLibraryUsageDescription` |
| Notifications | `POST_NOTIFICATIONS` (A13+) | Push capability + Background Modes: Remote notifications |
| Microphone | (omit) | (omit) |

## Build-flavor recommendation
Ship **separate driver app/flavor** (or runtime-gated build) so the customer app **does not declare
background location / foreground-service** — those raise the strictest store review (and would be
unjustifiable in a customer build). Customer + merchant + admin can share one app; driver is its own
target. This keeps each store listing's permission set minimal and reviewable.
