# SUPABASE_PRODUCTION_CONFIG.md — HAAT NOW

Supabase auth/config changes required after the frontend is deployed. **No schema/DDL/data changes** — auth configuration only. Project `umwbzradvbsirsybfxfb`.

## Current state (verified live)
| Setting | Now |
|---|---|
| `site_url` | `http://localhost:3000` |
| `uri_allow_list` (Redirect URLs) | empty |
| `external_phone_enabled` | `true` |
| `sms_provider` | `twilio` (configured) but using **Test OTP** |
| `sms_test_otp` | 6 demo numbers → `123456` |
| `external_email_enabled` | `true` (`mailer_autoconfirm=false`) |

## 1. Site URL changes
Set to the production frontend domain (Vercel URL or custom domain).
- **Dashboard:** Authentication → URL Configuration → **Site URL** = `https://<your-domain>` (e.g. `https://haat-now.vercel.app` or `https://app.haatnow.com`).
- **Or Management API** (PATCH `config/auth`): `{ "site_url": "https://<your-domain>" }`.

## 2. Redirect URL changes
- **Dashboard:** Authentication → URL Configuration → **Redirect URLs** → add:
  - `https://<your-domain>/**`
  - (if using Vercel previews) `https://*.vercel.app/**`
- **Or Management API:** `{ "uri_allow_list": "https://<your-domain>,https://*.vercel.app" }`.
- Phone OTP login does **not** use redirects; this is required for email confirmation / password recovery / OAuth flows.

## 3. Auth configuration
- Keep `external_phone_enabled=true`.
- Refresh-token rotation is on (`refresh_token_rotation_enabled=true`) ✅.
- `jwt_exp=3600` (1 h) — acceptable; tune if needed.
- Review rate limits for launch volume: `rate_limit_otp` / `rate_limit_sms_sent` (currently 30/h).
- (Optional) Email templates / sender domain if enabling email auth.

## 4. OTP configuration
**Before public launch — switch from Test OTP to real SMS:**
- **Dashboard:** Authentication → Providers → Phone → configure **Twilio** (Account SID, Auth Token, Messaging Service SID / sender number).
- **Remove Test OTP numbers:** clear `sms_test_otp` (and `sms_test_otp_valid_until`) so real codes are sent.
  - Management API: `{ "sms_test_otp": "", "sms_test_otp_valid_until": null }` (after Twilio is live).
- **Closed beta exception:** you may keep Test OTP for an invite-only beta (no SMS cost), but never for a public launch.

## 5. Security follow-ups
- **Rotate the Supabase access token** used during the cutover (it was shared in plaintext; it remains gitignored in `.mcp.json`). Account → Access Tokens → revoke + reissue.
- Confirm the **service-role key** is not exposed anywhere in the frontend/Vercel.

## Verification
- `GET config/auth` shows the new `site_url`/`uri_allow_list`.
- With Twilio live + Test OTP removed: a real phone receives a real code; demo `123456` no longer works.
- Until then (Test OTP): provisioned demo accounts log in with `123456` for E2E.
