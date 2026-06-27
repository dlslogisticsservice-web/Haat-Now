// ─────────────────────────────────────────────────────────────────────────────
// Tenant service — white-label SaaS provisioning + lifecycle. Built on the existing
// adminCrud engine (real Supabase / sandbox-safe). Provisioning happens from the
// Admin Panel — no manual SQL. Lifecycle transitions log an operation_events row
// (reusing the operations timeline) for audit.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';

const tenants = adminCrud('tenants');
const events = adminCrud('operation_events');

export type TenantStatus = 'draft' | 'active' | 'suspended' | 'archived';

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

  /** Lifecycle transitions — each persists status + logs the event. */
  async activate(id: string): Promise<{ error: any }> { const r = await tenants.update(id, { status: 'active' }); if (!r.error) await logLifecycle('tenant_activated', id); return r; },
  async suspend(id: string): Promise<{ error: any }>  { const r = await tenants.update(id, { status: 'suspended' }); if (!r.error) await logLifecycle('tenant_suspended', id); return r; },
  async archive(id: string): Promise<{ error: any }>  { const r = await tenants.update(id, { status: 'archived' }); if (!r.error) await logLifecycle('tenant_archived', id); return r; },
};
