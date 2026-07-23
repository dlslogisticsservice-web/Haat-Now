// ─────────────────────────────────────────────────────────────────────────────
// Merchant Runtime Adapter (migration M4).
//
// The second production Runtime Adapter. Exposes the Merchant channel to the Studio through
// the RuntimeAdapter contract — the Studio never imports the Merchant app.
//
// The merchant portal is ONE real component (MerchantApp) with its own internal navigation,
// so every merchant screen resolves to that same real component (lazy-loaded via dynamic
// import → out of the Studio's static graph, Guardian-clean). It opens at the portal's
// default screen and its own nav moves within it. Deep-linking the Studio's screen selector
// into a specific internal screen would require a new MerchantApp prop (a feature change),
// which is out of scope for M4 — see "remaining work".
//
// Screen list is single-sourced from the channel registry (getChannel) so it never drifts.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { defineRuntime, type RuntimeAdapter, type RuntimeScreenProps } from '../RuntimeAdapter';
import { registerRuntime } from '../registry';
import { getChannel } from '../../experience-channels/channels';

const noop = () => {};

// One loader — every merchant screen renders the real MerchantApp (no duplicate path).
const loadMerchantApp = async () => {
  const { MerchantApp } = await import('../../features/merchant/MerchantApp');
  const S: React.FC<RuntimeScreenProps> = ({ ctx }) => <MerchantApp merchantId={ctx.identity?.id ?? ''} onLogout={noop} />;
  return S;
};

const merchantScreens = (getChannel('merchant')?.screens ?? []).map(s => ({
  id: s.id,
  label: { ar: s.ar, en: s.en },
  requires: ['identity'],
  load: loadMerchantApp,
}));

export const merchantRuntime: RuntimeAdapter = defineRuntime({
  id: 'merchant',
  label: { ar: 'تطبيق التاجر', en: 'Merchant App' },
  form: 'desktop',
  themeTokens: ['--color-primary-fixed', '--color-on-primary-fixed', '--color-tertiary-fixed', '--card-radius', '--button-radius'],
  screens: merchantScreens,
});

// Self-register on import (side-effect): getRuntime('merchant') resolves once this loads.
registerRuntime(merchantRuntime);
