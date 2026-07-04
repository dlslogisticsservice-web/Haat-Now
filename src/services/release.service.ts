// ─────────────────────────────────────────────────────────────────────────────
// Release gate config — reads the existing public.settings table (key/value jsonb).
// Keys (operator-set, both optional):
//   min_app_version : { "version": "1.2.0" }   → installs below this are force-updated
//   maintenance     : { "enabled": true, "message_ar": "...", "message_en": "..." }
// Sandbox / missing rows → permissive (no gate), so nothing breaks before rows exist.
// ─────────────────────────────────────────────────────────────────────────────
import { settingsRepository } from '../repositories/settings.repository';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export interface ReleaseGate {
  minVersion: string | null;
  maintenance: boolean;
  maintenanceMessageAr: string;
  maintenanceMessageEn: string;
  storeUrlAndroid: string;
  storeUrlIos: string;
}

const DEFAULT_GATE: ReleaseGate = {
  minVersion: null, maintenance: false,
  maintenanceMessageAr: 'نقوم بأعمال صيانة لتحسين الخدمة. سنعود قريبًا.',
  maintenanceMessageEn: 'We are performing maintenance to improve the service. Back shortly.',
  storeUrlAndroid: '', storeUrlIos: '',
};

export const releaseService = {
  async getGate(): Promise<ReleaseGate> {
    if (SANDBOX) return DEFAULT_GATE;
    try {
      const { data } = await settingsRepository.getReleaseKeys();
      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value; });
      return {
        minVersion: map.min_app_version?.version ?? null,
        maintenance: !!map.maintenance?.enabled,
        maintenanceMessageAr: map.maintenance?.message_ar || DEFAULT_GATE.maintenanceMessageAr,
        maintenanceMessageEn: map.maintenance?.message_en || DEFAULT_GATE.maintenanceMessageEn,
        storeUrlAndroid: map.store_urls?.android || '',
        storeUrlIos: map.store_urls?.ios || '',
      };
    } catch {
      return DEFAULT_GATE; // never block the app on a config read failure
    }
  },
};
