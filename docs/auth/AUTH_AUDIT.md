# AUTH_AUDIT.md — HAAT NOW Authentication Regression

**Symptom:** `"Unsupported phone provider"` on login.
**Audit type:** read-only. No code changed.

---

## 1. Root cause (proven)

Two facts combine into a total login lockout:

1. **The app was migrated from sandbox auth → real Supabase phone OTP.**
   - Last committed ("working") `auth.service.ts` (commit `fd48a0d`) contained `isSandbox()` + a fabricated UUID (`11111111-2222-3333-4444-…`) + role-by-phone-suffix. In sandbox, `verifyOtp` was **mocked** — *any* 6-digit code succeeded **without ever calling Supabase**. That is why login "worked".
   - Current (uncommitted) `auth.service.ts` calls **real** `supabase.auth.signInWithOtp({ phone })` and `verifyOtp({ phone, token, type:'sms' })`. All sandbox/mock code was removed.

2. **The Supabase project has the phone provider DISABLED.**
   - Live probe `POST /auth/v1/otp {phone}` → `400 { "error_code":"phone_provider_disabled", "msg":"Unsupported phone provider" }`.
   - Live `GET /auth/v1/settings` → `"phone": false`, `"email": true`.

**Therefore:** the only login path the app now uses (real phone OTP) hits a disabled provider → `"Unsupported phone provider"`. The regression is **the sandbox shortcut was removed before the real SMS provider was enabled.** This is primarily a **Supabase configuration gap**, not a code bug — the migrated code is correct.

---

## 2. Exact broken flow

```
LoginScreen.handleSendOtp(phone)
  → authService.sendOtp(phone)
    → toE164(phone)                         ✅ phone normalized
    → supabase.auth.signInWithOtp({phone})  ❌ 400 phone_provider_disabled  ← BREAKS HERE
  → LoginScreen shows: "خطأ في إرسال الرمز: Unsupported phone provider"
```

`verifyOtp` is never reached because `sendOtp` fails first. No session is created → `onAuthStateChange` never fires → user stuck on the login wall.

---

## 3. Current authentication mode

| Setting | Value | Notes |
|---|---|---|
| `.env VITE_AUTH_MODE` | `production` | **inert** — code no longer reads it for auth (`isSandbox()` removed) |
| `.env AUTH_MODE` | `production` | inert |
| `PAYMENT_MODE` | `sandbox` | unrelated (payment gateway dry-run) |
| Auth implementation | **real Supabase phone OTP only** | no sandbox/mock remains in auth |

---

## 4. Every login path (audit)

| Path | Present in code? | Status |
|---|---|---|
| `signInWithOtp` (phone) | ✅ `auth.service.ts:32` | **disabled server-side** (provider off) |
| `verifyOtp` (sms) | ✅ `auth.service.ts:39` | unreachable (send fails first) |
| `signInWithPassword` | ❌ not implemented | email provider IS enabled, but no UI/code path |
| Magic link / OTP email | ❌ | — |
| OAuth (Apple/Google) | ❌ buttons exist in UI but non-functional | — |
| Mock / demo / sandbox login | ❌ removed | was the previous working path |

**Phone OTP is the sole functional path, and it is blocked.** There is no fallback.

---

## 5. Session / state verification

| Mechanism | Where | Behavior |
|---|---|---|
| `getSession` | `CheckoutPage.tsx` (×2) | reads persisted session (none exists now) |
| `getUser` (via `getCurrentUser`) | `auth.service.ts:46`, called in `App.tsx` mount | returns `null` (no session) → login wall |
| `onAuthStateChange` | `App.tsx` session effect | subscribed correctly; never fires (no login) |
| `refreshSession` | handled automatically by `supabase-js` (`persistSession` default true) | N/A until a session exists |
| Recovery after refresh | `App.tsx` `getCurrentUser()` on mount | **correct** — would restore a real session, but none can be created |

→ Session plumbing is **correct**; it simply has no session to manage because login is blocked.

---

## 6. Role resolution & routing

| Role | Resolution | Routing | Status |
|---|---|---|---|
| customer / merchant / driver / admin | `resolveHighestRole()` → `user_roles → roles` (priority admin>merchant>driver>customer) | `App.tsx:273/570/571/572` `session.role === …` | **correct, but unreachable** (no session) |
| super admin / country admin | DB only — `admin_users.scope` / `country_code` (migration 0018, applied) | **NOT used in app routing** — all admins route to one `AdminDashboard` | scoping enforced at DB/RLS, not in UI routing |

---

## 7. Supabase provider configuration (assumptions vs reality)

| Assumption | Reality (live probe) |
|---|---|
| Phone OTP enabled | ❌ `"phone": false` |
| Email/password enabled | ✅ `"email": true` (but no UI path) |
| Test OTP numbers configured | ❌ none (otherwise provider would be enabled) |
| Real SMS provider (Twilio/etc.) | ❌ not configured |

---

## 8. What the application currently REQUIRES to log in

The app **requires one of**:
- ✅ **Supabase Test OTP numbers** (dashboard, no SMS cost) — fastest for demo/testing, **or**
- ✅ **A real SMS provider** (Twilio/MessageBird/Vonage) wired into Supabase Phone settings — for production.

It does **not** currently use: sandbox auth (removed), and it **does** ultimately need **seeded demo accounts** (`seed_demo_accounts.sql`) so resolved roles map correctly. Email/password is enabled server-side but the app has no UI/code for it.

---

## 9. Affected files

| File | Role in the regression |
|---|---|
| `src/services/auth.service.ts` | **Primary** — migrated to real OTP (`signInWithOtp`/`verifyOtp`) + `resolveHighestRole`. The change that surfaced the symptom. |
| `src/App.tsx` | Session lifecycle (`getCurrentUser` + `onAuthStateChange`) + role routing (`session.role`). |
| `src/features/auth/LoginScreen.tsx` | Only phone-OTP UI; **misleading leftover hint** "✨ وضع التجربة: أدخل أي رمز من 6 أرقام" still shows when `MODE==='development'` — now false. |
| `src/utils/phone.ts` | `toE164` normalization (correct; not a cause). |
| `.env` | `VITE_AUTH_MODE=production` (inert for auth). |
| `src/features/auth/types.ts` | `User` type. |
| Deleted (no longer exist) | `features/auth/AuthContext.tsx`, `features/auth/auth.service.ts`, `components/common/ProtectedRoute.tsx` (dead code removed earlier). |
| DB (not app files) | `admin_users.scope/country_code`, `auth_*` functions (0018) — role scoping, applied. |

---

## 10. Required fixes (NOT yet implemented — awaiting approval)

### Recommended — Option A: enable Supabase Test OTP (zero code change)
Supabase → **Auth → Providers → Phone → enable**, add the 6 demo numbers from `DEMO_ACCOUNTS.md` as **Test OTP** entries (fixed codes, no real SMS). Then seed roles via `seed_demo_accounts.sql`. Unblocks login immediately for dev/demo. *Owner: whoever has dashboard access (not the codebase).*

### Production — Option B: real SMS provider
Configure Twilio/MessageBird/Vonage in Supabase Phone settings. **No code change** (the migrated code is already correct).

### Optional — Option C: add email/password path (code change, needs approval)
Email provider is already enabled. Add `signInWithPassword` to `auth.service.ts` + a minimal email/password field in `LoginScreen` (admins/testing without SMS). Requires UI work — out of scope until approved.

### Cleanup (code change, needs approval)
Remove the misleading sandbox hint in `LoginScreen.tsx:363-369` (it tells users "enter any 6-digit code", which is false under real OTP).

### NOT recommended
Re-introducing sandbox/mock sessions — it was deliberately removed; it would re-create fake-session security gaps and the `auth.uid()=null` failures across wallet/cart/orders.

---

## Risk assessment

| Risk | Severity | Notes |
|---|---|---|
| **Total login lockout in production** | 🔴 Critical | No working auth path; every role blocked |
| Misleading "enter any code" hint | 🟠 High (UX/trust) | Tells users any OTP works; false |
| No fallback auth path | 🟠 High | Single point of failure (phone provider) |
| Email enabled but unused | 🟡 Medium | Latent alternative path, no UI |
| Admin super/country scoping not in routing | 🟡 Medium | DB-enforced only; all admins see one dashboard |
| Session/role code | 🟢 Low | Verified correct; not the cause |

**Bottom line:** the code migration is correct; the break is a **disabled Supabase phone provider** with no fallback. The fastest safe resolution is **Option A** (enable Test OTP) — no code change required. I have **not** modified any code and await your approval before implementing any of the options above.
