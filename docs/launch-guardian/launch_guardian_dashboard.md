# Launch Guardian — Dashboards

Seven role dashboards over **one** data model. A dashboard is a *saved view*, not a new app:
same `guardian_*` store, same RLS, same EnterpriseUI atoms, one `guardian_dashboard(role)` RPC
returning a pre-shaped payload (one round-trip, no N+1 from the browser).

**Design law:** every widget answers a decision. If a number doesn't change what someone does,
it doesn't ship.

---

## 0. Information architecture

```
Super Admin → Launch Guardian
 ├── Overview        (role-aware landing; defaults to the viewer's role)
 ├── Health          (18 subsystems grid → drill-down)
 ├── Infrastructure  (8 vendors)
 ├── Business        (invariants + flow)
 ├── Incidents       (console: list → timeline → analysis → artifacts)
 ├── Quality         (suites, history, flake, baselines)
 ├── Releases        (readiness, approvals, history, rollback)
 └── Alerts          (rules, routing, on-call, silences)
```
Role switcher visible only to users holding multiple roles. Deep-link every widget
(`?view=incidents&sev=sev1`) so an alert can link straight to the evidence.

---

## 1. Common widget vocabulary

| Widget | Use |
|---|---|
| `StatusPill` | green/yellow/red/stale — **stale ≠ green** |
| `SLOGauge` | objective, current, **error budget remaining** |
| `Sparkline` | 24h trend from rollups (never raw) |
| `MetricTile` | value + delta vs prior period + threshold colouring |
| `IncidentRow` | sev · title · service · age · owner · occurrences |
| `TrendBand` | actual vs seasonal band (anomaly context) |
| `GateList` | pass/fail checklist (release readiness) |
| `FreshnessStamp` | "as of HH:MM" on every panel — trust requires knowing staleness |

---

## 2. CEO dashboard — *"is the business healthy and safe?"*

| Widget | Source | Decision it drives |
|---|---|---|
| Platform status (single pill) | worst-of tier-1 services | escalate or relax |
| Orders today + vs 7-day band | `biz.orders.throughput` rollups | demand collapse? |
| GMV / revenue today + delta | finance rollups | trading health |
| Payment success ratio | `biz.payment.success` | revenue leakage |
| COD reconciliation gap | `biz.cod.reconciled` | cash risk |
| Active SEV1/SEV2 | incidents | is anything on fire |
| Customer impact (est. users affected) | incident `impact` | comms decision |
| 30-day availability + error budget | `guardian_slos` | ship vs stabilise |
| AI spend MTD | analysis cost ledger | cost control |

*Deliberately excludes:* latencies, stack traces, test flake. Not the CEO's decision surface.

---

## 3. Operations dashboard — *"is the network flowing right now?"*

Orders in flight by state · unassigned > N min (**dispatch risk**) · driver supply vs demand by zone ·
merchant accept latency p95 · delivery ETA accuracy · cancellations (rolling) with reason mix ·
`biz.dispatch.unassigned` + `biz.orders.failratio` pills · live incident feed (ops-owned services).

---

## 4. Engineering dashboard — *"what is broken and where?"*

18-subsystem health grid (V1 grid, promoted to live checks) · API/DB/Realtime p50/p95/p99 ·
error rate by service + **new fingerprints since last deploy** (regression lens) ·
JS heap trend (memory-leak detector) · Edge Function invocations/errors · current release SHA +
deploy timeline overlaid on error rate (*did this deploy cause it?*) · open incidents by service ·
MTTA / MTTR trend.

**Signature panel — "Deploy vs Errors":** error-rate timeseries with deploy markers. One glance
answers the most common production question.

---

## 5. Support dashboard — *"what do I tell customers?"*

Active customer-facing incidents in **plain language** (title + impact + ETA + workaround) ·
affected segments (zone/city/platform) · order failures by reason · notification delivery health ·
"known issues" feed to paste into tickets · link to status/comms template.

*No stack traces.* Support needs the story, not the trace.

---

## 6. QA dashboard — *"is the build trustworthy?"*

Suite matrix (unit 179 · E2E 24 · ops-sim 20 · visual · a11y · SEO · localization · links · load) ×
last run × pass/fail × duration · **flake rate** (top offenders) · visual-regression diffs awaiting
review · coverage of critical journeys · failures grouped by changed path (blame lens) · gate status
feeding the Release Center.

---

## 7. Finance dashboard — *"is the money right?"*

**Ledger balanced** (Σdebit=Σcredit) pill — the single most important tile in Guardian ·
negative-wallet count (must be 0) · settlement backlog + oldest age vs SLA · commissions created vs
expected · refunds/compensations today · COD collected vs delivered · payment gateway fees ·
affiliate payouts pending · AI/infra spend MTD.

Any invariant breach here is **SEV1 by construction** (severity floor), regardless of user impact.

---

## 8. Dispatch dashboard — *"where are my drivers?"*

Live driver map (reuses `OperationsCommandCenter`/`OpsSvgMap`) · online drivers by zone ·
unassigned orders queue with age · assignment success rate · trigger health
(`order_auto_dispatch`, `order_driver_workload`) · realtime channel health (`driver_locations`) ·
ETA breach list.

---

## 9. RBAC mapping

| Role template | Default dashboard | Sees |
|---|---|---|
| `super_admin` | Overview | everything |
| `operations_manager` | Operations | health, business-ops, dispatch, incidents (ops) |
| `finance_manager` | Finance | finance invariants, settlements, spend |
| `support_agent` | Support | customer-facing incidents only (no traces) |
| `compliance_officer` | Health (read) | security/auth checks, audit |
| `marketing_manager` | CEO (subset) | growth/affiliate metrics |
| `country_manager` | Operations (scoped) | own country's services/incidents |

Enforced by `auth_has_permission('guardian.view')` + row scoping — **server-side**. The role switcher
is UI convenience; it grants nothing.

---

## 10. Performance & freshness

| Rule | Why |
|---|---|
| Dashboards read **rollups only** | the firehose never touches the UI |
| One RPC per dashboard (`guardian_dashboard(role)`) | one round-trip, RLS-enforced shaping |
| Poll 30s; Realtime push for incident transitions | fresh without hammering |
| Every panel carries a `FreshnessStamp`; > 2× interval ⇒ **stale** styling | never present stale as healthy |
| Empty ≠ zero | "no data" renders as `—`, never as a green 0 |

---

## 11. Anti-patterns (explicitly rejected)

- ❌ Vanity walls of charts nobody acts on.
- ❌ A green tile that is merely *unmeasured* (we render `unknown`/`stale`).
- ❌ Fabricated or extrapolated numbers — if a metric needs the live backend and we're in demo,
  it renders **yellow "demo"** (this honesty rule already governs V1).
- ❌ Client-side aggregation over raw rows.
- ❌ Per-role forks of the data model.
