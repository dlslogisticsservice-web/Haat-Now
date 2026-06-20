-- 0003_wallet_atomic_rpc.sql
-- Create database-side atomic wallet adjustment RPC to lock rows and prevent race conditions

create or replace function adjust_wallet_balance(
  p_owner_type varchar,
  p_owner_id uuid,
  p_amount decimal,
  p_type varchar
) returns jsonb as $$
declare
  v_wallet_id uuid;
  v_current_balance decimal;
  v_new_balance decimal;
  v_new_tx_id uuid;
  v_result jsonb;
begin
  -- SECURITY: block unauthenticated callers (no valid Supabase Auth session)
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- 1. Try to lock the wallet row for update
  select id, balance into v_wallet_id, v_current_balance
  from wallets
  where owner_type = p_owner_type and owner_id = p_owner_id
  for update;

  -- 2. Create the wallet if it doesn't already exist
  if v_wallet_id is null then
    insert into wallets (owner_type, owner_id, balance)
    values (p_owner_type, p_owner_id, 0.00)
    returning id, balance into v_wallet_id, v_current_balance;
  end if;

  -- 3. Check for sufficient balance on debit requests
  v_new_balance := v_current_balance + p_amount;
  if v_new_balance < 0 then
    raise exception 'رصيد المحفظة غير كافٍ لإجراء هذه العملية';
  end if;

  -- 4. Update the wallet balance atomically inside transaction
  update wallets
  set balance = v_new_balance
  where id = v_wallet_id;

  -- 5. Insert ledger entry for credit/debit
  insert into wallet_transactions (wallet_id, amount, type)
  values (v_wallet_id, abs(p_amount), p_type)
  returning id into v_new_tx_id;

  -- 6. Construct result object
  v_result := jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'new_balance', v_new_balance,
    'transaction_id', v_new_tx_id
  );

  return v_result;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
