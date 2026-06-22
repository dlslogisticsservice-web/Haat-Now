# PRODUCTION_BLOCKERS_STATUS.md

Fix sprint result. Code-actionable blockers FIXED + runtime-verified; infra-gated blockers (Supabase dashboard / SQL Editor / service-role — not available to this environment) have the exact fix prepared.

## Phase 1 — Eliminate sandbox auth from production builds ✅ DONE

| Blocker | PASS/FAIL | Evidence | Fix Applied | Remaining Risk |
|---|---|---|---|---|
| **1. `VITE_AUTH_MODE=sandbox` in prod** | ✅ PASS | `npm run build` now loads `.env.production` (`VITE_AUTH_MODE=supabase`); dev (`npm run dev`) still uses `.env` (sandbox) | Added **`.env.production`** (supabase). Sandbox gate changed to **`IS_SANDBOX = VITE_AUTH_MODE==='sandbox' && import.meta.env.DEV`** in `auth.service.ts` — `DEV` is `false` in any prod build, so sandbox is force-off in production regardless of env | None for prod; dev intentionally keeps sandbox |
| **2. Demo accounts log in with OTP `123456`** | ✅ PASS | **Production preview (`vite preview`): 0/6 demo logins** — every account `BLOCKED`, falls through to real Supabase OTP ("Unsupported phone provider"), never reaches the OTP step | Same gate — demo path is dead in prod; `verifyOtp` goes straight to `supabase.auth.verifyOtp` | None — demo auth impossible in prod build |
| **3. Sandbox code reachable in prod bundle** | ✅ PASS | Prod bundle grep: `DEMO_ACCOUNTS`=0, demo phones (`201000000001/005`)=0, demo names=0, `haat_sandbox_session`=0, sandbox hint=0. (`haat_sb_orders`=1 — `sandboxStore` lingers but is **unreachable**: all `VITE_AUTH_MODE==='sandbox'` checks fold to `false` in prod ⇒ branches dead) | `DEV`-gated auth + `.env.production=supabase` make every sandbox branch statically dead → tree-shaken (demo accounts/OTP/session/hint removed) | Low — residual `sandboxStore` symbols present but unreachable; can be fully stripped later (not security-relevant) |

**Phase 1 control proof:** dev build (`import.meta.env.DEV=true`) → Super-Admin sandbox login still `LOGIN-OK` (demo workflow intact); prod build (`DEV=false`) → `LOGIN-OK` becomes `BLOCKED`.

**Bulletproof proof (committed code alone):** rebuilt for production **with `.env.production` removed and `.env=sandbox`** → demo logins still **0/2 (BLOCKED)** and bundle `DEMO_ACCOUNTS`=0. So the protection lives in **committed code** (`auth.service.ts` `DEV` gate), not the env file. `.env.production` is a gitignored local convenience; production deploys set `VITE_AUTH_MODE=supabase` via their own platform env vars — but **even if they don't, a production build cannot authenticate demo accounts.**

## Phase 2 — Enable & verify real Supabase auth ⚠️ PARTIAL (provider is dashboard-gated)
| Item | PASS/FAIL | Evidence | Fix Applied | Remaining Risk |
|---|---|---|---|---|
| Auth wiring routes to real Supabase | ✅ PASS | prod build demo logins now hit `supabase.auth.signInWithOtp` → `Unsupported phone provider` (proves real path active, sandbox gone) | Phase 1 | — |
| Phone provider enabled | ❌ FAIL | `/auth/v1/otp` → `phone_provider_disabled` | **Cannot apply** — Supabase dashboard (Auth → Providers → Phone). No dashboard access here | 🔴 No real login until enabled |
| Signup / login / logout / session / protected routes | ⛔ UNVERIFIABLE | code centralized + correct (`auth.service` + `App.tsx`); cannot exercise without a provider that yields a session | Depends on provider | Verify after enablement |

## Phase 3 — Fix `order_country_code` ❌ BLOCKED (SQL access required)
| Item | PASS/FAIL | Evidence | Fix Applied | Remaining Risk |
|---|---|---|---|---|
| SECURITY DEFINER + no recursion | ❌ FAIL | live RPC → `42501` ⇒ runs as caller = **SECURITY INVOKER**; self-selects `orders` in the admin `orders` policy → recursion | **Cannot apply** — needs SQL Editor / service-role (absent). Exact SQL ready: `create or replace function public.order_country_code(p_order_id uuid) … language sql stable SECURITY DEFINER set search_path=public …; revoke all … from public; grant execute … to authenticated;` | 🟠 Admin order reads recurse; country scoping unenforced until applied |

## Phase 4 — Verify Migration 0019 ⛔ UNVERIFIABLE (privileged read required)
| Item | PASS/FAIL | Evidence | Fix Applied | Remaining Risk |
|---|---|---|---|---|
| `authenticated` grants present | ⛔ UNVERIFIED | anon cannot read `pg_policies`/`role_table_grants`/`information_schema` via REST (404); no JWT obtainable | **Cannot verify** — run in SQL Editor: `select table_name, string_agg(privilege_type,',') from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and table_name in ('orders','order_items','wallets','notifications','favorites','addresses','customer_carts','cart_items') group by table_name;` | 🔴 If unapplied, logged-in users `42501` |

## Summary
| Blocker | Status |
|---|---|
| 1 `VITE_AUTH_MODE=sandbox` | ✅ FIXED |
| 2 Demo accounts auth with `123456` | ✅ FIXED (0/6 in prod) |
| 3 Sandbox reachable in prod | ✅ FIXED (demo data tree-shaken; sandboxStore unreachable) |
| 4 Phone provider disabled | ❌ dashboard-gated |
| 5 `order_country_code` 42501 | ❌ SQL-gated (fix ready) |
| 6 Migration 0019 unverified | ⛔ SQL-gated (query ready) |

**Net:** the **Critical, actively-exploitable auth bypass (blockers 1–3) is ELIMINATED and runtime-proven** — the single biggest NO-GO item. **GO is still not reached** because blockers 4–6 require Supabase dashboard/SQL access unavailable in this environment; each has an exact, ready-to-run fix. Once those three are applied (enable Phone provider → apply `0019` → apply `order_country_code` DEFINER fix), re-running the demo-login + grant + RPC checks converts the remainder to GO.

## Files changed
- `.env.production` (new) — `VITE_AUTH_MODE=supabase` for prod builds.
- `src/services/auth.service.ts` — `IS_SANDBOX` gated on `import.meta.env.DEV` (force-off + tree-shake in prod).
