# Production Checklist — Official HaaT Now Website

> Final operational gate before and immediately after go-live. Covers security, data,
> observability, and rollback for the Wave 4 experience layer.

## Security
- [ ] All Wave 4 tables (`website_homepage_sections`, `website_collections`, `website_promotions`) have RLS enabled.
- [ ] Policies are tenant-scoped via `auth_tenant()`; **no anon grants**, **no `using(true)`**.
- [ ] Write policies additionally require `auth_has_permission('website.edit')`.
- [ ] No `SECURITY DEFINER` function grants `execute` to `anon`/`public`.
- [ ] Public site reads go through published snapshots, not direct authenticated tables.
- [ ] No secrets in client bundle; `VITE_*` contains only publishable keys.
- [ ] CSP, HSTS, X-Content-Type-Options, Referrer-Policy headers set.
- [ ] Portal routes (wallet/payment/invoices) require auth; no IDOR (tenant + owner checks).

## Data & migrations
- [ ] Migration `20260705000500_website_experience.sql` applied to staging, then production.
- [ ] Migration is additive + idempotent (`create table if not exists`); no existing table altered.
- [ ] `list_migrations` shows it recorded once; re-run is a no-op.
- [ ] Seed data for HaaT Now homepage/collections/promotions loaded (or created via Website Center).
- [ ] Backup/restore verified for the three new tables.

## Feature flags
- [ ] Global default = OFF (`StaticFlagResolver([])`), confirmed in production config.
- [ ] Per-tenant enable rules scoped to HaaT Now tenant id + `production` environment only.
- [ ] Documented rollback: set flags OFF → legacy path restored, no data loss.

## Observability
- [ ] Instrumented repositories emit latency + ok/err counters (Wave 1 observability).
- [ ] Health registry checks include the new aggregates' backends.
- [ ] Error tracking wired for the site shell + portal (client + edge).
- [ ] Alerts on: publish failures, checkout error rate, realtime disconnect, 5xx spikes.
- [ ] Audit log records Website Center edits (create/update/reorder/hide) with actor + version.

## Reliability
- [ ] Job queue (`CollectionJobQueue`) drains publish/revalidate jobs; failures retried, then dead-lettered.
- [ ] Realtime falls back to `createPollingSubscription` when channels unavailable.
- [ ] Graceful empty/error states everywhere (no white screen).
- [ ] Load test: homepage + search + checkout at expected peak concurrency.

## Release
- [ ] `npm run build` and `npm run build:live` both succeed on CI.
- [ ] E2E 24/24 and `test:website` 116/116 on CI.
- [ ] Version stamped in `version.json`; deploy verified against it (see deploy-ci-polling note).
- [ ] Post-deploy smoke: full customer journey on production behind the enabled flags.
- [ ] Rollback rehearsed and timed (< 5 min via flag flip).
- [ ] Owner + on-call sign-off recorded with commit SHA and timestamp.
