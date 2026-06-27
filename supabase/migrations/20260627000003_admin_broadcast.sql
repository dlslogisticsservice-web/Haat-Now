-- ─────────────────────────────────────────────────────────────────────────────
-- Admin broadcast — "Send Notification" to an audience (all / customers / drivers
-- / merchants). SECURITY DEFINER + admin-guarded (auth_is_admin). Inserts one
-- notification row per targeted user. Returns the number of recipients.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.broadcast_notification(p_audience text, p_type text, p_message text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer := 0; r integer := 0;
begin
  if not public.auth_is_admin() then
    raise exception 'not_authorized';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'empty_message';
  end if;

  if p_audience in ('customers', 'all') then
    insert into notifications (target_user_id, message, type)
      select id, p_message, coalesce(p_type, 'announcement') from customers;
    get diagnostics r = row_count; n := n + r;
  end if;
  if p_audience in ('drivers', 'all') then
    insert into notifications (target_user_id, message, type)
      select id, p_message, coalesce(p_type, 'announcement') from drivers;
    get diagnostics r = row_count; n := n + r;
  end if;
  if p_audience in ('merchants', 'all') then
    insert into notifications (target_user_id, message, type)
      select owner_user_id, p_message, coalesce(p_type, 'announcement') from merchants where owner_user_id is not null;
    get diagnostics r = row_count; n := n + r;
  end if;

  if p_audience not in ('customers', 'drivers', 'merchants', 'all') then
    raise exception 'invalid_audience';
  end if;

  return n;
end;
$$;

revoke all on function public.broadcast_notification(text, text, text) from public;
grant execute on function public.broadcast_notification(text, text, text) to authenticated;

-- Ordering index for the notification center (target + recency); the column is
-- target_user_id (not user_id). Complements idx_notifications_target_read.
create index if not exists idx_notifications_target_created on public.notifications (target_user_id, created_at desc);
