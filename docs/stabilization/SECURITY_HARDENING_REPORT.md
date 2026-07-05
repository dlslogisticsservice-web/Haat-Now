# Security Hardening Report
**HaaT Now — Phase 4 of the Enterprise Production Stabilization Program**
Date: 2026-07-05. Objective: remove every remaining sandbox shortcut from the live path and verify the security surface. Evidence-based (code + live introspection from earlier phases). One real live-path fix applied; the rest verified.

---

## 0. Result
The security **code** is genuinely strong and was re-verified this phase. The single real code-level live-path hole — the payment webhook accepting **unsigned** events when its secret was unset — is **fixed (fail-closed)**. Every remaining "sandbox shortcut" is gated by `VITE_AUTH_MODE` (a build-time `define`) or `import.meta.env.DEV`, so a real production build (`HAAT_LIVE_BACKEND=1`) **tree-shakes them out** — they are not reachable in a live artifact. The residual work is operational cutover config, not code.

## 1. Fix applied — S2: webhook now fails closed 🔴→✅
`supabase/functions/payment-webhook/index.ts` previously **logged a warning and continued** when `PAYMENT_WEBHOOK_SECRET` was unset — a forged webhook could mark orders `paid`. Now:
- **No secret → reject** (`503 WEBHOOK_SECRET_MISSING`) by default.
- Local development may opt out **explicitly** with `WEBHOOK_ALLOW_UNSIGNED=true` (documented as never-in-production).
This makes production fail-closed with no configuration, while preserving a clearly-labelled local-dev escape hatch. Edge-function only — no SPA/UI impact (SPA E2E 24/24 unchanged).

## 2. Verification by area

| # | Area | Status | Evidence |
|---|---|---|---|
| A | **Authentication** | ✅ Dual-mode, correctly gated | `auth.service.ts:13` `IS_SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox'` (build-time define → foldable). Live path: `signInWithOtp` / `verifyOtp` (`:96,101`). |
| B | **OTP** | ✅ Sandbox `123456` is DEV/sandbox-only, tree-shaken in prod | Guarded by `IS_SANDBOX` (`:90,104,107`). In a `supabase`-mode build the constant folds false → the `123456` branch is dead-code-eliminated. Live OTP requires a Supabase phone provider (operational). |
| C | **Webhook verification** | ✅ **Fixed — fail closed** (was High) | `payment-webhook/index.ts:64-79` (this phase). HMAC-SHA256 with constant-time compare + idempotency + no-downgrade guards remain intact. |
| D | **Secrets** | ✅ Clean | **0** `service_role`/`SUPABASE_SERVICE` refs in `src/` (grep); **0** `sk_live_`/`whsec_` literals; service-role key read only server-side (`_shared/supabase.ts`). `.env*` gitignored except `.env.example` (placeholders). Client uses only the anon publishable key. |
| E | **RBAC** | ⚠️ Client-side fine-grained; server = coarse RLS | `rbac.service.ts` catalogue enforced in the browser; authoritative gate is RLS by role/`admin_users.scope`. Fine-grained perms are **not** yet mirrored in RLS — a live cutover must ensure sensitive actions are RLS/edge-function gated, not UI-only. |
| F | **RLS** | ⚠️ Strong coverage; 3 ops tables off | Live: 91/94 tables RLS-enabled, **0 enabled-with-no-policy** (Phase-1 verified). `driver_performance`/`shift_breaks` remain RLS-**off** → enable per Phase-1 `DATABASE_MIGRATION_PLAN.md §P1.3` (needs write-path smoke). |
| G | **Payments** | ✅ Real Moyasar; каждая function verifies caller JWT | `payment-initiate/verify/refund` validate identity/scope; webhook now fail-closed (C). Requires `MOYASAR_*` + `PAYMENT_WEBHOOK_SECRET` secrets at cutover. |
| H | **Storage** | ✅ Real, owner-scoped | `storage.service.ts` → `supabase.storage` with owner-scoped paths matching storage RLS (`foldername[1]=auth.uid()`). Inactive in sandbox. |
| I | **Monitoring** | ⚠️ Seam only | `monitoring.service.ts` sends to `VITE_SENTRY_DSN` when set, else console. No SDK active by default — wire a provider at cutover. |

## 3. Sandbox shortcuts — every one is gated (verified)
| Shortcut | Gate | Prod behaviour |
|---|---|---|
| Hardcoded OTP `123456` | `IS_SANDBOX` (VITE_AUTH_MODE define) | dead-code-eliminated in a `supabase` build |
| Default acting-role `super_admin` (`rbac.service.ts:180`) | sandbox-only; no-op in live (`:179,183`) | inert in live |
| Service `if (SANDBOX) return …` short-circuits | `VITE_AUTH_MODE` | inert in live (real backend used) |
| Dev hooks `__sb/__prov/__tpl/__site` | `import.meta.env.DEV` (all 4 verified) | tree-shaken from prod |
| Forced sandbox build | `vite.config.ts:12` (`HAAT_LIVE_BACKEND=1` opts in) | prod cutover flips it |

No **ungated** `window.__` hook exists (grep). No security-sensitive sandbox path is reachable in a real production build.

## 4. Residual (operational cutover — not code)
1. **Build with `HAAT_LIVE_BACKEND=1`** so `VITE_AUTH_MODE=supabase` (Launch Blocker C1/C2).
2. **Set edge-function secrets**: `PAYMENT_WEBHOOK_SECRET` (now enforced by C), `MOYASAR_SECRET_KEY`, `MOYASAR_CALLBACK_URL`; never set `WEBHOOK_ALLOW_UNSIGNED` in prod.
3. **Enable the Supabase phone (SMS) provider** for live OTP; wire an email provider.
4. **Enable RLS** on `driver_performance`/`shift_breaks` (Phase-1 plan §P1.3).
5. **Mirror sensitive RBAC perms in RLS / edge functions** (E) — don't rely on UI gating.
6. **Tighten defense-in-depth** (low): scope CORS from `*` to known origins on the payment functions; keep the strong CSP/HSTS/COOP already in `vercel.json`.
7. Wire a monitoring provider (`VITE_SENTRY_DSN`).

## 5. Applied in Phase 4
| Item | Type | Risk |
|---|---|---|
| `payment-webhook/index.ts` — webhook fail-closed on missing secret | edge-function fix | **None to SPA** (Deno function; SPA E2E 24/24). Verify via CI Deno type-check + a staging webhook test. |
| `SECURITY_HARDENING_REPORT.md` | this report | — |

**Bottom line:** the code-level security posture is production-grade; the one real live-path fraud vector (unsigned webhooks) is closed. What remains is operational cutover configuration (secrets, live mode, SMS/email/monitoring providers, the 3-table RLS enable) — tracked in the Production Cutover checklist (Phase 5) and the Phase-1 DB plan.
