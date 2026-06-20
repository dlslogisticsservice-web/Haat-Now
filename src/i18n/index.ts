// ─────────────────────────────────────────────────────────────────────────────
// i18next setup (Section E) + regional Arabic dialect layer (Section F).
// Static UI strings live in `resources`; country-specific marketing wording
// lives in `DIALECT` and is selected by the active country's `dialect` key.
// ─────────────────────────────────────────────────────────────────────────────
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Dialect } from '../config/countries';

export const STORAGE_LANG_KEY = 'haat_lang';

const resources = {
  ar: {
    translation: {
      nav: { home: 'الرئيسية', orders: 'طلباتي', cart: 'سلتي', wallet: 'المحفظة', profile: 'حسابي' },
      common: { all: 'الكل', search: 'ماذا تريد اليوم؟ مطاعم، أكلات، متاجر...', viewAll: 'عرض الكل', more: 'المزيد', openNow: 'مفتوح الآن', free: 'مجاني', deliverTo: 'التوصيل إلى', language: 'اللغة' },
      home: { exclusiveOffers: 'العروض الحصرية', nearest: 'أقرب المطاعم إليك', featured: 'المتاجر المميزة', searchResults: 'نتائج البحث', why: 'لماذا تختار Haat Now؟' },
      cats: { restaurant: 'المطاعم', market: 'السوبر ماركت', pharmacy: 'الصيدلية', coffee: 'القهوة', sweets: 'الحلويات', gifts: 'الهدايا', perfume: 'العطور', flowers: 'الزهور', electronics: 'إلكترونيات' },
    },
  },
  en: {
    translation: {
      nav: { home: 'Home', orders: 'Orders', cart: 'Cart', wallet: 'Wallet', profile: 'Profile' },
      common: { all: 'All', search: 'What are you craving? Restaurants, food, stores…', viewAll: 'View all', more: 'More', openNow: 'Open now', free: 'Free', deliverTo: 'Deliver to', language: 'Language' },
      home: { exclusiveOffers: 'Exclusive Offers', nearest: 'Nearest restaurants', featured: 'Featured stores', searchResults: 'Search results', why: 'Why choose Haat Now?' },
      cats: { restaurant: 'Restaurants', market: 'Supermarket', pharmacy: 'Pharmacy', coffee: 'Coffee', sweets: 'Desserts', gifts: 'Gifts', perfume: 'Perfume', flowers: 'Flowers', electronics: 'Electronics' },
    },
  },
};

// Regional Arabic wording (Section F). Auto-selected by the active country's dialect.
export const DIALECT: Record<Dialect, { orderCta: string; nearest: string }> = {
  eg:     { orderCta: 'اطلب أكلك',  nearest: 'أقرب مطعم ليك' },
  sa:     { orderCta: 'اطلب وجبتك', nearest: 'أقرب مطعم لك' },
  gulf:   { orderCta: 'اطلب طلبك',  nearest: 'أقرب مطعم لك' },
  levant: { orderCta: 'اطلب أكلك',  nearest: 'أقرب مطعم إلك' },
};

export function dialectText(dialect: Dialect, key: keyof (typeof DIALECT)['sa']): string {
  return DIALECT[dialect][key];
}

const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_LANG_KEY)) || 'ar';

i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

export default i18n;
