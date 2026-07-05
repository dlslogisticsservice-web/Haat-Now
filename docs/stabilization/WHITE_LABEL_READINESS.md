# White-Label Readiness — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Exercise: "provision a brand-new company." Evidence cited `file:line`.

## Headline

The white-label subsystem is a **well-architected demo whose control plane runs almost entirely in browser `localStorage`**. It has an elegant 8-step provisioning orchestrator, a genuine versioned CMS/page builder, per-tenant render theming, and a template marketplace — but **none of it persists to a database in a way that survives production**, and the provisioner **would throw in live Supabase mode** because it writes ~19 fields the `tenants` table does not have (`provisioning.service.ts:43-57` vs `20260627000008_tenants.sql:9-33`). Verified.

Persistence reality (all localStorage-only, no Supabase branch):
- Website content — `haat_sb_website_v1` (`website.service.ts:17`); **no `website_*` migration exists** (verified).
- Theme presets — `haat_crud_theme_presets` (`themePresets.service.ts:15`).
- Templates — `haat_crud_templates` (`templates.service.ts:47`).
- Platform registry — `haat_platform_registry` (`platform.service.ts:14`).
- Design tokens — `haat_design_store_v1` (`DesignContext.tsx:8`).

---

## Provisioning classification (the requested checklist)

| Item | Classification | Evidence |
|---|---|---|
| Tenant (record) | **Automatic (sandbox) / Broken (live)** | `tenant.service.ts:47`; schema mismatch |
| Theme | Automatic (preset-id string) | `provisioning.service.ts:44` |
| Logo | **Manual** (only if `logo_url` passed; upload is separate) | `:47`, `BrandAssetsPanel.tsx:24` |
| Domain (subdomain) | Semi-Automatic (cosmetic string `${slug}.haatnow.app`) | `website.service.ts:155` |
| Domain (custom) + SSL | **Manual / Stub** (free-text + manual SSL dropdown; no DNS/ACME) | `WebsiteCenter.tsx:236-243` |
| SMTP (email) | **Missing** | no email provisioning anywhere |
| SMS | **Missing** | no SMS/sender provisioning |
| Payments config | **Missing / Stub** (integration *tags* only, no keys/account) | `:52-53` |
| Storage | Stub (`storage_provider` string flag) | `:53` |
| Feature flags | Automatic (`features_json` from plan/template) | `:49` |
| Countries | **Missing** (country is a string, not per-tenant enablement) | `:43` |
| Currencies | **Missing per-tenant** (global from `config/countries.ts`) | `countries.ts:24-33` |
| Languages | **Missing per-tenant** (global AR/EN only) | `i18n/index.ts:151` |
| Brand assets | Semi-Automatic (real upload, manual step) | `storage.service.ts:38` |
| Roles | **Stub** (`roles_seeded` flag; `listRoles()` result discarded) | `:50-51` |
| Admin accounts | **Missing / Stub** (no `auth.users`, no invite; wizard admits unimplemented) | `TenantOnboardingWizard.tsx:137,273` |
| Secrets | **Missing** | none generated |
| Env vars | **Missing** | none |
| Initial data | **Stub** (`demo_data_profile` string; no seeder runs) | `:55` |
| Default website | Automatic (lazy, localStorage) | `website.service.ts:160-167` |
| Activation | Automatic | `:56-57` |

**Automatic: 5 · Semi-Automatic: 3 · Manual: 2 · Stub: 5 · Missing: 7.**
The 7 Missing + 5 Stub items are precisely the ones that make white-label *real*: auth users, payments, email/SMS, domains/SSL, secrets, RBAC rows, data seeding.

---

## What genuinely works well (credit)

- **Provisioning orchestrator** — idempotent, resumable, rollbackable, audited to `operation_events` (`provisioning.service.ts`). Good engineering; just pointed at localStorage.
- **CMS / page builder** — 13 block types, nav/footer/blog/legal/SEO, draft→publish→version→**rollback** (20-entry history) (`website.service.ts:26-262`); real visual editor (`WebsiteCenter.tsx`).
- **Public-site runtime** — host resolution (custom domain → subdomain → `?site=`), per-tenant brand/theme application, per-tenant `sitemap.xml`/`robots.txt` (`runtime.ts:18-139`).
- **Per-tenant render theming** — `tenantTheme()` merges preset + overrides into CSS variables live, no rebuild (`tenant.service.ts:20-36`).
- **Localization** — AR/EN + regional Arabic dialects + 8-country currency formatting with correct 3-decimal Gulf currencies (`config/countries.ts:24-50`).

## What blocks real white-label onboarding

1. Provisioner throws in live DB (schema mismatch) — **must fix first**.
2. No tenant admin login creation (auth user/invite).
3. No payment/subscription billing wiring (no charge ever occurs — `subscription.service.ts:54-68`).
4. No SMTP / SMS provisioning.
5. No domain/DNS/SSL automation.
6. No DB-backed website (localStorage only → not served cross-device, no SSR).
7. No tenant-scoped RBAC rows or data isolation (see MULTI_TENANCY).
8. No secrets/env per tenant; no data seeder.

---

## Verdict

**White-label readiness: Demo-grade.** As a sales demo it is impressive and coherent. As a production white-label control plane it is **not deployable** — the one thing a white-label platform must do (spin up a fully working, isolated, billable, reachable brand automatically) it cannot do, and its provisioning path is currently incompatible with its own database schema.
