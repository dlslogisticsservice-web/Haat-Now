# Launch Blockers Report
**HAAT NOW — Enterprise Due-Diligence Audit (Part 13)**
Only items that **must** be resolved before a real production launch (onboarding paying tenants/customers against the live backend). Categorized Critical / High / Medium / Low. Every item cites evidence and the source report. Read-only audit — this lists blockers, it does not fix them.

> Framing: "launch" = operating the platform against its **live Supabase backend with real tenants**, not the shipped self-contained demo. As a *demo*, the artifact is already green (build ✓, E2E 24/24). The blockers below are what stand between the demo and a real multi-tenant SaaS.

---

## 🔴 CRITICAL — must be solved before any real tenant/customer

| # | Blocker | Evidence | Source |
|---|---|---|---|
| C1 | **App ships forced into sandbox/demo mode and has never run against the live backend in the shipped artifact.** Build must be flipped (`HAAT_LIVE_BACKEND=1`) and the entire live path (auth OTP, RLS, payments, storage) validated end-to-end. | `vite.config.ts:12-15`; `.env.production:10`; stub client `lib/supabase.ts:19-35` | Production Readiness §0 |
| C2 | **Hardcoded OTP `123456` authenticates into any role incl. super-admin.** Live Supabase OTP must be the only path in production; the sandbox auth must be provably unreachable. | `auth.service.ts:15,30,104-115` | Production Readiness S1 |
| C3 | **No multi-tenant data isolation** — there is no `tenant_id` on any domain table and **no per-tenant RLS**. Onboarding ≥2 real tenants risks cross-tenant data exposure. Isolation is currently app-logic + admin country-scoping only. | `…000008_tenants.sql:6-7`; `…000018:37-39`; `…000026·2:80-81` | Database Review §4-5 |
| C4 | **Website & design content persist only to `localStorage`** — no Supabase persistence. Published sites/themes don't survive across devices/sessions/users; unusable for real tenants who expect durable, shared publishing. | `website.service.ts:11,16-17,64-65`; `DesignContext.tsx:8,22` | Website Review (persistence caveat) |
| C5 | **Duplicate/conflicting DB tables (`vehicles`, `driver_shifts`)** whose surviving physical schema depends on migration apply-order; `…000027·5:26` indexes a non-existent column → probable **apply-time migration failure** on a clean DB. The ops backend cannot be trusted until reconciled. | `…000028:16-24,59-67` vs `…000027·5:10-26`, `…000027·6:24-31` | Database Review §7 · Duplication D6 |

## 🟠 HIGH — must be solved before general availability / scale

| # | Blocker | Evidence | Source |
|---|---|---|---|
| H1 | **Payment webhook HMAC verification is skipped if `PAYMENT_WEBHOOK_SECRET` is unset** — forged `captured` events could mark orders paid. Must hard-fail when the secret is absent. | `payment-webhook/index.ts:64-67,183-197` | Production Readiness S2 |
| H2 | **RLS final state unverified + prior incidents.** A prior release shipped 21 core tables RLS-enabled with zero policies (`rls_recovery`); `audit_logs`/`settings` have policies but RLS is never enabled; finance tables may be default-deny. A live `pg_policies`/`pg_indexes` audit is required. | `…000021:2-8,203-219`; `…000031:338-346` | Database Review §5 |
| H3 | **SMS and Email providers are not wired.** Live OTP needs a Supabase phone provider (Twilio); notifications/marketing need an email provider. Without them, real users can't receive OTPs or transactional messages. | `auth.service.ts:96,118`; `growth.service.ts:8`; `GrowthCenter.tsx:194` | Production Readiness (SMS/Email) |
| H4 | **White-label promise unmet in-product:** customer/merchant/driver/admin apps render a **single platform-global brand**, not the authenticated tenant's brand — there is no login-time `applyTheme(tenant)`. Per-tenant runtime branding exists only on the public website. | `main.tsx:62`; `DesignContext.tsx:57-59`; per-tenant `applyTheme` fires only in website runtime + a manual preview button | White-Label Review |
| H5 | **Silent index gaps on hot paths** — notification/merchant/reviews indexes in `performance_indexes` reference non-existent columns and are silently skipped, so they never land. At real volume these queries degrade. | `…000027·2:28-53` vs `init:17,23,37-38` | Database Review §3 |

## 🟡 MEDIUM — should be solved before or shortly after launch (not hard blockers)

| # | Item | Evidence | Source |
|---|---|---|---|
| M1 | Fine-grained RBAC enforced client-side only; RLS must mirror the permission catalogue for authoritative protection. | `rbac.service.ts:30-66,154-159` | Production Readiness S3 |
| M2 | **914 KB admin chunk** + `PublicSiteApp` eagerly bundled into the entry chunk (tenant-site visitors download the whole app). | `dist/assets/AdminDashboard-*.js`; `main.tsx:12` | Performance P1, P2 |
| M3 | `tsconfig` **`strict` mode is off**, enabling 100 `as any` casts — erodes type-safety before a backend cutover where types matter most. | `tsconfig.json`; `grep "as any"` = 100 | Code Quality Q3, Q4 |
| M4 | Emails / PDF / Invoices are unimplemented (brand slots are placeholders). Required only if invoicing/email is in launch scope. | `assets.service.ts:35-36`; no PDF/mail libs | White-Label Review |
| M5 | Growth engine + console duplicated (A/B); two i18n systems. Maintainability drag, not a functional blocker. | `OperationsCenter.tsx:86`; ~1,278 inline `L()` calls | Duplication D1, D2 |

## 🟢 LOW — cleanup, not blocking

| # | Item | Evidence |
|---|---|---|
| L1 | 9 dead files + 6 unused dependencies (`@google/genai`, `react-router-dom`, `motion`, `express`, `@types/express`, `dotenv`). | Dead-Code Report §1-2 |
| L2 | Generic package name `"react-example"`. | `package.json:2` |
| L3 | Two documentation roots (`docs/` + `documentation/`). | Duplication §3 |
| L4 | CORS `*` on payment functions; CSP `'unsafe-inline'` scripts; low comment density in god objects. | Prod Readiness S5, S6; Code Quality Q7 |

---

## Verdict
- **Ship as a demo / sales sandbox:** ✅ ready today (build ✓, E2E 24/24, strong security-code hygiene, feature-complete UX).
- **Launch as a live multi-tenant SaaS:** ❌ blocked by **5 Critical + 5 High** items. The critical cluster is coherent and addressable — it is dominated by two themes: **(a) flip-and-validate the live backend** (C1, C2, H1, H2, H3) and **(b) make multi-tenancy real** (C3, C4, C5, H4, H5). None require a rewrite; they require a focused backend-hardening + multi-tenancy program.
