// AUTHORIZED BY: Phase 0.4 sprint (Tenant Provisioning Engine), per PRODUCTIZATION_MASTER_PLAN_V2 §0.1
// Phase: 0.4
// Purpose: ORCHESTRATOR-ONLY engine that provisions a tenant by sequencing existing services. Owner: Platform.
// Existing services reused: tenant.service, subscription.service, rbac.service, monitoring, adminCrud (operation_events audit). Theme Presets/Brand Assets/Integration/CMS reached via tenant fields.
// Why a new service is required: no service orchestrates end-to-end tenant provisioning (transactional/idempotent/resumable/retryable/auditable). It owns NO domain logic — every step delegates to an existing service.
// Duplicate analysis: creates NO new tenant/subscription/theme/brand/rbac/audit system; reuses them. Audit = operation_events (existing). Run store = engine resume-state only, not a second audit system.
// Consumers: ProvisioningConsole (admin), future TenantOnboardingWizard (Phase 0.6).
// Future merge candidate: NO
import { adminCrud } from './admin-crud.service';
import { tenantService } from './tenant.service';
import { subscriptionService, type PlanKey } from './subscription.service';
import { rbacService } from './rbac.service';
import { monitoring } from './monitoring.service';

const events = adminCrud('operation_events');
const tenants = adminCrud('tenants');
const RUNS_KEY = 'haat_sb_provision_runs';

export interface ProvisionSpec {
  brand_name: string; slug?: string; plan?: PlanKey; theme_preset_id?: string; country_code?: string; vertical?: string; primary_color?: string; logo_url?: string; support_email?: string;
  // Declarative manifest fields (Phase 0.5) — the engine applies these generically; it holds NO business logic.
  trial_days?: number; features?: Record<string, boolean>; integrations?: string[]; roles?: string[]; permissions?: string[]; cms_structure?: any; navigation?: any; demo_data_profile?: string; template_id?: string;
}
export type StepStatus = 'pending' | 'ok' | 'skipped' | 'failed';
export interface StepState { key: string; ar: string; en: string; status: StepStatus; error?: string; at?: string }
export interface ProvisionRun { id: string; slug: string; spec: ProvisionSpec; tenantId: string | null; status: 'running' | 'completed' | 'failed' | 'rolled_back'; steps: StepState[]; created_at: string; updated_at: string }
interface Ctx { spec: ProvisionSpec; slug: string; tenantId: string | null }

const nowISO = () => new Date().toISOString();
const audit = (action: string, meta: Record<string, any>) => { try { events.create({ action, entity_type: 'provisioning', entity_id: meta.tenant || meta.run || null, meta, created_at: nowISO() }); } catch { /* best-effort */ } };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const allTenants = (): any[] => { try { return JSON.parse(localStorage.getItem('haat_crud_tenants') || '[]'); } catch { return []; } };
const bySlug = (slug: string) => allTenants().find(t => t.slug === slug);
const byId = (id: string | null) => (id ? allTenants().find(t => t.id === id) : null);
const readRuns = (): ProvisionRun[] => { try { return JSON.parse(localStorage.getItem(RUNS_KEY) || '[]'); } catch { return []; } };
const writeRuns = (r: ProvisionRun[]) => { try { localStorage.setItem(RUNS_KEY, JSON.stringify(r.slice(0, 50))); } catch { /* quota */ } };
const saveRun = (run: ProvisionRun) => { const runs = readRuns(); run.updated_at = nowISO(); const i = runs.findIndex(x => x.id === run.id); if (i >= 0) runs[i] = run; else runs.unshift(run); writeRuns(runs); };

// Each step delegates to an existing service. done() = idempotency guard; rollback handled by removing the tenant.
interface Step { key: string; ar: string; en: string; done: (c: Ctx) => boolean; run: (c: Ctx) => Promise<void> }
const STEPS: Step[] = [
  { key: 'tenant', ar: 'إنشاء المستأجر', en: 'Create tenant', done: c => !!c.tenantId,
    run: async c => { const ex = bySlug(c.slug); if (ex) { c.tenantId = ex.id; return; } const { data, error } = await tenantService.provision({ brand_name: c.spec.brand_name, slug: c.slug, country_code: c.spec.country_code || 'SA', vertical: c.spec.vertical || 'food', primary_color: c.spec.primary_color || '#A3F95B', template_id: c.spec.template_id || null }); if (error || !data?.id) throw new Error('tenant create failed'); c.tenantId = data.id; } },
  { key: 'theme', ar: 'تعيين قالب السمة', en: 'Assign theme preset', done: c => !!byId(c.tenantId)?.theme_preset_id,
    run: async c => { const { error } = await tenantService.update(c.tenantId!, { theme_preset_id: c.spec.theme_preset_id || 'preset-default' }); if (error) throw new Error('theme assign failed'); } },
  { key: 'brand', ar: 'الهوية وأصول العلامة', en: 'Brand & assets', done: c => !!byId(c.tenantId)?.brand_seeded,
    run: async c => { const { error } = await tenantService.saveBranding(c.tenantId!, { app_name: c.spec.brand_name, support_email: c.spec.support_email || `support@${c.slug}.com`, logo_url: c.spec.logo_url || '', brand_seeded: true }); if (error) throw new Error('brand save failed'); } },
  { key: 'subscription', ar: 'الاشتراك والتجربة', en: 'Subscription & trial', done: c => !!byId(c.tenantId)?.sub_status,
    run: async c => { const { error } = await subscriptionService.startTrial(c.tenantId!, c.spec.plan || 'starter'); if (error) throw new Error('subscription failed'); if (c.spec.features) await tenantService.update(c.tenantId!, { features_json: JSON.stringify(c.spec.features) }); } },
  { key: 'roles', ar: 'الأدوار والمدير الافتراضي', en: 'Roles & default admin', done: c => !!byId(c.tenantId)?.roles_seeded,
    run: async c => { rbacService.listRoles(); const { error } = await tenantService.update(c.tenantId!, { default_admin: c.spec.support_email || `admin@${c.slug}.com`, roles_seeded: true, default_roles: c.spec.roles || [], default_permissions: c.spec.permissions || [] }); if (error) throw new Error('roles seed failed'); } },
  { key: 'integrations', ar: 'التكاملات الافتراضية', en: 'Default integrations', done: c => !!byId(c.tenantId)?.integrations_seeded,
    run: async c => { const { error } = await tenantService.update(c.tenantId!, { integrations_seeded: true, analytics_enabled: true, storage_provider: 'supabase_storage', integrations: c.spec.integrations || [] }); if (error) throw new Error('integrations seed failed'); } },
  { key: 'cms', ar: 'الموقع والصفحات الافتراضية', en: 'Default site & pages', done: c => !!byId(c.tenantId)?.default_website,
    run: async c => { const { error } = await tenantService.update(c.tenantId!, { default_website: true, site_name: c.spec.brand_name, cms_structure: c.spec.cms_structure || null, navigation: c.spec.navigation || null, demo_data_profile: c.spec.demo_data_profile || null }); if (error) throw new Error('cms seed failed'); } },
  { key: 'activate', ar: 'التفعيل', en: 'Activate', done: c => byId(c.tenantId)?.status === 'active',
    run: async c => { const { error } = await tenantService.activate(c.tenantId!); if (error) throw new Error('activate failed'); } },
];

export const provisioningService = {
  steps: () => STEPS.map(s => ({ key: s.key, ar: s.ar, en: s.en })),
  listRuns: (): ProvisionRun[] => readRuns(),
  getRun: (id: string): ProvisionRun | undefined => readRuns().find(r => r.id === id),

  /** Provision a tenant. Idempotent (by slug + per-step done()), resumable (pass resumeRunId), auditable. */
  async provision(spec: ProvisionSpec, resumeRunId?: string): Promise<ProvisionRun> {
    const slug = slugify(spec.slug || spec.brand_name);
    let run = resumeRunId ? this.getRun(resumeRunId) : undefined;
    if (!run) run = { id: `prov-${Date.now().toString(36)}`, slug, spec, tenantId: bySlug(slug)?.id || null, status: 'running', steps: STEPS.map(s => ({ key: s.key, ar: s.ar, en: s.en, status: 'pending' as StepStatus })), created_at: nowISO(), updated_at: '' };
    run.status = 'running'; saveRun(run);
    audit('provision_started', { run: run.id, slug }); monitoring.track('provision_started', { slug });
    const ctx: Ctx = { spec: run.spec, slug, tenantId: run.tenantId };

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i]; const st = run.steps[i];
      if (st.status === 'ok' || st.status === 'skipped') { if (!ctx.tenantId) ctx.tenantId = bySlug(slug)?.id || null; continue; }
      try {
        if (step.done(ctx)) { st.status = 'skipped'; }
        else { audit('provision_step_started', { run: run.id, step: step.key }); await step.run(ctx); st.status = 'ok'; }
        st.at = nowISO(); st.error = undefined; run.tenantId = ctx.tenantId; saveRun(run);
        audit('provision_step_ok', { run: run.id, step: step.key, tenant: ctx.tenantId, skipped: st.status === 'skipped' });
      } catch (e: any) {
        st.status = 'failed'; st.error = String(e?.message || e); st.at = nowISO(); run.status = 'failed'; run.tenantId = ctx.tenantId; saveRun(run);
        audit('provision_step_failed', { run: run.id, step: step.key, error: st.error, tenant: ctx.tenantId });
        monitoring.captureError(e, { phase: 'provisioning', step: step.key, run: run.id });
        return run; // stop; tenant stays 'draft' (never active while partial) → retry/resume or rollback
      }
    }
    run.status = 'completed'; run.tenantId = ctx.tenantId; saveRun(run);
    audit('provision_completed', { run: run.id, tenant: ctx.tenantId }); monitoring.track('provision_completed', { tenant: ctx.tenantId });
    return run;
  },

  /** Retry / resume a failed run from its first non-completed step. */
  retry(runId: string): Promise<ProvisionRun> { const run = this.getRun(runId); if (!run) return Promise.reject(new Error('run not found')); return this.provision(run.spec, runId); },

  /** Rollback completed operations — removes the (never-activated-while-partial) tenant so nothing partial remains. */
  async rollback(runId: string): Promise<ProvisionRun | undefined> {
    const run = this.getRun(runId); if (!run) return undefined;
    if (run.tenantId) { try { await tenants.remove(run.tenantId); } catch (e) { monitoring.captureError(e, { phase: 'rollback', run: run.id }); } }
    run.status = 'rolled_back'; run.tenantId = null; run.steps.forEach(s => { if (s.status === 'ok' || s.status === 'skipped') s.status = 'pending'; }); saveRun(run);
    audit('provision_rolled_back', { run: run.id }); return run;
  },

  /** Completion verification — confirms the tenant actually holds every provisioned artifact. */
  verify(runId: string): { ok: boolean; checks: { key: string; ok: boolean }[] } {
    const run = this.getRun(runId); const t = run?.tenantId ? byId(run.tenantId) : null;
    const checks = [
      { key: 'tenant', ok: !!t }, { key: 'theme', ok: !!t?.theme_preset_id }, { key: 'brand', ok: !!t?.brand_seeded },
      { key: 'subscription', ok: !!t?.sub_status }, { key: 'roles', ok: !!t?.roles_seeded },
      { key: 'integrations', ok: !!t?.integrations_seeded }, { key: 'cms', ok: !!t?.default_website },
      { key: 'active', ok: t?.status === 'active' },
    ];
    return { ok: checks.every(c => c.ok), checks };
  },
};

// Dev-only harness hook (tree-shaken from production, like __sb) — lets the Phase 0.4 suite drive the engine.
if (import.meta.env.DEV && typeof window !== 'undefined') { (window as any).__prov = provisioningService; }
