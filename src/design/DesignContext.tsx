import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { DesignConfig, DEFAULT_DESIGN, applyDesign, mergeDesign } from './designSystem';
import { useAppConfig } from '../contexts/AppConfigContext';

// Persistence layer (PHASE A): localStorage is the live store. A `design_settings`
// table migration is provided for server-backed sync; designService can be wired to
// it without changing this API.
const STORE_KEY = 'haat_design_store_v1';

interface Layer { base: DesignConfig; byCountry: Record<string, Partial<DesignConfig>> }
interface Version { id: string; at: string; data: Layer }
interface Store { published: Layer; draft: Layer; versions: Version[] }

const emptyLayer = (): Layer => ({ base: structuredClone(DEFAULT_DESIGN), byCountry: {} });
function loadStore(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && raw.published && raw.draft) return raw;
  } catch { /* ignore */ }
  return { published: emptyLayer(), draft: emptyLayer(), versions: [] };
}
function saveStore(s: Store) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
const effective = (layer: Layer, country: string): DesignConfig => mergeDesign(layer.base, layer.byCountry[country] || {});

interface DesignCtx {
  country: string;
  publishedConfig: DesignConfig;
  draftConfig: DesignConfig;
  versions: Version[];
  // edit the draft for the active country (scope='country') or globally (scope='base')
  patchDraft: (scope: 'base' | 'country', patch: Partial<DesignConfig>) => void;
  resetDraftSection: () => void;
  saveDraft: () => void;
  publish: () => void;
  /** Atomically set the base config AND publish it (Phase 0.2 Theme Presets — avoids patch+publish staleness). */
  applyPreset: (config: DesignConfig) => void;
  discardDraft: () => void;
  rollback: (versionId: string) => void;
  previewing: boolean;
  setPreviewing: (on: boolean) => void;
}

const Ctx = createContext<DesignCtx | null>(null);
export const useDesign = () => { const c = useContext(Ctx); if (!c) throw new Error('useDesign outside provider'); return c; };

export function DesignProvider({ children }: { children: ReactNode }) {
  const { country: countryCfg } = useAppConfig();
  const country = countryCfg.code;
  const [store, setStore] = useState<Store>(loadStore);
  const [previewing, setPreviewing] = useState(false);
  const seq = useRef(1000);

  const publishedConfig = useMemo(() => effective(store.published, country), [store.published, country]);
  const draftConfig     = useMemo(() => effective(store.draft, country), [store.draft, country]);

  // Apply the live theme: draft while previewing, otherwise the published config.
  useEffect(() => {
    applyDesign(previewing ? draftConfig : publishedConfig);
  }, [previewing, draftConfig, publishedConfig]);

  const commit = (next: Store) => { setStore(next); saveStore(next); };

  const patchDraft: DesignCtx['patchDraft'] = (scope, patch) => {
    setStore(s => {
      const draft: Layer = structuredClone(s.draft);
      if (scope === 'base') draft.base = mergeDesign(draft.base, patch);
      else draft.byCountry[country] = mergeDesign(mergeDesign(draft.base, draft.byCountry[country] || {}), patch) as Partial<DesignConfig>;
      const next = { ...s, draft }; saveStore(next); return next;
    });
  };
  const resetDraftSection = () => commit({ ...store, draft: structuredClone(store.published) });
  const saveDraft = () => saveStore(store); // already persisted on each patch; explicit save is a no-op confirm
  const discardDraft = () => commit({ ...store, draft: structuredClone(store.published) });
  const publish = () => {
    const id = `v-${++seq.current}`;
    const version: Version = { id, at: new Date().toISOString(), data: structuredClone(store.published) };
    const published = structuredClone(store.draft);
    commit({ published, draft: structuredClone(store.draft), versions: [version, ...store.versions].slice(0, 20) });
  };
  const rollback = (versionId: string) => {
    const v = store.versions.find(x => x.id === versionId);
    if (!v) return;
    commit({ ...store, published: structuredClone(v.data), draft: structuredClone(v.data) });
  };
  const applyPreset = (config: DesignConfig) => {
    setStore(s => {
      const layer: Layer = { base: structuredClone(config), byCountry: {} };
      const version: Version = { id: `v-${++seq.current}`, at: new Date().toISOString(), data: structuredClone(s.published) };
      const next: Store = { published: structuredClone(layer), draft: structuredClone(layer), versions: [version, ...s.versions].slice(0, 20) };
      saveStore(next); return next;
    });
    setPreviewing(false);
  };

  const value: DesignCtx = {
    country, publishedConfig, draftConfig, versions: store.versions,
    patchDraft, resetDraftSection, saveDraft, publish, applyPreset, discardDraft, rollback, previewing, setPreviewing,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
