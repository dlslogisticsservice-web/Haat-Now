// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — Egypt operational configuration (production launch market).
// Real governorates & cities (public geography) + configurable business rules:
// launch coverage zones, delivery pricing, and estimated delivery times.
//
// These are LAUNCH DEFAULTS — every fee/threshold/ETA is a business parameter the
// Country Admin can tune per zone; nothing here is a hard-coded runtime constant.
// Money is in EGP (see countries.ts EG). No fabricated merchant/customer data.
// ─────────────────────────────────────────────────────────────────────────────

export interface EgZone {
  id: string;
  nameAr: string; nameEn: string;
  cityId: string;
  active: boolean;              // is HAAT NOW live in this zone at launch?
  deliveryFee: number;         // base delivery fee (EGP)
  minOrder: number;            // minimum basket (EGP)
  etaMin: number;              // estimated delivery, low bound (minutes)
  etaMax: number;              // estimated delivery, high bound (minutes)
}
export interface EgCity { id: string; nameAr: string; nameEn: string; governorateId: string; launch: boolean }
export interface EgGovernorate { id: string; nameAr: string; nameEn: string }

// All 27 Egyptian governorates (real). `launch` cities/zones below define coverage.
export const EG_GOVERNORATES: EgGovernorate[] = [
  { id: 'cairo', nameAr: 'القاهرة', nameEn: 'Cairo' },
  { id: 'giza', nameAr: 'الجيزة', nameEn: 'Giza' },
  { id: 'qalyubia', nameAr: 'القليوبية', nameEn: 'Qalyubia' },
  { id: 'alexandria', nameAr: 'الإسكندرية', nameEn: 'Alexandria' },
  { id: 'dakahlia', nameAr: 'الدقهلية', nameEn: 'Dakahlia' },
  { id: 'sharqia', nameAr: 'الشرقية', nameEn: 'Sharqia' },
  { id: 'gharbia', nameAr: 'الغربية', nameEn: 'Gharbia' },
  { id: 'monufia', nameAr: 'المنوفية', nameEn: 'Monufia' },
  { id: 'beheira', nameAr: 'البحيرة', nameEn: 'Beheira' },
  { id: 'kafr_el_sheikh', nameAr: 'كفر الشيخ', nameEn: 'Kafr El Sheikh' },
  { id: 'damietta', nameAr: 'دمياط', nameEn: 'Damietta' },
  { id: 'port_said', nameAr: 'بورسعيد', nameEn: 'Port Said' },
  { id: 'ismailia', nameAr: 'الإسماعيلية', nameEn: 'Ismailia' },
  { id: 'suez', nameAr: 'السويس', nameEn: 'Suez' },
  { id: 'fayoum', nameAr: 'الفيوم', nameEn: 'Fayoum' },
  { id: 'beni_suef', nameAr: 'بني سويف', nameEn: 'Beni Suef' },
  { id: 'minya', nameAr: 'المنيا', nameEn: 'Minya' },
  { id: 'asyut', nameAr: 'أسيوط', nameEn: 'Asyut' },
  { id: 'sohag', nameAr: 'سوهاج', nameEn: 'Sohag' },
  { id: 'qena', nameAr: 'قنا', nameEn: 'Qena' },
  { id: 'luxor', nameAr: 'الأقصر', nameEn: 'Luxor' },
  { id: 'aswan', nameAr: 'أسوان', nameEn: 'Aswan' },
  { id: 'red_sea', nameAr: 'البحر الأحمر', nameEn: 'Red Sea' },
  { id: 'new_valley', nameAr: 'الوادي الجديد', nameEn: 'New Valley' },
  { id: 'matrouh', nameAr: 'مطروح', nameEn: 'Matrouh' },
  { id: 'north_sinai', nameAr: 'شمال سيناء', nameEn: 'North Sinai' },
  { id: 'south_sinai', nameAr: 'جنوب سيناء', nameEn: 'South Sinai' },
];

// Launch cities. `launch: true` = onboarding merchants/captains now; others are roadmap.
export const EG_CITIES: EgCity[] = [
  { id: 'cairo_city', nameAr: 'مدينة القاهرة', nameEn: 'Cairo City', governorateId: 'cairo', launch: true },
  { id: 'new_cairo', nameAr: 'القاهرة الجديدة', nameEn: 'New Cairo', governorateId: 'cairo', launch: true },
  { id: 'nasr_city', nameAr: 'مدينة نصر', nameEn: 'Nasr City', governorateId: 'cairo', launch: true },
  { id: 'heliopolis', nameAr: 'مصر الجديدة', nameEn: 'Heliopolis', governorateId: 'cairo', launch: true },
  { id: 'maadi', nameAr: 'المعادي', nameEn: 'Maadi', governorateId: 'cairo', launch: true },
  { id: 'giza_city', nameAr: 'مدينة الجيزة', nameEn: 'Giza City', governorateId: 'giza', launch: true },
  { id: 'sheikh_zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed', governorateId: 'giza', launch: true },
  { id: '6th_october', nameAr: 'السادس من أكتوبر', nameEn: '6th of October', governorateId: 'giza', launch: true },
  { id: 'alexandria_city', nameAr: 'مدينة الإسكندرية', nameEn: 'Alexandria City', governorateId: 'alexandria', launch: false },
];

// Launch coverage zones with per-zone delivery pricing + ETA (business-tunable).
export const EG_ZONES: EgZone[] = [
  { id: 'z_newcairo', nameAr: 'التجمع الخامس', nameEn: 'Fifth Settlement', cityId: 'new_cairo', active: true, deliveryFee: 20, minOrder: 60, etaMin: 25, etaMax: 45 },
  { id: 'z_nasr', nameAr: 'مدينة نصر', nameEn: 'Nasr City', cityId: 'nasr_city', active: true, deliveryFee: 18, minOrder: 50, etaMin: 20, etaMax: 40 },
  { id: 'z_heliopolis', nameAr: 'مصر الجديدة', nameEn: 'Heliopolis', cityId: 'heliopolis', active: true, deliveryFee: 18, minOrder: 50, etaMin: 20, etaMax: 40 },
  { id: 'z_maadi', nameAr: 'المعادي', nameEn: 'Maadi', cityId: 'maadi', active: true, deliveryFee: 22, minOrder: 60, etaMin: 25, etaMax: 45 },
  { id: 'z_zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed', cityId: 'sheikh_zayed', active: true, deliveryFee: 25, minOrder: 70, etaMin: 30, etaMax: 50 },
  { id: 'z_october', nameAr: 'السادس من أكتوبر', nameEn: '6th of October', cityId: '6th_october', active: true, deliveryFee: 25, minOrder: 70, etaMin: 30, etaMax: 50 },
  { id: 'z_dokki', nameAr: 'الدقي والمهندسين', nameEn: 'Dokki & Mohandessin', cityId: 'giza_city', active: true, deliveryFee: 18, minOrder: 50, etaMin: 20, etaMax: 40 },
];

// Delivery pricing rules — the model the fee engine applies on top of the zone base fee.
export const EG_DELIVERY_RULES = {
  currency: 'EGP',
  freeDeliveryThreshold: 250,   // basket ≥ this ⇒ delivery free (EGP)
  perKmSurcharge: 3,            // added per km beyond the zone's included radius (EGP)
  includedRadiusKm: 4,          // km covered by the base zone fee
  peakSurcharge: 8,             // added during peak windows (EGP)
  peakWindows: ['12:00-14:00', '19:00-22:00'],
  smallOrderFee: 5,            // added when basket < zone.minOrder (EGP)
  codEnabled: true,
  serviceFeePercent: 0,        // launch: no customer service fee
} as const;

const activeZones = () => EG_ZONES.filter(z => z.active);

/** Resolve a launch zone by id (falls back to the first active zone). */
export function egZone(zoneId?: string): EgZone { return activeZones().find(z => z.id === zoneId) || activeZones()[0]; }

/** Compute the delivery fee for a zone + basket (business rules applied). Returns EGP. */
export function egDeliveryFee(zoneId: string | undefined, basket: number, opts?: { distanceKm?: number; peak?: boolean }): number {
  const z = egZone(zoneId);
  if (basket >= EG_DELIVERY_RULES.freeDeliveryThreshold) return 0;
  let fee = z.deliveryFee;
  if (basket < z.minOrder) fee += EG_DELIVERY_RULES.smallOrderFee;
  const extraKm = Math.max(0, (opts?.distanceKm ?? 0) - EG_DELIVERY_RULES.includedRadiusKm);
  fee += Math.round(extraKm) * EG_DELIVERY_RULES.perKmSurcharge;
  if (opts?.peak) fee += EG_DELIVERY_RULES.peakSurcharge;
  return fee;
}

/** Human ETA string for a zone, localized. */
export function egEta(zoneId: string | undefined, locale: 'ar' | 'en' = 'ar'): string {
  const z = egZone(zoneId);
  return locale === 'ar' ? `${z.etaMin}–${z.etaMax} دقيقة` : `${z.etaMin}–${z.etaMax} min`;
}

export const EG_LAUNCH_SUMMARY = {
  market: 'Egypt',
  currency: 'EGP',
  launchGovernorates: ['cairo', 'giza'],
  launchCities: EG_CITIES.filter(c => c.launch).length,
  launchZones: activeZones().length,
  roadmap: ['alexandria', 'qalyubia'],
};
