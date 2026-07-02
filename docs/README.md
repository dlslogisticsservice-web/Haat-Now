# HAAT NOW — Documentation Hierarchy

All project documentation, reports, plans, audits and runbooks live under `docs/`, organized by **purpose**.
Source code (`src/`) and the database (`supabase/`) stay at the repository root for fast access; the
repository root now holds **only `README.md`** among Markdown files. Start at **[INDEX.md](INDEX.md)**.

> Filenames were preserved during every reorganization (`git mv`), so any prose reference to a document
> (e.g. "see PHASE_0_7_IMPLEMENTATION_REPORT.md") still names the correct file — only its folder changed.
> A complete old-path → new-path list is in **[CHANGELOG_DOCS.md](CHANGELOG_DOCS.md)**.

## Folder structure
```
docs/
├── README.md            ← you are here (hierarchy guide)
├── INDEX.md             ← documentation entry point (links to everything)
├── CHANGELOG_DOCS.md    ← every moved document (old → new)
│
├── architecture/   ← system dependency map, platform inventory, data model, demo accounts
├── governance/     ← Service Registry + Implementation Standard (Definition of Done)
├── plans/          ← productization master plans, priorities, roadmaps, cleanup plans
├── phases/         ← Phase 0.x SaaS-foundation implementation reports
├── implementation/ ← feature completion + module implementation reports
├── qa/             ← QA, validation, operational-readiness & simulation reports, gap analyses
├── deployment/     ← release/deploy plans, certifications, go-live, env/config, native/store
├── production/     ← launch checklists, handover, production-ops certification, blockers
├── founder/        ← founder acceptance reports
├── apps/           ← per-surface improvement reports (Captain/Customer/Driver/Merchant)
├── operations/     ← runbooks, recovery plans, execution guides
├── audits/         ← blockers, impact analysis, MCP/DB audits, cutover readiness, safe-area
├── reports/        ← auth/RBAC verifications, backend/app readiness, status, structure/move logs
├── verification/   ← runtime / auth verification records
├── migrations/     ← migration ledger + auth migration packages
├── mobile/         ← mobile / native documentation
├── testing/        ← E2E test plan + screenshot/capture scripts + screenshots (test infra)
└── archive/        ← superseded / historical documents
```

## Where to find things (the new folders)
- **`architecture/`** — `SYSTEM_DEPENDENCY_MAP.md`, `ENTERPRISE_PLATFORM_INVENTORY.md` (+ data model, demo accounts).
- **`governance/`** — `SERVICE_REGISTRY.md` (every service + owner domain + layer rules), `IMPLEMENTATION_STANDARD.md` (the Definition of Done + Sprint Checklist).
- **`plans/`** — `PRODUCTIZATION_MASTER_PLAN.md`, `PRODUCTIZATION_MASTER_PLAN_V2.md` (frozen architecture), `IMPLEMENTATION_PRIORITY.md`, `RC_IMPLEMENTATION_PLAN.md`, `DAY_ONE_OPERATION_PLAN.md`, `TENANT_ISOLATION_ROADMAP.md`, `PROJECT_CLEANUP_PLAN.md`.
- **`phases/`** — `PHASE_0_1..0_7_IMPLEMENTATION_REPORT.md`, `PHASE_0_3_INTEGRATION_REPORT.md` (the SaaS-foundation sprints).
- **`implementation/`** — `*_COMPLETION_REPORT.md`, `INTEGRATION_PLATFORM_REPORT.md`, `ENTERPRISE_COMPLETION_REPORT.md`, `PAYMENT_CONSOLIDATION_REPORT.md`, `OPERATIONS_*_REPORT.md`, `ZONE_MANAGEMENT_REPORT.md`, `WHITE_LABEL_PLATFORM_REPORT.md`, `DEMO_LIFECYCLE_REPORT.md`.
- **`qa/`** — `ENTERPRISE_PRODUCTION_VALIDATION_REPORT.md`, `ENTERPRISE_OPERATIONAL_READINESS_REPORT.md`, `OPERATIONAL_SIMULATION_REPORT.md`, `MULTI_PORTAL_SIMULATION_REPORT.md`, `END_TO_END_BUSINESS_FLOW_REPORT.md`, `ENTERPRISE_HARDENING_REPORT.md`, `FINAL_*_QA_REPORT.md`, `MANUAL_QA_CORRECTIONS_REPORT.md`, `GAP_ANALYSIS.md`, `FINAL_ENTERPRISE_GAP_ANALYSIS.md`.
- **`deployment/`** — `DEPLOYMENT_VERIFICATION_REPORT.md`, `RELEASE_*`, `RC1_STABILIZATION_REPORT.md`, `SUPABASE_BACKEND_RECOVERY_REPORT.md`, `NATIVE_RELEASE.md`, `STORE_SUBMISSION_GUIDE.md`, `PRODUCTION_RELEASE_REPORT.md`, `FINAL_RELEASE_CERTIFICATION.md` (+ pre-existing deploy plans/config).
- **`production/`** — `LAUNCH_CHECKLIST.md`, `PRODUCTION_HANDOVER.md`, `PRODUCTION_OPERATIONS_CERTIFICATION.md`, `FINAL_PRODUCTION_BLOCKERS_REPORT.md`, `PRODUCT_LAUNCH_REVIEW.md`, `PAYMENT_PRODUCTION_READY_REPORT.md`.
- **`founder/`** — `FOUNDER_ACCEPTANCE_REPORT.md`, `FOUNDER_FINAL_ACCEPTANCE_REPORT.md`.
- **`apps/`** — `CAPTAIN_V2_REPORT.md`, `CAPTAIN_V3_PREMIUM_REPORT.md`, `CUSTOMER_APP_IMPROVEMENT_REPORT.md`, `DRIVER_APP_IMPROVEMENT_REPORT.md`, `MERCHANT_PORTAL_IMPROVEMENT_REPORT.md`.

## Pre-existing folders (from earlier cleanups)
`audits/`, `reports/`, `operations/`, `migrations/`, `mobile/`, `verification/`, `archive/`, `testing/`
were organized in prior passes; this sprint added `phases/`, `governance/`, `implementation/`, `qa/`,
`production/`, `founder/`, `apps/` and consolidated the remaining root reports into them.

## Related (not moved)
- **`documentation/`** — design specifications (referenced from `src/index.css`); already organized, left in place.
- **`README.md`** (repo root) — project overview & getting started → points here.
