# HAAT NOW — Documentation Index

All project documentation, reports, audits and runbooks live under `docs/`, organized by purpose.
Source code (`src/`) and the database (`supabase/`) remain at the repository root for fast access.
The root keeps only `README.md`.

> Filenames were preserved during the reorganization, so any prose reference to a document
> (e.g. "see PHONE_AUTH_REPORT.md") still names the correct file — only its folder changed.

## Folder structure

```
docs/
├── README.md                  ← you are here (index)
├── PROJECT_STRUCTURE_REPORT.md ← move log (old path → new path)
├── SAFE_AREA_AUDIT_REPORT.md  ← latest hotfix audit
├── audits/        ← blockers, impact analysis, MCP / DB audits, cutover readiness, db-audit scripts
├── reports/       ← verification, status, readiness & completion reports
├── deployment/    ← deployment plans, certifications, go-live checklists, env/config
├── testing/       ← test plans, screenshot/capture scripts, screenshots/
├── operations/    ← runbooks, recovery plans, step-by-step execution guides
├── architecture/  ← data model, demo accounts
├── migrations/    ← migration ledger + auth migration packages
├── archive/       ← superseded / historical documents, branding asset archives
├── plans/         ← pre-existing planning docs (backlog, redesign/migration plans)
└── verification/  ← pre-existing runtime / auth verification records
```

> `audits/`, `reports/`, `plans/` and `verification/` already existed from a previous cleanup.
> Subsequent passes consolidated the root-level documents into them and added `deployment/`,
> `testing/`, `operations/`, `architecture/`, `migrations/` and `archive/`.
>
> Non-runtime dev tooling was also relocated from the root: `__db_audit.cjs` / `__db_check.cjs`
> → `audits/`; `screenshot*.cjs` / `capture_login.mjs` → `testing/`; the branding `.zip` →
> `archive/`. The repository root now holds only runtime/config files
> (`index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vercel.json`, `metadata.json`, `README.md`).

## Where to find things

### Audits — `docs/audits/`
Blocker tracking, pre-migration impact, MCP connectivity & database audits, cutover readiness.
- `MCP_CONNECTION_REPORT.md`, `MCP_DATABASE_AUDIT.md`, `MCP_RECOVERY_REPORT.md`
- `PRE_MIGRATION_IMPACT_REPORT.md`
- `PRODUCTION_BLOCKERS_REPORT.md`, `PRODUCTION_BLOCKERS_STATUS.md`
- `PRODUCTION_CUTOVER_READINESS.md`

### Reports — `docs/reports/`
Auth/admin/RBAC verifications, backend & application readiness, feature completion, live status.
- Auth: `ACCOUNT_EXISTENCE_REPORT.md`, `AUTH_DATA_MAPPING_REPORT.md`, `AUTH_SOURCE_REPORT.md`, `AUTH_USERS_VERIFICATION.md`, `ADMIN_USERS_VERIFICATION.md`, `PHONE_AUTH_REPORT.md`, `PHONE_AUTH_VERIFICATION.md`, `RBAC_VERIFICATION.md`, `RBAC_EXECUTION_REPORT.md`
- Readiness/completion: `BACKEND_READINESS_REPORT.md`, `APPLICATION_READINESS_REPORT.md`, `APPLICATION_COMPLETION_REPORT.md`, `FEATURE_COMPLETION_REPORT.md`
- Production/status: `PRODUCTION_VALIDATION_REPORT.md`, `PRODUCTION_WIRING_REPORT.md`, `FINAL_PRODUCTION_RECHECK.md`, `FINAL_PRODUCTION_EXECUTION_REPORT.md`, `LIVE_PROJECT_STATUS.md`, `MIGRATION_LEDGER_REPORT.md`, `RESUME_STATUS.md`, `REPOSITORY_CONSISTENCY_REPORT.md`

### Deployment — `docs/deployment/`
How to ship: plans, certifications, go-live checklists, Vercel/Supabase config.
- `DEPLOY_NOW.md`, `DEPLOYMENT_PLAN.md`, `FINAL_DEPLOYMENT_PACKAGE.md`
- `FINAL_CUTOVER_RUNBOOK.md`, `FINAL_PRODUCTION_CERTIFICATION.md`, `FINAL_EXECUTION_CERTIFICATION.md`
- `GO_LIVE_CHECKLIST.md`, `LAUNCH_CHECKLIST.md`
- `VERCEL_ENV_SETUP.md`, `SUPABASE_PRODUCTION_CONFIG.md`

### Testing — `docs/testing/`
- `E2E_TEST_PLAN.md`

### Operations — `docs/operations/`
Runbooks, recovery procedures, step-by-step execution.
- `EXECUTION_RUNBOOK.md`, `SUPABASE_EXECUTION_RUNBOOK.md`
- `PRODUCTION_RECOVERY_EXECUTION_PLAN.md`, `RLS_RECOVERY_PLAN.md`
- `STEP_1_2_EXECUTION_REPORT.md`, `STEP_3_EXECUTION_REPORT.md`
- `PAYMENT_ACTIVATION_GUIDE.md`

### Architecture — `docs/architecture/`
Data model, auth migration packages, demo data.
- `REAL_AUTH_MIGRATION_PACKAGE.md`, `REAL_AUTH_MIGRATION_PACKAGE_V2.md`
- `DEMO_ACCOUNTS.md`

### Archive — `docs/archive/`
Reserved for superseded / historical documents (currently empty).

## Related (not moved)

- **`documentation/`** — pre-existing design specifications (e.g. `documentation/design/HAAT-NOW-DESIGN-SPEC.md`, referenced from `src/index.css`). Already organized; left in place.
- **`README.md`** (repo root) — project overview & getting started.
