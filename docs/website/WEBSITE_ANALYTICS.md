# Website Analytics

> HaaT Now · Phase 10 · Design only (Part 13). Today the only analytics is a fire-and-forget
> `monitoring.track('website_pageview')` seam (`runtime.ts:142-144`) with no storage or dashboard.
> Website OS adds first-party, privacy-respecting, per-page analytics.

## 1. Ingestion
- A lightweight **edge beacon** endpoint receives pageview/event pings (no heavy third-party JS).
- Events: `pageview`, `click` (tracked elements), `form_submit`, `conversion` (goal), `outbound`,
  `search`.
- Server-side enrichment: tenant/site/path/locale (from host resolution), referrer class, device
  class, country (from edge geo), UTM params. **No PII, no cross-site tracking, cookieless option**
  (privacy-first, GDPR-friendly — a selling point).
- Stored in `website_page_analytics` (rollup) + `website_events` (raw, short-retention, partitioned
  by tenant/date at scale).

## 2. Per-page metrics (Part 13)

| Metric | Source |
|---|---|
| Views | pageview beacons |
| Clicks | tracked-element click events |
| CTR | clicks / impressions for CTAs & nav |
| Conversions | goal events (form submit, app-download click, order-start) |
| Bounce rate | single-event sessions |
| Heatmap-ready | click coordinates (sampled, opt-in) exported for a heatmap overlay |
| Search terms | on-site search events |
| Top pages | ranked views per period |
| Broken pages | 404 hits from the edge (+ SEO broken-link scan) |
| SEO health | aggregated per-page SEO score (SEO Platform §7) |

## 3. Dashboards (in Website Center)
- Site overview: views/uniques/conversions trend, top pages, top referrers, device/country split.
- Page drill-down: the per-page metrics above + the page's SEO score and Core Web Vitals.
- Funnel/goals: define conversion goals (e.g. "clicked Get the App", "submitted merchant form").
- Forms analytics: submission volume, spam rate, completion rate per form.

## 4. Core Web Vitals (real-user monitoring)
- The public runtime reports LCP/CLS/INP (web-vitals) via the beacon → per-page RUM.
- Ties performance to SEO and to the Part 14 targets (95+ Lighthouse) with real-user evidence.

## 5. Integrations
- Optional passthrough to a tenant's own GA4/Meta Pixel (config in `website_settings`) — but the
  first-party dashboard works without any third party.
- Server-side conversion export (webhook) for tenants who want their own attribution.

## 6. Privacy, multi-tenancy & retention
- Cookieless by default; IP stored only as a salted hash; honor Do-Not-Track / consent banner.
- All analytics rows are `tenant_id`-scoped (RLS); a tenant sees only its own sites.
- Raw events short-retention (e.g. 30–90 days) then rolled up; rollups long-retention.
- Access gated by `website.analytics.view`.

## 7. Scale (10k tenants)
- Beacon writes are append-only and cheap; batch/aggregate via the Phase 9 scheduler into
  `website_page_analytics` rollups so dashboards read pre-aggregated rows (no live scans).
- Partition `website_events` by tenant-hash/date; drop old partitions on retention.
