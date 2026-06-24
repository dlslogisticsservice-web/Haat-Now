-- ════════════════════════════════════════════════════════════════════════════
-- Pre-E5B hardening — review idempotency.
-- One review per (order, target). submit_review upserts (re-callable, no dupes).
-- Verified pre-apply: 0 duplicate (order_id,target_type,target_id) groups, 0 NULL targets.
-- Standard UNIQUE (NULLS DISTINCT) — legacy NULL-target rows (none today) never conflict.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass and conname = 'reviews_order_target_uniq'
  ) then
    alter table public.reviews
      add constraint reviews_order_target_uniq unique (order_id, target_type, target_id);
  end if;
end$$;

-- Idempotent submit_review: upsert on the unique key (re-submitting updates the rating/comment).
create or replace function public.submit_review(p_order_id uuid, p_target_type text, p_target_id uuid, p_rating int, p_comment text default null)
returns public.reviews language plpgsql security definer set search_path=public as $$
declare v public.reviews;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5' using errcode='P0001'; end if;
  insert into public.reviews(order_id, customer_id, target_type, target_id, rating, comment, status)
    values (p_order_id, auth.uid(), p_target_type, p_target_id, p_rating, p_comment, 'approved')
  on conflict (order_id, target_type, target_id) do update
    set rating = excluded.rating, comment = excluded.comment, status = 'approved'
  returning * into v;
  -- keep drivers.rating as the live average of approved driver reviews
  if p_target_type = 'driver' and p_target_id is not null then
    update public.drivers set rating = (
      select round(avg(rating)::numeric, 2) from public.reviews
      where target_type = 'driver' and target_id = p_target_id and status = 'approved')
    where id = p_target_id;
  end if;
  return v;
end;
$$;
