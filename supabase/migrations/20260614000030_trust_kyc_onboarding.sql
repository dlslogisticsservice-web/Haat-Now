-- ════════════════════════════════════════════════════════════════════════════
-- PHASE E1 — TRUST, KYC & SUPPLY ONBOARDING
-- Self-registration + document upload + KYC review + approve/reject/suspend/ban,
-- with a full audit trail. Entities: merchant | driver.
-- All state transitions go through SECURITY DEFINER RPCs that write approval_history.
-- Idempotent. RLS: applicants see/own their application; ops-admins manage all.
-- ════════════════════════════════════════════════════════════════════════════

-- ── onboarding columns on the entity tables ─────────────────────────────────
alter table public.merchants
  add column if not exists owner_user_id uuid,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists tax_number text,
  add column if not exists commercial_registration_number text,
  add column if not exists business_type text,
  add column if not exists address text,
  add column if not exists submitted_at timestamptz;
create index if not exists idx_merchants_owner on public.merchants(owner_user_id);

alter table public.drivers
  add column if not exists owner_user_id uuid,
  add column if not exists national_id_number text,
  add column if not exists license_number text,
  add column if not exists license_expiry date,
  add column if not exists vehicle_plate text,
  add column if not exists submitted_at timestamptz;
create index if not exists idx_drivers_owner on public.drivers(owner_user_id);

-- ════════════ ENTITIES ════════════
-- Current lifecycle status of each merchant/driver (one row per entity).
create table if not exists public.account_status (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('merchant','driver')),
  entity_id uuid not null,
  status text not null default 'pending'
     check (status in ('pending','under_review','approved','rejected','suspended','banned')),
  reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (entity_type, entity_id)
);
create index if not exists idx_account_status_lookup on public.account_status(entity_type, status);

-- The KYC review queue: one submission record per onboarding attempt.
create table if not exists public.kyc_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('merchant','driver')),
  entity_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid,
  decision_notes text
);
create index if not exists idx_kyc_reviews_status on public.kyc_reviews(status, submitted_at);

-- Document metadata (files live in the private 'kyc-documents' storage bucket).
create table if not exists public.merchant_documents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  doc_type text not null check (doc_type in ('commercial_registration','tax_certificate','business_license','owner_id','other')),
  file_path text not null,
  file_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists idx_merchant_docs on public.merchant_documents(merchant_id, status);

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  doc_type text not null check (doc_type in ('driver_license','national_id','vehicle_registration','insurance','other')),
  file_path text not null,
  file_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists idx_driver_docs on public.driver_documents(driver_id, status);

-- Immutable audit trail of every status transition.
create table if not exists public.approval_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('merchant','driver')),
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  action text not null,            -- submitted | approved | rejected | suspended | lifted | banned
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_approval_history on public.approval_history(entity_type, entity_id, created_at desc);

create table if not exists public.suspensions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('merchant','driver')),
  entity_id uuid not null,
  reason text,
  suspended_by uuid,
  suspended_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid,
  is_active boolean not null default true
);
create index if not exists idx_suspensions_active on public.suspensions(entity_type, entity_id, is_active);

create table if not exists public.bans (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('merchant','driver')),
  entity_id uuid not null,
  reason text,
  banned_by uuid,
  banned_at timestamptz not null default now(),
  is_active boolean not null default true
);
create index if not exists idx_bans_active on public.bans(entity_type, entity_id, is_active);

-- ════════════ PRIVATE STORAGE BUCKET for KYC documents ════════════
insert into storage.buckets (id, name, public) values ('kyc-documents','kyc-documents', false)
  on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- RPCs — applicant submission + admin review. All write approval_history.
-- ════════════════════════════════════════════════════════════════════════════

-- helper: log a transition
create or replace function public.log_approval(p_type text, p_id uuid, p_from text, p_to text, p_action text, p_reason text)
returns void language sql security definer set search_path=public as $$
  insert into public.approval_history(entity_type,entity_id,from_status,to_status,action,actor_id,reason)
  values (p_type,p_id,p_from,p_to,p_action,auth.uid(),p_reason);
$$;

-- MERCHANT self-registration → pending review
create or replace function public.submit_merchant_application(
  p_business_name text, p_contact_email text, p_contact_phone text,
  p_tax_number text default null, p_cr_number text default null,
  p_business_type text default null, p_address text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  insert into public.merchants(business_name, owner_user_id, contact_email, contact_phone,
    tax_number, commercial_registration_number, business_type, address, submitted_at)
  values (p_business_name, auth.uid(), p_contact_email, p_contact_phone,
    p_tax_number, p_cr_number, p_business_type, p_address, now())
  returning id into v_id;
  insert into public.account_status(entity_type,entity_id,status,updated_by) values ('merchant',v_id,'pending',auth.uid());
  insert into public.kyc_reviews(entity_type,entity_id,status) values ('merchant',v_id,'pending');
  perform public.log_approval('merchant',v_id,null,'pending','submitted',null);
  return v_id;
end;$$;

-- DRIVER self-registration → pending review
create or replace function public.submit_driver_application(
  p_full_name text, p_phone text, p_national_id text default null,
  p_license_number text default null, p_license_expiry date default null,
  p_vehicle_plate text default null, p_vehicle_id uuid default null, p_zone_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  insert into public.drivers(full_name, phone_number, owner_user_id, national_id_number,
    license_number, license_expiry, vehicle_plate, vehicle_id, zone_id, status, is_online, submitted_at)
  values (p_full_name, p_phone, auth.uid(), p_national_id, p_license_number, p_license_expiry,
    p_vehicle_plate, p_vehicle_id, p_zone_id, 'offline', false, now())
  returning id into v_id;
  insert into public.account_status(entity_type,entity_id,status,updated_by) values ('driver',v_id,'pending',auth.uid());
  insert into public.kyc_reviews(entity_type,entity_id,status) values ('driver',v_id,'pending');
  perform public.log_approval('driver',v_id,null,'pending','submitted',null);
  return v_id;
end;$$;

-- ADMIN: KYC decision (approve / reject)
create or replace function public.review_kyc(p_entity_type text, p_entity_id uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_from text;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'decision must be approved|rejected'; end if;
  select status into v_from from public.account_status where entity_type=p_entity_type and entity_id=p_entity_id;
  update public.account_status set status=p_decision, reason=p_notes, updated_at=now(), updated_by=auth.uid()
    where entity_type=p_entity_type and entity_id=p_entity_id;
  update public.kyc_reviews set status=p_decision, reviewed_at=now(), reviewer_id=auth.uid(), decision_notes=p_notes
    where entity_type=p_entity_type and entity_id=p_entity_id and status='pending';
  perform public.log_approval(p_entity_type,p_entity_id,v_from,p_decision,p_decision,p_notes);
end;$$;

-- ADMIN: suspend / lift / ban
create or replace function public.suspend_entity(p_entity_type text, p_entity_id uuid, p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_from text;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  select status into v_from from public.account_status where entity_type=p_entity_type and entity_id=p_entity_id;
  update public.account_status set status='suspended', reason=p_reason, updated_at=now(), updated_by=auth.uid()
    where entity_type=p_entity_type and entity_id=p_entity_id;
  insert into public.suspensions(entity_type,entity_id,reason,suspended_by) values (p_entity_type,p_entity_id,p_reason,auth.uid());
  perform public.log_approval(p_entity_type,p_entity_id,v_from,'suspended','suspended',p_reason);
end;$$;

create or replace function public.lift_suspension(p_entity_type text, p_entity_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  update public.suspensions set is_active=false, lifted_at=now(), lifted_by=auth.uid()
    where entity_type=p_entity_type and entity_id=p_entity_id and is_active;
  update public.account_status set status='approved', reason=null, updated_at=now(), updated_by=auth.uid()
    where entity_type=p_entity_type and entity_id=p_entity_id;
  perform public.log_approval(p_entity_type,p_entity_id,'suspended','approved','lifted',null);
end;$$;

create or replace function public.ban_entity(p_entity_type text, p_entity_id uuid, p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_from text;
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  select status into v_from from public.account_status where entity_type=p_entity_type and entity_id=p_entity_id;
  update public.account_status set status='banned', reason=p_reason, updated_at=now(), updated_by=auth.uid()
    where entity_type=p_entity_type and entity_id=p_entity_id;
  insert into public.bans(entity_type,entity_id,reason,banned_by) values (p_entity_type,p_entity_id,p_reason,auth.uid());
  perform public.log_approval(p_entity_type,p_entity_id,v_from,'banned','banned',p_reason);
end;$$;

-- ADMIN: review a single document
create or replace function public.review_document(p_entity_type text, p_doc_id uuid, p_status text, p_notes text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_ops_admin() then raise exception 'not authorised' using errcode='P0001'; end if;
  if p_status not in ('approved','rejected') then raise exception 'status must be approved|rejected'; end if;
  if p_entity_type='merchant' then
    update public.merchant_documents set status=p_status, notes=p_notes, reviewed_at=now(), reviewed_by=auth.uid() where id=p_doc_id;
  else
    update public.driver_documents set status=p_status, notes=p_notes, reviewed_at=now(), reviewed_by=auth.uid() where id=p_doc_id;
  end if;
end;$$;

grant execute on function public.submit_merchant_application(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.submit_driver_application(text,text,text,text,date,text,uuid,uuid) to authenticated;
grant execute on function public.review_kyc(text,uuid,text,text) to authenticated;
grant execute on function public.suspend_entity(text,uuid,text) to authenticated;
grant execute on function public.lift_suspension(text,uuid) to authenticated;
grant execute on function public.ban_entity(text,uuid,text) to authenticated;
grant execute on function public.review_document(text,uuid,text,text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════
alter table public.account_status   enable row level security;
alter table public.kyc_reviews      enable row level security;
alter table public.merchant_documents enable row level security;
alter table public.driver_documents enable row level security;
alter table public.approval_history enable row level security;
alter table public.suspensions      enable row level security;
alter table public.bans             enable row level security;

-- applicant ownership helpers via subquery; admins via is_ops_admin()
drop policy if exists merchant_documents_own on public.merchant_documents;
create policy merchant_documents_own on public.merchant_documents for all to authenticated
  using (public.is_ops_admin() or exists (select 1 from public.merchants m where m.id=merchant_id and m.owner_user_id=auth.uid()))
  with check (public.is_ops_admin() or exists (select 1 from public.merchants m where m.id=merchant_id and m.owner_user_id=auth.uid()));

drop policy if exists driver_documents_own on public.driver_documents;
create policy driver_documents_own on public.driver_documents for all to authenticated
  using (public.is_ops_admin() or exists (select 1 from public.drivers d where d.id=driver_id and d.owner_user_id=auth.uid()))
  with check (public.is_ops_admin() or exists (select 1 from public.drivers d where d.id=driver_id and d.owner_user_id=auth.uid()));

-- status / review / history / suspensions / bans: owner reads own, admin all; writes admin-only (RPCs are DEFINER)
do $$
declare t text;
begin
  foreach t in array array['account_status','kyc_reviews','approval_history','suspensions','bans'] loop
    execute format($f$drop policy if exists %1$s_read on public.%1$s$f$, t);
    execute format($f$create policy %1$s_read on public.%1$s for select to authenticated using (
        public.is_ops_admin()
        or (entity_type='merchant' and exists (select 1 from public.merchants m where m.id=entity_id and m.owner_user_id=auth.uid()))
        or (entity_type='driver'   and exists (select 1 from public.drivers d   where d.id=entity_id and d.owner_user_id=auth.uid())))$f$, t);
    execute format($f$drop policy if exists %1$s_admin_write on public.%1$s$f$, t);
    execute format($f$create policy %1$s_admin_write on public.%1$s for all to authenticated using (public.is_ops_admin()) with check (public.is_ops_admin())$f$, t);
  end loop;
end$$;

-- ── storage RLS for the private kyc-documents bucket (folder = <auth uid>/...) ──
drop policy if exists kyc_own_rw on storage.objects;
create policy kyc_own_rw on storage.objects for all to authenticated
  using (bucket_id='kyc-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_ops_admin()))
  with check (bucket_id='kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── table grants for the authenticated role (this project grants per-table; new
--    tables are not auto-granted). Row access is still gated by the RLS policies above;
--    DEFINER RPCs bypass these grants. ──
grant select, insert, update on public.merchant_documents to authenticated;
grant select, insert, update on public.driver_documents   to authenticated;
grant select, insert, update on public.account_status     to authenticated;
grant select, insert, update on public.kyc_reviews        to authenticated;
grant select                  on public.approval_history  to authenticated;
grant select, insert, update on public.suspensions        to authenticated;
grant select, insert, update on public.bans               to authenticated;

-- ════════════ backfill: existing seeded merchants/drivers are pre-approved ════════════
insert into public.account_status(entity_type,entity_id,status)
  select 'merchant', id, 'approved' from public.merchants on conflict (entity_type,entity_id) do nothing;
insert into public.account_status(entity_type,entity_id,status)
  select 'driver', id, 'approved' from public.drivers on conflict (entity_type,entity_id) do nothing;
