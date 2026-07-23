// ─────────────────────────────────────────────────────────────────────────────
// Website Runtime Adapter (migration M6) — completes the Runtime Migration.
//
// The website is different from the app channels: its Studio (WebsiteCenter) is itself a
// website tool and used to import the website's rendering primitives directly
// (blocks / MediaPicker / i18n), which was the last remaining admin→website static edge.
//
// This adapter makes the Runtime layer OWN all website loading. Every website primitive the
// Studio needs is exposed here as a lazy bridge that dynamic-imports features/website — the
// only legal bridge. The Studio imports these bridges from runtime/ (admin→runtime, legal)
// and never imports features/website. It also registers a 'website' runtime whose 'pages'
// screen loads the REAL public site app (PublicSiteApp) — same component the live site uses,
// not a preview-only stand-in.
//
// Types come from the neutral services/website.service (not the website feature).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { defineRuntime, type RuntimeAdapter, type RuntimeScreenProps } from '../RuntimeAdapter';
import { registerRuntime } from '../registry';
import type { WebsiteBlock, WebsiteSite } from '../../services/website.service';

// ── Studio bridges — the Runtime owns website loading (dynamic import = the legal bridge) ──

/** The public site's motion/interaction stylesheet, lazy-loaded. */
export const WebsiteBlockStyles = React.lazy(async () => {
  const { BlockStyles } = await import('../../features/website/blocks');
  return { default: BlockStyles };
});

/** One website section rendered through the REAL public SectionShell + BlockRenderer. */
export const WebsiteSection = React.lazy(async () => {
  const { SectionShell, BlockRenderer } = await import('../../features/website/blocks');
  const C: React.FC<{ block: WebsiteBlock; onNav?: (path: string) => void }> = ({ block, onNav }) => (
    <SectionShell block={block}><BlockRenderer block={block} onNav={onNav ?? (() => {})} /></SectionShell>
  );
  return { default: C };
});

/** The website Media Library picker, lazy-loaded. */
export const WebsiteMediaPicker = React.lazy(async () => {
  const { MediaPicker } = await import('../../features/website/MediaPicker');
  return { default: MediaPicker };
});

/** Localize a site (bilingual audit) through the real website i18n — loaded on demand. */
export async function resolveLocalizedSite(site: WebsiteSite, locale: 'ar' | 'en'): Promise<WebsiteSite> {
  const { localizeSite } = await import('../../features/website/i18n');
  return localizeSite(site, locale);
}

// ── Runtime registration — website is a first-class registry channel ──

const loadPublicSite = async () => {
  const { PublicSiteApp } = await import('../../features/website/PublicSiteApp');
  const S: React.FC<RuntimeScreenProps> = () => <PublicSiteApp />;
  return S;
};

export const websiteRuntime: RuntimeAdapter = defineRuntime({
  id: 'website',
  label: { ar: 'الموقع', en: 'Website' },
  form: 'desktop',
  themeTokens: ['--color-primary-fixed', '--color-on-primary-fixed', '--color-tertiary-fixed', '--card-radius', '--button-radius'],
  // The public site app resolves its own tenant/site (host-driven), so it needs no identity.
  screens: [{ id: 'pages', label: { ar: 'الصفحات', en: 'Pages' }, load: loadPublicSite }],
});

// Self-register on import (side-effect): getRuntime('website') resolves once this loads.
registerRuntime(websiteRuntime);
