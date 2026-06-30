// ─────────────────────────────────────────────────────────────────────────────
// Tenant service — white-label SaaS provisioning + lifecycle. Built on the existing
// adminCrud engine (real Supabase / sandbox-safe). Provisioning happens from the
// Admin Panel — no manual SQL. Lifecycle transitions log an operation_events row
// (reusing the operations timeline) for audit.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';
import { applyDesign, mergeDesign, DEFAULT_DESIGN, type DesignConfig } from '../design/designSystem';

const tenants = adminCrud('tenants');
const events = adminCrud('operation_events');

export type TenantStatus = 'draft' | 'active' | 'suspended' | 'archived';

/** Build a DesignConfig from a tenant's flat brand fields — reuses the ONE theming engine. */
export function tenantTheme(t: Record<string, any>): DesignConfig {
  const n = (v: any, d: number) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  return mergeDesign(DEFAULT_DESIGN, {
    colors: {
      ...DEFAULT_DESIGN.colors,
      primary: t.primary_color || DEFAULT_DESIGN.colors.primary,
      secondary: t.secondary_color || DEFAULT_DESIGN.colors.secondary,
      accent: t.accent_color || t.primary_color || DEFAULT_DESIGN.colors.accent,
    },
    typography: { ...DEFAULT_DESIGN.typography, fontFamily: t.font_family || DEFAULT_DESIGN.typography.fontFamily },
    cards: { ...DEFAULT_DESIGN.cards, radius: n(t.card_radius, DEFAULT_DESIGN.cards.radius) },
    buttons: { ...DEFAULT_DESIGN.buttons, radius: n(t.button_radius, DEFAULT_DESIGN.buttons.radius) },
    glass: { ...DEFAULT_DESIGN.glass, intensity: n(t.glass_intensity, DEFAULT_DESIGN.glass.intensity) },
    branding: { ...DEFAULT_DESIGN.branding, favicon: t.favicon_url || DEFAULT_DESIGN.branding.favicon, appLogo: t.logo_url || '', darkLogo: t.dark_logo_url || '', lightLogo: t.light_logo_url || '', splashLogo: t.splash_url || '' },
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
  async archive(id: string): Promise<{ error: any }>  { const r = await tenants.update(id, { status: 'archived' }); if (!r.error) await logLifecycle('tenant_archived', id); return r; },
};
