// AUTHORIZED BY: Phase 0.5 sprint (Template Marketplace), per PRODUCTIZATION_MASTER_PLAN_V2 §Template Marketplace
// Phase: 0.5
// Purpose: Declarative business-template manifests + catalog CRUD/version/import-export/validate/preview/assign. Owner: Platform.
// Existing services reused: provisioning.service (generic engine — receives a spec), themePresets (validate preset), subscription (validate plan), adminCrud persistence.
// Why a new service is required: business knowledge (verticals) must live in DECLARATIVE manifests, NOT in the generic Provisioning Engine. This service owns the manifests + maps a manifest → the engine's generic ProvisionSpec.
// Duplicate analysis: no new provisioning flow (delegates to provisioning.service.provision); no new theme/subscription/brand system; manifests are pure data.
// Consumers: TemplateMarketplace (admin); the Provisioning Engine reads only the derived spec (never this service).
// Future merge candidate: NO
import { type ProvisionSpec } from './provisioning.service';
import { type PlanKey, PLAN_CATALOG } from './subscription.service';
import { themePresetsService } from './themePresets.service';

export interface TemplateManifest {
  id: string; name: string; version: number; system?: boolean;
  vertical: string;
  theme_preset_id: string;
  brand_defaults: { primary_color?: string; support_email?: string; app_name?: string };
  cms_structure: { pages: string[] };
  roles: string[];
  navigation: string[];
  integrations: string[];
  features: Record<string, boolean>;
  permissions: string[];
  subscription: { plan: PlanKey; trialDays?: number };
  demo_data_profile: string;
  updated_at: string;
  history?: { version: number; at: string }[];
}

const feat = (...on: string[]) => { const all = ['wallet', 'loyalty', 'scheduling', 'tips', 'live_tracking', 'ratings', 'referrals', 'subscriptions']; const o: Record<string, boolean> = {}; all.forEach(f => o[f] = on.includes(f) || on.includes('*')); return o; };
const now = () => new Date().toISOString();

// ── Declarative catalog (business knowledge lives HERE, not in the engine) ──
const SEED: Omit<TemplateManifest, 'updated_at' | 'history'>[] = [
  { id: 'tpl-restaurant', name: 'Restaurant', version: 1, system: true, vertical: 'food', theme_preset_id: 'preset-default', brand_defaults: { primary_color: '#a3f95b' }, cms_structure: { pages: ['home', 'menu', 'offers', 'about', 'contact'] }, roles: ['operations_manager', 'support_agent'], navigation: ['home', 'menu', 'orders', 'profile'], integrations: ['stripe', 'google_maps', 'fcm'], features: feat('wallet', 'ratings', 'loyalty', 'scheduling'), permissions: ['orders.view', 'orders.manage', 'catalog.products.manage'], subscription: { plan: 'starter', trialDays: 14 }, demo_data_profile: 'restaurant-small' },
  { id: 'tpl-food-delivery', name: 'Food Delivery', version: 1, system: true, vertical: 'food', theme_preset_id: 'preset-sunset', brand_defaults: { primary_color: '#fb7185' }, cms_structure: { pages: ['home', 'restaurants', 'offers', 'track', 'contact'] }, roles: ['operations_manager', 'finance_manager', 'support_agent'], navigation: ['home', 'discover', 'orders', 'wallet', 'profile'], integrations: ['stripe', 'paymob', 'google_maps', 'fcm', 'twilio'], features: feat('wallet', 'ratings', 'loyalty', 'scheduling', 'tips', 'live_tracking'), permissions: ['orders.view', 'orders.manage', 'fleet.drivers.view'], subscription: { plan: 'business', trialDays: 14 }, demo_data_profile: 'food-delivery-large' },
  { id: 'tpl-courier', name: 'Courier', version: 1, system: true, vertical: 'express', theme_preset_id: 'preset-ocean', brand_defaults: { primary_color: '#38bdf8' }, cms_structure: { pages: ['home', 'services', 'pricing', 'track', 'contact'] }, roles: ['operations_manager', 'finance_manager'], navigation: ['home', 'services', 'track', 'wallet'], integrations: ['stripe', 'google_maps', 'mapbox', 'fcm'], features: feat('live_tracking', 'scheduling', 'wallet'), permissions: ['orders.view', 'ops.dispatch.manage'], subscription: { plan: 'business', trialDays: 14 }, demo_data_profile: 'courier-mid' },
  { id: 'tpl-pharmacy', name: 'Pharmacy', version: 1, system: true, vertical: 'pharmacy', theme_preset_id: 'preset-default', brand_defaults: { primary_color: '#4ade80' }, cms_structure: { pages: ['home', 'catalog', 'prescriptions', 'offers', 'contact'] }, roles: ['operations_manager', 'compliance_officer'], navigation: ['home', 'catalog', 'orders', 'profile'], integrations: ['moyasar', 'google_maps', 'fcm'], features: feat('wallet', 'scheduling', 'ratings'), permissions: ['orders.view', 'catalog.products.manage', 'compliance.kyc.view'], subscription: { plan: 'starter', trialDays: 14 }, demo_data_profile: 'pharmacy-small' },
  { id: 'tpl-supermarket', name: 'Supermarket', version: 1, system: true, vertical: 'market', theme_preset_id: 'preset-default', brand_defaults: { primary_color: '#22c55e' }, cms_structure: { pages: ['home', 'departments', 'offers', 'cart', 'contact'] }, roles: ['operations_manager', 'finance_manager', 'support_agent'], navigation: ['home', 'departments', 'cart', 'orders', 'wallet'], integrations: ['stripe', 'paymob', 'google_maps', 'fcm'], features: feat('wallet', 'loyalty', 'scheduling', 'ratings'), permissions: ['orders.view', 'catalog.products.manage', 'catalog.categories.manage'], subscription: { plan: 'business', trialDays: 14 }, demo_data_profile: 'market-large' },
  { id: 'tpl-flowers', name: 'Flowers', version: 1, system: true, vertical: 'flowers', theme_preset_id: 'preset-sunset', brand_defaults: { primary_color: '#f43f5e' }, cms_structure: { pages: ['home', 'bouquets', 'occasions', 'offers', 'contact'] }, roles: ['operations_manager'], navigation: ['home', 'bouquets', 'orders', 'profile'], integrations: ['stripe', 'google_maps', 'fcm'], features: feat('wallet', 'scheduling', 'ratings'), permissions: ['orders.view', 'catalog.products.manage'], subscription: { plan: 'starter', trialDays: 14 }, demo_data_profile: 'flowers-small' },
  { id: 'tpl-laundry', name: 'Laundry', version: 1, system: true, vertical: 'logistics', theme_preset_id: 'preset-ocean', brand_defaults: { primary_color: '#0ea5e9' }, cms_structure: { pages: ['home', 'services', 'pricing', 'book', 'contact'] }, roles: ['operations_manager'], navigation: ['home', 'services', 'book', 'orders'], integrations: ['moyasar', 'google_maps', 'fcm'], features: feat('scheduling', 'live_tracking', 'wallet'), permissions: ['orders.view', 'orders.manage'], subscription: { plan: 'starter', trialDays: 14 }, demo_data_profile: 'laundry-small' },
  { id: 'tpl-luxury', name: 'Luxury', version: 1, system: true, vertical: 'food', theme_preset_id: 'preset-royal', brand_defaults: { primary_color: '#c084fc' }, cms_structure: { pages: ['home', 'collections', 'membership', 'concierge', 'contact'] }, roles: ['operations_manager', 'finance_manager', 'marketing_manager', 'support_agent'], navigation: ['home', 'collections', 'membership', 'orders', 'wallet'], integrations: ['stripe', 'moyasar', 'google_maps', 'mapbox', 'fcm', 'ses'], features: feat('*'), permissions: ['orders.view', 'orders.manage', 'marketing.campaigns.manage'], subscription: { plan: 'enterprise', trialDays: 30 }, demo_data_profile: 'luxury-premium' },
  { id: 'tpl-corporate', name: 'Corporate', version: 1, system: true, vertical: 'logistics', theme_preset_id: 'preset-royal', brand_defaults: { primary_color: '#a855f7' }, cms_structure: { pages: ['home', 'solutions', 'about', 'careers', 'contact'] }, roles: ['operations_manager', 'finance_manager', 'compliance_officer'], navigation: ['home', 'solutions', 'reports', 'billing'], integrations: ['stripe', 'ses', 'posthog', 'google_analytics'], features: feat('subscriptions', 'wallet', 'scheduling'), permissions: ['finance.view', 'orders.view', 'security.logs.view'], subscription: { plan: 'enterprise', trialDays: 30 }, demo_data_profile: 'corporate-b2b' },
  { id: 'tpl-minimal', name: 'Minimal', version: 1, system: true, vertical: 'food', theme_preset_id: 'preset-default', brand_defaults: { primary_color: '#a3f95b' }, cms_structure: { pages: ['home', 'contact'] }, roles: ['operations_manager'], navigation: ['home', 'orders'], integrations: ['google_maps'], features: feat('ratings'), permissions: ['orders.view'], subscription: { plan: 'free' }, demo_data_profile: 'minimal' },
];

const KEY = 'haat_crud_templates';
const read = (): TemplateManifest[] => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* reseed */ } const seeded = SEED.map(s => ({ ...s, updated_at: now(), history: [] as { version: number; at: string }[] })); try { localStorage.setItem(KEY, JSON.stringify(seeded)); } catch { /* quota */ } return seeded; };
const write = (l: TemplateManifest[]) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* quota */ } };

export interface TemplateValidation { valid: boolean; errors: string[] }

export const templatesService = {
  // Marketplace + CRUD
  list: (): TemplateManifest[] => read(),
  get: (id: string): TemplateManifest | undefined => read().find(t => t.id === id),
  create(name: string, base?: Partial<TemplateManifest>): TemplateManifest {
    const t: TemplateManifest = { id: `tpl-${Date.now().toString(36)}`, name: name.trim() || 'Template', version: 1, vertical: base?.vertical || 'food', theme_preset_id: base?.theme_preset_id || 'preset-default', brand_defaults: base?.brand_defaults || {}, cms_structure: base?.cms_structure || { pages: ['home', 'contact'] }, roles: base?.roles || ['operations_manager'], navigation: base?.navigation || ['home'], integrations: base?.integrations || [], features: base?.features || feat('ratings'), permissions: base?.permissions || ['orders.view'], subscription: base?.subscription || { plan: 'starter', trialDays: 14 }, demo_data_profile: base?.demo_data_profile || 'minimal', updated_at: now(), history: [] };
    write([...read(), t]); return t;
  },
  // Versioning — bump + history on update
  update(id: string, patch: Partial<TemplateManifest>): void {
    const list = read(); const t = list.find(x => x.id === id); if (!t || t.system) return;
    (t.history ||= []).unshift({ version: t.version, at: t.updated_at });
    Object.assign(t, patch); t.version += 1; t.updated_at = now(); write(list);
  },
  remove(id: string): void { const t = read().find(x => x.id === id); if (t?.system) return; write(read().filter(x => x.id !== id)); },
  duplicate(id: string): TemplateManifest | undefined { const s = this.get(id); if (!s) return undefined; const { id: _i, system: _s, updated_at: _u, history: _h, ...rest } = s; return this.create(`${s.name} (copy)`, rest); },

  // Import / Export
  exportTemplate: (id: string): string => { const t = read().find(x => x.id === id); return t ? JSON.stringify(t, null, 2) : ''; },
  importTemplate(json: string): TemplateManifest | null { try { const o = JSON.parse(json); if (!o?.vertical || !o?.theme_preset_id) return null; return this.create(o.name || 'Imported', o); } catch { return null; } },

  // Validation
  validate(t: Partial<TemplateManifest>): TemplateValidation {
    const errors: string[] = [];
    if (!t.vertical) errors.push('vertical required');
    if (!t.theme_preset_id) errors.push('theme_preset_id required');
    else if (!themePresetsService.get(t.theme_preset_id)) errors.push(`theme preset "${t.theme_preset_id}" not found`);
    if (!t.subscription?.plan) errors.push('subscription.plan required');
    else if (!PLAN_CATALOG.some(p => p.key === t.subscription!.plan)) errors.push(`plan "${t.subscription.plan}" not in catalog`);
    if (!t.cms_structure?.pages?.length) errors.push('cms_structure.pages required');
    return { valid: errors.length === 0, errors };
  },

  // Preview — read-only summary of what will be provisioned
  preview(t: TemplateManifest) {
    return { vertical: t.vertical, plan: t.subscription.plan, themePreset: t.theme_preset_id, pages: t.cms_structure.pages, integrations: t.integrations, features: Object.keys(t.features).filter(k => t.features[k]), roles: t.roles, demo: t.demo_data_profile };
  },

  /** Map a manifest → the engine's GENERIC ProvisionSpec (business knowledge stays in the manifest). */
  toSpec(t: TemplateManifest, overrides: { brand_name: string; slug?: string; support_email?: string; logo_url?: string }): ProvisionSpec {
    return {
      brand_name: overrides.brand_name, slug: overrides.slug,
      plan: t.subscription.plan, trial_days: t.subscription.trialDays,
      theme_preset_id: t.theme_preset_id, vertical: t.vertical,
      primary_color: t.brand_defaults.primary_color, support_email: overrides.support_email || t.brand_defaults.support_email,
      logo_url: overrides.logo_url,
      features: t.features, integrations: t.integrations, roles: t.roles, permissions: t.permissions,
      cms_structure: t.cms_structure, navigation: t.navigation, demo_data_profile: t.demo_data_profile,
      template_id: t.id,
    };
  },

  // Assignment — tag a tenant with the template it was provisioned from (reference only).
  assignToTenant(tenantId: string, templateId: string): void {
    try { const arr = JSON.parse(localStorage.getItem('haat_crud_tenants') || '[]'); const i = arr.findIndex((x: any) => x.id === tenantId); if (i >= 0) { arr[i].template_id = templateId; localStorage.setItem('haat_crud_tenants', JSON.stringify(arr)); } } catch { /* ignore */ }
  },
};

// Dev-only harness hook (tree-shaken from production) — lets the Phase 0.5 suite drive the catalog.
if (import.meta.env.DEV && typeof window !== 'undefined') { (window as any).__tpl = templatesService; }
