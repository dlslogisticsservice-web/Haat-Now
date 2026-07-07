-- ═══════════════════════════════════════════════════════════════════════════════
-- Production Launch · Cash-on-Delivery (COD) as a first-class payment method.
--
-- STRICTLY ADDITIVE + IDEMPOTENT. Adds `orders.payment_method` so COD (and any future
-- method) is recorded for reporting/receipts. COD needs NO gateway: an order is created by
-- the existing order engine and a COD attempt is written to `payment_attempts` (provider
-- 'cod') by the payment orchestrator. Settlement/commission/driver-credit are already
-- payment-method-agnostic (they key off status='delivered' + delivery_fee), so no change to
-- the settlement engine is required for COD to be paid out.
--
-- Cash reconciliation (flip payment_status→paid when the driver collects) is a reporting
-- refinement handled at delivery; it is intentionally NOT a settlement dependency.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── orders.payment_method (additive) ──────────────────────────────────────────────
alter table if exists public.orders
  add column if not exists payment_method text;

comment on column public.orders.payment_method is
  'Payment method for the order: ''cod'' (cash on delivery), ''moyasar'' (card), etc. Null = legacy/unspecified.';

-- Index for finance/ops reporting by method (partial: only rows that set a method).
create index if not exists idx_orders_payment_method
  on public.orders(payment_method)
  where payment_method is not null;

-- ── payment_attempts: allow the 'cod' provider ────────────────────────────────────
-- provider is a free-text column (no enum); COD rows are inserted with provider='cod',
-- status='pending', gateway_reference=null. No schema change needed beyond documentation.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payment_attempts' and column_name = 'provider'
  ) then
    comment on column public.payment_attempts.provider is
      'Gateway/provider identifier. ''cod'' = cash on delivery (no gateway, no gateway_reference).';
  end if;
end $$;
