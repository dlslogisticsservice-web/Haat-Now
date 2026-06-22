# AUTH_USERS_VERIFICATION.md — Independent (live, read-only)

Fresh query of `auth.users` on `umwbzradvbsirsybfxfb`. Not based on prior reports.

## Evidence
```sql
select count(*) total, count(*) filter (where phone is not null) with_phone,
       count(*) filter (where phone_confirmed_at is not null) phone_confirmed from auth.users;
-- → total=6, with_phone=6, phone_confirmed=6
```
| Phone | created | phone_confirmed (OTP-ready) |
|---|---|---|
| 201000000001 | ✅ | ✅ |
| 201000000002 | ✅ | ✅ |
| 201000000003 | ✅ | ✅ |
| 201000000004 | ✅ | ✅ |
| 201000000005 | ✅ | ✅ |
| 966500000004 | ✅ | ✅ |

Live readiness: `POST /auth/v1/otp` for an existing user (+201000000005) → **HTTP 200**.

## Verification
| Check | Result |
|---|---|
| Total users = 6 | ✅ PASS |
| Phone numbers present (6/6) | ✅ PASS |
| Accounts created (6/6) | ✅ PASS |
| OTP readiness (phone_confirmed_at set, OTP send 200) | ✅ PASS |

**AUTH USERS = ✅ PASS.**
