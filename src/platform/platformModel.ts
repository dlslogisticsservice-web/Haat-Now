// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — Enterprise SaaS / White-Label FOUNDATION (PHASE ENTERPRISE-P).
// Additive, backward-compatible registries. Initially seeded with the existing
// HAAT NOW brand/config — NO production data migration, NO mandatory tenant_id.
// This is the future-ready data model only; existing modules are untouched.
// ─────────────────────────────────────────────────────────────────────────────

export type RegistryStatus = 'active' | 'draft' | 'inactive';
export type AppVertical = 'food' | 'market' | 'pharmacy' | 'flowers' | 'express' | 'logistics';
export type ProviderType = 'payment' | 'sms' | 'email' | 'maps' | 'push' | 'storage' | 'analytics';
export type FlagState = 'enabled' | 'disabled' | 'beta' | 'experimental';
export type FlagScope = 'global' | 'country' | 'brand' | 'application';
export type EnvName = 'production' | 'staging' | 'development' | 'sandbox';

export interface BrandConfig {
  id: string;
  name: string;
  displayName: string;
  logo: string; darkLogo: string; lightLogo: string; favicon: string; splash: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: string;
  packageName: string; bundleId: string;
  storeLinks: { android: string; ios: string };
  supportEmail: string; supportPhone: string;
  legal: { privacy: string; terms: string };
  status: RegistryStatus;
}

export interface ApplicationConfig {
  id: string; name: string; vertical: AppVertical; enabled: boolean; status: RegistryStatus;
}

export interface ProviderConfig {
  id: string; type: ProviderType; name: string; country: string; status: RegistryStatus;
}

export interface FeatureFlag {
  key: string; label: string; state: FlagState; scope: FlagScope;
}

export interface EnvironmentConfig {
  id: string; name: EnvName; apiEndpoint: string; cdn: string; storage: string; domain: string;
}

export interface PlatformRegistry {
  brands: BrandConfig[];
  applications: ApplicationConfig[];
  providers: ProviderConfig[];
  flags: FeatureFlag[];
  environments: EnvironmentConfig[];
}

// ── Seed: the existing HAAT NOW configuration (from designSystem defaults +
//    capacitor.config.ts + the 6 verticals already present in the home grid). ──
export const DEFAULT_PLATFORM: PlatformRegistry = {
  brands: [{
    id: 'haatnow',
    name: 'HAAT NOW',
    displayName: 'HAAT NOW',
    logo: '', darkLogo: '', lightLogo: '', favicon: '/vite.svg', splash: '',
    colors: { primary: '#a3f95b', secondary: '#a1d667', accent: '#88dc41' },
    fonts: 'Cairo',
    packageName: 'com.haatnow.app', bundleId: 'com.haatnow.app',
    storeLinks: { android: '', ios: '' },
    supportEmail: 'support@hatnow.com', supportPhone: '',
    legal: { privacy: '', terms: '' },
    status: 'active',
  }],
  applications: [
    { id: 'app-food', name: 'Food', vertical: 'food', enabled: true, status: 'active' },
    { id: 'app-market', name: 'Market', vertical: 'market', enabled: true, status: 'active' },
    { id: 'app-pharmacy', name: 'Pharmacy', vertical: 'pharmacy', enabled: true, status: 'active' },
    { id: 'app-flowers', name: 'Flowers', vertical: 'flowers', enabled: true, status: 'active' },
    { id: 'app-express', name: 'Express', vertical: 'express', enabled: false, status: 'draft' },
    { id: 'app-logistics', name: 'Logistics', vertical: 'logistics', enabled: false, status: 'draft' },
  ],
  providers: [
    { id: 'prov-storage', type: 'storage', name: 'Supabase Storage', country: '*', status: 'active' },
    { id: 'prov-maps', type: 'maps', name: 'Google Maps', country: '*', status: 'active' },
    { id: 'prov-sms', type: 'sms', name: 'SMS (test OTP)', country: '*', status: 'active' },
    { id: 'prov-push', type: 'push', name: 'Firebase Cloud Messaging', country: '*', status: 'inactive' },
    { id: 'prov-payment', type: 'payment', name: 'Payment gateway', country: '*', status: 'inactive' },
    { id: 'prov-email', type: 'email', name: 'Email provider', country: '*', status: 'inactive' },
    { id: 'prov-analytics', type: 'analytics', name: 'Analytics provider', country: '*', status: 'inactive' },
  ],
  flags: [
    { key: 'live_map', label: 'Live operations map', state: 'enabled', scope: 'global' },
    { key: 'global_search', label: 'Global search (Ctrl+K)', state: 'enabled', scope: 'global' },
    { key: 'realtime_notifications', label: 'Realtime notification center', state: 'enabled', scope: 'global' },
    { key: 'design_center', label: 'Design Center / Theme Engine', state: 'enabled', scope: 'global' },
    { key: 'experience_builder', label: 'Experience Builder', state: 'beta', scope: 'global' },
    { key: 'audit_logs', label: 'System audit logs', state: 'beta', scope: 'global' },
    { key: 'multi_tenant', label: 'Multi-tenant white-label', state: 'experimental', scope: 'global' },
    { key: 'push_notifications', label: 'Push notifications (mobile)', state: 'disabled', scope: 'global' },
  ],
  environments: [
    { id: 'env-prod', name: 'production', apiEndpoint: '', cdn: '', storage: 'Supabase', domain: '' },
    { id: 'env-sandbox', name: 'sandbox', apiEndpoint: 'localStorage', cdn: '', storage: 'localStorage', domain: 'localhost' },
    { id: 'env-staging', name: 'staging', apiEndpoint: '', cdn: '', storage: '', domain: '' },
    { id: 'env-dev', name: 'development', apiEndpoint: '', cdn: '', storage: '', domain: 'localhost' },
  ],
};
