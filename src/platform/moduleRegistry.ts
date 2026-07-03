// ─────────────────────────────────────────────────────────────────────────────
// Platform Module Registry — the single RUNTIME catalog of the platform's modules.
// There is no other runtime module registry, so this file IS the canonical source
// (derived from docs/governance/SERVICE_REGISTRY.md, the frozen governance record).
// It stores ONLY the metadata that has no live source; everything with a live source
// is resolved at render time and NOT duplicated here:
//   • feature-flag STATE  → platform.service (platformModel flags)   — via flag KEYS below
//   • permission LABELS   → rbac.service (PERMISSIONS)               — via permission KEYS below
//   • doc / source links  → constructed from the real repo paths below
// Pure data + helpers only (no service imports) so it stays a leaf module.
// ─────────────────────────────────────────────────────────────────────────────

export type ModuleStatus = 'stable' | 'beta' | 'experimental' | 'legacy' | 'planned';
export type ModuleHealth = 'operational' | 'degraded' | 'planned' | 'unknown';
export type ModuleGroup =
  | 'Identity' | 'Platform' | 'Experience' | 'Commerce' | 'Finance'
  | 'Operations' | 'Growth' | 'Surfaces';

export interface PlatformModule {
  id: string;
  name: string;
  description: string;
  owner: string;              // owner domain (SERVICE_REGISTRY §7)
  group: ModuleGroup;
  dependencies: string[];     // module ids this module depends on (drives the dependency graph)
  relatedServices: string[];  // real service files (src/services|platform|experience|design)
  status: ModuleStatus;
  productionReady: boolean;
  version: string;
  entryPoint: string;         // real repo path (source entry)
  docPath: string;            // real repo path under docs/
  testCoverage: string;       // honest coverage note (the suite is sandbox E2E journeys)
  featureFlagKeys: string[];  // resolved live against platform.service.flags()
  permissionKeys: string[];   // resolved live against rbac.service.permissions()
  health: ModuleHealth;
}

// Base repo (for "Open documentation" / "Open source entry" — built from paths, not hardcoded URLs per row).
export const REPO_BLOB_BASE = 'https://github.com/dlslogisticsservice-web/Haat-Now/blob/main/';
export const docUrl = (m: PlatformModule) => REPO_BLOB_BASE + m.docPath;
export const sourceUrl = (m: PlatformModule) => REPO_BLOB_BASE + m.entryPoint;

const E2E_FLOW = 'E2E: exercised by journey suite';
const E2E_SMOKE = 'E2E: admin-tab smoke render';
const TYPED = 'Type-checked; not in E2E suite';

export const PLATFORM_MODULES: PlatformModule[] = [
  // ── Identity ────────────────────────────────────────────────────────────────
  { id: 'auth', name: 'Authentication', description: 'Dual-mode phone-OTP auth, session recovery, role & country resolution.',
    owner: 'Identity', group: 'Identity', dependencies: ['rbac'], relatedServices: ['auth.service.ts', 'account.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/auth.service.ts',
    docPath: 'docs/verification/AUTH_VALIDATION_REPORT.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: [], health: 'operational' },
  { id: 'rbac', name: 'RBAC', description: 'Roles, permissions, templates & guards. Live guard is identity-driven; server enforcement is RLS.',
    owner: 'Identity', group: 'Identity', dependencies: ['auth'], relatedServices: ['rbac.service.ts', 'hooks/useRbac.tsx'],
    status: 'stable', productionReady: true, version: '1.1.0', entryPoint: 'src/services/rbac.service.ts',
    docPath: 'docs/verification/RBAC_VALIDATION_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['security.rbac.manage'], health: 'operational' },

  // ── Platform ────────────────────────────────────────────────────────────────
  { id: 'tenant', name: 'Tenant / White-Label', description: 'Tenant config spine: brand, theme, subscription, features, domains, lifecycle.',
    owner: 'Platform', group: 'Platform', dependencies: ['themeEngine', 'subscription', 'adminCrud'], relatedServices: ['tenant.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/tenant.service.ts',
    docPath: 'docs/implementation/WHITE_LABEL_PLATFORM_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: ['multi_tenant'], permissionKeys: ['platform.whitelabel.manage', 'platform.tenants.manage'], health: 'operational' },
  { id: 'subscription', name: 'Subscription', description: 'Plan catalog, trials, usage limits & status. No payment gateway (subscription mgmt only).',
    owner: 'Platform', group: 'Platform', dependencies: ['tenant'], relatedServices: ['subscription.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/subscription.service.ts',
    docPath: 'docs/phases/PHASE_0_1_IMPLEMENTATION_REPORT.md', testCoverage: TYPED, featureFlagKeys: [], permissionKeys: ['platform.tenants.manage'], health: 'operational' },
  { id: 'provisioning', name: 'Provisioning Engine', description: 'Orchestrator-only tenant provisioning: idempotent, resumable, retryable, rollback, verify.',
    owner: 'Platform', group: 'Platform', dependencies: ['tenant', 'subscription', 'rbac', 'themePresets'], relatedServices: ['provisioning.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/provisioning.service.ts',
    docPath: 'docs/phases/PHASE_0_4_IMPLEMENTATION_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['platform.tenants.manage'], health: 'operational' },
  { id: 'templates', name: 'Template Marketplace', description: 'Declarative business-template manifests → generic provisioning spec (business knowledge as data).',
    owner: 'Platform', group: 'Platform', dependencies: ['provisioning', 'themePresets', 'subscription'], relatedServices: ['templates.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/templates.service.ts',
    docPath: 'docs/phases/PHASE_0_5_IMPLEMENTATION_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['platform.tenants.manage'], health: 'operational' },
  { id: 'integrations', name: 'Integration Center', description: 'The one provider registry: providers, feature flags, brands, apps, environments, webhook logs.',
    owner: 'Platform', group: 'Platform', dependencies: ['platformRegistry'], relatedServices: ['platform.service.ts', 'platform/platformModel.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/features/admin/IntegrationCenter.tsx',
    docPath: 'docs/implementation/INTEGRATION_PLATFORM_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['platform.integrations.manage'], health: 'operational' },
  { id: 'platformRegistry', name: 'Platform Registry', description: 'This module. Runtime catalog of platform modules with owner, deps, health, flags & permissions.',
    owner: 'Platform', group: 'Platform', dependencies: ['integrations', 'rbac'], relatedServices: ['platform/moduleRegistry.ts', 'platform.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/features/admin/PlatformModuleRegistry.tsx',
    docPath: 'docs/implementation/PLATFORM_REGISTRY_IMPLEMENTATION_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['platform.tenants.manage'], health: 'operational' },
  { id: 'adminCrud', name: 'CRUD Engine', description: 'Generic dual-mode CRUD engine (localStorage ⇄ Supabase) reused across the platform.',
    owner: 'Platform', group: 'Platform', dependencies: [], relatedServices: ['admin-crud.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/admin-crud.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: [], health: 'operational' },
  { id: 'release', name: 'Release / Version Gate', description: 'App-version gate + maintenance flags from settings; version.json deploy verification.',
    owner: 'Platform', group: 'Platform', dependencies: [], relatedServices: ['release.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/release.service.ts',
    docPath: 'docs/deployment/RELEASE_STATUS.md', testCoverage: TYPED, featureFlagKeys: [], permissionKeys: ['system.settings.manage'], health: 'operational' },
  { id: 'monitoring', name: 'Monitoring', description: 'Crash/event reporting seam (Sentry/analytics via env DSN). Provider-agnostic; no DSN wired by default.',
    owner: 'Platform', group: 'Platform', dependencies: [], relatedServices: ['monitoring.service.ts'],
    status: 'experimental', productionReady: false, version: '0.9.0', entryPoint: 'src/services/monitoring.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: TYPED, featureFlagKeys: [], permissionKeys: [], health: 'degraded' },

  // ── Experience ──────────────────────────────────────────────────────────────
  { id: 'themeEngine', name: 'Theme Engine', description: 'applyDesign() → 40+ CSS vars on :root. One engine; every surface re-skins live, no rebuild.',
    owner: 'Experience', group: 'Experience', dependencies: [], relatedServices: ['design/designSystem.ts', 'design/DesignContext.tsx'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/design/designSystem.ts',
    docPath: 'docs/developer/06-theme-engine.md', testCoverage: E2E_FLOW, featureFlagKeys: ['design_center'], permissionKeys: [], health: 'operational' },
  { id: 'designCenter', name: 'Design Center', description: 'Admin editor for the theme engine + presets + experience + brand assets. Live preview + publish/rollback.',
    owner: 'Experience', group: 'Experience', dependencies: ['themeEngine', 'themePresets', 'brandAssets'], relatedServices: ['features/admin/DesignCenter.tsx'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/features/admin/DesignCenter.tsx',
    docPath: 'docs/developer/14-design-center.md', testCoverage: E2E_SMOKE, featureFlagKeys: ['design_center'], permissionKeys: ['platform.design.manage'], health: 'operational' },
  { id: 'themePresets', name: 'Theme Presets', description: 'Reusable DesignConfig snapshots (save/apply/duplicate/export/import/assign).',
    owner: 'Platform', group: 'Experience', dependencies: ['themeEngine'], relatedServices: ['themePresets.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/themePresets.service.ts',
    docPath: 'docs/phases/PHASE_0_2_IMPLEMENTATION_REPORT.md', testCoverage: TYPED, featureFlagKeys: ['design_center'], permissionKeys: ['platform.design.manage'], health: 'operational' },
  { id: 'brandAssets', name: 'Brand Assets / Media', description: 'Logos, favicon, splash, social + media library (Supabase Storage / data-URL sandbox).',
    owner: 'Experience', group: 'Experience', dependencies: ['themeEngine'], relatedServices: ['experience/assets.service.ts', 'storage.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/experience/assets.service.ts',
    docPath: 'docs/developer/07-brand-assets.md', testCoverage: TYPED, featureFlagKeys: [], permissionKeys: ['platform.whitelabel.manage'], health: 'operational' },
  { id: 'cms', name: 'CMS / Experience Builder', description: 'Versioned per-country screen content (splash/login/onboarding), draft/publish/rollback. One CMS.',
    owner: 'Experience', group: 'Experience', dependencies: ['themeEngine', 'brandAssets'], relatedServices: ['experience/experience.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/experience/experience.service.ts',
    docPath: 'docs/developer/13-cms.md', testCoverage: E2E_SMOKE, featureFlagKeys: ['experience_builder'], permissionKeys: [], health: 'operational' },
  { id: 'notifications', name: 'Notifications', description: 'In-app notifications + broadcast + push tokens + realtime channel. Outbound push/SMS needs a provider.',
    owner: 'Experience', group: 'Experience', dependencies: [], relatedServices: ['notification.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/notification.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_FLOW, featureFlagKeys: ['realtime_notifications', 'push_notifications'], permissionKeys: ['system.notifications.manage'], health: 'operational' },
  { id: 'cx', name: 'Customer Care / CX', description: 'Support tickets, reviews + moderation, favorites, reorder, tracking, search/discovery.',
    owner: 'Experience', group: 'Experience', dependencies: [], relatedServices: ['cx.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/cx.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: ['support.view', 'support.reply', 'support.close'], health: 'operational' },

  // ── Commerce ────────────────────────────────────────────────────────────────
  { id: 'orders', name: 'Orders', description: 'Order lifecycle (create/status/cancel) with notifications. Sandbox lifecycle via sandboxStore.',
    owner: 'Commerce', group: 'Commerce', dependencies: ['notifications'], relatedServices: ['order.service.ts', 'sandboxStore.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/order.service.ts',
    docPath: 'docs/developer/03-system-architecture.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: ['orders.view', 'orders.manage', 'orders.cancel'], health: 'operational' },
  { id: 'catalog', name: 'Catalog & Inventory', description: 'Products, variants, images, categories, favorites, reviews + stock control.',
    owner: 'Commerce', group: 'Commerce', dependencies: [], relatedServices: ['product.service.ts', 'inventory.service.ts', 'merchant.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/product.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: ['catalog.products.manage', 'catalog.categories.manage'], health: 'operational' },
  { id: 'cart', name: 'Cart & Checkout', description: 'Cart (local + remote sync), coupons, payment methods, transaction records.',
    owner: 'Commerce', group: 'Commerce', dependencies: ['payments', 'orders'], relatedServices: ['cart.service.ts', 'checkout.service.ts', 'coupon.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/checkout.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: ['marketing.coupons.manage'], health: 'operational' },

  // ── Finance ─────────────────────────────────────────────────────────────────
  { id: 'payments', name: 'Payment Orchestrator', description: 'Canonical payment path: initiate() → payment-initiate edge fn (Moyasar). COD/wallet real; other gateways config-only.',
    owner: 'Finance', group: 'Finance', dependencies: ['wallet'], relatedServices: ['payment-orchestrator.service.ts'],
    status: 'beta', productionReady: false, version: '0.9.0', entryPoint: 'src/services/payment-orchestrator.service.ts',
    docPath: 'docs/implementation/PAYMENT_CONSOLIDATION_REPORT.md', testCoverage: TYPED, featureFlagKeys: [], permissionKeys: ['finance.refund'], health: 'degraded' },
  { id: 'wallet', name: 'Wallet', description: 'Wallet balances + transactions + atomic delivery completion (complete_delivery RPC).',
    owner: 'Finance', group: 'Finance', dependencies: ['notifications'], relatedServices: ['wallet.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/wallet.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: [], health: 'operational' },
  { id: 'finance', name: 'Finance / Settlements', description: 'Revenue, commission, settlement engine, adjustments, compensation, refunds, accounting exports.',
    owner: 'Finance', group: 'Finance', dependencies: ['wallet'], relatedServices: ['finance.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/finance.service.ts',
    docPath: 'docs/implementation/OPERATIONS_EXECUTION_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['finance.view', 'finance.settle', 'finance.pay', 'finance.refund'], health: 'operational' },

  // ── Operations ──────────────────────────────────────────────────────────────
  { id: 'opsCommand', name: 'Operations Command Center', description: 'Live ops map (drivers/orders/merchants/heatmap), batch dispatch, zone analytics; SVG fallback.',
    owner: 'Operations', group: 'Operations', dependencies: ['dispatch', 'fleet'], relatedServices: ['ops/command.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/features/admin/OperationsCommandCenter.tsx',
    docPath: 'docs/implementation/OPERATIONS_COMMAND_CENTER_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: ['live_map'], permissionKeys: ['ops.command.view'], health: 'operational' },
  { id: 'dispatch', name: 'Dispatch', description: 'Auto/manual dispatch, offers, timeout sweep, reassignment (PostGIS nearest-driver). No-op in sandbox.',
    owner: 'Operations', group: 'Operations', dependencies: ['fleet'], relatedServices: ['ops/dispatch.service.ts'],
    status: 'beta', productionReady: false, version: '0.9.0', entryPoint: 'src/services/ops/dispatch.service.ts',
    docPath: 'docs/implementation/ZONE_MANAGEMENT_REPORT.md', testCoverage: TYPED, featureFlagKeys: [], permissionKeys: ['ops.dispatch.manage', 'ops.zones.manage'], health: 'degraded' },
  { id: 'fleet', name: 'Fleet', description: 'Drivers, vehicles, shifts, performance, GPS tracking, payouts.',
    owner: 'Operations', group: 'Operations', dependencies: [], relatedServices: ['driver.service.ts', 'ops/shift.service.ts', 'ops/performance.service.ts', 'ops/vehicle.service.ts', 'ops/payout.service.ts', 'tracking.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/driver.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: ['fleet.drivers.view', 'fleet.vehicles.manage', 'fleet.performance.view'], health: 'operational' },
  { id: 'onboarding', name: 'KYC / Onboarding', description: 'Merchant/driver KYC & trust onboarding: documents, decisions, suspend/ban, compliance stats.',
    owner: 'Operations', group: 'Operations', dependencies: [], relatedServices: ['onboarding.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/onboarding.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['compliance.kyc.view', 'compliance.kyc.approve', 'compliance.kyc.suspend'], health: 'operational' },
  { id: 'analytics', name: 'Analytics', description: 'Platform/merchant/driver aggregates. Admin dashboard KPIs partly synthetic (audit).',
    owner: 'Operations', group: 'Operations', dependencies: [], relatedServices: ['analytics.service.ts', 'admin.service.ts'],
    status: 'beta', productionReady: false, version: '0.9.0', entryPoint: 'src/services/analytics.service.ts',
    docPath: 'docs/audits/CODEBASE_AUDIT_MASTER_REPORT.md', testCoverage: E2E_SMOKE, featureFlagKeys: ['audit_logs'], permissionKeys: ['security.logs.view'], health: 'degraded' },

  // ── Growth ──────────────────────────────────────────────────────────────────
  { id: 'growth', name: 'Growth', description: 'Referrals, cashback, tiers, affiliates/influencers, segments, message campaigns (growth + growthb).',
    owner: 'Growth', group: 'Growth', dependencies: ['loyalty'], relatedServices: ['growth.service.ts', 'growthb.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/growthb.service.ts',
    docPath: 'docs/implementation/CANONICAL_ARCHITECTURE.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['marketing.growth.view'], health: 'operational' },
  { id: 'loyalty', name: 'Loyalty', description: 'Points balance/history/award/redeem + tiers/rewards. Balance canonicalized to loyalty.service.',
    owner: 'Growth', group: 'Growth', dependencies: [], relatedServices: ['loyalty.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/loyalty.service.ts',
    docPath: 'docs/implementation/CANONICAL_ARCHITECTURE.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: [], health: 'operational' },
  { id: 'campaigns', name: 'Campaigns', description: 'Marketing campaigns (banners/sponsored/seasonal) + tracking/analytics.',
    owner: 'Growth', group: 'Growth', dependencies: [], relatedServices: ['campaign.service.ts'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/services/campaign.service.ts',
    docPath: 'docs/governance/SERVICE_REGISTRY.md', testCoverage: E2E_SMOKE, featureFlagKeys: [], permissionKeys: ['marketing.campaigns.manage'], health: 'operational' },

  // ── Surfaces ────────────────────────────────────────────────────────────────
  { id: 'customerApp', name: 'Customer App', description: 'Marketplace: browse → cart → checkout → order → track → review/reorder → wallet/loyalty → profile.',
    owner: 'Experience', group: 'Surfaces', dependencies: ['orders', 'cart', 'wallet', 'cx'], relatedServices: ['features/home', 'features/checkout', 'features/orders'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/App.tsx',
    docPath: 'docs/apps/CUSTOMER_APP_IMPROVEMENT_REPORT.md', testCoverage: E2E_FLOW, featureFlagKeys: ['global_search'], permissionKeys: [], health: 'operational' },
  { id: 'merchantPortal', name: 'Merchant Portal', description: 'Order queue, kitchen display, catalog, inventory, store settings, wallet, reports.',
    owner: 'Commerce', group: 'Surfaces', dependencies: ['orders', 'catalog', 'wallet'], relatedServices: ['features/merchant/MerchantApp.tsx'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/features/merchant/MerchantApp.tsx',
    docPath: 'docs/apps/MERCHANT_PORTAL_IMPROVEMENT_REPORT.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: [], health: 'operational' },
  { id: 'driverApp', name: 'Captain (Driver) App', description: 'Online toggle, nearby jobs, accept→pickup→deliver→earn, GPS, shift/dispatch/payout. KPIs real in live.',
    owner: 'Operations', group: 'Surfaces', dependencies: ['fleet', 'orders', 'wallet'], relatedServices: ['features/driver/DriverApp.tsx'],
    status: 'stable', productionReady: true, version: '1.1.0', entryPoint: 'src/features/driver/DriverApp.tsx',
    docPath: 'docs/apps/CAPTAIN_V3_PREMIUM_REPORT.md', testCoverage: E2E_FLOW, featureFlagKeys: [], permissionKeys: [], health: 'operational' },
  { id: 'adminPortal', name: 'Admin Portal', description: 'Super/country control plane: ops, finance, KYC, care, growth, RBAC, integrations, design, provisioning, registry.',
    owner: 'Platform', group: 'Surfaces', dependencies: ['rbac', 'opsCommand', 'finance', 'integrations'], relatedServices: ['features/admin/AdminDashboard.tsx'],
    status: 'stable', productionReady: true, version: '1.0.0', entryPoint: 'src/features/admin/AdminDashboard.tsx',
    docPath: 'docs/implementation/ADMIN_UX_COMPLETION_REPORT.md', testCoverage: E2E_FLOW, featureFlagKeys: ['global_search', 'audit_logs'], permissionKeys: [], health: 'operational' },

  // ── Planned ─────────────────────────────────────────────────────────────────
  { id: 'websitePlatform', name: 'Website Platform', description: 'Tenant websites/pages/blog/SEO/domains. Architecture designed; runtime not yet implemented.',
    owner: 'Platform', group: 'Platform', dependencies: ['tenant', 'themeEngine', 'cms', 'brandAssets', 'subscription'], relatedServices: ['(planned) website.service.ts'],
    status: 'planned', productionReady: false, version: '0.0.0', entryPoint: 'docs/architecture/WEBSITE_PLATFORM_ARCHITECTURE.md',
    docPath: 'docs/architecture/WEBSITE_PLATFORM_ARCHITECTURE.md', testCoverage: 'n/a — not implemented', featureFlagKeys: ['multi_tenant'], permissionKeys: ['platform.whitelabel.manage'], health: 'planned' },
];

// ── Pure helpers (leaf; no service imports) ──────────────────────────────────
export const MODULE_GROUPS: ModuleGroup[] = ['Surfaces', 'Platform', 'Identity', 'Experience', 'Commerce', 'Finance', 'Operations', 'Growth'];

export function moduleById(id: string): PlatformModule | undefined {
  return PLATFORM_MODULES.find(m => m.id === id);
}

/** Reverse dependency edges: module id → ids of modules that depend on it. */
export function dependentsOf(id: string): string[] {
  return PLATFORM_MODULES.filter(m => m.dependencies.includes(id)).map(m => m.id);
}

/** Registry health rollup for the header metrics. */
export function registrySummary() {
  const total = PLATFORM_MODULES.length;
  const productionReady = PLATFORM_MODULES.filter(m => m.productionReady).length;
  const operational = PLATFORM_MODULES.filter(m => m.health === 'operational').length;
  const degraded = PLATFORM_MODULES.filter(m => m.health === 'degraded').length;
  const planned = PLATFORM_MODULES.filter(m => m.status === 'planned').length;
  return { total, productionReady, operational, degraded, planned };
}
