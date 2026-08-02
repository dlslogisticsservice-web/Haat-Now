-- ════════════════════════════════════════════════════════════════════════════
-- FINAL CRITICAL REMEDIATION — eliminates the two confirmed Red Team findings from
-- docs/security/FINAL_INDEPENDENT_RED_TEAM_REPORT.md:
--   N-2 (CRITICAL) referral subsystem — unauthenticated wallet minting
--   N-1 (MEDIUM)   driver KYC/PII over-exposure to the ordering customer
-- Scope is strictly these two. No unrelated systems, no previously-secured modules touched.
-- Idempotent. Detection model matches prior passes (client = current_user in authenticated/anon;
-- DEFINER RPCs & the delivery trigger run as owner and pass through).
-- ════════════════════════════════════════════════════════════════════════════

-- ══ N-2 — referral subsystem hardening ══════════════════════════════════════════════════════

-- (1)(2) generate_referral_code: a direct client may mint ONLY its own customer code, and the
-- reward amounts are SERVER-controlled (client-supplied values are ignored). Internal callers
-- (create_affiliate/create_influencer, run as owner) keep their trusted arguments.
create or replace function public.generate_referral_code(
  p_owner_type text, p_owner_id uuid, p_reward_referrer numeric default 10, p_reward_referee numeric default 10)
returns referral_codes language plpgsql security definer set search_path = public, pg_temp as $function$
declare v public.referral_codes; v_code text;
begin
  -- Non-admins (i.e. ordinary clients) may mint ONLY their own customer code and NEVER control
  -- the reward amounts. Gate on is_ops_admin() (not current_user) because this is a SECURITY
  -- DEFINER function — inside it current_user is the owner, so it cannot distinguish a client;
  -- auth.uid()/is_ops_admin() read the request JWT and remain accurate. The admin-only internal
  -- callers (create_affiliate/create_influencer) pass is_ops_admin() and keep their arguments.
  if not public.is_ops_admin() then
    if p_owner_type <> 'customer' or p_owner_id is distinct from auth.uid() then
      raise exception 'permission denied' using errcode = '42501';
    end if;
    p_reward_referrer := 15;   -- server-controlled; client values discarded
    p_reward_referee  := 10;
  end if;
  select * into v from public.referral_codes where owner_type=p_owner_type and owner_id=p_owner_id limit 1;
  if found then return v; end if;
  v_code := upper(substr(md5(p_owner_id::text || clock_timestamp()::text), 1, 8));
  insert into public.referral_codes(owner_type,owner_id,code,reward_referrer,reward_referee)
    values (p_owner_type,p_owner_id,v_code,p_reward_referrer,p_reward_referee) returning * into v;
  return v;
end;$function$;

-- (3) apply_referral_code: a client may only apply a code for THEMSELVES (referee = auth.uid()).
create or replace function public.apply_referral_code(p_code text, p_referee uuid)
returns referrals language plpgsql security definer set search_path = public, pg_temp as $function$
declare c public.referral_codes; v public.referrals;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = 'P0001'; end if;
  if p_referee is distinct from auth.uid() and not public.is_ops_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into c from public.referral_codes where upper(code)=upper(p_code) and is_active for update;
  if not found then raise exception 'invalid referral code' using errcode = 'P0001'; end if;
  if c.max_uses <> 0 and c.used_count >= c.max_uses then raise exception 'referral code exhausted' using errcode = 'P0001'; end if;
  if c.owner_id = p_referee then raise exception 'cannot refer yourself' using errcode = 'P0001'; end if;
  if exists (select 1 from public.referrals where referee_id=p_referee) then raise exception 'already referred' using errcode = 'P0001'; end if;
  insert into public.referrals(code_id,referrer_owner_type,referrer_id,referee_id,reward_referrer,reward_referee)
    values (c.id,c.owner_type,c.owner_id,p_referee,c.reward_referrer,c.reward_referee) returning * into v;
  update public.referral_codes set used_count=used_count+1 where id=c.id;
  return v;
end;$function$;

-- (4)(5)(6) qualify_referral: NEVER client-callable — only trusted backend/service (or ops).
-- Validates the qualifying order (exists, belongs to referee, PAID, DELIVERED) and is idempotent
-- (a single pending referral per referee is rewarded exactly once).
create or replace function public.qualify_referral(p_referee uuid, p_order_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
declare r public.referrals; o record;
begin
  if current_user in ('authenticated','anon') and not public.is_ops_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select customer_id, status, payment_status into o from public.orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'P0001'; end if;
  if o.customer_id is distinct from p_referee then raise exception 'order does not belong to referee' using errcode = 'P0001'; end if;
  if o.payment_status <> 'paid' then raise exception 'order not paid' using errcode = 'P0001'; end if;
  if o.status <> 'delivered' then raise exception 'order not delivered' using errcode = 'P0001'; end if;

  select * into r from public.referrals where referee_id=p_referee and status='pending' for update;
  if not found then return; end if;   -- idempotent: no pending referral ⇒ already rewarded / none
  update public.referrals set status='rewarded', order_id=p_order_id, qualified_at=now() where id=r.id;

  perform public.credit_customer_wallet(p_referee, r.reward_referee, 'referral_bonus');
  if r.referrer_owner_type='customer' then
    perform public.credit_customer_wallet(r.referrer_id, r.reward_referrer, 'referral_reward');
  elsif r.referrer_owner_type='affiliate' then
    update public.affiliates set total_referred=total_referred+1, total_earned=total_earned+r.reward_referrer where code_id=r.code_id;
  elsif r.referrer_owner_type='influencer' then
    update public.influencers set total_referred=total_referred+1, total_earned=total_earned+r.reward_referrer where code_id=r.code_id;
  end if;
end;$function$;

-- Server-driven qualification: fires only when an order becomes PAID + DELIVERED. Runs as owner
-- (SECURITY DEFINER) so it passes qualify_referral's service-only gate; never blocks the order.
create or replace function public.trg_qualify_referral_on_delivery()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $function$
begin
  if new.status = 'delivered' and new.payment_status = 'paid'
     and (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status) then
    begin
      perform public.qualify_referral(new.customer_id, new.id);
    exception when others then null;
    end;
  end if;
  return new;
end;$function$;
drop trigger if exists qualify_referral_on_delivery on public.orders;
create trigger qualify_referral_on_delivery after update on public.orders
  for each row execute function public.trg_qualify_referral_on_delivery();

-- (7) Revoke the client/anon surface. generate/apply stay callable by the authenticated owner;
-- qualify becomes service-only (the delivery trigger runs as owner and is unaffected).
revoke execute on function public.generate_referral_code(text, uuid, numeric, numeric) from anon, public;
revoke execute on function public.apply_referral_code(text, uuid)                       from anon, public;
revoke execute on function public.qualify_referral(uuid, uuid)                          from anon, public, authenticated;

-- ══ N-1 — driver KYC/PII: public-safe projection, KYC hidden ════════════════════════════════
-- Remove the full-row order-scoped customer read of `drivers` (which exposed national_id/license),
-- and serve customers a safe projection scoped to the same relationship (self / owner / ops /
-- driver-of-my-order). KYC + internal identifiers + owner are never exposed.
drop policy if exists "Read drivers" on public.drivers;

drop view if exists public.drivers_public;
create view public.drivers_public with (security_invoker = false) as
  select d.id, d.full_name, d.vehicle_id, d.vehicle_plate,
         d.rating, d.status, d.is_online, d.current_lat, d.current_lng
  from public.drivers d
  where d.id = auth.uid()
     or (d.owner_user_id is not null and d.owner_user_id = auth.uid())
     or public.is_ops_admin()
     or exists (select 1 from public.orders o where o.driver_id = d.id and o.customer_id = auth.uid());
grant select on public.drivers_public to authenticated;
