// ─────────────────────────────────────────────────────────────────────────────
// Merchant store-operations settings — production-ready persistence layer.
// merchant_branches has no operational columns yet, so this service persists to
// localStorage in sandbox and to the additive `merchant_branches.settings` jsonb
// column in production (migration 20260626000003). The store OPEN/CLOSED state
// also drives the REAL `merchant_branches.is_active` flag via merchantService,
// so closing/vacation actually hides the store from customers. No mock data.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { merchantService } from './merchant.service';

// Demo mode is decided by the BUILD, never by whether a client object happens to exist:
// `|| !supabase` meant a production deploy with missing env vars silently served demo
// data. (main.tsx blocks that boot today, so this is closing the trap, not a live bug.)
import { IS_SANDBOX as SANDBOX } from '../config/runtime';

export type StoreStatus = 'open' | 'busy' | 'closed';
export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export interface DayHours { open: string; close: string; closed: boolean }
export interface StoreSettings {
  status: StoreStatus;
  vacationMode: boolean;
  autoAccept: boolean;
  minOrder: number;
  prepTimeMinutes: number;
  busyExtraMinutes: number;
  deliveryRadiusKm: number;
  hours: Record<DayKey, DayHours>;
}

export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const defaultHours = (): Record<DayKey, DayHours> =>
  DAY_KEYS.reduce((acc, d) => { acc[d] = { open: '09:00', close: '23:59', closed: false }; return acc; }, {} as Record<DayKey, DayHours>);

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  status: 'open', vacationMode: false, autoAccept: false,
  minOrder: 0, prepTimeMinutes: 20, busyExtraMinutes: 15, deliveryRadiusKm: 8,
  hours: defaultHours(),
};

const key = (branchId: string) => `haat_merchant_settings_${branchId}`;

function merge(raw: Partial<StoreSettings> | null): StoreSettings {
  if (!raw) return DEFAULT_STORE_SETTINGS;
  return { ...DEFAULT_STORE_SETTINGS, ...raw, hours: { ...defaultHours(), ...(raw.hours || {}) } };
}

export const merchantSettingsService = {
  async get(branchId: string): Promise<StoreSettings> {
    if (!SANDBOX) {
      const { data } = await supabase.from('merchant_branches').select('settings').eq('id', branchId).maybeSingle();
      if (data?.settings && Object.keys(data.settings).length) return merge(data.settings as Partial<StoreSettings>);
    }
    try { return merge(JSON.parse(localStorage.getItem(key(branchId)) || 'null')); } catch { return DEFAULT_STORE_SETTINGS; }
  },

  async save(branchId: string, settings: StoreSettings): Promise<void> {
    try { localStorage.setItem(key(branchId), JSON.stringify(settings)); } catch { /* ignore */ }
    if (!SANDBOX) {
      await supabase.from('merchant_branches').update({ settings }).eq('id', branchId);
    }
    // Store open/closed (incl. vacation) drives the REAL is_active flag → hides from customers.
    const active = settings.status !== 'closed' && !settings.vacationMode;
    await merchantService.updateBranchInfo(branchId, { is_active: active } as any);
  },

  /** True if the store currently accepts orders (status + vacation + today's hours). */
  isAcceptingOrders(s: StoreSettings, now: Date = new Date()): boolean {
    if (s.status === 'closed' || s.vacationMode) return false;
    const day = DAY_KEYS[now.getDay()];
    const h = s.hours[day];
    if (!h || h.closed) return false;
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return t >= h.open && t <= h.close;
  },

  /** Effective prep estimate (adds the busy surcharge when in Busy mode). */
  effectivePrepTime(s: StoreSettings): number {
    return s.prepTimeMinutes + (s.status === 'busy' ? s.busyExtraMinutes : 0);
  },
};
