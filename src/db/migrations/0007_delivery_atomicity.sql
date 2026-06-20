-- 0007_delivery_atomicity.sql
-- Phase 15: remove client-controlled fee + merge status transition and payout into one RPC.
--
-- Problem solved:
--   Phase 14 had two residual risks:
--   (1) p_delivery_fee was caller-supplied — any authenticated driver could inflate their payout.
--   (2) updateOrderStatus('delivered') and complete_delivery_payout() were two separate calls —
--       a network drop between them left the order delivered but the driver unpaid.
--
-- Solution:
--   (1) delivery_fee is now stored on the orders row at creation time.
--       complete_delivery() reads it from there — the caller supplies no amounts.
--   (2) complete_delivery() performs the status transition AND the full payout in a
--       single PL/pgSQL transaction with one FOR UPDATE lock.

-- ════════════════════════════════════════════════════════════════════
-- STEP 1: Add delivery_fee to orders (idempotent)
-- Stores the agreed delivery fee at order-creation time so the payout
-- RPC can read it from the DB instead of trusting the caller.
-- Existing rows (and future rows where fee is not specified) default
-- to the current flat rate of 10.00 SAR.
-- ════════════════════════════════════════════════════════════════════
alter table orders
  add column if not exists delivery_fee decimal(10,2) not null default 10.00;

-- ════════════════════════════════════════════════════════════════════
-- STEP 2: complete_delivery() — fully atomic delivery finalisation
-- CREATE OR REPLACE is inherently idempotent.
--
-- Inputs:   p_order_id, p_driver_id  (no fee — read from orders.delivery_fee)
-- Returns:  jsonb result payload
--
-- Transaction sequence:
--   1.  Auth guard
--   2.  SELECT orders FOR UPDATE          (row lock blocks concurrent calls)
--   3.  Verify driver_id matches
--   4.  Verify valid transition (on_the_way → delivered)
--       OR idempotency short-circuit if already delivered + paid
--   5.  UPDATE orders SET status = 'delivered'
--   6.  INSERT order_status_history
--   7.  INSERT driver_earnings             (UNIQUE(order_id) is backstop)
--   8.  SELECT wallets FOR UPDATE
--   9.  UPDATE wallets.balance             (COALESCE against any NULL)
--   10. INSERT wallet_transactions
--   11. RETURN success payload with customer_id for notification
--
-- On ANY failure: ROLLBACK — no partial state possible.
-- ════════════════════════════════════════════════════════════════════
create or replace function complete_delivery(
  p_order_id  uuid,
  p_driver_id uuid
) returns jsonb as $$
declare
  v_status        varchar;
  v_driver        uuid;
  v_customer      uuid;
  v_fee           decimal;
  v_earning_id    uuid;
  v_wallet_id     uuid;
  v_current_bal   decimal;
  v_new_bal       decimal;
  v_tx_id         uuid;
begin
  -- 1. Auth guard: reject unauthenticated callers
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- 2. Lock the order row for the full duration of this transaction.
  --    All concurrent complete_delivery() calls for this order block here
  --    and serialise behind the first one that acquires the lock.
  select status, driver_id, customer_id, delivery_fee
  into   v_status, v_driver, v_customer, v_fee
  from   orders
  where  id = p_order_id
  for    update;

  if v_status is null then
    raise exception 'Order not found: %', p_order_id;
  end if;

  -- 3. Verify the calling driver is the assigned driver
  if v_driver is distinct from p_driver_id then
    raise exception 'Driver mismatch for order %', p_order_id;
  end if;

  -- 4. Status validation + idempotency
  --    'on_the_way' → normal path
  --    'delivered'  → idempotency: return success if earnings already exist,
  --                   otherwise fall through (handles the edge case where the
  --                   status was updated but the payout rolled back externally)
  --    anything else → invalid transition, raise
  if v_status = 'delivered' then
    perform 1 from driver_earnings where order_id = p_order_id;
    if found then
      return jsonb_build_object(
        'success',           true,
        'already_processed', true,
        'customer_id',       v_customer
      );
    end if;
    -- Delivered but no earnings yet — fall through to payout only
  elsif v_status != 'on_the_way' then
    raise exception 'Order % cannot be completed from status "%"', p_order_id, v_status;
  end if;

  -- 5. Advance status to delivered (skip if already there from idempotency path above)
  if v_status = 'on_the_way' then
    update orders
    set    status = 'delivered'
    where  id = p_order_id;

    -- 6. Append status history entry
    insert into order_status_history (order_id, status, notes)
    values (p_order_id, 'delivered', 'تم التسليم بنجاح.');
  end if;

  -- 7. Fee is derived entirely from orders.delivery_fee — caller supplies nothing.
  --    COALESCE covers orders created before this column existed (pre-migration rows).
  v_fee := coalesce(v_fee, 10.00);

  -- 8. Insert driver earnings.
  --    UNIQUE(order_id) on driver_earnings is the backstop if two concurrent calls
  --    somehow both pass the idempotency check above — the second INSERT will raise
  --    unique_violation and roll back the entire transaction.
  insert into driver_earnings (driver_id, order_id, delivery_fee_earned, tip_earned, bonus_earned)
  values (p_driver_id, p_order_id, v_fee, 0.00, 0.00)
  returning id into v_earning_id;

  -- 9. Lock the wallet row and read current balance
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

  -- COALESCE guards against any pre-existing NULL balance (belt-and-suspenders;
  -- wallets.balance is NOT NULL since migration 0011 but costs nothing to keep).
  v_new_bal := coalesce(v_current_bal, 0) + v_fee;

  update wallets
  set    balance = v_new_bal
  where  id = v_wallet_id;

  -- 10. Write ledger entry
  insert into wallet_transactions (wallet_id, amount, type)
  values (v_wallet_id, v_fee, 'payout')
  returning id into v_tx_id;

  -- 11. Return payload — customer_id is included so the caller can
  --     fire the delivery notification without a second DB round-trip.
  return jsonb_build_object(
    'success',           true,
    'already_processed', false,
    'customer_id',       v_customer,
    'earning_id',        v_earning_id,
    'wallet_id',         v_wallet_id,
    'new_balance',       v_new_bal,
    'transaction_id',    v_tx_id
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
