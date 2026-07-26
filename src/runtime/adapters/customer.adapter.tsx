// ─────────────────────────────────────────────────────────────────────────────
// Customer Runtime Adapter (migration M3).
//
// The first production Runtime Adapter. It exposes the Customer channel's real screens to
// the Studio through the RuntimeAdapter contract — the Studio never imports a customer
// screen. Each screen is LAZY-loaded via dynamic import(), which keeps the customer
// implementation out of the Studio's static module graph (no cycle, Guardian-clean), and
// each `load()` returns a thin wrapper that maps the RuntimeContext to the real screen's
// native props. Same components the live app renders — no placeholders, no second render path.
//
// Lives under src/runtime/ (a neutral seam), so it may reference features via dynamic import;
// it is not subject to the features-cannot-import-features rule (M2), which scans src/features.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { defineRuntime, type RuntimeAdapter, type RuntimeScreenProps } from '../RuntimeAdapter';
import { registerRuntime } from '../registry';

const noop = () => {};
const cid = (ctx: RuntimeScreenProps['ctx']) => ctx.identity?.id ?? '';

export const customerRuntime: RuntimeAdapter = defineRuntime({
  id: 'customer',
  label: { ar: 'تطبيق العميل', en: 'Customer App' },
  form: 'mobile',
  themeTokens: ['--color-primary-fixed', '--color-on-primary-fixed', '--color-tertiary-fixed', '--card-radius', '--button-radius'],
  screens: [
    // ── Entry Experience (Phase 8I) — model-driven, animated, pre-auth (no identity required),
    // so they mount and preview in any mode. One renderer, five kinds. The 'landing' screen is the
    // Authentication Landing (entry kind 'auth'). ──
    ...([
      ['splash', 'splash', { ar: 'الشاشة الافتتاحية', en: 'Splash' }],
      ['intro', 'intro', { ar: 'التعريف', en: 'Intro' }],
      ['welcome', 'welcome', { ar: 'الترحيب', en: 'Welcome' }],
      ['landing', 'auth', { ar: 'تسجيل الدخول', en: 'Auth Landing' }],
      ['onboarding', 'onboarding', { ar: 'الإعداد', en: 'Onboarding' }],
    ] as const).map(([screenId, kind, label]) => ({
      id: screenId,
      label,
      requires: [] as string[],
      load: async () => {
        const { EntryExperience } = await import('../../experience-entry/EntryExperience');
        const S: React.FC<RuntimeScreenProps> = () => <EntryExperience kind={kind} />;
        return S;
      },
    })),
    // ── Privacy & Security → Delete Account (Phase 8I · Apple compliance UI, no backend) ──
    {
      id: 'privacy', label: { ar: 'الخصوصية والأمان', en: 'Privacy & Security' }, requires: [] as string[],
      load: async () => {
        const { DeleteAccountFlow } = await import('../../experience-entry/DeleteAccountFlow');
        const S: React.FC<RuntimeScreenProps> = ({ ctx }) => <DeleteAccountFlow lang={ctx.locale} />;
        return S;
      },
    },
    {
      id: 'home', label: { ar: 'الرئيسية', en: 'Home' }, requires: ['identity'],
      load: async () => {
        const { HomeScreen } = await import('../../features/home/HomeScreen');
        const S: React.FC<RuntimeScreenProps> = ({ ctx }) => (
          <HomeScreen customerId={cid(ctx)} selectedCat={null} onSelectCat={noop} searchQuery="" onSearchQuery={noop} onSelectRestaurant={noop} onNavigateToWallet={noop} />
        );
        return S;
      },
    },
    {
      id: 'wallet', label: { ar: 'المحفظة', en: 'Wallet' }, requires: ['identity'],
      load: async () => {
        const { WalletScreen } = await import('../../features/wallet/WalletScreen');
        const S: React.FC<RuntimeScreenProps> = ({ ctx }) => <WalletScreen customerId={cid(ctx)} />;
        return S;
      },
    },
    {
      id: 'profile', label: { ar: 'الملف الشخصي', en: 'Profile' }, requires: ['identity'],
      load: async () => {
        const { ProfileScreen } = await import('../../features/profile/ProfileScreen');
        const S: React.FC<RuntimeScreenProps> = ({ ctx }) => (
          <ProfileScreen session={{ id: cid(ctx), phone_number: ctx.identity?.phone ?? '', role: ctx.identity?.role ?? 'customer' }} onLogout={noop} />
        );
        return S;
      },
    },
    {
      id: 'orders', label: { ar: 'الطلبات', en: 'Orders' }, requires: ['identity'],
      load: async () => {
        const { OrdersList } = await import('../../features/orders/OrdersList');
        const S: React.FC<RuntimeScreenProps> = ({ ctx }) => <OrdersList customerId={cid(ctx)} selectedOrderIdInit={undefined} onSelectOrderBack={noop} />;
        return S;
      },
    },
    {
      id: 'search', label: { ar: 'البحث', en: 'Search' }, requires: ['identity'],
      load: async () => {
        const { DiscoverScreen } = await import('../../features/discover/DiscoverScreen');
        const S: React.FC<RuntimeScreenProps> = ({ ctx }) => <DiscoverScreen customerId={cid(ctx)} onOpenBranch={noop} />;
        return S;
      },
    },
    {
      id: 'categories', label: { ar: 'الفئات', en: 'Categories' }, requires: ['identity'],
      load: async () => {
        const { DiscoverScreen } = await import('../../features/discover/DiscoverScreen');
        const S: React.FC<RuntimeScreenProps> = ({ ctx }) => <DiscoverScreen customerId={cid(ctx)} onOpenBranch={noop} />;
        return S;
      },
    },
  ],
});

// Self-register on import (side-effect): importing this module makes the customer runtime
// available via getRuntime('customer'). Idempotent by id.
registerRuntime(customerRuntime);
