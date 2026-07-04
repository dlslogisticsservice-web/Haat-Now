# Tenant Provisioning Experience — Implementation Report

**Sprint:** end-to-end **White Label onboarding** — a complete visual, operator-driven tenant provisioning
experience with post-provision verification and a Provisioning Summary. Reuse-first, no duplication.

## Outcome
✅ Implemented and runtime-verified. Gate green: **typecheck 0 · build ✓ · sandbox E2E 24/24 · provisioning
probe PASS (9 steps → provision → 10/10 verification → summary)**. Sandbox demo unchanged.

## No duplication — enhanced the existing wizard in place
The platform already had a `TenantOnboardingWizard` (Phase 0.6). Rather than build a second wizard, this sprint
**enhanced it in place** into the full experience. It remains **presentation-only**; all provisioning is done by
the **existing Provisioning Engine** — no duplicate provisioning logic, no new services.

| Reused | How |
|---|---|
| **Provisioning Engine** | `provisioningService.provision(spec)` runs the 8 delegating steps; `retry`, `verify` reused |
| **Provision Timeline + operation_events** | the timeline renders `run.steps`; the engine audits to `operation_events` — nothing duplicated |
| **Template Marketplace** | industries = distinct manifest **verticals**; templates filtered by industry; `toSpec` builds the spec |
| **Theme Presets / Theme Engine** | theme step + template default preset |
| **Subscription** | `PLAN_CATALOG` plan step |
| **Tenant Service** | tenant record (admin account, custom domain written post-provision) |
| **Website Runtime** (`website.service`) | Website + CMS verification; custom domain written to the site |
| **RBAC / Permissions** | `<Can perm="platform.tenants.manage">` gate |

## 9-step visual workflow
`Industry → Template → Theme → Brand → Domain → Subscription → Admin Account → Review → Provision`
- **Industry** (new) — pick a vertical; filters the templates.
- **Template** — manifest selection (defaults theme/plan/brand color).
- **Theme** — theme preset (or template default).
- **Brand** — name, support email, logo URL, primary color.
- **Domain** — subdomain + optional custom domain (runtime priority: custom → subdomain → dev param).
- **Subscription** — plan.
- **Admin Account** (new) — admin name + phone (recorded on the tenant; live mode creates the Auth user +
  assigns the role via RBAC).
- **Review** — all choices.
- **Provision** — calls the engine, shows the live timeline, then auto-verifies.

Autosave/resume, per-step validation (`templatesService.validate`), and the permission gate are preserved.

## Automatic post-provision verification (10 items)
Reuses `provisioningService.verify(runId)` (the 8 engine artifacts) + the tenant record + `website.service`:
Website · Admin Portal · Merchant Portal · Customer App · Captain App · Theme · Brand · CMS · Permissions ·
Subscription. Surfaces are marked available when the tenant is **active** and its config is present; Website/CMS
check the seeded published site; Theme/Brand/Subscription/Permissions map to the engine's `verify` checks.

## Provisioning Summary screen
Shows: **Provision duration** · **Completed modules** (from `run.steps`) · **Warnings** (managed-subdomain note,
admin-account note) · **Errors** (failed steps + failed verifications) · **Links** — **Website URL**
(`<slug>.haatnow.app` / custom domain, opens the working preview in sandbox), **Admin URL**, **Tenant URL**.

## Runtime verification (Definition of Done)
Puppeteer probe (super admin → Onboarding):
```
9 steps navigate (industry→…→provision) · click Provision
summary present · verification 10/10 (Website "7 pages", surfaces available, theme/brand/cms/perms/subscription ✓)
Website URL contains the slug · Admin URL + Tenant URL present · duration shown · 8 completed-module chips
console errors: 0   → PROBE PASS
```

## Known limitations
- Sandbox provisioning + verification are complete and verified; **live** provisioning depends on the Supabase
  RPCs / seeding covered by the three-environment model (documented staging follow-up).
- The Admin Account is recorded on the tenant in sandbox; creating the real `auth.users` row + RBAC role
  assignment is the live-mode step (noted in the summary warnings).
- Custom-domain DNS/SSL is set as state; real provisioning is a Website Center / edge follow-up.

## Rollback
The wizard is presentation-only and additive. Revert the commit to restore the prior wizard. The engine's own
`rollback(runId)` removes a partially-provisioned tenant; a failed run stays in `draft` (never active) and is
retryable from the timeline.
