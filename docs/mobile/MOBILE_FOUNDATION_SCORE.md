# Mobile Foundation Readiness Score (Task K)

**Date:** 2026-06-24 · Scored after MOBILE-0 foundation work. Honest, evidence-based.

## Scorecard
| Dimension | Current | Target | Remaining work |
|---|---|---|---|
| **Android readiness** | **55%** | 100% | `cap add android`, signing keystore + Play App Signing, manifest permissions + network-security-config, branding, Play declarations |
| **iOS readiness** | **50%** | 100% | macOS + `cap add ios`, signing/profiles, Info.plist usage strings, Push/Background/Associated-Domains capabilities, branding |
| **PWA readiness** | **85%** | 100% | icon PNG set only (paths pre-wired); HTTPS prod serve |
| **Push readiness** | **25%** | 100% | Firebase project + creds, wire real token registration, `push-send` edge fn, event hooks |
| **Analytics readiness** | **20%** | 100% | Sentry (web) + Firebase Analytics/Crashlytics, `analytics-client` seam + events |
| **Store readiness** | **30%** | 100% | privacy policy + terms, data-safety/privacy forms, account-deletion flow, real OTP, bg-location declaration |
| **OVERALL** | **~45%** | 100% | native shells + push + branding + compliance (below) |

## What this phase delivered (real, build-safe)
- ✅ Capacitor 8.4.1 installed (`core/cli/android/ios`) + `capacitor.config.ts` (appId `com.haatnow.app`).
- ✅ PWA: manifest, service worker (prod-only, API-bypassing), mobile meta, shortcuts, maskable-icon refs.
- ✅ 10 production specs/audits (Android, iOS, PWA, deep links, push, store compliance, analytics,
  permissions matrix, branding, this score).
- ✅ No business logic touched; build + lint + E2E green.

## Blockers to App Store / Play submission (ranked)
| # | Blocker | Owner | Effort |
|---|---|---|---|
| 1 | Native shells not generated (`cap add android/ios`) — iOS needs macOS+Xcode | eng | 0.5 d (Android) / 0.5 d (iOS, on Mac) |
| 2 | Branding assets (icons/splash) absent | design | 0.5 d once artwork ready |
| 3 | Device push not wired (Firebase + `push-send` + token registration) | eng | 1.5 d |
| 4 | Real Twilio OTP (store reviewers test login) | ops | 0.5 d |
| 5 | Privacy policy + Terms + data-safety/privacy forms | legal/ops | 1 d |
| 6 | **Account-deletion flow** (Play hard requirement) — not built | eng | 1 d |
| 7 | Signing (keystore / Apple certs + profiles) | ops | 0.5 d |
| 8 | Driver build flavor (background location isolated) | eng | 1 d |
| 9 | Analytics/Crashlytics wiring | eng | 1 d |

## Estimated work remaining before submission
- **Android (internal testing track):** ~**4–5 working days** (shells + push + branding + OTP + signing + privacy + account-deletion).
- **iOS (TestFlight):** ~**+2–3 days** on top (macOS toolchain, capabilities, Apple privacy + review).
- **Net to first store submission:** ~**1.5–2 weeks** of focused work, **none of it blocked by the current
  codebase** — it is native packaging, branding, push, compliance, and one new account-deletion flow.

## Verdict
The goal — *"publishing should require branding and certificates only"* — is **partially achieved**: the
**web/PWA + Capacitor config foundation is real and build-safe**, and every native/store step is documented
with exact commands/specs. Beyond branding + certs, the genuine remaining engineering is **push delivery,
account deletion, and analytics** (all designed here). **Foundation: solid; submission: ~1.5–2 weeks out.**
