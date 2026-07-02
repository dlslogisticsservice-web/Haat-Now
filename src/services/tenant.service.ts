// ─────────────────────────────────────────────────────────────────────────────
// Tenant service — white-label SaaS provisioning + lifecycle. Built on the existing
// adminCrud engine (real Supabase / sandbox-safe). Provisioning happens from the
// Admin Panel — no manual SQL. Lifecycle transitions log an operation_events row
// (reusing the operations timeline) for audit.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';
import { applyDesign, mergeDesign, DEFAULT_DESIGN, type DesignConfig } from '../design/designSystem';
import { themePresetsService } from './themePresets.service';

const tenants = adminCrud('tenants');
const events = adminCrud('operation_events');
const allTenants = (): any[] => { try { return JSON.parse(localStorage.getItem('haat_crud_tenants') || '[]'); } catch { return []; } };

export type TenantStatus = 'draft' | 'active' | 'suspended' | 'archived';

/** Build a DesignConfig for a tenant — reuses the ONE theming engine. Base = the tenant's assigned
 *  theme preset (theme_preset_id, Phase 0.2) or the default; the tenant's flat brand fields are overrides
 *  on top (tenant stores only a preset id + overrides — never a full preset copy). */
export function tenantTheme(t: Record<string, any>): DesignConfig {
  const n = (v: any, d: number) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const base = t.theme_preset_id ? themePresetsService.getConfig(t.theme_preset_id) : DEFAULT_DESIGN;
  return mergeDesign(base, {
    colors: {
      ...base.colors,
      primary: t.primary_color || base.colors.primary,
      secondary: t.secondary_color || base.colors.secondary,
      accent: t.accent_color || t.primary_color || base.colors.accent,
    },
    typography: { ...base.typography, fontFamily: t.font_family || base.typography.fontFamily },
    cards: { ...base.cards, radius: n(t.card_radius, base.cards.radius) },
    buttons: { ...base.buttons, radius: n(t.button_radius, base.buttons.radius) },
    glass: { ...base.glass, intensity: n(t.glass_intensity, base.glass.intensity) },
    branding: { ...base.branding, favicon: t.favicon_url || base.branding.favicon, appLogo: t.logo_url || '', darkLogo: t.dark_logo_url || '', lightLogo: t.light_logo_url || '', splashLogo: t.splash_url || '' },
  });
}

async function logLifecycle(action: string, tenantId: string, meta?: Record<string, any>) {
  try { await events.create({ action, entity_type: 'tenant', entity_id: tenantId, meta: meta || null, created_at: new Date().toISOString() }); }
  catch { /* timeline is best-effort */ }
}

export const tenantService = {
  list: () => tenants.list(),

  /** Provision a new tenant (from the Admin Panel). */
  async provision(payload: Record<string, any>): Promise<{ data: any; error: any }> {
    const slug = payload.slug || String(payload.brand_name || 'tenant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data, error } = await tenants.create({ status: 'draft', primary_color: '#A3F95B', plan: 'starter', ...payload, slug });
    if (!error && data?.id) await logLifecycle('tenant_provisioned', data.id, { brand_name: data.brand_name, plan: data.plan });
    return { data, error };
  },

  update: (id: string, patch: Record<string, any>) => tenants.update(id, patch),

  /** Persist a tenant's full brand/identity/theme patch. */
  async saveBranding(id: string, patch: Record<string, any>): Promise<{ error: any }> {
    const r = await tenants.update(id, patch);
    if (!r.error) await logLifecycle('tenant_branding_updated', id, { fields: Object.keys(patch) });
    return { error: r.error };
  },

  /** Apply a tenant's brand theme to the live app (reuses applyDesign — no duplicate theming logic). */
  applyTheme(t: Record<string, any>) { applyDesign(tenantTheme(t)); },

  /** Restore the default HAAT NOW theme. */
  restoreDefaultTheme() { applyDesign(DEFAULT_DESIGN); },

  /** Lifecycle transitions — each persists status + logs the event. */
  async activate(id: string): Promise<{ error: any }> { const r = await tenants.update(id, { status: 'active' }); if (!r.error) await logLifecycle('tenant_activated', id); return r; },
  async suspend(id: string): Promise<{ error: any }>  { const r = await tenants.update(id, { status: 'suspended' }); if (!r.error) await logLifecycle('tenant_suspended', id); return r; },
  async resume(id: string): Promise<{ error: any }>   { const r = await tenants.update(id, { status: 'active' });    if (!r.error) await logLifecycle('tenant_resumed', id); return r; },
  async archive(id: string): Promise<{ error: any }>  { const r = await tenants.update(id, { status: 'archived' }); if (!r.error) await logLifecycle('tenant_archived', id); return r; },

  // ── Export / Import / Backup / Restore / Clone / Delete (Phase 0.7) ──
  // Reuse the existing tenant store (adminCrud) + operation_events audit. No new persistence, no provisioning logic.
  /** Serialize a tenant's full config to a versioned JSON document (backup/export). */
  exportTenant(id: string): string {
    const t = allTenants().find(x => x.id === id); if (!t) return '';
    logLifecycle('tenant_exported', id, { slug: t.slug });
    return JSON.stringify({ version: 1, kind: 'haat-tenant', exported_at: new Date().toISOString(), tenant: t }, null, 2);
  },
  /** Recreate a tenant from an exported JSON document (import/restore) — restores into the tenant store. */
  async importTenant(json: string, opts?: { slugSuffix?: string }): Promise<{ data: any; error: any }> {
    let parsed: any; try { parsed = JSON.parse(json); } catch { return { data: null, error: { message: 'invalid JSON' } }; }
    const src = parsed?.tenant || parsed; if (!src || (!src.brand_name && !src.slug)) return { data: null, error: { message: 'not a tenant export' } };
    const { id: _i, created_at: _c, ...fields } = src;
    const slug = `${src.slug || 'tenant'}${opts?.slugSuffix ?? '-import'}`;
    const { data, error } = await tenants.create({ ...fields, slug, status: fields.status || 'draft' });
    if (!error && data?.id) await logLifecycle('tenant_imported', data.id, { from_slug: src.slug });
    return { data, error };
  },
  /** Clone = export + import with a fresh slug/id (reuses export/import). */
  async cloneTenant(id: string): Promise<{ data: any; error: any }> {
    const json = this.exportTenant(id); if (!json) return { data: null, error: { message: 'not found' } };
    const r = await this.importTenant(json, { slugSuffix: `-clone-${Date.now().toString(36).slice(-4)}` });
    if (!r.error && r.data?.id) await logLifecycle('tenant_cloned', r.data.id, { source: id });
    return r;
  },
  /** Delete = backup-first then remove (never lose data). Returns the backup JSON. */
  async deleteTenant(id: string): Promise<{ backup: string; error: any }> {
    const backup = this.exportTenant(id);
    const { error } = await tenants.remove(id);
    if (!error) await logLifecycle('tenant_deleted', id, {});
    return { backup, error };
  },
};
