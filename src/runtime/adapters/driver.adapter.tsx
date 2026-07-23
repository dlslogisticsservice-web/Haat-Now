// ─────────────────────────────────────────────────────────────────────────────
// Driver Runtime Adapter (migration M5).
//
// The third production Runtime Adapter. Exposes the Driver channel to the Studio through
// the RuntimeAdapter contract — the Studio never imports the Driver app.
//
// Like the merchant portal, the driver app is ONE real component (DriverApp) with its own
// internal navigation, so every driver screen resolves to that same real component,
// lazy-loaded via dynamic import (→ out of the Studio's static graph, Guardian-clean) and
// mapping RuntimeContext → its native props. Deep-linking the Studio's screen selector into
// a specific internal screen would need a new DriverApp prop (a feature change), out of scope.
//
// Screen list is single-sourced from the channel registry so it never drifts.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { defineRuntime, type RuntimeAdapter, type RuntimeScreenProps } from '../RuntimeAdapter';
import { registerRuntime } from '../registry';
import { getChannel } from '../../experience-channels/channels';

const noop = () => {};

// One loader — every driver screen renders the real DriverApp (no duplicate path).
const loadDriverApp = async () => {
  const { DriverApp } = await import('../../features/driver/DriverApp');
  const S: React.FC<RuntimeScreenProps> = ({ ctx }) => <DriverApp driverId={ctx.identity?.id ?? ''} onLogout={noop} />;
  return S;
};

const driverScreens = (getChannel('driver')?.screens ?? []).map(s => ({
  id: s.id,
  label: { ar: s.ar, en: s.en },
  requires: ['identity'],
  load: loadDriverApp,
}));

export const driverRuntime: RuntimeAdapter = defineRuntime({
  id: 'driver',
  label: { ar: 'تطبيق المندوب', en: 'Driver App' },
  form: 'mobile',
  themeTokens: ['--color-primary-fixed', '--color-on-primary-fixed', '--color-tertiary-fixed', '--card-radius', '--button-radius'],
  screens: driverScreens,
});

// Self-register on import (side-effect): getRuntime('driver') resolves once this loads.
registerRuntime(driverRuntime);
