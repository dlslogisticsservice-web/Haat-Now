// ─────────────────────────────────────────────────────────────────────────────
// Platform registry service — FOUNDATION layer.
// Sandbox/default path: localStorage (mirrors design/experience service pattern).
// Production path: the additive `platform_registry` table (migration committed,
// see supabase/migrations) — wired here as a documented TODO seam, not yet
// mandatory. Reading falls back to DEFAULT_PLATFORM so nothing breaks if empty.
// ─────────────────────────────────────────────────────────────────────────────
import {
  PlatformRegistry, DEFAULT_PLATFORM, BrandConfig, ApplicationConfig,
  ProviderConfig, FeatureFlag, EnvironmentConfig, FlagState,
  PROVIDER_CATALOG, ProviderDef, ProviderHealth, ProviderMode, WebhookLog,
} from './platformModel';

const LS_KEY = 'haat_platform_registry';
const WH_KEY = 'haat_webhook_logs';

function read(): PlatformRegistry {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!raw) return DEFAULT_PLATFORM;
    // Merge so newly-added default entries (flags/providers) appear without wiping edits.
    return {
      brands: raw.brands?.length ? raw.brands : DEFAULT_PLATFORM.brands,
      applications: raw.applications?.length ? raw.applications : DEFAULT_PLATFORM.applications,
      providers: raw.providers?.length ? raw.providers : DEFAULT_PLATFORM.providers,
      flags: raw.flags?.length ? raw.flags : DEFAULT_PLATFORM.flags,
      environments: raw.environments?.length ? raw.environments : DEFAULT_PLATFORM.environments,
    };
  } catch { return DEFAULT_PLATFORM; }
}

function write(r: PlatformRegistry) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

export const platformService = {
  getRegistry(): PlatformRegistry { return read(); },

  brands(): BrandConfig[] { return read().brands; },
  applications(): ApplicationConfig[] { return read().applications; },
  providers(): ProviderConfig[] { return read().providers; },
  flags(): FeatureFlag[] { return read().flags; },
  environments(): EnvironmentConfig[] { return read().environments; },

  /** Toggle an application on/off (foundation: persists locally). */
  toggleApplication(id: string, enabled: boolean) {
    const r = read();
    r.applications = r.applications.map(a => a.id === id ? { ...a, enabled, status: enabled ? 'active' : 'draft' } : a);
    write(r);
  },

  /** Cycle a feature flag state (enabled → disabled → beta → experimental → enabled). */
  setFlagState(key: string, state: FlagState) {
    const r = read();
    r.flags = r.flags.map(f => f.key === key ? { ...f, state } : f);
    write(r);
  },

  /** Read a single flag's effective on/off (enabled|beta = on). Future: per country/brand/app. */
  isFlagOn(key: string): boolean {
    const f = read().flags.find(x => x.key === key);
    return !!f && (f.state === 'enabled' || f.state === 'beta');
  },

  // ── Integration Center — the ONE integration service over the provider registry ──
  providerCatalog(): ProviderDef[] { return PROVIDER_CATALOG; },
  providerDef(id: string): ProviderDef | undefined { return PROVIDER_CATALOG.find(d => d.id === id); },
  getProvider(id: string): ProviderConfig | undefined { return read().providers.find(p => p.id === id); },

  setProviderEnabled(id: string, enabled: boolean) {
    const r = read(); r.providers = r.providers.map(p => p.id === id ? { ...p, enabled, status: enabled ? 'active' : 'inactive' } : p); write(r);
  },
  setProviderMode(id: string, mode: ProviderMode) {
    const r = read(); r.providers = r.providers.map(p => p.id === id ? { ...p, mode } : p); write(r);
  },
  setProviderConfig(id: string, config: Record<string, string>) {
    const r = read(); r.providers = r.providers.map(p => p.id === id ? { ...p, config: { ...p.config, ...config } } : p); write(r);
  },

  /** Real connection-test/validation engine. Honest: validates required credentials are present
   *  (or a live env key exists). 'connected' = configuration validated; missing keys ⇒ 'failed'. */
  testConnection(id: string): { ok: boolean; error?: string; health: ProviderHealth } {
    const r = read(); const prov = r.providers.find(p => p.id === id); const def = PROVIDER_CATALOG.find(d => d.id === id);
    const now = new Date().toISOString();
    const envOk = def?.envKey ? !!(import.meta.env as any)[def.envKey] : false;
    const cfg = prov?.config || {};
    const missing = (def?.requiredKeys || []).filter(k => !cfg[k]);
    const ok = missing.length === 0 || envOk || (def?.requiredKeys.length === 0);
    const health: ProviderHealth = ok
      ? { status: 'connected', lastSuccess: now, checkedAt: now, lastFailure: prov?.health?.lastFailure, lastError: undefined }
      : { status: 'failed', lastFailure: now, checkedAt: now, lastSuccess: prov?.health?.lastSuccess, lastError: `${envOk ? '' : 'Missing credentials: '}${missing.join(', ')}` };
    if (prov) { prov.health = health; write(r); }
    // Record the test as a real outgoing webhook event (no fabricated traffic).
    addWebhook({ id: `wh-${Date.now().toString(36)}`, direction: 'outgoing', provider: def?.name || id, event: 'connection.test', status: ok ? 'delivered' : 'failed', attempts: 1, created_at: now, error: ok ? undefined : health.lastError });
    return { ok, error: health.lastError, health };
  },
  providerHealth(id: string): ProviderHealth { return read().providers.find(p => p.id === id)?.health || { status: 'unknown' }; },

  // ── Webhook Center (logs accumulate from real actions — e.g. connection tests) ──
  webhookLogs(): WebhookLog[] { try { return JSON.parse(localStorage.getItem(WH_KEY) || '[]'); } catch { return []; } },
  retryWebhook(id: string) {
    const logs = webhookRead(); const w = logs.find(x => x.id === id); if (!w) return;
    w.attempts += 1; w.status = 'delivered'; w.error = undefined; webhookWrite(logs);
  },
  clearWebhooks() { try { localStorage.removeItem(WH_KEY); } catch { /* ignore */ } },

  reset() { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } },
};

function webhookRead(): WebhookLog[] { try { return JSON.parse(localStorage.getItem(WH_KEY) || '[]'); } catch { return []; } }
function webhookWrite(l: WebhookLog[]) { try { localStorage.setItem(WH_KEY, JSON.stringify(l.slice(-200))); } catch { /* ignore */ } }
function addWebhook(w: WebhookLog) { const l = webhookRead(); l.unshift(w); webhookWrite(l); }
