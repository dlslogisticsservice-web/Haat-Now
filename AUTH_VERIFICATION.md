# AUTH_VERIFICATION.md

**Mode:** dual-mode auth, selected by `VITE_AUTH_MODE` (`sandbox` | `supabase`). Currently `sandbox`.
**Verification:** headless Puppeteer drove the real login UI (phone → OTP `123456` → role routing). Evidence below is from the live run.

## Role login matrix (OTP = 123456)
```
PASS  Customer EG   +201000000001   expected=customer  got=customer
PASS  Customer SA   +966500000001   expected=customer  got=customer
PASS  Merchant EG   +201000000002   expected=merchant  got=merchant
PASS  Merchant SA   +966500000002   expected=merchant  got=merchant
PASS  Driver EG     +201000000003   expected=driver    got=driver
PASS  Driver SA     +966500000003   expected=driver    got=driver
PASS  Egypt Admin   +201000000004   expected=admin     got=admin
PASS  Saudi Admin   +966500000004   expected=admin     got=admin
PASS  Super Admin   +201000000005   expected=admin     got=admin
TOTAL: 9 PASS / 0 FAIL
```

## Session lifecycle
```
login            -> customer            PASS
refresh (reload) -> customer (persists) PASS   ← session survives page refresh
logout           -> login screen        PASS
```

## How it works
- **Sandbox mode** (`auth.service.ts`): `verifyOtp` accepts OTP `123456`, looks up the phone in `DEMO_ACCOUNTS` (E.164-keyed), builds a real `User{id,phone,role}`, persists to `localStorage.haat_sandbox_session`. `getCurrentUser` restores it on refresh; `signOut` clears it.
- **Supabase mode**: untouched production path — `supabase.auth.signInWithOtp/verifyOtp`, role from `user_roles` (`resolveHighestRole`).
- Phones normalized to **E.164** via `toE164` (e.g. `+966500000001`).
- **Bug found & fixed during verification:** in sandbox the real `supabase.auth.onAuthStateChange` fired `INITIAL_SESSION=null` on mount and wiped the sandbox session on refresh. Fixed in `App.tsx` — the Supabase listener is now subscribed **only** in `supabase` mode.

## Switching modes
`.env`: `VITE_AUTH_MODE=sandbox` (demo) ↔ `VITE_AUTH_MODE=supabase` (real OTP). No code change required; production implementation is fully preserved.

## Requirements checklist
| Requirement | Result |
|---|---|
| All 9 demo accounts login | ✅ 9/9 |
| OTP always 123456 (sandbox) | ✅ |
| Session persistence | ✅ (refresh keeps session) |
| Logout works | ✅ |
| Role resolution (customer/merchant/driver/admin) | ✅ |
| Route guards (role → portal) | ✅ |
| Refresh does not destroy session | ✅ |
| Mode switch via env var only | ✅ |
| Production auth preserved | ✅ |
