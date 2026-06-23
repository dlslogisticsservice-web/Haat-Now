# Medium Security Findings — HAAT NOW

**Date:** 2026-06-24 · Definition: limited impact / requires unusual conditions / hardening. Deferred
per sprint scope (Critical + High only); logged for the backlog. None block production.

---

## ME-1 — `order_status_history` INSERT open to any authenticated user (audit-log integrity)
`INSERT WITH CHECK (true)` lets any authenticated user append status-history rows for any `order_id`.
**Impact limited:** the *real* order status lives on `orders.status` (separately RLS-scoped), and the
customer tracking timeline is derived from `orders.status` (not this audit log). So this is audit-trail
pollution, not order-state tampering. **Recommended fix:** move history writes to a `SECURITY DEFINER`
trigger on `orders` and revoke client INSERT — avoids breaking customer-create vs merchant/driver-update
write paths. Not done here to avoid touching the fulfillment write paths under "no-refactor".

## ME-2 — `campaign_events` INSERT open (analytics spam)
`INSERT WITH CHECK (true)` for impression/click/revenue events. Acceptable for append-only analytics;
worst case is event-count inflation. **Recommended:** scope `revenue`/`order_id` events to the user's own
order, or move event ingestion behind an edge function.

## ME-3 — Production hardening recommendations (not vulnerabilities)
- **Retry/offline:** payment-verify already polls (12 attempts); general fetches lack retry/offline UX.
- **Rate limiting:** confirm Supabase Auth OTP rate-limits are enabled (dashboard); consider per-IP limits at the edge.
- **Monitoring:** wire `ErrorBoundary.onError` + edge logs to Sentry/Logflare.
- **Token rotation:** rotate the Supabase management token before go-live.

---

## Result: 2 Medium RLS findings + hardening notes. **0 blocking.** Deferred to backlog.
