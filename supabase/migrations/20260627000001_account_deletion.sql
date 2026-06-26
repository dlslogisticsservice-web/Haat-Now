-- ─────────────────────────────────────────────────────────────────────────────
-- Account self-deletion (Apple Guideline 5.1.1(v) + Google Play data-deletion).
-- A SECURITY DEFINER RPC the signed-in user calls to erase their own account.
-- GDPR right-to-erasure approach: ANONYMIZE profile rows that are referenced by
-- transactional/financial records (orders, settlements) — which erasure permits —
-- HARD-DELETE pure personal-data rows (addresses, push tokens, reviews), then
-- remove the auth identity so the account can never sign in again.
-- Additive & idempotent (create or replace). No existing table altered.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.delete_my_account()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Anonymize PII on profile rows referenced by transactional data (kept for accounting/audit).
  update public.customers
     set full_name = 'Deleted user', phone_number = null, email = null, avatar_url = null
   where id = uid;

  update public.drivers
     set full_name = 'Deleted driver', phone_number = null,
         national_id_number = null, license_number = null, vehicle_plate = null
   where id = uid or owner_user_id = uid;

  update public.merchants
     set business_name = 'Deleted merchant', contact_email = null, contact_phone = null,
         tax_number = null, commercial_registration_number = null
   where owner_user_id = uid;

  -- Hard-delete pure personal-data rows (not needed for financial integrity).
  delete from public.addresses   where customer_id = uid;
  delete from public.push_tokens where user_id = uid;
  delete from public.reviews     where customer_id = uid;

  -- Remove the auth identity (revokes all future sign-in).
  delete from auth.users where id = uid;

  return json_build_object('deleted', true, 'user_id', uid);
end;
$$;

-- Only an authenticated user may delete THEIR OWN account (uid is derived from the JWT, not args).
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
