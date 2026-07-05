-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 · P0-2 — Fix provisioning ↔ tenants schema mismatch.
--
-- The provisioning engine (src/services/provisioning.service.ts) and tenantTheme()
-- (src/services/tenant.service.ts) + subscription.service.ts write ~20 tenant fields
-- that did NOT exist as columns on public.tenants (20260627000008). In sandbox mode the
-- localStorage store accepts arbitrary JSON, so provisioning "worked"; in LIVE Supabase
-- mode PostgREST rejects unknown columns, so real white-label onboarding threw.
--
-- This migration is strictly ADDITIVE and IDEMPOTENT: every column is nullable with no
-- default (or a safe default), so existing rows and every current query are unchanged.
-- It makes the existing provisioner PostgREST-compatible in live mode with ZERO app
-- changes and NO breaking changes.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  -- Provisioning-step flag + config fields (provisioning.service.ts STEPS)
  alter table public.tenants add column if not exists theme_preset_id    text;
  alter table public.tenants add column if not exists brand_seeded        boolean default false;
  alter table public.tenants add column if not exists app_name            text;
  alter table public.tenants add column if not exists support_email       text;
  alter table public.tenants add column if not exists sub_status          text;
  alter table public.tenants add column if not exists trial_ends_at       timestamptz;
  alter table public.tenants add column if not exists features_json       jsonb;
  alter table public.tenants add column if not exists default_admin       text;
  alter table public.tenants add column if not exists roles_seeded        boolean default false;
  alter table public.tenants add column if not exists default_roles       jsonb;
  alter table public.tenants add column if not exists default_permissions jsonb;
  alter table public.tenants add column if not exists integrations_seeded boolean default false;
  alter table public.tenants add column if not exists analytics_enabled   boolean default false;
  alter table public.tenants add column if not exists storage_provider    text;
  alter table public.tenants add column if not exists integrations        jsonb;
  alter table public.tenants add column if not exists default_website     boolean default false;
  alter table public.tenants add column if not exists site_name           text;
  alter table public.tenants add column if not exists cms_structure       jsonb;
  alter table public.tenants add column if not exists navigation          jsonb;
  alter table public.tenants add column if not exists demo_data_profile   text;

  -- Extended branding fields read by tenantTheme() (tenant.service.ts:20-36)
  alter table public.tenants add column if not exists accent_color        varchar(9);
  alter table public.tenants add column if not exists card_radius         numeric;
  alter table public.tenants add column if not exists button_radius       numeric;
  alter table public.tenants add column if not exists glass_intensity     numeric;
  alter table public.tenants add column if not exists favicon_url         text;
  alter table public.tenants add column if not exists dark_logo_url       text;
  alter table public.tenants add column if not exists light_logo_url      text;
  alter table public.tenants add column if not exists splash_url          text;
  alter table public.tenants add column if not exists template_id         text;
end $$;

-- No RLS change: tenants already has tenants_public_read_active + tenants_admin_all
-- (20260627000008). New columns inherit those policies automatically.
