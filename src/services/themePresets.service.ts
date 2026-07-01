// AUTHORIZED BY: Phase 0.2 sprint (Theme Presets), per PRODUCTIZATION_MASTER_PLAN_V2 §Theme Presets
// Phase: 0.2
// Purpose: Named, tenant-independent theme presets — reusable DesignConfig snapshots (save/apply/duplicate/export/import/assign). Owner domain: Platform/Experience.
// Existing services reused: design/designSystem (DesignConfig, DEFAULT_DESIGN, applyDesign, mergeDesign); adminCrud haat_crud_* persistence namespace.
// Why a new service is required: no existing service owns reusable, tenant-independent theme presets; this is a focused catalog referenced by tenants — NOT a new theme/config/token model.
// Duplicate analysis: reuses DesignConfig + applyDesign + mergeDesign (no ThemeEngine2/DesignStore2). A preset stores ONE DesignConfig; tenants store only a preset id + optional overrides (no config copy).
// Existing services reused (dup rule): designSystem only.
// Consumers: ThemePresetsPanel (Design Center), tenant.service (resolve a tenant's preset), TenantWorkspace (assign).
// Future merge candidate: NO
import { DesignConfig, DEFAULT_DESIGN, applyDesign, mergeDesign } from '../design/designSystem';

export interface ThemePreset { id: string; name: string; config: DesignConfig; system?: boolean; created_at: string }

// Persist in the existing adminCrud namespace (haat_crud_*) — no second persistence mechanism.
const KEY = 'haat_crud_theme_presets';
const nowISO = () => new Date().toISOString();
const withColors = (primary: string, secondary: string, accent: string): DesignConfig =>
  mergeDesign(DEFAULT_DESIGN, { colors: { ...DEFAULT_DESIGN.colors, primary, secondary, accent } });

function seed(): ThemePreset[] {
  const presets: ThemePreset[] = [
    { id: 'preset-default', name: 'HAAT NOW', config: DEFAULT_DESIGN, system: true, created_at: nowISO() },
    { id: 'preset-ocean', name: 'Ocean', config: withColors('#38bdf8', '#7dd3fc', '#0ea5e9'), system: true, created_at: nowISO() },
    { id: 'preset-sunset', name: 'Sunset', config: withColors('#fb7185', '#fda4af', '#f43f5e'), system: true, created_at: nowISO() },
    { id: 'preset-royal', name: 'Royal', config: withColors('#c084fc', '#d8b4fe', '#a855f7'), system: true, created_at: nowISO() },
  ];
  try { localStorage.setItem(KEY, JSON.stringify(presets)); } catch { /* quota */ }
  return presets;
}
const read = (): ThemePreset[] => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* reseed */ } return seed(); };
const write = (l: ThemePreset[]) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* quota */ } };

export const themePresetsService = {
  // 1/2. Model + CRUD
  list: (): ThemePreset[] => read(),
  get: (id: string): ThemePreset | undefined => read().find(p => p.id === id),
  /** Sync config resolver for the theme cascade (tenant.service). Falls back to default. */
  getConfig: (id?: string): DesignConfig => (id && read().find(p => p.id === id)?.config) || DEFAULT_DESIGN,

  // 3. Save a given (current) design config as a new preset
  create(name: string, config: DesignConfig): ThemePreset {
    const preset: ThemePreset = { id: `preset-${Date.now().toString(36)}`, name: name.trim() || 'Preset', config, created_at: nowISO() };
    write([...read(), preset]);
    return preset;
  },
  update(id: string, patch: { name?: string; config?: DesignConfig }): void {
    const list = read(); const p = list.find(x => x.id === id); if (!p || p.system) return;
    if (patch.name !== undefined) p.name = patch.name; if (patch.config) p.config = patch.config;
    write(list);
  },
  remove(id: string): void { const p = read().find(x => x.id === id); if (p?.system) return; write(read().filter(x => x.id !== id)); },

  // 5. Duplicate
  duplicate(id: string): ThemePreset | undefined {
    const src = this.get(id); if (!src) return undefined;
    return this.create(`${src.name} (copy)`, src.config);
  },

  // 6/7. Export / Import
  exportPreset(id: string): string { const p = this.get(id); return p ? JSON.stringify({ name: p.name, config: p.config }, null, 2) : ''; },
  importPreset(json: string): ThemePreset | null {
    try { const o = JSON.parse(json); if (!o?.config) return null; return this.create(o.name || 'Imported', mergeDesign(DEFAULT_DESIGN, o.config)); } catch { return null; }
  },

  // 4/9. Apply / Preview — reuse applyDesign (transient live preview; persistent apply goes via DesignContext.publish)
  applyConfig(config: DesignConfig) { applyDesign(config); },

  // 10. Effective config for a tenant = preset + optional overrides (tenant stores only id + overrides)
  effective(presetId: string | undefined, overrides?: Partial<DesignConfig>): DesignConfig {
    return mergeDesign(this.getConfig(presetId), overrides || {});
  },
};
