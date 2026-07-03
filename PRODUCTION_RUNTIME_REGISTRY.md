# Production Runtime Registry (Phase 1)

Factual inventory, from source, of how the app switches between the **sandbox** (localStorage) backend and the
**live** (Supabase) backend — the map that governs the Production Activation sprint. No code was changed to
produce this.

## 0. The master switch
| Element | Value / behavior |
|---|---|
| Build-time gate | `vite.config.ts:12` — `const authMode = process.env.HAAT_LIVE_BACKEND === '1' ? 'supabase' : 'sandbox'`, injected as `import.meta.env.VITE_AUTH_MODE`. **Single source of truth.** |
| `.env` / `.env.production` | `VITE_AUTH_MODE=sandbox`, **plus real** `VITE_SUPABASE_URL` (`https://umwbzradvbsirsybfxfb.supabase.co`) + `VITE_SUPABASE_ANON_KEY`. A live project exists; the app just isn't pointed at it by default. |
| Client | `src/lib/supabase.ts` — in sandbox returns a **recursive Proxy stub** (every call → `{data:[],error:null}`, every channel a no-op: zero HTTP/websockets). In live builds `createClient(url, anon)` (or `null` if creds missing). |
| Files that branch on the mode | **30** `src/**` files read `import.meta.env.VITE_AUTH_MODE`. |
| E2E harness | `docs/testing/e2e_runner.cjs` drives the **sandbox** build (24/24). No live-mode E2E exists. |

**Implication:** "sandbox vs live" is decided at build. Shipping live = build with `HAAT_LIVE_BACKEND=1` against
the configured project (with seeded `auth.users`, roles, and RLS). The sandbox path is the current shipped demo
and the only path the test suite exercises.

## 1. Authentication
| Concern | Sandbox impl | Live impl | Status |
|---|---|---|---|
| Login (OTP) | `DEMO_ACCOUNTS` + fixed OTP `123456` | `supabase.auth.signInWithOtp` / `verifyOtp` (`auth.service.ts:96,118`) | **Live exists** |
| Session store | `localStorage haat_sandbox_session` | Supabase session (getSession) | **Live exists** |
| Session recovery | read local session | `supabase.auth.getSession()` (`:165`) | **Live exists** |
| Refresh tokens | n/a | handled by supabase-js autoRefresh | **Live exists** (verify config) |
| Logout | clear `haat_*` (`account.service`) | `supabase.auth.signOut()` | **Live exists** |
| Role resolution | account role from `DEMO_ACCOUNTS` | `resolveHighestRole()` over `user_roles`→`roles` (`:45`) | **Live exists** |
| Country resolution | `country-detection.service` + `haat_country` | same (offline-first; not auth-bound) | **Live exists** |
| Auth-state subscription | no-op | `supabase.auth.onAuthStateChange` (`:175`) | **Live exists** |

**Finding:** Phase 2 is largely already implemented for live mode. The work is *verification/hardening*, not
building from scratch. The sandbox identity is a parallel path behind the flag.

## 2. RBAC  🔴 the real gap
| Concern | Sandbox impl | Live impl | Status |
|---|---|---|---|
| Roles / permissions store | `localStorage haat_sb_rbac_roles` (`rbac.service.ts:90`) | **NONE** — `rbac.service` has **0** `supabase` references | **Missing for live** |
| Acting role | `localStorage haat_sb_rbac_acting`, defaults to `super_admin` | none | **Missing / insecure** |
| Guard (`<Can>`/`useRbac`) | reads localStorage roles | same (no server enforcement) | **Client-only** |
| Tables available | — | `roles`, `permissions`, `role_permissions`, `user_roles` exist in migrations, **unused by the app** | **Wire-up needed** |

**Finding:** Production RBAC is genuinely unbuilt — the service never reads the DB. This is the primary Phase 3
implementation task: add a Supabase-backed branch (gated by mode), leaving sandbox on localStorage.

## 3. Data layer (representative services)
| Service | Sandbox path | Live path | Notes |
|---|---|---|---|
| `admin-crud` | `localStorage haat_crud_<t>` | `supabase.from(<t>)` | Dual-mode facade (clean) |
| `order.service` | via `sandboxStore.createOrder` (UI-level) | real inserts + RPC | create/update **no sandbox branch** → stub no-ops in demo; demo uses `sandboxStore` |
| `sandboxStore` | the demo engine (`haat_sb_*`) | n/a | **sandbox-only by design** |
| `finance/ops/growth/loyalty/analytics/cx/onboarding` | mixed: some have sandbox branches, many are Supabase-only (no-op in demo) | real RPCs/tables | live correctness depends on unseen RPCs |
| `wallet.service` | none (demo wallet in `sandboxStore`) | `wallets`/`wallet_transactions` + RPC `complete_delivery` | dual-mode split |
| `storage.service` | none (always Supabase) | Supabase Storage | image upload no-ops in sandbox |

## 4. Payments (post-consolidation)
| Flow | Sandbox | Live | Status |
|---|---|---|---|
| Checkout entry | `sandboxStore.createOrder` + instant success modal (no gateway) | `paymentOrchestrator.initiate()` → `payment-initiate` edge fn (Moyasar) | canonical single path (consolidation sprint) |
| COD | order placed, collect on delivery | same | behavior identical |
| Online payment | not exercised (no gateway in demo) | Moyasar hosted page + `payment-webhook` (HMAC+idempotency) | live only; **unproven at runtime here** |
| Refund | n/a | `payment-refund` edge fn | live only |
| Wallet credit | `sandboxStore` wallet | `wallet.service` / `complete_delivery` RPC | dual-mode |

## 5. Driver dashboard  🔴 fabricated analytics
`DriverApp.tsx` derives rating, acceptance/completion rate, avg-delivery, rank, week/month earnings,
cash-collected, bonus, and the nearby-order metrics from `hashNum(driverId…)` (lines 343–350, 554) — **in both
modes**. Only `totalEarned`/`completedCount` come from real data (`sandboxStore` / `driver_earnings`). Phase 6
("no fake analytics") targets this; note that replacing it affects the **sandbox demo's** displayed numbers.

## 6. Feature toggles / fallback paths
- **`VITE_AUTH_MODE`** — the one real toggle (build-time). 30 files branch on it.
- **`HAAT_LIVE_BACKEND`** — the build env that flips the toggle.
- **`MISSING_SUPABASE_VARS`** / `supabase === null` — services guard with `|| !supabase`; if live creds are
  absent, calls degrade to empty rather than crash.
- **`release.service`** — permissive `DEFAULT_GATE` on sandbox/error (never blocks).
- **`monitoring.service`** — active only if `VITE_SENTRY_DSN` set (else console).
- **Google Maps** — real map if `VITE_GOOGLE_MAPS_API_KEY`, else SVG/canvas fallback.
- **Supabase Proxy stub** — the platform-wide fallback that keeps any ungated live call inert in sandbox.

## 7. Gaps that block a real production launch (from code)
1. **RBAC not wired to the DB** (§2) — production has no server-backed permission source.
2. **Live path unproven at runtime** — E2E is sandbox-only; live auth needs real phone OTP; live RBAC needs
   seeded `auth.users`+roles; many services depend on unseen Postgres RPCs.
3. **Sandbox is the shipped/tested product** — removing it breaks the demo and the 24/24 E2E (Phase 7's own gate).
4. **Driver analytics fabricated** (§5) — replacing them changes the demo's displayed numbers.
5. **Live seeding is manual** — `seed_demo_accounts.sql` needs `auth.users` created by hand.

---

*Phase 1 complete. This registry is the input to Phases 2–6; the scope decision below (destructive changes to
frozen auth/RBAC/payments + the sandbox's fate + runtime-validation limits) is raised before any of those.*
