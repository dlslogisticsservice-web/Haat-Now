# Launch Guardian — Delivery Roadmap

From the V1 that exists today to the full operational brain. Incremental, each phase shippable and
useful on its own. **No phase begins before its prerequisite is real** (the lesson already learned
from `pg_cron` and the SMS provider).

---

## Phase 0 — V1 (BUILT, not deployed)

Already implemented and committed (`6bfc20d`, feature branch):
in-app **Health grid (17 subsystems 🟢🟡🔴)** · **System Metrics** · **AI Repair Prompt** (auto-collected
logs/stack/build, Copy + Open in Claude, copy-only) · **Regression panel** · **approval-gate banner** ·
`monitoring.recentEvents()` ring buffer · docs.

**Honest limits:** health is derived from client-visible signals only; no persistence (buffer dies on
reload); no incidents/alerts; no history; regression is display-only. Phase 1 fixes persistence first —
without a store, nothing else is possible.

---

## Phase map

| Phase | Delivers | Hard prerequisite | Effort | Value |
|---|---|---|---|---|
| **1 · Store + Ingest** | `guardian_*` foundation, `guardian-ingest`, in-app collector, real Health checks with history | schema migration | M | ★★★★ persistence = memory |
| **2 · Probes + Infra/Business** | edge probes, 8 vendor checks, **`biz.*` invariants**, rollups, retention | **`pg_cron` + `pg_net` enabled** | M | ★★★★★ catches silent money bugs |
| **3 · Incidents + Alerts** | detection, correlation, incident console, Alert Center (Slack/Email first) | 1–2 | M | ★★★★★ MTTA collapses |
| **4 · AI RCA + Artifacts** | `guardian-ai`, RCA, the 9 artifacts, confidence + eval loop | 3 + Anthropic key | M | ★★★★ MTTR collapses |
| **5 · Quality Center** | CI-driven suites, results, flake, visual baselines, gates | GH Actions workflows | M | ★★★★ regression prevention |
| **6 · Release Center** | readiness board, approvals, canary flags, rollback, DORA | 5 + webhooks | M | ★★★★ safe shipping |
| **7 · Dashboards + SLOs** | 7 role dashboards, SLOs, error budgets | 2–6 | S | ★★★ decisions, not charts |

**Sequencing rule:** 1 → 2 → 3 are the spine (memory → truth → response). 4–7 are leverage on top.
Do not build 4 before 3: an AI analyst with no incidents to analyse is a demo, not a system.

---

## Critical prerequisites (blockers, tracked)

| # | Prereq | Blocks | Owner |
|---|---|---|---|
| P1 | **`pg_cron` + `pg_net` extensions** — not installed today | Phase 2 (all scheduling/rollups) | OPS |
| P2 | **Anthropic API key** in Edge Function secrets | Phase 4 | OPS |
| P3 | **Slack webhook** (+ SMS/Email providers, already being provisioned for the product) | Phase 3 channels | OPS |
| P4 | **GitHub Actions** workflows + repo secrets | Phase 5 | Eng |
| P5 | **Vercel + GitHub webhooks** → ingest | Phase 6 | OPS |
| P6 | **Live backend** (`HAAT_LIVE_BACKEND=1`) | Business/infra checks report real (yellow "demo" until then) | RM |
| P7 | **FCM/APNs** (push not implemented today) | Push alert channel | Mobile |

---

## Beyond v1.0 (deliberately deferred)

| Idea | Why later |
|---|---|
| **Auto-remediation** (restart, scale, feature-flag kill-switch) | requires proven RCA accuracy + blast-radius controls. Earliest v2, and even then: flag-flip only, never code. |
| **Predictive alerting** (forecast budget burn / demand collapse) | needs ≥1 season of real data |
| **Anomaly ML** (beyond EWMA bands) | rules first; only add ML where rules demonstrably fail |
| **Multi-tenant Guardian** (per white-label tenant) | after the platform registry is live |
| **Public status page** | derive from `guardian_check_status`; needs comms policy |
| **Cost intelligence** (Supabase/Vercel/AI spend vs orders) | after Finance dashboard proves the data |
| **Chaos drills** | only once rollback is battle-tested |
| **Mobile Guardian app** | Slack + push covers on-call adequately |
| **Vendor pager** (PagerDuty/Opsgenie) | the Webhook channel already makes this a config, not a rewrite |

---

## Success metrics (how we know it worked)

| Metric | Baseline (today) | v1.0 target |
|---|---|---|
| Time to detect a production break | human notices (∞) | **< 2 min** |
| MTTA (SEV1) | n/a | **< 5 min** |
| MTTR (SEV1) | unmeasured | **< 60 min** |
| Silent money bugs reaching a human | unknown (no invariant monitoring) | **0 undetected > 15 min** |
| Change failure rate | unmeasured | measured, then < 15% |
| False-positive pages | n/a | **< 5%** |
| RCA accuracy (human-verdicted) | n/a | **> 70%** at ≥0.8 confidence |
| Release readiness decision | tribal | **gated + audited, 100%** |

If Guardian cannot move MTTA/MTTR and catch invariant breaches, it has failed — regardless of how
good the dashboards look.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Alert fatigue** kills adoption | dependency suppression, dedup, budgets, weekly silence review (§ alerting) |
| **AI wrong → wasted work / bad fix** | confidence bands, `unknowns` required, reference post-validation, human gate, eval golden set |
| **Guardian slows the product** | async/sampled/circuit-broken collectors; P5 fail-open |
| **Telemetry cost blowup** | sampling, rollups, partition-drop retention, capacity model |
| **Scope creep into a QA platform rebuild** | reuse ledger — 9 of 12 QA suites already exist; Guardian schedules, it doesn't rewrite |
| **Guardian fails silently** | `guardian.self.*` checks (ingest lag, probe staleness, alert queue) |
| **Security surface** | RLS + `auth_has_permission` + service-role-only writes + secrets server-side + PII scrub |
| **"Just let the AI fix it"** pressure | capability boundary: no repo/deploy credential exists. Not policy — architecture. |

---

## Definition of done for v1.0

- [ ] All 18 health + 8 infra + 12 business checks live with history and SLOs.
- [ ] Detection → incident → alert works end-to-end, dependency-suppressed, < 5% false positives.
- [ ] AI RCA produces the 9 artifacts with calibrated confidence + human verdict loop.
- [ ] All 12 QA capabilities scheduled, with baselines and gates feeding releases.
- [ ] Release Center gates every production change; rollback ≤ 2 min, drilled at least once.
- [ ] 7 role dashboards, each widget tied to a decision.
- [ ] Zero automatic production code changes — by architecture.
- [ ] Guardian monitors Guardian.
