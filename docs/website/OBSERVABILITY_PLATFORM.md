# Observability Platform

> HaaT Now · Phase 10.5 · Design only (Part 14). End-to-end monitoring for the DXP, built on the
> existing `monitoring.service` seam, the Analytics beacon (RUM), `operation_events` (audit), and the
> Phase 9 scheduler (health jobs). Turns the platform's blind spots (Phase 8 flagged no alerting)
> into an observable system.

## 1. Signals & sources
| Domain | What we watch | Source |
|---|---|---|
| **Publishing** | publish success/failure, compile time, snapshot size, revalidate success, stuck scheduled publishes | Publishing Engine events + `website_publish_history` |
| **SEO** | index coverage, sitemap freshness, canonical errors, structured-data validity, cloaking checks | SEO Service + scheduled crawl |
| **Performance** | Core Web Vitals (LCP/CLS/INP) per page/tenant, TTFB, cache hit ratio, JS budget breaches | Analytics RUM beacon + edge metrics + CI Lighthouse |
| **Broken Links** | internal 404s, dead media, orphan pages | scheduled broken-link scan (SEO §6) + edge 404 log |
| **Content Drift** | draft-vs-published divergence age, stale translations, unpublished changes | diff of draft vs snapshot + translation staleness |
| **Experience Errors** | render errors, failed data bindings, realtime-block data-source failures, JS exceptions | edge render logs + client error beacon |
| **Failed Workflows** | rejected/stuck approvals, expired schedules, emergency rollbacks | `website_workflow_instances` + audit |
| **Analytics Health** | beacon ingestion rate, gaps, SRM in experiments, rollup lag | ingestion metrics + scheduler |

## 2. Model (additive, multi-tenant, RLS)
```sql
create table website_observability_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid, site_id uuid,
  domain text not null,                          -- 'publish'|'seo'|'perf'|'links'|'drift'|'render'|'workflow'|'analytics'
  severity text not null check (severity in ('info','warn','error','critical')),
  code text, message text, context jsonb, at timestamptz default now()
);
create table website_alerts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid, site_id uuid,
  rule text not null, condition jsonb, channel text,   -- in-app|email|webhook|pager
  state text default 'ok' check (state in ('ok','firing','acknowledged')), last_fired_at timestamptz
);
create table website_health_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid, site_id uuid,
  metrics jsonb not null, computed_at timestamptz default now()
);
```

## 3. Pipeline
```
edge render / beacon / RPC / scheduler jobs
   → emit website_observability_events (+ operation_events for auditable actions)
   → scheduled rollups → website_health_snapshots (per site/tenant)
   → alert rules evaluate → website_alerts → notify (in-app/email/webhook/pager)
   → dashboards in Website Center + platform ops console
```
- **Health jobs** run on the Phase 9 scheduler (broken-link scan, SEO check, CWV rollup, drift
  check, workflow-stuck check, analytics-gap check). Fixes the Phase 8 "no scheduler/alerting" gap
  for the DXP surface.

## 4. Dashboards & SLOs
- **Per-tenant health**: publish success rate, CWV pass %, broken-link count, drift age, workflow
  SLA, uptime. **Per-page**: CWV, SEO score, errors, experiment health.
- **SLOs** (platform-level): publish→live latency, edge availability, API p95, beacon ingestion
  success. Error budgets tracked; alerts fire on burn.

## 5. Alerting & on-call
- Rule-based alerts with severity + channel (in-app, email, signed webhook, pager). Tenant-scoped
  (a tenant sees its own site alerts) + platform-scoped (ops sees fleet-wide).
- **Emergency rollback** and **failed publish** are always high-severity, immediate-notify.

## 6. Tracing & debugging
- Each publish/render/journey-run/experiment carries a correlation id; events are queryable by it →
  reconstruct "why did this page render this variant / fail to publish".
- Experience decisions (which rule/variant/experiment applied) are logged for reproducibility
  (Experience §2.4) — critical for debugging personalization.

## 7. Integration with strict concerns
Multi-tenant (events/alerts RLS-scoped); RBAC (`observability.view`, `observability.manage`);
localized dashboards; feeds SEO/analytics health; white-label (tenant sees only its sites); flag-
gated integrations; audit (alert config changes); ties to Governance (policy-violation and stuck-
approval alerts). Observability is the safety net that makes running 10k tenant experiences
operable — the Phase 8 CTO audit's missing "operational heartbeat," now designed in.
