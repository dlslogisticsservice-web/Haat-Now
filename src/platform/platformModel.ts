// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — Enterprise SaaS / White-Label FOUNDATION (PHASE ENTERPRISE-P).
// Additive, backward-compatible registries. Initially seeded with the existing
// HAAT NOW brand/config — NO production data migration, NO mandatory tenant_id.
// This is the future-ready data model only; existing modules are untouched.
// ─────────────────────────────────────────────────────────────────────────────

export type RegistryStatus = 'active' | 'draft' | 'inactive';
export type AppVertical = 'food' | 'market' | 'pharmacy' | 'flowers' | 'express' | 'logistics';
export type ProviderType = 'payment' | 'sms' | 'email' | 'maps' | 'push' | 'storage' | 'analytics' | 'ai';
export type ProviderCategory = 'payment' | 'messaging' | 'maps' | 'storage' | 'analytics' | 'ai';
export type ProviderMode = 'sandbox' | 'production';
export interface ProviderHealth { status: 'connected' | 'failed' | 'unknown'; lastSuccess?: string; lastFailure?: string; lastError?: string; checkedAt?: string }
/** Static definition of a known provider — required credential keys + capabilities. */
export interface ProviderDef { id: string; category: ProviderCategory; type: ProviderType; name: string; requiredKeys: string[]; supportsMode: boolean; envKey?: string }
export interface WebhookLog { id: string; direction: 'incoming' | 'outgoing'; provider: string; event: string; status: 'delivered' | 'failed' | 'retrying'; attempts: number; created_at: string; error?: string }
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
  category?: ProviderCategory; enabled?: boolean; mode?: ProviderMode; config?: Record<string, string>; health?: ProviderHealth; priority?: number;
}

// ── Canonical catalog of supported providers (required credential keys for validation/test) ──
export const PROVIDER_CATALOG: ProviderDef[] = [
  // Payment
  { id: 'stripe', category: 'payment', type: 'payment', name: 'Stripe', requiredKeys: ['publishable_key', 'secret_key', 'webhook_secret'], supportsMode: true },
  { id: 'paymob', category: 'payment', type: 'payment', name: 'Paymob', requiredKeys: ['api_key', 'integration_id', 'hmac_secret'], supportsMode: true },
  { id: 'moyasar', category: 'payment', type: 'payment', name: 'Moyasar', requiredKeys: ['publishable_key', 'secret_key'], supportsMode: true },
  // Messaging
  { id: 'twilio', category: 'messaging', type: 'sms', name: 'Twilio', requiredKeys: ['account_sid', 'auth_token', 'from_number'], supportsMode: false },
  { id: 'whatsapp', category: 'messaging', type: 'sms', name: 'WhatsApp Business', requiredKeys: ['phone_number_id', 'access_token'], supportsMode: false },
  { id: 'fcm', category: 'messaging', type: 'push', name: 'Firebase Messaging', requiredKeys: ['server_key', 'sender_id'], supportsMode: false },
  { id: 'smtp', category: 'messaging', type: 'email', name: 'SMTP', requiredKeys: ['host', 'port', 'username', 'password'], supportsMode: false },
  { id: 'ses', category: 'messaging', type: 'email', name: 'Amazon SES', requiredKeys: ['access_key_id', 'secret_access_key', 'region'], supportsMode: false },
  // Maps
  { id: 'google_maps', category: 'maps', type: 'maps', name: 'Google Maps', requiredKeys: ['api_key'], supportsMode: false, envKey: 'VITE_GOOGLE_MAPS_API_KEY' },
  { id: 'mapbox', category: 'maps', type: 'maps', name: 'Mapbox', requiredKeys: ['access_token'], supportsMode: false },
  { id: 'osm', category: 'maps', type: 'maps', name: 'OpenStreetMap', requiredKeys: [], supportsMode: false },
  // Storage
  { id: 'supabase_storage', category: 'storage', type: 'storage', name: 'Supabase Storage', requiredKeys: ['url', 'service_key'], supportsMode: false, envKey: 'VITE_SUPABASE_URL' },
  { id: 's3', category: 'storage', type: 'storage', name: 'Amazon S3', requiredKeys: ['access_key_id', 'secret_access_key', 'bucket', 'region'], supportsMode: false },
  { id: 'cloudinary', category: 'storage', type: 'storage', name: 'Cloudinary', requiredKeys: ['cloud_name', 'api_key', 'api_secret'], supportsMode: false },
  // Analytics
  { id: 'firebase_analytics', category: 'analytics', type: 'analytics', name: 'Firebase Analytics', requiredKeys: ['measurement_id', 'api_key'], supportsMode: false },
  { id: 'google_analytics', category: 'analytics', type: 'analytics', name: 'Google Analytics', requiredKeys: ['measurement_id'], supportsMode: false },
  { id: 'mixpanel', category: 'analytics', type: 'analytics', name: 'Mixpanel', requiredKeys: ['project_token'], supportsMode: false },
  { id: 'posthog', category: 'analytics', type: 'analytics', name: 'PostHog', requiredKeys: ['api_key', 'host'], supportsMode: false },
  // AI
  { id: 'openai', category: 'ai', type: 'ai', name: 'OpenAI', requiredKeys: ['api_key'], supportsMode: false },
  { id: 'anthropic', category: 'ai', type: 'ai', name: 'Anthropic', requiredKeys: ['api_key'], supportsMode: false },
  { id: 'gemini', category: 'ai', type: 'ai', name: 'Google Gemini', requiredKeys: ['api_key'], supportsMode: false },
];

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
  // Integration registry — instantiated from PROVIDER_CATALOG (the ONE provider registry).
  providers: PROVIDER_CATALOG.map((d, i) => ({
    id: d.id, type: d.type, name: d.name, country: '*', status: 'inactive' as RegistryStatus,
    category: d.category, enabled: false, mode: d.supportsMode ? ('sandbox' as ProviderMode) : undefined,
    config: {}, health: { status: 'unknown' as const }, priority: i + 1,
  })),
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
