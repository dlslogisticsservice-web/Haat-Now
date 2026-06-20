// ─────────────────────────────────────────────────────────────────────────────
// AppConfig context — single source of truth for country + language (Sections
// D/E/F/G/H). Handles: persistence, currency formatting, dialect text, document
// direction, and best-effort GPS→country detection (with manual override).
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import i18n, { dialectText, STORAGE_LANG_KEY } from '../i18n';
import {
  COUNTRIES, getCountry, formatPrice,
  type CountryCode, type CountryConfig, type Lang,
} from '../config/countries';
import { countryDetection } from '../services/country-detection.service';

interface AppConfigValue {
  country: CountryConfig;
  lang: Lang;
  setCountry: (code: CountryCode, opts?: { manual?: boolean }) => void;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  price: (amount: number) => string;
  dt: (key: 'orderCta' | 'nearest') => string;
}

const AppConfigContext = createContext<AppConfigValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryConfig>(
    () => getCountry(countryDetection.getPersisted()),
  );
  const [lang, setLangState] = useState<Lang>(
    () => ((typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_LANG_KEY)) as Lang) || 'ar',
  );

  // Apply language + document direction whenever lang changes.
  useEffect(() => {
    i18n.changeLanguage(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  const setCountry = useCallback((code: CountryCode, opts?: { manual?: boolean }) => {
    setCountryState(COUNTRIES[code]);
    countryDetection.persist(code, opts?.manual);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_LANG_KEY, l);
  }, []);

  const toggleLang = useCallback(() => setLang(lang === 'ar' ? 'en' : 'ar'), [lang, setLang]);

  // Run the detection fallback chain once on mount (manual override is respected
  // inside the service; GPS only fires when not manually overridden).
  useEffect(() => {
    let cancelled = false;
    countryDetection.detect().then(({ code, source }) => {
      if (!cancelled && source !== 'manual' && source !== 'persisted') setCountry(code);
    });
    return () => { cancelled = true; };
  }, [setCountry]);

  const value: AppConfigValue = {
    country,
    lang,
    setCountry,
    setLang,
    toggleLang,
    price: (amount: number) => formatPrice(amount, country, lang),
    dt: (key) => dialectText(country.dialect, key),
  };

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used within AppConfigProvider');
  return ctx;
}
