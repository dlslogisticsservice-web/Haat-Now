// Migration contract test — the Wave-0 foundation migration declares every website_*
// table with multi-tenant RLS. Guards against schema/code drift (the Phase 9.5 lesson:
// verify the migration actually contains what the code assumes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20260705000100_website_platform_foundation.sql'),
  'utf8',
).toLowerCase();

const REQUIRED_TABLES = [
  'website_sites', 'website_pages', 'website_sections', 'website_blocks', 'website_navigation',
  'website_menus', 'website_assets', 'website_media', 'website_forms', 'website_redirects',
  'website_domains', 'website_themes', 'website_theme_tokens', 'website_seo', 'website_revisions',
  'website_publish_history', 'website_templates', 'website_component_library', 'website_page_permissions',
  'website_settings', 'website_translations', 'website_custom_code', 'website_feature_flags',
];

test('all 23 required website_* tables are created', () => {
  for (const t of REQUIRED_TABLES) {
    assert.ok(SQL.includes(`create table if not exists public.${t}`), `missing table ${t}`);
  }
});

test('migration is additive/idempotent (create table if not exists throughout)', () => {
  assert.equal(SQL.includes('drop table'), false, 'must not drop tables');
  const creates = SQL.match(/create table if not exists/g) ?? [];
  assert.ok(creates.length >= REQUIRED_TABLES.length, 'every table must be guarded');
});

test('RLS is enabled and tenant-scoped (auth_tenant + auth_has_permission)', () => {
  assert.ok(SQL.includes('enable row level security'), 'RLS not enabled');
  assert.ok(SQL.includes('public.auth_tenant()'), 'tenant isolation not wired');
  assert.ok(SQL.includes("public.auth_has_permission('website.edit')"), 'write permission not enforced');
});

test('multi-tenant + versioning + soft-delete + audit columns present on sites', () => {
  const sitesDdl = SQL.slice(SQL.indexOf('create table if not exists public.website_sites'));
  for (const col of ['tenant_id uuid not null', 'version int not null default 1', 'deleted_at timestamptz', 'created_at timestamptz', 'updated_at timestamptz']) {
    assert.ok(sitesDdl.includes(col), `sites missing ${col}`);
  }
});

test('no anonymous grants (no website_* table is granted to anon)', () => {
  assert.equal(SQL.includes('to anon'), false, 'website tables must not be granted to anon');
});
