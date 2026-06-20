// ─────────────────────────────────────────────────────────────────────────────
// Country detection service (Phase 3.5 / Section 6).
// Real architecture with a provider abstraction + ordered fallback chain:
//   1. manual override (persisted, always wins)
//   2. previously persisted country
//   3. GPS  → ReverseGeocodeProvider
//   4. timezone / browser-locale heuristic
//   5. DEFAULT_COUNTRY
// The geocoding provider is swappable — the offline bounding-box provider needs
// no API key; drop in a Google/Mapbox provider later without touching callers.
// ─────────────────────────────────────────────────────────────────────────────
import { COUNTRIES, DEFAULT_COUNTRY, type CountryCode } from '../config/countries';

const STORAGE_KEY = 'haat_country';
const MANUAL_KEY = 'haat_country_manual';

export interface GeoCoordinates { latitude: number; longitude: number; }
export type DetectionSource = 'manual' | 'persisted' | 'gps' | 'locale' | 'default';

export interface ReverseGeocodeProvider {
  countryFromCoords(coords: GeoCoordinates): Promise<CountryCode | null>;
}

// ── Default provider: offline bounding boxes (no network / no key) ───────────
const BOXES: Array<{ code: CountryCode; lat: [number, number]; lng: [number, number] }> = [
  { code: 'EG', lat: [22, 32], lng: [25, 37] },
  { code: 'SA', lat: [16, 33], lng: [34, 56] },
  { code: 'AE', lat: [22, 27], lng: [51, 57] },
  { code: 'KW', lat: [28, 31], lng: [46, 49] },
  { code: 'QA', lat: [24, 27], lng: [50, 52] },
  { code: 'BH', lat: [25, 27], lng: [50, 51] },
  { code: 'OM', lat: [16, 27], lng: [52, 60] },
  { code: 'JO', lat: [29, 34], lng: [34, 40] },
];

export const boundingBoxProvider: ReverseGeocodeProvider = {
  async countryFromCoords({ latitude, longitude }) {
    for (const b of BOXES) {
      if (latitude >= b.lat[0] && latitude <= b.lat[1] && longitude >= b.lng[0] && longitude <= b.lng[1]) return b.code;
    }
    return null;
  },
};

// ── Timezone / locale heuristic ──────────────────────────────────────────────
const TZ_MAP: Record<string, CountryCode> = {
  'Africa/Cairo': 'EG', 'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Kuwait': 'KW',
  'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM', 'Asia/Amman': 'JO',
};

function countryFromLocaleOrTz(): CountryCode | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_MAP[tz]) return TZ_MAP[tz];
  } catch { /* ignore */ }
  try {
    const region = (navigator.language.split('-')[1] || '').toUpperCase();
    if (region && (COUNTRIES as Record<string, unknown>)[region]) return region as CountryCode;
  } catch { /* ignore */ }
  return null;
}

function getCurrentPosition(): Promise<GeoCoordinates | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600000 },
    );
  });
}

export const countryDetection = {
  getPersisted(): CountryCode | null {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem(STORAGE_KEY);
    return v && (COUNTRIES as Record<string, unknown>)[v] ? (v as CountryCode) : null;
  },
  isManualOverride(): boolean {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MANUAL_KEY) === '1';
  },
  persist(code: CountryCode, manual = false): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, code);
    if (manual) localStorage.setItem(MANUAL_KEY, '1');
  },

  /** Run the full fallback chain. GPS is only attempted when not manually overridden. */
  async detect(provider: ReverseGeocodeProvider = boundingBoxProvider): Promise<{ code: CountryCode; source: DetectionSource }> {
    if (this.isManualOverride()) {
      const m = this.getPersisted();
      if (m) return { code: m, source: 'manual' };
    }
    const persisted = this.getPersisted();
    if (persisted) return { code: persisted, source: 'persisted' };

    const coords = await getCurrentPosition();
    if (coords) {
      const byGps = await provider.countryFromCoords(coords);
      if (byGps) return { code: byGps, source: 'gps' };
    }

    const byLocale = countryFromLocaleOrTz();
    if (byLocale) return { code: byLocale, source: 'locale' };

    return { code: DEFAULT_COUNTRY, source: 'default' };
  },
};
