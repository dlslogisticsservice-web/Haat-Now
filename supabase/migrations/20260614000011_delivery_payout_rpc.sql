-- 0011_delivery_payout_rpc.sql
-- Atomic server-side driver payout: earnings + wallet credit + ledger entry in ONE transaction.
-- Replaces the three-step client-side flow that was vulnerable to TOCTOU races.
-- Phase 14.2: patched for full idempotency, COALESCE null-safety, wallet NOT NULL hardening.

-- ════════════════════════════════════════════════════════════════════
-- STEP 1: Harden wallets.balance (idempotent)
-- Zero any NULL balances first, then lock the column as NOT NULL.
-- Safe on re-run: UPDATE affects 0 rows when no NULLs exist; DO block
-- skips the ALTER when the column is already NOT NULL.
-- ════════════════════════════════════════════════════════════════════
update wallets set balance = 0 where balance is null;

do $idempotent_not_null$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'wallets'
      and column_name  = 'balance'
      and is_nullable  = 'YES'
  ) then
    alter table wallets alter column balance set not null;
  end if;
end;
$idempotent_not_null$;

-- ════════════════════════════════════════════════════════════════════
-- STEP 2: Database-level duplicate protection on driver_earnings (idempotent)
-- DO block skips the ADD CONSTRAINT when it already exists, so re-runs
-- succeed without error.
-- ════════════════════════════════════════════════════════════════════
do $idempotent_unique$
begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'driver_earnings_order_id_unique'
      and conrelid = 'public.driver_earnings'::regclass
  ) then
    alter table driver_earnings
      add constraint driver_earnings_order_id_unique unique (order_id);
  end if;
end;
$idempotent_unique$;

-- ════════════════════════════════════════════════════════════════════
-- STEP 3: Atomic delivery payout RPC
-- CREATE OR REPLACE is inherently idempotent.
--
-- complete_delivery_payout() wraps all financial writes in a single
-- PL/pgSQL transaction:
--   1. Verify order exists and is delivered       (row-locked FOR UPDATE)
--   2. Verify calling driver matches order.driver_id
--   3. Idempotency check: return early if already processed
--   4. INSERT driver_earnings                     (unique constraint is backstop)
--   5. Lock wallet row FOR UPDATE, UPDATE balance
--   6. INSERT wallet_transactions ledger entry
-- Any failure causes ROLLBACK of the entire unit — no partial state.
-- ════════════════════════════════════════════════════════════════════
create or replace function complete_delivery_payout(
  p_order_id     uuid,
  p_driver_id    uuid,
  p_delivery_fee decimal default 10.00
) returns jsonb as $$
declare
  v_order_status  varchar;
  v_order_driver  uuid;
  v_earning_id    uuid;
  v_wallet_id     uuid;
  v_current_bal   decimal;
  v_new_bal       decimal;
  v_tx_id         uuid;
begin
  -- Auth guard: reject unauthenticated callers
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- 1. Lock the order row for the duration of this transaction.
  --    Concurrent calls block here until the first one commits or rolls back.
  select status, driver_id
  into   v_order_status, v_order_driver
  from   orders
  where  id = p_order_id
  for    update;

  if v_order_status is null then
    raise exception 'Order not found: %', p_order_id;
  end if;

  -- 2. Verify the order is in delivered state
  if v_order_status != 'delivered' then
    raise exception 'Order % is not delivered (status: %)', p_order_id, v_order_status;
  end if;

  -- 3. Verify the calling driver is the assigned driver
  if v_order_driver is distinct from p_driver_id then
    raise exception 'Driver mismatch for order %', p_order_id;
  end if;

  -- 4. Idempotency check — return success without re-processing if already done.
  --    The unique constraint on driver_earnings(order_id) is a second line of defence
  --    against concurrent calls that both pass this check before either inserts.
  perform 1 from driver_earnings where order_id = p_order_id;
  if found then
    return jsonb_build_object('success', true, 'already_processed', true);
  end if;

  -- 5. Insert the earnings record.
  --    If a concurrent call slipped through the idempotency check above, the
  --    unique constraint raises unique_violation which rolls back this transaction.
  insert into driver_earnings (driver_id, order_id, delivery_fee_earned, tip_earned, bonus_earned)
  values (p_driver_id, p_order_id, p_delivery_fee, 0.00, 0.00)
  returning id into v_earning_id;

  -- 6. Lock and update the wallet row.
  select id, balance
  into   v_wallet_id, v_current_bal
  from   wallets
  where  owner_type = 'driver' and owner_id = p_driver_id
  for    update;

  -- Auto-create wallet if driver has never been paid before
  if v_wallet_id is null then
    insert into wallets (owner_type, owner_id, balance)
    values ('driver', p_driver_id, 0.00)
    returning id, balance into v_wallet_id, v_current_bal;
  end if;

  -- COALESCE guards against any pre-existing NULL balance (Phase 14.2 fix).
  -- wallets.balance is now NOT NULL (enforced above), but this defence-in-depth
  -- guard costs nothing and protects against any future schema drift.
  v_new_bal := coalesce(v_current_bal, 0) + p_delivery_fee;

  update wallets
  set    balance = v_new_bal
  where  id = v_wallet_id;

  -- 7. Write ledger entry
  insert into wallet_transactions (wallet_id, amount, type)
  values (v_wallet_id, p_delivery_fee, 'payout')
  returning id into v_tx_id;

  return jsonb_build_object(
    'success',           true,
    'already_processed', false,
    'earning_id',        v_earning_id,
    'wallet_id',         v_wallet_id,
    'new_balance',       v_new_bal,
    'transaction_id',    v_tx_id
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ════════════════════════════════════════════════════════════════════
-- STEP 4: Wallet consistency audit view
-- CREATE OR REPLACE is inherently idempotent.
-- Lets admins detect drift between wallets.balance and the ledger sum.
-- Run: SELECT * FROM wallet_balance_audit WHERE drift <> 0;
-- ════════════════════════════════════════════════════════════════════
create or replace view wallet_balance_audit as
select
  w.id,
  w.owner_type,
  w.owner_id,
  w.balance                                          as recorded_balance,
  coalesce(sum(
    case when wt.type in ('deposit', 'payout', 'payment_refund')
         then wt.amount
         else -wt.amount
    end
  ), 0)                                              as computed_balance,
  w.balance - coalesce(sum(
    case when wt.type in ('deposit', 'payout', 'payment_refund')
         then wt.amount
         else -wt.amount
    end
  ), 0)                                              as drift
from wallets w
left join wallet_transactions wt on wt.wallet_id = w.id
group by w.id, w.owner_type, w.owner_id, w.balance;
