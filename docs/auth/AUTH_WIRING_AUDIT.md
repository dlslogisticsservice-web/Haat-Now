# AUTH_WIRING_AUDIT.md

**Result:** ✅ Every auth path is wired through `src/services/auth.service.ts`. No legacy auth, no bypasses. One bypass found (`CheckoutPage` raw `getSession`) — **removed and re-wired**.

## Repository search results
| Pattern | Locations | Verdict |
|---|---|---|
| `supabase.auth.signInWithOtp` | `auth.service.ts:63` only | ✅ centralized |
| `supabase.auth.verifyOtp` | `auth.service.ts:85` only | ✅ centralized |
| `supabase.auth.getUser` | `auth.service.ts:102` only | ✅ centralized |
| `supabase.auth.getSession` | `auth.service.ts:` (`getAccessToken`) only | ✅ centralized (was ×2 in CheckoutPage — **fixed**) |
| `supabase.auth.onAuthStateChange` | `auth.service.ts:` (`subscribeToAuthChanges`) only | ✅ centralized (was in `App.tsx` — **fixed**) |
| `supabase.auth.signOut` | `auth.service.ts:114` only | ✅ centralized |
| `AuthContext` | — | ✅ none (deleted) |
| `ProtectedRoute` | — | ✅ none (deleted) |
| `useAuth` | — | ✅ none |
| `features/auth/auth.service` (duplicate) | — | ✅ none (deleted) |

**Post-fix verification:** `grep "supabase\.auth\." src` outside `auth.service.ts` → **NONE**.

## Every auth entry point
| Entry point | File | Goes through |
|---|---|---|
| Send OTP | `LoginScreen.tsx:32` | `authService.sendOtp` |
| Verify OTP / login | `LoginScreen.tsx:47` | `authService.verifyOtp` |
| Logout | `App.tsx:183` (`handleLogout`) | `authService.signOut` |
| Session restore (mount/refresh) | `App.tsx` session effect | `authService.getCurrentUser` |
| Auth-change subscription | `App.tsx` session effect | `authService.subscribeToAuthChanges` |
| Access token for edge functions | `CheckoutPage.tsx` (payment-verify, payment-initiate) | `authService.getAccessToken` |

## Every session source
| Source | Implementation (per mode) |
|---|---|
| `getCurrentUser()` | sandbox → `localStorage.haat_sandbox_session`; supabase → `supabase.auth.getUser()` |
| `subscribeToAuthChanges()` | sandbox → no-op; supabase → `supabase.auth.onAuthStateChange` |
| `getAccessToken()` | sandbox → `''`; supabase → `supabase.auth.getSession().access_token` |
| Login state in React | `App.tsx` `session` state, set only from `authService` results |

There is **one** session state (`App.tsx session`) and **one** persistence mechanism per mode. No localStorage-only auth in supabase mode; no raw Supabase session reads elsewhere.

## Every route guard
| Guard | File | Logic |
|---|---|---|
| Auth wall | `App.tsx` (`if (!session) → <LoginScreen>`) | blocks all app content until `authService` yields a user |
| Role routing | `App.tsx:273/570/571/572` (`session.role === …`) | customer / merchant / driver / admin portals |
| Session-validating gate | `App.tsx` (`sessionValidating` loader) | waits for `authService.getCurrentUser()` before rendering |

`session.role` is the single guard input, and it is only ever set from `authService` output.

## Every role resolver
| Mode | Resolver |
|---|---|
| sandbox | `DEMO_ACCOUNTS[phone].role` (E.164-keyed map in `auth.service.ts`) |
| supabase | `resolveHighestRole(uid)` → `user_roles → roles` (priority admin>merchant>driver>customer) |

Both live **inside** `auth.service.ts`. No role logic exists elsewhere.

## Legacy auth code still active
**None.** `AuthContext.tsx`, `ProtectedRoute.tsx`, and the duplicate `features/auth/auth.service.ts` were deleted in a prior phase and are confirmed absent (no files, no imports, no references).

## Duplicated auth logic
**None remaining.** The only duplication was `CheckoutPage` and `App.tsx` reading the Supabase session directly. Both now call `authService` (`getAccessToken` / `subscribeToAuthChanges`).

## Changes made by this audit
- `auth.service.ts`: added `getAccessToken()` and `subscribeToAuthChanges()` (centralizing the last two raw `supabase.auth` references).
- `App.tsx`: `onAuthStateChange` → `authService.subscribeToAuthChanges`.
- `CheckoutPage.tsx`: 2× `supabase.auth.getSession()` → `authService.getAccessToken()`; added `authService` import.

## Validation
- `grep supabase.auth. src` outside `auth.service.ts` → **NONE**.
- `tsc --noEmit` → clean. `npm run build` → exit 0.
- Runtime smoke (sandbox): **login PASS · persist-after-refresh PASS · logout PASS**.

## Note (not a wiring defect)
In **sandbox** mode `getAccessToken()` returns `''`, so the payment edge functions (`payment-initiate`/`verify`) receive no real JWT — sandbox cannot authenticate the real payment backend (expected; `PAYMENT_MODE=sandbox` covers dry-run). In **supabase** mode it returns the real token. This is correct dual-mode behavior, now centralized.
