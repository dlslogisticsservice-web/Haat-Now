# PHONE_AUTH_REPORT.md — Phase B

Phone authentication enabled automatically via the Management API (`PATCH /v1/projects/{ref}/config/auth`). No dashboard action was required.

## Audit (before)
| Setting | Before |
|---|---|
| `external_phone_enabled` | `false` |
| `sms_provider` | `twilio` (no test OTP) |
| `sms_test_otp` | `null` |
| `external_email_enabled` | `true` (`mailer_autoconfirm=false`) |
| anonymous | disabled |

## Action (auto-completed)
`PATCH config/auth` (2 corrections from API validation errors → succeeded on 3rd attempt, **HTTP 200**):
```json
{ "external_phone_enabled": true,
  "sms_test_otp": "201000000001=123456,201000000002=123456,201000000003=123456,201000000004=123456,966500000004=123456,201000000005=123456",
  "sms_test_otp_valid_until": "2030-12-31T23:59:59Z" }
```
(Test OTP requires E.164 **without** `+`, and a paired `valid_until` — both applied.)

## Verification — ✅ PASS
| Check | Result |
|---|---|
| `external_phone_enabled` | ✅ `true` |
| Test OTP configured (6 demo numbers → `123456`) | ✅ |
| Live `POST /auth/v1/otp` (existing user) | ✅ **HTTP 200** |
| Live `POST /auth/v1/verify` (code `123456`) | ✅ returns a real **JWT** (`access_token`) |
| Decoded JWT | ✅ `sub = 080b74ea-…` (customer auth uid), `role = authenticated`, `phone = 201000000001` |

**Phase B = PASS.** Real phone OTP authentication is live (Test OTP mode — no SMS cost). For real SMS at scale, add Twilio credentials later (optional; does not block login with Test OTP).

**Note:** Test OTP is a non-production convenience. Before public launch, configure a real SMS provider (Twilio) and remove the test numbers.
