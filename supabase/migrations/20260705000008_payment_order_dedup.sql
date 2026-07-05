-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-9 — Server-side double-charge prevention (order-scoped dedup).
--
-- BEFORE: payment_attempts.idempotency_key was a random UUID per attempt, so the DB UNIQUE
-- prevented only literal duplicate keys — NOT two independent initiate calls creating two
-- Moyasar charges for one order. The real guard was a CLIENT-side lock
-- (payment-orchestrator.service.ts); a direct edge-function caller bypassed it.
-- (SECURITY §S-6, R-09.)
--
-- AFTER: a partial UNIQUE index guaranteeing AT MOST ONE active (pending/captured) payment
-- attempt per order, enforced by the database regardless of caller. Combined with the
-- edge function now deriving a deterministic idempotency_key = 'order:<orderId>'
-- (payment-initiate/index.ts), a second concurrent initiate collides and is rejected/
-- reused instead of creating a second charge.
--
-- Guarded: if legacy duplicate active attempts already exist, index creation is skipped
-- with a notice rather than failing the migration (reconcile, then re-run).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  begin
    create unique index if not exists uq_payment_attempts_active_order
      on public.payment_attempts (order_id)
      where status in ('pending','captured');
  exception when unique_violation or others then
    raise notice 'uq_payment_attempts_active_order not created — pre-existing duplicate active attempts must be reconciled first';
  end;
end $$;
