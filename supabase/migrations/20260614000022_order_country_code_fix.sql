-- ─────────────────────────────────────────────────────────────────────────────
-- 20260614000022_order_country_code_fix.sql
-- Convert order_country_code to SECURITY DEFINER to (a) fix prosecdef=false and
-- (b) prevent infinite RLS recursion: the function is referenced inside the
-- "Admins read orders by scope" policy ON orders. As SECURITY INVOKER its internal
-- `select ... from orders` re-triggers that same policy → recursion. As DEFINER it
-- runs as the owner and BYPASSES RLS on its internal read → no recursion.
-- Signature is taken verbatim from 0018. Idempotent (create or replace).
-- NOT executed here — prepared for the P0 recovery cutover.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.order_country_code(p_order_id uuid) returns varchar
  language sql stable security definer set search_path = public as $$
  select co.code
  from orders o
  join merchant_branches mb on mb.id = o.branch_id
  join zones z              on z.id  = mb.zone_id
  join cities ci            on ci.id = z.city_id
  join countries co         on co.id = ci.country_id
  where o.id = p_order_id;
$$;

revoke all on function public.order_country_code(uuid) from public;
grant execute on function public.order_country_code(uuid) to authenticated;

-- Verify: select proname, prosecdef from pg_proc where proname='order_country_code';  -- expect prosecdef = t
