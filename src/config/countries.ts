// ─────────────────────────────────────────────────────────────────────────────
// Multi-country foundation (Phase 3 / Section D + G).
// One config table for all 8 markets — currency, locale, dialect, default city.
// Reuses the existing countries/cities/zones DB schema (no new tables).
// ─────────────────────────────────────────────────────────────────────────────

export type CountryCode = 'EG' | 'SA' | 'AE' | 'KW' | 'QA' | 'BH' | 'OM' | 'JO';
export type Lang = 'ar' | 'en';
export type Dialect = 'eg' | 'sa' | 'gulf' | 'levant';

export interface CountryConfig {
  code: CountryCode;
  nameAr: string;
  nameEn: string;
  flag: string;
  dialCode: string;
  currency: { code: string; symbolAr: string; symbolEn: string; decimals: number };
  locale: string;            // BCP-47 for Intl number formatting
  dialect: Dialect;
  defaultCityAr: string;
  defaultCityEn: string;
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  EG: { code: 'EG', nameAr: 'مصر',            nameEn: 'Egypt',        flag: '🇪🇬', dialCode: '+20',  currency: { code: 'EGP', symbolAr: 'ج.م', symbolEn: 'EGP', decimals: 2 }, locale: 'ar-EG', dialect: 'eg',     defaultCityAr: 'القاهرة', defaultCityEn: 'Cairo'    },
  SA: { code: 'SA', nameAr: 'السعودية',       nameEn: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966', currency: { code: 'SAR', symbolAr: 'ر.س', symbolEn: 'SAR', decimals: 2 }, locale: 'ar-SA', dialect: 'sa',     defaultCityAr: 'الرياض',  defaultCityEn: 'Riyadh'   },
  AE: { code: 'AE', nameAr: 'الإمارات',       nameEn: 'UAE',          flag: '🇦🇪', dialCode: '+971', currency: { code: 'AED', symbolAr: 'د.إ', symbolEn: 'AED', decimals: 2 }, locale: 'ar-AE', dialect: 'gulf',   defaultCityAr: 'دبي',     defaultCityEn: 'Dubai'    },
  KW: { code: 'KW', nameAr: 'الكويت',         nameEn: 'Kuwait',       flag: '🇰🇼', dialCode: '+965', currency: { code: 'KWD', symbolAr: 'د.ك', symbolEn: 'KWD', decimals: 3 }, locale: 'ar-KW', dialect: 'gulf',   defaultCityAr: 'الكويت',  defaultCityEn: 'Kuwait City' },
  QA: { code: 'QA', nameAr: 'قطر',            nameEn: 'Qatar',        flag: '🇶🇦', dialCode: '+974', currency: { code: 'QAR', symbolAr: 'ر.ق', symbolEn: 'QAR', decimals: 2 }, locale: 'ar-QA', dialect: 'gulf',   defaultCityAr: 'الدوحة',  defaultCityEn: 'Doha'     },
  BH: { code: 'BH', nameAr: 'البحرين',        nameEn: 'Bahrain',      flag: '🇧🇭', dialCode: '+973', currency: { code: 'BHD', symbolAr: 'د.ب', symbolEn: 'BHD', decimals: 3 }, locale: 'ar-BH', dialect: 'gulf',   defaultCityAr: 'المنامة', defaultCityEn: 'Manama'   },
  OM: { code: 'OM', nameAr: 'عُمان',          nameEn: 'Oman',         flag: '🇴🇲', dialCode: '+968', currency: { code: 'OMR', symbolAr: 'ر.ع', symbolEn: 'OMR', decimals: 3 }, locale: 'ar-OM', dialect: 'gulf',   defaultCityAr: 'مسقط',    defaultCityEn: 'Muscat'   },
  JO: { code: 'JO', nameAr: 'الأردن',         nameEn: 'Jordan',       flag: '🇯🇴', dialCode: '+962', currency: { code: 'JOD', symbolAr: 'د.أ', symbolEn: 'JOD', decimals: 3 }, locale: 'ar-JO', dialect: 'levant', defaultCityAr: 'عمّان',   defaultCityEn: 'Amman'    },
};

export const COUNTRY_LIST: CountryConfig[] = Object.values(COUNTRIES);
export const DEFAULT_COUNTRY: CountryCode = 'EG';

export function getCountry(code: string | null | undefined): CountryConfig {
  return (code && COUNTRIES[code as CountryCode]) || COUNTRIES[DEFAULT_COUNTRY];
}

/** Format a money amount for a country, currency-aware (symbol side + decimals). */
export function formatPrice(amount: number, country: CountryConfig, lang: Lang = 'ar'): string {
  const { decimals, symbolAr, symbolEn } = country.currency;
  const n = (amount ?? 0).toLocaleString(lang === 'ar' ? country.locale : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return lang === 'ar' ? `${n} ${symbolAr}` : `${symbolEn} ${n}`;
}
