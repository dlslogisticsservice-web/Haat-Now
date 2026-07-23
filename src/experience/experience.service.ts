// ─────────────────────────────────────────────────────────────────────────────
// Visual Experience Builder — persistence service.
// Real path: Supabase `screen_experiences` (+ history) so changes propagate to
// ALL users. Sandbox path: localStorage (mirrors the campaign.service pattern).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import {
  ScreenType, CountryCode, ExperienceSet, DEFAULT_EXPERIENCE,
  DEFAULT_SPLASH, DEFAULT_ONBOARDING, DEFAULT_LOGIN, cloneExperience,
} from './experienceTypes';

// Demo mode is decided by the BUILD, never by whether a client object happens to exist:
// `|| !supabase` meant a production deploy with missing env vars silently served demo
// data. (main.tsx blocks that boot today, so this is closing the trap, not a live bug.)
import { IS_SANDBOX as SANDBOX } from '../config/runtime';
const LS_KEY = 'haat_sb_screen_experiences_v1';

const SCREEN_KEYS: ScreenType[] = ['splash', 'login', 'onboarding'];
const defaultFor = (t: ScreenType) =>
  t === 'splash' ? DEFAULT_SPLASH : t === 'onboarding' ? DEFAULT_ONBOARDING : DEFAULT_LOGIN;

export interface ExperienceVersion {
  version_number: number;
  config: ExperienceSet[ScreenType];
  published_at: string;
  published_by: string | null;
}

interface Row {
  country_code: string;
  screen_type: ScreenType;
  draft_config: ExperienceSet[ScreenType];
  published_config: ExperienceSet[ScreenType];
  version_number: number;
  history: ExperienceVersion[];
}

// ── localStorage store (sandbox) ─────────────────────────────────────────────
type Store = Record<string, Row>; // key = `${country}:${screen}`
const k = (c: string, s: ScreenType) => `${c}:${s}`;
const readStore = (): Store => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const writeStore = (s: Store) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ } };
function ensureRow(store: Store, c: string, s: ScreenType): Row {
  const key = k(c, s);
  if (!store[key]) {
    store[key] = { country_code: c, screen_type: s, draft_config: cloneExperience(DEFAULT_EXPERIENCE)[s], published_config: cloneExperience(DEFAULT_EXPERIENCE)[s], version_number: 1, history: [] };
  }
  return store[key];
}

function assemble(get: (s: ScreenType) => ExperienceSet[ScreenType] | undefined): ExperienceSet {
  return {
    splash: (get('splash') as ExperienceSet['splash']) ?? cloneExperience(DEFAULT_EXPERIENCE).splash,
    onboarding: (get('onboarding') as ExperienceSet['onboarding']) ?? cloneExperience(DEFAULT_EXPERIENCE).onboarding,
    login: (get('login') as ExperienceSet['login']) ?? cloneExperience(DEFAULT_EXPERIENCE).login,
  };
}

export const experienceService = {
  isSandbox: SANDBOX,

  /** Published set for a country — used by the live app. Read-only, fast. */
  async getPublishedSet(country: CountryCode): Promise<ExperienceSet> {
    if (SANDBOX) {
      const store = readStore();
      return assemble(s => store[k(country, s)]?.published_config);
    }
    try {
      const { data } = await supabase.from('screen_experiences')
        .select('screen_type, published_config').eq('country_code', country);
      const map: Record<string, ExperienceSet[ScreenType]> = {};
      (data || []).forEach((r: { screen_type: string; published_config: ExperienceSet[ScreenType] }) => { map[r.screen_type] = r.published_config; });
      return assemble(s => map[s]);
    } catch {
      return cloneExperience(DEFAULT_EXPERIENCE);
    }
  },

  /** Draft set for a country — used by the admin builder preview. */
  async getDraftSet(country: CountryCode): Promise<ExperienceSet> {
    if (SANDBOX) {
      const store = readStore();
      return assemble(s => store[k(country, s)]?.draft_config);
    }
    try {
      const { data } = await supabase.from('screen_experiences')
        .select('screen_type, draft_config, published_config').eq('country_code', country);
      const map: Record<string, ExperienceSet[ScreenType]> = {};
      (data || []).forEach((r: { screen_type: string; draft_config: ExperienceSet[ScreenType]; published_config: ExperienceSet[ScreenType] }) => { map[r.screen_type] = r.draft_config ?? r.published_config; });
      return assemble(s => map[s]);
    } catch {
      return cloneExperience(DEFAULT_EXPERIENCE);
    }
  },

  /** Persist a draft for one screen of one country. */
  async saveDraft(country: CountryCode, screen: ScreenType, config: ExperienceSet[ScreenType]): Promise<void> {
    if (SANDBOX) {
      const store = readStore();
      const row = ensureRow(store, country, screen);
      row.draft_config = config;
      writeStore(store);
      return;
    }
    await supabase.from('screen_experiences').upsert({
      country_code: country, screen_type: screen, draft_config: config, updated_at: new Date().toISOString(),
    }, { onConflict: 'country_code,screen_type' });
  },

  /** Publish a screen's draft → live, snapshot the previous published into history. */
  async publish(country: CountryCode, screen: ScreenType, adminId?: string | null): Promise<void> {
    if (SANDBOX) {
      const store = readStore();
      const row = ensureRow(store, country, screen);
      row.history = [{ version_number: row.version_number, config: row.published_config, published_at: new Date().toISOString(), published_by: adminId ?? null }, ...row.history].slice(0, 30);
      row.published_config = cloneExperience({ ...DEFAULT_EXPERIENCE, [screen]: row.draft_config })[screen];
      row.version_number += 1;
      writeStore(store);
      return;
    }
    const { data: cur } = await supabase.from('screen_experiences')
      .select('draft_config, published_config, version_number').eq('country_code', country).eq('screen_type', screen).maybeSingle();
    const ver = (cur?.version_number ?? 1);
    if (cur?.published_config) {
      await supabase.from('screen_experience_history').insert({
        country_code: country, screen_type: screen, version_number: ver, config: cur.published_config, published_by: adminId ?? null,
      });
    }
    await supabase.from('screen_experiences').upsert({
      country_code: country, screen_type: screen,
      published_config: cur?.draft_config ?? defaultFor(screen),
      version_number: ver + 1, updated_by: adminId ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'country_code,screen_type' });
  },

  async publishAll(country: CountryCode, adminId?: string | null): Promise<void> {
    for (const s of SCREEN_KEYS) await this.publish(country, s, adminId);
  },

  /** Discard the draft (reset to published). */
  async discardDraft(country: CountryCode, screen: ScreenType): Promise<void> {
    if (SANDBOX) {
      const store = readStore();
      const row = ensureRow(store, country, screen);
      row.draft_config = row.published_config;
      writeStore(store);
      return;
    }
    const { data } = await supabase.from('screen_experiences').select('published_config').eq('country_code', country).eq('screen_type', screen).maybeSingle();
    await supabase.from('screen_experiences').update({ draft_config: data?.published_config ?? defaultFor(screen) }).eq('country_code', country).eq('screen_type', screen);
  },

  async listVersions(country: CountryCode, screen: ScreenType): Promise<ExperienceVersion[]> {
    if (SANDBOX) { const store = readStore(); return store[k(country, screen)]?.history ?? []; }
    const { data } = await supabase.from('screen_experience_history')
      .select('version_number, config, published_at, published_by')
      .eq('country_code', country).eq('screen_type', screen).order('version_number', { ascending: false }).limit(30);
    return (data as ExperienceVersion[]) || [];
  },

  /** Roll back published to a historical version. */
  async rollback(country: CountryCode, screen: ScreenType, versionNumber: number, adminId?: string | null): Promise<void> {
    if (SANDBOX) {
      const store = readStore();
      const row = ensureRow(store, country, screen);
      const v = row.history.find(h => h.version_number === versionNumber);
      if (v) { row.published_config = v.config; row.draft_config = v.config; row.version_number += 1; writeStore(store); }
      return;
    }
    const { data: v } = await supabase.from('screen_experience_history').select('config').eq('country_code', country).eq('screen_type', screen).eq('version_number', versionNumber).maybeSingle();
    if (v?.config) {
      await supabase.from('screen_experiences').update({ published_config: v.config, draft_config: v.config, updated_by: adminId ?? null, updated_at: new Date().toISOString() }).eq('country_code', country).eq('screen_type', screen);
    }
  },
};
