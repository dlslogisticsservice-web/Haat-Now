# Launch Guardian — Module Catalog

Ten modules, one control plane. Each entry: **responsibility · inputs · outputs · dependencies ·
surface · what it REUSES from HAAT NOW** (reuse is a design requirement, not a nicety).

Module id prefix: `LG-`.

---

## LG-1 · Health Monitor

**Responsibility** — Continuous truth for the 18 product/platform/delivery subsystems.

| | |
|---|---|
| **Inputs** | edge probes (HTTP/TLS/DNS/RPC/SQL), synthetic renders (CI), in-app vitals, `/version.json`, `/health.json` |
| **Outputs** | `guardian_checks` status transitions → Signals → Detections |
| **Depends on** | LG-9 (store), scheduler (`pg_cron`) |
| **Surface** | Health grid (green/yellow/red + detail + sparkline), subsystem drill-down |
| **Reuses** | existing `/version.json` + `/health.json`; `monitoring.service` seam; EnterpriseUI `StatusBadge`/`MetricCard`; V1 health grid as the UI seed |

**Checks owned:** Website · Website Studio · Admin · Merchant/Driver/Customer portals · APIs ·
Mobile APIs · DB · Storage · Auth · Edge Functions · Realtime · CDN · DNS · SSL · Domain · Env vars.

*Notable check semantics:* **SSL** = days-to-expiry (yellow < 21d, red < 7d). **DNS** = apex + www
resolve to the expected target (this class of bug already bit us: `www.haatnow.app` cert).
**Env vars** = parity between `check:env` requirements and what the running build actually has
(exposed via a build-stamped manifest, never the values).

---

## LG-2 · Infrastructure Monitor

**Responsibility** — Vendor reality, independent of our code.

| | |
|---|---|
| **Inputs** | vendor status APIs (Supabase, Vercel, Google Cloud, GitHub, FCM) + **real-call probes** (a Maps geocode, an SMS dry-run, an email send to a sink, an FCM validate) |
| **Outputs** | vendor Check status, quota/credit warnings, incident correlation hints |
| **Depends on** | LG-9, secrets in Edge Function config |
| **Surface** | Infra board: vendor × status × last-incident × quota |
| **Reuses** | `IntegrationCenter`'s provider registry + `HealthBadge` idiom; payment edge functions as the Moyasar probe |

> **Design rule:** a vendor is green only when a *real call* succeeds. A green status page with a
> failing call is **red** — status pages lag. Correlate both; trust the call.

---

## LG-3 · Business Monitor

**Responsibility** — Detect money/flow breakage that infra monitoring cannot see.

| | |
|---|---|
| **Inputs** | SQL invariants + windowed throughput over `orders`, `wallets`, `ledger_entries`, `commissions`, `settlements`, `payment_attempts`, `refunds`, `referrals`, `notifications`, `drivers`, `merchants` |
| **Outputs** | business Checks, invariant violations (always ≥ high severity) |
| **Depends on** | LG-9, scheduler, live backend (yellow "demo" in sandbox) |
| **Surface** | Business board + Finance dashboard |
| **Reuses** | `analyticsService` / `sandboxStore.getPlatformAnalytics()`; the ledger/settlement RPCs already deployed |

**Invariant catalogue (v1.0)**

| Check | Rule | Severity if violated |
|---|---|---|
| `biz.ledger.balanced` | per `ref_id`: Σdebit = Σcredit | **critical** |
| `biz.wallet.nonneg` | no `wallets.balance < 0` | **critical** |
| `biz.cod.reconciled` | delivered COD orders ⇒ `payment_status='paid'` within N min | high |
| `biz.affiliate.once` | ≤1 commission per (referral, order) | high |
| `biz.settlement.backlog` | oldest unpaid settlement age < SLA | high |
| `biz.orders.throughput` | orders/15m within seasonal band | medium (anomaly) |
| `biz.orders.failratio` | cancelled/total < threshold | high |
| `biz.payment.success` | gateway success ratio ≥ threshold | high |
| `biz.notify.delivery` | delivered/sent ≥ threshold | medium |
| `biz.inventory.oversell` | no negative stock movement | high |
| `biz.dispatch.unassigned` | accepted orders unassigned > N min | high |

---

## LG-4 · Incident Engine

**Responsibility** — Turn noisy signals into the few things humans should act on.

| | |
|---|---|
| **Inputs** | Signals + Detections from LG-1/2/3, LG-7 test failures, LG-8 deploy events |
| **Outputs** | `guardian_incidents` (open→ack→mitigated→resolved), timeline, ownership |
| **Depends on** | LG-9, LG-10 (alerts) |
| **Surface** | Incident console: list, filters, timeline, evidence, actions |
| **Reuses** | `OpsIncidentLog` UI idiom; `audit_logs` for the human trail |

**Correlation:** fingerprint = `hash(kind, service, normalized_message|check_key)`. Same
fingerprint + open incident + within window ⇒ append occurrence, **do not** create a new incident.
Release-scoped: a new deploy SHA opens a fresh fingerprint generation (regressions stay visible).

**Severity matrix**

| | money/data loss | customer-blocking | degraded | cosmetic |
|---|---|---|---|---|
| **all users** | SEV1 | SEV1 | SEV2 | SEV3 |
| **segment** | SEV1 | SEV2 | SEV3 | SEV4 |
| **single** | SEV2 | SEV3 | SEV4 | SEV4 |

---

## LG-5 · AI Analyst (RCA)

**Responsibility** — For each incident: probable cause, blast radius, confidence, evidence.
**Never** touches code. Full contract in `launch_guardian_ai_pipeline.md`.

| | |
|---|---|
| **Inputs** | Incident + evidence bundle (signals, stack frames, recent commits/SHA, deploy events, check history, related test failures) |
| **Outputs** | `guardian_analyses` (cause, services, impact, confidence 0–1, evidence refs) |
| **Depends on** | LG-4, `guardian-ai` Edge Function, Claude API key (server-side only) |
| **Surface** | Incident → Analysis tab |
| **Reuses** | the V1 prompt-assembly concept; `/version.json` SHA for release grounding |

---

## LG-6 · AI Repair Pipeline

**Responsibility** — Produce the 9 artifacts a human needs to fix and ship safely.

| | |
|---|---|
| **Inputs** | Incident + Analysis |
| **Outputs** | Developer Report · Technical Analysis · **Git Diff Recommendation** · Claude Prompt · Codex Prompt · Regression / Validation / Deployment / Rollback checklists — all immutable + versioned |
| **Depends on** | LG-5 |
| **Surface** | Artifacts tab: preview, copy, "Open in Claude", export to PR description |
| **Reuses** | V1's Copy Prompt / Open-in-Claude UX |

> **Hard rule (P2):** the Git Diff Recommendation is a *suggestion rendered as a diff*. Guardian
> has no write credential to the repo. Applying it = a human opening a PR. There is no code path
> from Guardian to `main`.

---

## LG-7 · Quality Center

**Responsibility** — Permanent QA platform (12 capabilities). See `launch_guardian_quality_center.md`.

| | |
|---|---|
| **Inputs** | scheduled/triggered CI runs; suite results posted back |
| **Outputs** | `guardian_test_runs` + artifacts (screens, traces, reports); failures ⇒ Detections |
| **Depends on** | GitHub Actions, LG-9 |
| **Surface** | QA Center: suites, history, flake rate, baselines |
| **Reuses** | **existing harnesses**: `npm run test:website` (179), `e2e_runner.cjs` (24), `ops_simulation.cjs` (20), `public_site_shots.cjs`, `content_verify.cjs`, `studio_parity_check.cjs`, `loc_validate.cjs` |

---

## LG-8 · Release Center

**Responsibility** — Approval → canary → promote/rollback, fully audited. See `launch_guardian_release_center.md`.

| | |
|---|---|
| **Inputs** | GitHub PR/checks, Vercel deploy webhooks, QA gates, readiness checklist |
| **Outputs** | `guardian_releases`, `guardian_approvals`, deployment audit |
| **Depends on** | LG-7, LG-1, webhooks |
| **Surface** | Release Center: readiness board, approvals, history, one-click **rollback runbook** |
| **Reuses** | `FINAL_PRODUCTION_CUTOVER_RUNBOOK.md` as the canonical checklist source; `/version.json` SHA verification |

---

## LG-9 · Telemetry Store

**Responsibility** — The single durable substrate. Schema in `launch_guardian_database_design.md`.

| | |
|---|---|
| **Inputs** | `guardian-ingest` only (single write path) |
| **Outputs** | RLS-scoped reads, rollups, retention |
| **Depends on** | Supabase, `pg_cron` for rollup/prune |
| **Surface** | none (infrastructure) |
| **Reuses** | Supabase RLS + `auth_has_permission`; the `webhook_events` idempotency pattern |

---

## LG-10 · Alert Center

**Responsibility** — The right human, once, with context. See `launch_guardian_alerting.md`.

| | |
|---|---|
| **Inputs** | Incident transitions, SLO burn, budget alerts |
| **Outputs** | notifications + escalation state |
| **Depends on** | LG-4, channel adapters |
| **Surface** | Alert rules, routing, on-call, silences |
| **Reuses** | `NotificationCenter` + `notification_templates`; SMS/Email providers already being provisioned for the product |

---

## Dependency graph

```
LG-9 Store ◄──────────────── everything writes via ingest
  ▲
  ├── LG-1 Health ─┐
  ├── LG-2 Infra ──┼──► LG-4 Incidents ──► LG-5 AI RCA ──► LG-6 Repair Artifacts
  ├── LG-3 Business┘            │                                  │
  ├── LG-7 QA ─────────────────┤                                  ▼
  └── LG-8 Release ◄───────────┘◄──────────── human approval ── PR (outside Guardian)
                     │
                     └──► LG-10 Alerts ──► Slack/Email/SMS/Push/Webhook
                     └──► Dashboards (7 roles)
```

## Reuse ledger (what we do NOT build)

| Need | Existing thing reused |
|---|---|
| client error/log capture | `monitoring.service` (`captureError`/`track`/`log` + ring buffer) |
| audit trail | `audit_logs` + `adminService.auditLogs` |
| RBAC | `role_permissions` + `auth_has_permission` |
| UI atoms | `EnterpriseUI` (`StatusBadge`, `MetricCard`, `WorkspaceHeader`, `DashboardGrid`…) |
| nav/routing | `AdminSidebar` NavKey + `AdminDashboard` render branch |
| provider registry/health | `IntegrationCenter` |
| notifications | `NotificationCenter` + `notification_templates` + Realtime |
| test suites | all `docs/testing/*` harnesses + `npm run test:website` |
| cutover/rollback procedure | `FINAL_PRODUCTION_CUTOVER_RUNBOOK.md` |
| business metrics | `analyticsService` / `sandboxStore.getPlatformAnalytics()` |
