# PHONE_AUTH_VERIFICATION.md — Independent (live, read-only)

Fresh read of `GET /v1/projects/{ref}/config/auth` + a live OTP probe.

## Evidence
| Setting | Value |
|---|---|
| `external_phone_enabled` | **`true`** |
| `sms_test_otp` | set — 6 numbers `…=123456` (OTP enabled) |
| `sms_provider` | `twilio` |
| `rate_limit_otp` | 30 |
| `site_url` | `http://localhost:3000` |
| `uri_allow_list` | `""` (empty) |
| `external_email_enabled` | `true` |
| Live `POST /auth/v1/otp` (existing user) | **HTTP 200** |

## Verification
| Check | Result |
|---|---|
| Phone provider enabled | ✅ PASS |
| OTP enabled (Test OTP configured + live send 200) | ✅ PASS |
| Auth configuration valid | ✅ PASS (phone+email enabled, sane rate limits, refresh rotation on) |
| Redirect configuration valid | ⚠️ PASS-with-note — valid for current state, but `site_url` is `http://localhost:3000` and `uri_allow_list` is empty |

**PHONE AUTH = ✅ PASS** (with redirect note).

**Notes (non-blocking for phone OTP):**
- Phone OTP login does not use a redirect, so the localhost `site_url`/empty allow-list does not block login.
- Before production deploy, set `site_url` to the production domain and add it to `uri_allow_list` (needed for any email/OAuth redirect flows).
- `sms_test_otp` is a non-production convenience; configure real Twilio credentials and remove test numbers before public launch.
