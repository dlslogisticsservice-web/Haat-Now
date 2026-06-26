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
} from './platformModel';

const LS_KEY = 'haat_platform_registry';

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

  reset() { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } },
};
