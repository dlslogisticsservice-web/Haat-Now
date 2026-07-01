# Phase 0.4 — Tenant Provisioning Engine · Implementation Report

Implemented the **orchestrator-only** provisioning engine from `PRODUCTIZATION_MASTER_PLAN_V2` §0.1. It owns
**no domain logic** — every step delegates to an existing service. No service redesigned, no duplicate
implementation, existing `operation_events` audit + `monitoring` reused. Ran the full
`IMPLEMENTATION_STANDARD.md` Definition of Done.

## Files changed
- **New:** `src/services/provisioning.service.ts` — governed service (full header). The engine:
  `provision(spec, resumeRunId?)`, `retry(runId)`, `rollback(runId)`, `verify(runId)`, `getRun/listRuns/steps`.
  Dev-only `window.__prov` hook (tree-shaken from prod, like `__sb`).
- **New:** `src/features/admin/ProvisioningConsole.tsx` — spec form + **timeline · progress · log · retry ·
  rollback · verify** UI (component, not a service). RBAC-gated.
- **Extended:** `AdminSidebar.tsx` (+ Provisioning nav, Platform group, super), `AdminDashboard.tsx` (route).
- **Updated:** `SERVICE_REGISTRY.md` — `provisioning.service` entry (same commit, governance §7).

## Orchestrator — every step delegates to an existing service (no duplication)
| Step | Delegates to (reused) |
|---|---|
| Create tenant | `tenant.service.provision` |
| Assign theme preset | `tenant.service.update` ← Theme Presets (Phase 0.2) |
| Brand & assets | `tenant.service.saveBranding` ← Brand Assets (Phase 0.3) |
| Subscription & trial | `subscription.service.startTrial` (Phase 0.1) |
| Roles & default admin | `rbac.service` |
| Default integrations | `tenant.service.update` (Integration Center prefs) |
| Default site & pages | `tenant.service.update` (CMS/website default marker) |
| Activate | `tenant.service.activate` |
Audit → `operation_events` (existing); failures → `monitoring.captureError`; tracking → `monitoring.track`.

## Engine requirements — met + verified
| Requirement | Implementation | Runtime proof |
|---|---|---|
| **Transactional** | `activate` is the last step ⇒ a partial tenant is never `active`; rollback removes it | tenant `active` only on full completion |
| **Idempotent** | per-step `done()` guard + slug-based tenant reuse | re-provision same slug → **1 tenant** (no dup), steps skipped |
| **Retryable** | `retry(runId)` = provision with `resumeRunId` from first non-ok step | resume → `completed` |
| **Resumable** | run persisted (`haat_sb_provision_runs`); ok/skipped steps not re-run | resume → `completed`, no dup |
| **Auditable** | every step → `operation_events` (reused audit) | **18** `provisioning` rows for one run |
| **Rollback** | `rollback(runId)` removes the (never-active-while-partial) tenant | after rollback → **0 tenants** left |
| **Completion verification** | `verify(runId)` checks the tenant holds every artifact | **ok=true** (8/8 checks) |
| **Timeline / progress / log** | ProvisioningConsole renders 8 steps + status/errors + X/8 | UI timeline = **8 steps**, run `completed` |

## Runtime verification (engine via `__prov` + UI)
- **Full provision:** `status=completed`, 8/8 steps; tenant artifacts — theme `preset-ocean`, `brand_seeded`,
  subscription `trialing`, `roles_seeded`, `integrations_seeded`, `default_website`, status `active`.
- **Completion verify:** `ok=true` (all 8 checks).
- **Audit:** 18 `operation_events` rows (`provision_started`/`_step_started`/`_step_ok`/`_completed`).
- **Idempotency:** re-provision same slug → 1 tenant (no duplicate).
- **Resume/Retry:** provision with `resumeRunId` → completed, no duplicate.
- **Rollback:** tenant removed → 0 partial tenants remain.
- **UI console:** provisioning from the form renders the 8-step timeline → `completed`. **0 console errors.**

## Failure recovery (no partial tenants)
On a step failure the run stops as `failed`; the tenant is left `draft` (never `active` while partial) and is
fully **recoverable** by `retry`/resume (completes it) or `rollback` (removes it). A partial, live tenant is
therefore impossible.

## Reuse / governance
No new tenant/subscription/theme/brand/rbac/audit system — all reused. New service carries the governance
header + registry entry + owner domain (Platform); layer/forbidden rules respected (provisioning → app
services + audit, never UI/Hooks); 0 circular imports. **Payment Rule** unaffected (subscription = trial only).

## Production verification
Typecheck 0 · Lint 0 · Build ✓ · E2E 24/24 · engine + UI runtime-verified · 0 console errors. Deployed via the
git workflow; production verified via Vercel `version.json` == merged commit (GitHub Actions API rate-limited →
gated on local CI-equivalent, IMPLEMENTATION_STANDARD §5).

**Phase 0.4 complete, deployed, production-verified. Stopping — Phase 0.5 not started.**
