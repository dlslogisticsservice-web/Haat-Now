# Launch Guardian Platform v1.0 — Master Architecture

> The permanent operational brain of HAAT NOW. An in-product AI DevOps / SRE / QA / Release
> Engineer. Not a dashboard — a control plane.
> **Status:** design. Implementation phased (see `launch_guardian_future_roadmap.md`).

---

## 1. Purpose & non-goals

**Purpose.** One coherent system that answers, continuously and without a human asking:
*Is HAAT NOW healthy? Is the business flowing? What broke, why, who's affected, what's the fix,
and is it safe to ship the fix?*

**Explicit non-goals (hard constraints):**
- ❌ **Never mutates production code.** Guardian emits *artifacts and recommendations only*.
- ❌ Never auto-applies a migration, secret, or deploy. Every state change is human-approved.
- ❌ Not a replacement for Sentry/Datadog if the org later buys them — Guardian *ingests* them.
- ❌ Not a second app. It is a **Super Admin workspace + a set of collectors**, reusing the
  existing HAAT NOW stack (no new framework, no second router, no duplicate design system).

**Guiding principles**
| # | Principle | Consequence |
|---|---|---|
| P1 | **Reuse over rebuild** | Extends `monitoring.service`, `analyticsService`, `audit_logs`, RBAC (`auth_has_permission`), EnterpriseUI atoms, existing test harnesses. |
| P2 | **Human-in-the-loop** | AI proposes; Super Admin disposes. Approval gates are schema-level, not UI-level. |
| P3 | **Evidence over inference** | Every incident links to raw signals (logs, probe results, commit SHA). No unfounded claims. |
| P4 | **Bounded cost** | Telemetry is sampled, rolled up, and retention-capped. AI calls are budgeted + deduped. |
| P5 | **Fail-open for the product** | Guardian must never degrade HAAT NOW. Collectors are async, best-effort, circuit-broken. |
| P6 | **Mode-aware** | Works in `sandbox` (demo) and `live` (`HAAT_LIVE_BACKEND=1`) without forking logic. |

---

## 2. Reality constraints (why this design, not a generic one)

HAAT NOW has **no application server**. The stack is:
- **Client:** React 19 + Vite 6 + Tailwind v4 (SPA), Capacitor shell (`com.haatnow.app`).
- **Backend:** Supabase `umwbzradvbsirsybfxfb` — 143 tables, 147 RPCs, 7 buckets, RLS everywhere,
  Realtime publication on `notifications/orders/driver_locations`, **4 edge functions**
  (`payment-initiate|verify|webhook|refund`).
- **Hosting:** Vercel, `main` → production, apex `haatnow.app` (SPA rewrite `/(.*) → /index.html`).
- **CI:** GitHub. Harnesses already exist (`test:website` unit, `e2e_runner.cjs`,
  `ops_simulation.cjs`, puppeteer shot/parity scripts under `docs/testing/`).
- **⚠ `pg_cron` / `pg_net` are NOT installed** — scheduling must be designed, not assumed.

**Therefore Guardian's compute lives in four planes** (there is nowhere else to put it):

| Plane | Runs | Used for |
|---|---|---|
| **A. In-app collector** | browser (SPA) | client errors, web-vitals, route/render failures, session context |
| **B. Edge Functions** | Supabase Deno | scheduled probes, ingestion API, AI orchestration (secrets stay server-side) |
| **C. CI runner** | GitHub Actions | QA suites needing a browser/node (E2E, visual, a11y, load, link-check) |
| **D. External webhooks** | inbound | Vercel deploys, GitHub pushes/PRs, Sentry, payment gateway, uptime vendor |

**Scheduling decision (explicit):** enable **`pg_cron` + `pg_net`** for DB-side probes and rollups;
use **GitHub Actions `schedule:`** for browser-based QA; **Vercel Cron** only as fallback.
This is a hard prerequisite, tracked in the roadmap.

---

## 3. System context (C4 L1)

```
        ┌──────────── Humans ────────────┐
        │ CEO · Ops · Eng · Support · QA │
        │ Finance · Dispatch · On-call   │
        └───────────────┬────────────────┘
                        │ Super Admin → Launch Guardian workspace (RBAC-scoped)
                        ▼
   ┌─────────────────────────────────────────────────────────┐
   │           LAUNCH GUARDIAN CONTROL PLANE                  │
   │  Health · Infra · Business · Incidents · AI · QA ·       │
   │  Release · Dashboards · Alerts                           │
   └───┬───────────┬───────────┬───────────┬─────────────┬────┘
       │           │           │           │             │
       ▼           ▼           ▼           ▼             ▼
  HAAT NOW    Supabase     External     GitHub        Alert
   SPA/App    (DB/Edge/    providers    Actions       channels
  (collector) Storage/RT)  (Maps/FCM/   (QA suites)   (Slack/Email/
                            SMS/Email/                 SMS/Push/
                            Vercel)                    Webhook)
```

---

## 4. Layered architecture (C4 L2)

```
┌── L5 SURFACES ────────────────────────────────────────────────────────────┐
│ Super Admin workspace (React, EnterpriseUI atoms, RBAC-gated)             │
│ 7 role dashboards · Incident console · QA center · Release center         │
└───────────────▲───────────────────────────────────────────────────────────┘
                │ reads (RLS-scoped views + RPCs)
┌── L4 INTELLIGENCE ────────────────────────────────────────────────────────┐
│ Detection engine (rules + thresholds + anomaly)                           │
│ Correlation & dedup (fingerprint → incident)                              │
│ AI RCA + Artifact generator (Claude via Edge Function)                    │
│ Confidence scoring · Impact estimation                                    │
└───────────────▲───────────────────────────────────────────────────────────┘
                │
┌── L3 STORE ───────────────────────────────────────────────────────────────┐
│ Supabase: guardian_* tables · rollups · retention · RLS · audit           │
└───────────────▲───────────────────────────────────────────────────────────┘
                │ ingest (single write path)
┌── L2 INGESTION ───────────────────────────────────────────────────────────┐
│ `guardian-ingest` Edge Function — auth, schema-validate, rate-limit,      │
│ sample, fingerprint, PII-scrub, enrich (release SHA, env, mode), persist  │
└───────────────▲───────────────────────────────────────────────────────────┘
                │
┌── L1 COLLECTORS ──────────────────────────────────────────────────────────┐
│ A: in-app (errors, vitals, routes)   B: edge probes (health/infra/biz)    │
│ C: CI runners (QA suites)            D: webhooks (Vercel/GitHub/gateway)  │
└───────────────────────────────────────────────────────────────────────────┘
```

**Single write path.** Every signal — browser, probe, CI, webhook — enters through
`guardian-ingest`. No collector writes tables directly. One place for auth, validation,
sampling, fingerprinting, scrubbing, and cost control.

---

## 5. Core domain model (conceptual — schema in the DB doc)

```
Signal        raw datapoint (metric | event | log | probe result | test result)
   │ fingerprint(kind, service, normalized message/check)
   ▼
Detection     a rule fired on signals (threshold | absence | anomaly | test fail)
   │ correlate (same fingerprint + time window + release)
   ▼
Incident      the unit humans work: severity, status, service(s), impact, owner
   │ enrich
   ▼
Analysis      AI RCA: probable cause, affected services, confidence, evidence refs
   │ generate
   ▼
Artifacts     Developer Report · Technical Analysis · Git Diff Recommendation ·
              Claude Prompt · Codex Prompt · Regression/Validation/Deployment/Rollback checklists
   │ human approval
   ▼
Release       PR → checks → canary → promote | rollback   (audited end-to-end)
```

**Invariants**
- An Incident always has ≥1 Signal as evidence (P3).
- An Artifact is immutable + versioned; regenerating creates a new version.
- No Artifact can reach "applied" without a human `guardian_approvals` row (P2).
- Every human action is dual-written to `audit_logs` (existing) + Guardian's own trail.

---

## 6. Health model (uniform across all 18 subsystems + infra + business)

Every monitored thing is a **Check** with one contract:

| Field | Meaning |
|---|---|
| `key` | stable id, e.g. `web.public.home`, `db.latency`, `biz.orders.throughput` |
| `plane` | health · infra · business |
| `probe` | how measured (http, rpc, sql, sdk, webhook, synthetic) |
| `interval` | 30s / 1m / 5m / 15m / hourly |
| `thresholds` | green/yellow/red boundaries + hysteresis + min-samples |
| `owner_role` | which dashboard / on-call rotation owns it |
| `slo` | optional objective (availability %, p95 latency) + error budget |

**Status algebra:** `green` (within SLO) · `yellow` (degraded / config-missing / demo-mode) ·
`red` (failing). Composites roll up **worst-of-children**; `yellow` never masks `red`.
Hysteresis (N consecutive samples) prevents flapping.

**Coverage → probe mapping (v1.0)**

| Group | Checks | Probe plane |
|---|---|---|
| **Product surfaces** | Website, Website Studio, Admin, Merchant/Driver/Customer portals | synthetic HTTP + render assertion (C) |
| **Platform** | APIs, Mobile APIs, Edge Functions, Realtime, Auth, DB, Storage | edge probe RPC/SQL/SDK (B) |
| **Delivery** | CDN, DNS, SSL, Domain, Env vars | edge probe HTTP/TLS/DNS + `check:env` parity (B) |
| **Infra vendors** | Supabase, Google Cloud, Maps, FCM, SMS, Email, Vercel, GitHub | vendor status API + real-call probe (B/D) |
| **Business** | Orders, Drivers, Merchants, Customers, Wallet, Payments, COD, Affiliate, Inventory, Settlement, Finance, Notifications | SQL/RPC invariants + throughput windows (B) |

> **Business monitoring is not "count rows".** It is **invariant + flow** monitoring:
> *ledger Σdebit = Σcredit*, *no negative wallet*, *orders-per-15m within seasonal band*,
> *COD collected == delivered*, *settlement backlog age*, *affiliate commission created exactly once*,
> *notification delivery ratio*. These are the checks that catch a silent money bug.

---

## 7. Security architecture

- **RBAC:** reuse the live server-side model (`admin_users.role_template` → `role_permissions` →
  `auth_has_permission(perm)`), adding keys: `guardian.view`, `guardian.incident.ack`,
  `guardian.incident.resolve`, `guardian.ai.run`, `guardian.qa.run`, `guardian.release.approve`,
  `guardian.alert.manage`, `guardian.silence`. **Never a client-side check alone** — RLS enforces.
- **RLS:** all `guardian_*` tables readable by `authenticated` **and** `auth_has_permission('guardian.view')`;
  writes only via the ingest function (service role) or an explicit permission.
- **Secrets:** AI keys, vendor keys, webhook secrets live **only** in Edge Function secrets.
  The browser never holds them; the client calls RPCs/functions, never vendors directly.
- **PII:** signals are scrubbed at ingest (phone/email/address/token redaction) before persist.
  Store identifiers (`order_id`, `user_id`) — never personal payloads.
- **Tamper-evidence:** every human action (ack, approve, silence, promote, rollback) writes
  `audit_logs` + `guardian_approvals` with actor, reason, timestamp.
- **Webhook auth:** signature-verified, replay-protected by event id — reusing the
  `webhook_events` idempotency pattern already proven for payments.

---

## 8. Mode-awareness (sandbox vs live)

Guardian must be truthful about the demo build:
- In `sandbox`, backend checks report **yellow "demo"** — never a false green, never a false red.
- Business invariants run against `sandboxStore` in demo and Supabase in live through the **same
  Check contract**; only the `probe` implementation differs.
- QA / Release / AI planes are mode-independent (they operate on repo + CI + deploys).

---

## 9. Reliability & cost

| Concern | Design |
|---|---|
| Guardian must not slow the app | collectors use `sendBeacon`/async, sampled, circuit-broken; zero blocking work on the render path |
| Telemetry growth | raw signals 14d → 1m rollups 90d → 1h rollups 13mo; pruned by `created_at` |
| AI cost | RCA runs only on **new** fingerprints, debounced, daily-budgeted, cached by (fingerprint, release) |
| Alert storms | dedup by fingerprint, grouping windows, escalation backoff, maintenance windows |
| Guardian outage | degraded Guardian ≠ product outage; last-known health cached and stamped **stale** |

---

## 10. Interfaces (contracts, not code)

| Interface | Direction | Contract |
|---|---|---|
| `guardian-ingest` | in | `{ kind, key, value?, level?, message?, meta?, release, mode, at }` → 202 |
| `guardian-probe` | scheduled | runs due Checks → emits Signals via ingest |
| `guardian-ai` | invoked | `{ incident_id }` → Analysis + Artifacts (persisted, never applied) |
| `guardian-alert` | internal | Incident transition → routing → channel adapters |
| `guardian-qa` | CI → in | `{ suite, passed, failed, duration, artifacts[] }` |
| Webhooks | in | Vercel deploy · GitHub push/PR/check · gateway events |
| Read API | out | RLS-scoped views + RPCs consumed by the workspace |

---

## 11. Delivery phases (detail in roadmap)

| Phase | Scope | Prereq |
|---|---|---|
| **0 (built)** | Launch Guardian **V1** — in-app health grid, metrics, copy-only AI Repair Prompt, regression view | — |
| **1** | Store + ingest + in-app collector + real health checks | `guardian_*` schema |
| **2** | Edge probes + infra/business checks + rollups | `pg_cron`+`pg_net` |
| **3** | Incidents + detection + Alert Center | 1–2 |
| **4** | AI RCA + Artifact pipeline | 3 + AI key |
| **5** | QA Center (CI-driven) | GH Actions |
| **6** | Release Center (approval/canary/rollback) | 5 |
| **7** | Role dashboards + SLO/error budgets | 2–6 |

---

## 12. Document map

| Doc | Contains |
|---|---|
| `launch_guardian_architecture.md` | this — vision, planes, layers, security, contracts |
| `launch_guardian_modules.md` | module catalog: responsibility, I/O, deps, reuse |
| `launch_guardian_database_design.md` | `guardian_*` schema, indexes, RLS, retention, RPCs |
| `launch_guardian_ai_pipeline.md` | detection → RCA → artifacts, prompt contracts, guardrails |
| `launch_guardian_dashboard.md` | 7 role dashboards, widgets, IA, RBAC |
| `launch_guardian_alerting.md` | rules, severity, escalation, channels, dedup |
| `launch_guardian_quality_center.md` | 12 QA capabilities, runners, baselines, gates |
| `launch_guardian_release_center.md` | approval, canary, readiness, rollback, audit |
| `launch_guardian_future_roadmap.md` | phases, milestones, risks, effort |
