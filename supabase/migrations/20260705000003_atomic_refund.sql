-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-4 — Atomic refunds + double-entry ledger posting.
--
-- BEFORE (payment-refund edge fn): read-then-write TOCTOU on the refund ceiling with no
-- lock or unique constraint → two concurrent partial refunds could both pass and over-
-- refund; the order was marked refunded BEFORE the gateway call (fail → stuck row); and
-- refunds NEVER posted to the finance ledger. (SECURITY §S-5, RISK_REGISTER R-03/R-14.)
--
-- AFTER: a reserve → gateway → confirm saga.
--   refund_reserve()  — locks the attempt + sums prior refunds FOR UPDATE, enforces the
--                       ceiling, inserts a pending refund row. Race-safe & idempotent.
--   refund_confirm()  — on gateway success: sets the refund + order status AND posts a
--                       balanced customer_refund/platform_cash ledger entry (idempotent
--                       via post_ledger's txn_id guard). On failure: marks the refund
--                       failed WITHOUT touching order.payment_status.
--
-- Backward compatible: additive columns + new RPCs. Existing refunds table/policies kept.
-- ─────────────────────────────────────────────────────────────────────────────

-- Idempotency + traceability on the refunds row.
alter table public.refunds add column if not exists idempotency_key text;
alter table public.refunds add column if not exists ledger_txn_id   uuid;
create unique index if not exists uq_refunds_idempotency_key
  on public.refunds (idempotency_key) where idempotency_key is not null;

-- Allow the 'partially_refunded'-driving statuses; refunds.status stays pending|refunded|failed.
-- (order.payment_status carries 'partially_refunded'/'refunded' — unchanged.)

-- refund_reserve — race-safe insert of a pending refund with a locked ceiling check.
-- Returns the refund row as jsonb. Idempotent on p_idempotency_key.
create or replace function public.refund_reserve(
  p_order_id          uuid,
  p_payment_attempt_id uuid,
  p_amount            numeric,
  p_reason            text,
  p_idempotency_key   text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_attempt      public.payment_attempts;
  v_captured     numeric;
  v_prior        numeric;
  v_refund       public.refunds;
  v_existing     public.refunds;
begin
  -- Trust the server context (service-role edge fn ⇒ auth.uid() is null); when an
  -- authenticated user calls this directly, require ops-admin. Blocks non-admin users.
  if auth.uid() is not null and not public.is_ops_admin() then
    raise exception 'not authorised' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = 'P0001';
  end if;

  -- Idempotent replay.
  if p_idempotency_key is not null then
    select * into v_existing from public.refunds where idempotency_key = p_idempotency_key;
    if found then return to_jsonb(v_existing); end if;
  end if;

  -- Lock the attempt row so concurrent refunds serialize on it.
  select * into v_attempt from public.payment_attempts
    where id = p_payment_attempt_id and order_id = p_order_id
    for update;
  if not found then raise exception 'payment attempt not found' using errcode = 'P0001'; end if;
  if v_attempt.status <> 'captured' then
    raise exception 'can only refund a captured payment' using errcode = 'P0001';
  end if;

  v_captured := v_attempt.amount;

  -- Sum prior non-failed refunds under the same lock → no TOCTOU.
  select coalesce(sum(amount), 0) into v_prior
    from public.refunds
    where order_id = p_order_id and status <> 'failed';

  if v_prior + p_amount > v_captured + 0.001 then
    raise exception 'refund exceeds captured amount (available %.2f)', (v_captured - v_prior)
      using errcode = 'P0001';
  end if;

  insert into public.refunds (order_id, payment_attempt_id, amount, currency, reason, status, idempotency_key, initiated_by)
    values (p_order_id, p_payment_attempt_id, p_amount, v_attempt.currency, p_reason, 'pending', p_idempotency_key, auth.uid())
    returning * into v_refund;

  return to_jsonb(v_refund);
end;$$;

-- refund_confirm — finalize after the gateway responds. On success: update refund +
-- order.payment_status + post the ledger entry, all in one transaction. On failure:
-- mark the refund failed only (order untouched).
create or replace function public.refund_confirm(
  p_refund_id     uuid,
  p_success       boolean,
  p_gateway_ref   text default null,
  p_raw           jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_refund   public.refunds;
  v_captured numeric;
  v_prior    numeric;
  v_txn      uuid;
  v_status   text;
begin
  if auth.uid() is not null and not public.is_ops_admin() then
    raise exception 'not authorised' using errcode = 'P0001';
  end if;

  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'refund not found' using errcode = 'P0001'; end if;
  if v_refund.status = 'refunded' then return to_jsonb(v_refund); end if;   -- idempotent

  if not p_success then
    update public.refunds
      set status = 'failed', gateway_refund_ref = p_gateway_ref, raw_response = p_raw, updated_at = now()
      where id = p_refund_id returning * into v_refund;
    return to_jsonb(v_refund);
  end if;

  -- Success: post a balanced ledger entry (customer_refund debit / platform_cash credit).
  v_txn := gen_random_uuid();
  perform public.post_ledger(v_txn, 'refund', jsonb_build_array(
    jsonb_build_object('account_type','customer_refund','owner_type','customer','owner_id',
      (select customer_id from public.orders where id = v_refund.order_id),
      'debit', v_refund.amount, 'credit', 0, 'ref_table','refunds','ref_id', v_refund.id),
    jsonb_build_object('account_type','platform_cash','owner_type','platform',
      'debit', 0, 'credit', v_refund.amount, 'ref_table','refunds','ref_id', v_refund.id)
  ));

  update public.refunds
    set status = 'refunded', gateway_refund_ref = p_gateway_ref, raw_response = p_raw,
        ledger_txn_id = v_txn, updated_at = now()
    where id = p_refund_id returning * into v_refund;

  -- Order payment_status: full vs partial, computed from the captured amount.
  select amount into v_captured from public.payment_attempts where id = v_refund.payment_attempt_id;
  select coalesce(sum(amount), 0) into v_prior
    from public.refunds where order_id = v_refund.order_id and status <> 'failed';
  v_status := case when v_prior >= v_captured - 0.01 then 'refunded' else 'partially_refunded' end;
  update public.orders set payment_status = v_status where id = v_refund.order_id;

  return to_jsonb(v_refund);
end;$$;

-- Edge functions call these with the service-role client (bypasses RLS); grant to
-- authenticated too so an in-app ops console can drive refunds under is_ops_admin().
-- Phase 9.5 hardening (live security-advisor finding): revoke anon/PUBLIC execute on these
-- money-mutating SECURITY DEFINER functions; only authenticated (ops) + service-role edge fn.
revoke execute on function public.refund_reserve(uuid, uuid, numeric, text, text) from public, anon;
revoke execute on function public.refund_confirm(uuid, boolean, text, jsonb)       from public, anon;
grant  execute on function public.refund_reserve(uuid, uuid, numeric, text, text) to authenticated;
grant  execute on function public.refund_confirm(uuid, boolean, text, jsonb)       to authenticated;
