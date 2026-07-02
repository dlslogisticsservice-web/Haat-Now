# Phase 0.6 — Tenant Onboarding Wizard · Implementation Report

Implemented per `PRODUCTIZATION_MASTER_PLAN_V2` §0.1 (Onboarding Wizard). The wizard is a **presentation layer
only** — it collects/validates input, selects a template, and calls the **existing** Provisioning Engine. It
contains **no business logic** and provisions nothing itself. Ran the full `IMPLEMENTATION_STANDARD.md`.

## Presentation-only compliance (what it does NOT do)
- Does **not** provision tenants directly → calls `provisioningService.provision(spec)`.
- Does **not** manipulate subscriptions / apply themes / create assets / assign roles / set up integrations →
  all of those are performed by the **engine** (from the template manifest). The wizard only passes a spec.
- No new service created; **no business logic** — validation delegates to `templatesService.validate`.

## Files changed
- **New:** `src/features/admin/TenantOnboardingWizard.tsx` — the wizard (component). Progress indicator,
  Back/Next, autosave/resume, graceful error recovery. RBAC-gated (`platform.tenants.manage`).
- **Extended:** `AdminSidebar.tsx` (+ Onboarding nav, Platform group, super), `AdminDashboard.tsx` (route).
- No service changes ⇒ no `SERVICE_REGISTRY.md` entry required (§7).

## Wizard flow (12 steps) — verified
1 Welcome · 2 Company · 3 Business Type · 4 Template Selection · 5 Branding (logo → Brand Assets) · 6 Theme
(Theme Presets) · 7 Subscription (plan) · 8 Domain (placeholder) · 9 Review · 10 Provision · 11 Progress ·
12 Success. Progress indicator highlights the active step; **Back/Next** with per-step validation.

## Reuse proof (no duplication)
| Concern | Reused (not duplicated) |
|---|---|
| Provisioning | `provisioningService.provision` / `retry` (single engine, no duplicated flow) |
| Templates | `templatesService.list` (selection), `.validate` (validation), `.toSpec` (manifest→spec), `.assignToTenant` |
| Theme | `themePresetsService.list` (theme step) |
| Subscription | `PLAN_CATALOG` (plan step) |
| Brand Assets | logo field → passed to the engine which applies it via `saveBranding` |
| RBAC | `<Can perm="platform.tenants.manage">` gate |
| Integration Center / CMS | applied by the engine from the manifest (wizard doesn't touch them) |

## Wizard-flow verification (runtime, real UI)
- Wizard loads (welcome) with the 10-step **progress indicator**.
- **Validation:** Company step with no brand → **Next blocked** (stays on company); Business step with no
  template → **Next blocked** (stays on business). (Reuses input checks + `templatesService.validate` at Review.)
- Steps render (branding/theme/subscription/domain/review) with reused pickers.

## Provisioning verification
- At the Provision step, **Provision** → the wizard calls `provisioningService.provision(toSpec(template))` →
  **Success** screen. Tenant created (slug `zeta-onboard`): `theme_preset_id=preset-default`, `sub_status=trialing`,
  `template_id=tpl-restaurant`, `vertical=food`, `cms_structure.pages=5`, status **active** — the manifest's
  config, applied by the engine (not the wizard). **0 console errors.**
- **Graceful error recovery:** on a failed run the wizard shows the failed step + a **Retry** button
  (`provisioningService.retry`) — the engine's resumable/retryable path (verified in Phase 0.4).

## Resume verification (bug found + fixed)
- **Autosave:** editing any field persists `{form, step}` to `haat_sb_onboarding_draft` (verified: typing a
  brand name writes the draft).
- **Resume:** reopening the wizard restores the saved step + data (resumed banner shown; injected step-9 draft
  → wizard opens at the Provision step and completes).
- **Bug fixed:** the autosave `useEffect` fired on mount with the empty initial state *before* the resume
  effect's `setState` re-rendered, **clobbering the resumed draft to step 0**. Fixed by loading the draft in the
  `useState` **lazy initializer** (initial state = the draft), so autosave can never overwrite it. Re-verified:
  resume lands on the correct step and completes.

## Production verification
Typecheck 0 · Lint 0 · Build ✓ · E2E 24/24 · wizard flow + provisioning + resume runtime-verified · 0 console
errors. Deployed via the git workflow; production verified via Vercel `version.json` == merged commit (GitHub
Actions API rate-limited → gated on local CI-equivalent, IMPLEMENTATION_STANDARD §5).

**Phase 0.6 complete, deployed, production-verified. Stopping — Phase 0.7 not started.**
