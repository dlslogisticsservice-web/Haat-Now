// ─────────────────────────────────────────────────────────────────────────────
// Subscription service (Phase 0.1) — plan catalog, plan management, trial lifecycle,
// usage limits + usage guard, subscription status. Built OVER the existing
// tenant.service + subscriptions/memberships tables (adminCrud sandbox / Supabase).
// Source of truth for a tenant's subscription lives on the tenant record (plan,
// sub_status, trial_ends_at); the subscriptions table holds the event ledger and the
// memberships table holds the tenant↔plan membership. No parallel system.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';
import { tenantService } from './tenant.service';
import { kv } from '../lib/kv';

export type PlanKey = 'free' | 'starter' | 'business' | 'enterprise';
export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
/** -1 = unlimited. */
export interface PlanLimits { orders: number; drivers: number; merchants: number; branches: number }
export interface Plan { key: PlanKey; ar: string; en: string; priceMonthly: number; custom?: boolean; trialDays: number; limits: PlanLimits; features: string[] }

// 1. Subscription Catalog
export const PLAN_CATALOG: Plan[] = [
  { key: 'free', ar: 'مجاني', en: 'Free', priceMonthly: 0, trialDays: 0, limits: { orders: 100, drivers: 5, merchants: 2, branches: 3 }, features: ['wallet', 'ratings'] },
  { key: 'starter', ar: 'مبتدئ', en: 'Starter', priceMonthly: 99, trialDays: 14, limits: { orders: 2000, drivers: 25, merchants: 15, branches: 30 }, features: ['wallet', 'ratings', 'loyalty', 'scheduling'] },
  { key: 'business', ar: 'أعمال', en: 'Business', priceMonthly: 299, trialDays: 14, limits: { orders: 20000, drivers: 150, merchants: 100, branches: 250 }, features: ['wallet', 'ratings', 'loyalty', 'scheduling', 'tips', 'live_tracking', 'referrals'] },
  { key: 'enterprise', ar: 'مؤسسي', en: 'Enterprise', priceMonthly: 0, custom: true, trialDays: 30, limits: { orders: -1, drivers: -1, merchants: -1, branches: -1 }, features: ['wallet', 'ratings', 'loyalty', 'scheduling', 'tips', 'live_tracking', 'referrals', 'subscriptions'] },
];
const planOf = (k?: string): Plan => PLAN_CATALOG.find(p => p.key === k) || PLAN_CATALOG[1];
const ls = (t: string): any[] => kv.list(t);

export type UsageResource = keyof PlanLimits;
export interface UsageGuard { resource: UsageResource; used: number; limit: number; unlimited: boolean; remaining: number; allowed: boolean; overage: boolean; pct: number }
export interface SubscriptionView { plan: Plan; status: SubStatus; trialEndsAt: string | null; trialDaysLeft: number; onTrial: boolean; limits: PlanLimits }

export const subscriptionService = {
  // ── 1. Catalog · 2. Plan management helpers ──
  catalog: (): Plan[] => PLAN_CATALOG,
  getPlan: (k?: string): Plan => planOf(k),

  // ── 6. Subscription status (derived; trial expiry → past_due) ──
  view(tenant: Record<string, any> | null | undefined): SubscriptionView {
    const plan = planOf(tenant?.plan);
    const trialEndsAt: string | null = tenant?.trial_ends_at || null;
    let status: SubStatus = (tenant?.sub_status as SubStatus) || 'trialing';
    let trialDaysLeft = 0; let onTrial = false;
    if (trialEndsAt) {
      const ms = new Date(trialEndsAt).getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(ms / 86400000));
      onTrial = status === 'trialing';
      if (status === 'trialing' && ms <= 0) status = 'past_due';
    }
    return { plan, status, trialEndsAt, trialDaysLeft, onTrial, limits: plan.limits };
  },

  // ── 3. Trial lifecycle ──
  async startTrial(tenantId: string, planKey: PlanKey): Promise<{ error: any }> {
    const plan = planOf(planKey);
    const end = new Date(Date.now() + plan.trialDays * 86400000).toISOString();
    const r = await tenantService.update(tenantId, { plan: plan.key, sub_status: 'trialing', trial_ends_at: end, subscribed_at: new Date().toISOString(), features_json: JSON.stringify(this.planFeatures(plan)) });
    if (!r.error) { this.logEvent(tenantId, 'trial_started', { plan: plan.key, trialDays: plan.trialDays }); this.upsertMembership(tenantId, plan.key, 'trialing'); }
    return { error: r.error };
  },

  // ── 2. Plan management (upgrade/downgrade) ──
  async changePlan(tenantId: string, planKey: PlanKey): Promise<{ error: any }> {
    const plan = planOf(planKey);
    const r = await tenantService.update(tenantId, { plan: plan.key, sub_status: 'active', features_json: JSON.stringify(this.planFeatures(plan)) });
    if (!r.error) { this.logEvent(tenantId, 'plan_changed', { plan: plan.key }); this.upsertMembership(tenantId, plan.key, 'active'); }
    return { error: r.error };
  },

  async setStatus(tenantId: string, status: SubStatus): Promise<{ error: any }> {
    const r = await tenantService.update(tenantId, { sub_status: status });
    if (!r.error) this.logEvent(tenantId, 'subscription_status', { status });
    return { error: r.error };
  },
  cancel(tenantId: string) { return this.setStatus(tenantId, 'canceled'); },

  // Plan → feature flags (reuses White Label features_json; 'enterprise' enables all catalog features).
  planFeatures(plan: Plan): Record<string, boolean> {
    const all = ['wallet', 'loyalty', 'scheduling', 'tips', 'live_tracking', 'ratings', 'referrals', 'subscriptions'];
    const out: Record<string, boolean> = {};
    all.forEach(f => { out[f] = plan.features.includes(f); });
    return out;
  },

  // ── 4. Usage limits + 5. Usage guard ──
  usage(): Record<UsageResource, number> {
    return { orders: ls('orders').length, drivers: ls('drivers').length, merchants: ls('merchants').length, branches: ls('merchant_branches').length };
  },
  usageGuard(tenant: Record<string, any>, resource: UsageResource): UsageGuard {
    const limit = this.view(tenant).limits[resource];
    const used = this.usage()[resource] || 0;
    const unlimited = limit < 0;
    return { resource, used, limit, unlimited, remaining: unlimited ? Infinity : Math.max(0, limit - used), allowed: unlimited || used < limit, overage: !unlimited && used > limit, pct: unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100)) };
  },
  allUsage(tenant: Record<string, any>): UsageGuard[] { return (['orders', 'drivers', 'merchants', 'branches'] as UsageResource[]).map(r => this.usageGuard(tenant, r)); },

  // ── Ledgers (reuse subscriptions + memberships tables) ──
  logEvent(tenantId: string, action: string, meta: Record<string, any>) {
    try { adminCrud('subscriptions').create({ tenant_id: tenantId, action, meta, created_at: new Date().toISOString() }); } catch { /* best-effort ledger */ }
  },
  upsertMembership(tenantId: string, plan: string, status: string) {
    try {
      // Tenant↔plan membership row (reuses the memberships table; sandbox = haat_crud_memberships).
      const cur = ls('memberships'); const i = cur.findIndex((x: any) => x.tenant_id === tenantId);
      const row = { id: i >= 0 ? cur[i].id : `mem-${tenantId}`, tenant_id: tenantId, plan, status, updated_at: new Date().toISOString() };
      if (i >= 0) cur[i] = { ...cur[i], ...row }; else cur.unshift(row);
      kv.set('memberships', cur);
    } catch { /* best-effort */ }
  },
};
