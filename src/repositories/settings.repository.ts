import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// settings.repository (Phase-2 service→repository migration).
// Supabase data access for the public.settings key/value table. No business logic.
// ─────────────────────────────────────────────────────────────────────────────

export const settingsRepository = {
  /** Release-gate keys (min_app_version, maintenance, store_urls). */
  getReleaseKeys() {
    return supabase.from('settings').select('key, value').in('key', ['min_app_version', 'maintenance', 'store_urls']);
  },
};
