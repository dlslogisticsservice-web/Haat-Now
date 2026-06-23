# Security Under Load Report — HAAT NOW

**Date:** 2026-06-24

## Auth / OTP / session
- OTP send/verify go through Supabase Auth (rate-limited server-side). Per-request work is constant-time
  (token verify), independent of data volume → no scaling cost.
- Session refresh is handled by supabase-js automatically (background JWT refresh); no per-request DB cost.

## RLS performance at scale (grounded in measured index latency)
RLS policies filter on **indexed columns**, so RLS-filtered queries inherit the measured index performance:
- Customer-scoped reads (`customer_id = auth.uid()`) use `idx_orders_customer_created` etc. → **3.4 ms**
  (was 190 ms). RLS adds an index-supported predicate, not a scan.
- Owner predicates on `order_items` / `payment_transactions` resolve through the new FK indexes.
- Policy subqueries (`exists (select 1 from admin_users where user_id=auth.uid() and scope='super')`,
  `user_roles` joins) hit **primary-key / unique indexes on tiny tables** → constant-time.
- Country isolation uses `order_country_code` `SECURITY DEFINER` (bypasses per-row RLS recursion) → no
  quadratic blow-up under load.

## Hardening fixed earlier (holds under load)
- `app_config` super-only write, `payment_transactions` own-order insert, `support_messages`
  `sender_id = auth.uid()` (see `SECURITY_AUDIT.md`). These predicates are O(1) / index-backed → negligible
  load cost.

## Verdict
Security controls add **constant-time / index-supported** overhead; RLS does not introduce a scaling
bottleneck once the hot-path indexes exist (they now do). Auth/OTP/session are server-rate-limited and
volume-independent.
