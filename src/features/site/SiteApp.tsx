// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Site shell (Wave 3, Parts 1/2).
// The premium public-website shell: header + nav + footer + a page body rendered from
// a published SiteSnapshot. Reuses the SINGLE SnapshotRenderer (no duplicate rendering
// logic) — the SPA injects the exact HTML the edge produces. Responsive, mobile-first,
// glass UI, keyboard-accessible. Mounting is a flagged launch step (see docs). Reusable
// by every tenant (re-skins via theme tokens). No lib/supabase import (guard-safe).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { GlassCard, PrimaryButton, SiteKeyframes, AnimateIn } from './ui/primitives';
import { AppInstallModal } from './AppInstallModal';
import { SnapshotRenderer } from '../../website-platform/rendering/renderer';
import type { SiteSnapshot } from '../../website-platform/publishing/contracts';
import type { MigrationOffer } from '../../website-platform/growth/checkout-migration';

export interface SiteBrand { name: string; logoUrl?: string }
export interface SiteAppProps {
  snapshot: SiteSnapshot;
  path: string;
  locale?: string;
  brand?: SiteBrand;
  /** Called when a nav/link is clicked (client routing). */
  onNavigate: (path: string) => void;
  /** Optional configurable growth offer (app-install / checkout migration). */
  growthOffer?: MigrationOffer;
  onContinueApp?: (deepLink: string, storeUrl: string | null) => void;
}

const NAV: Array<{ label: string; path: string }> = [
  { label: 'Home', path: '/' },
  { label: 'Restaurants', path: '/restaurants' },
  { label: 'Grocery', path: '/grocery' },
  { label: 'Pharmacy', path: '/pharmacy' },
  { label: 'Parcels', path: '/parcel-delivery' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Contact', path: '/contact' },
];
const FOOTER_LINKS: Array<{ label: string; path: string }> = [
  { label: 'About', path: '/about' }, { label: 'Careers', path: '/careers' }, { label: 'Help', path: '/help' },
  { label: 'Privacy', path: '/privacy' }, { label: 'Terms', path: '/terms' }, { label: 'Cookies', path: '/cookie-policy' },
];

export const SiteApp: React.FC<SiteAppProps> = ({ snapshot, path, locale = 'en', brand, onNavigate, growthOffer, onContinueApp }) => {
  const [dismissed, setDismissed] = useState(false);
  const renderer = useMemo(() => new SnapshotRenderer(), []);
  const page = useMemo(
    () => snapshot.pages.find(p => p.path === path && p.locale === locale) ?? snapshot.pages.find(p => p.path === path) ?? snapshot.pages[0],
    [snapshot, path, locale],
  );
  const bodyHtml = useMemo(() => (page ? renderer.renderPageBody(page) : ''), [renderer, page]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
      <SiteKeyframes />

      <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <GlassCard style={{ borderRadius: 0, borderInline: 'none', borderTop: 'none', padding: '12px 18px' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" onClick={() => onNavigate('/')} aria-label={`${brand?.name ?? 'HaaT Now'} home`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
              {brand?.logoUrl ? <img src={brand.logoUrl} alt="" style={{ height: 28 }} /> : <strong style={{ fontSize: 18, color: 'var(--color-primary-fixed)' }}>{brand?.name ?? 'HaaT Now'}</strong>}
            </button>
            <nav aria-label="Primary" style={{ display: 'flex', gap: 4, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
              {NAV.map(item => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  aria-current={item.path === path ? 'page' : undefined}
                  style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: item.path === path ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <PrimaryButton onClick={() => onNavigate('/')} ariaLabel="Get the app">Get the app</PrimaryButton>
          </div>
        </GlassCard>
      </header>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 18px 64px' }}>
        <AnimateIn>
          {/* Reuses the single SnapshotRenderer output (same HTML the edge serves). */}
          <div className="wp-page" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </AnimateIn>
      </main>

      <footer style={{ borderTop: '1px solid var(--color-outline-variant)', padding: '28px 18px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>© {new Date().getFullYear()} {brand?.name ?? 'HaaT Now'}. All rights reserved.</span>
          <nav aria-label="Footer" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {FOOTER_LINKS.map(l => (
              <button key={l.path} type="button" onClick={() => onNavigate(l.path)} style={{ background: 'transparent', border: 'none', color: 'var(--color-on-surface-variant)', fontSize: 13, cursor: 'pointer' }}>{l.label}</button>
            ))}
          </nav>
        </div>
      </footer>

      {growthOffer && !dismissed && (
        <AppInstallModal
          offer={growthOffer}
          onContinueApp={(deepLink, storeUrl) => { onContinueApp?.(deepLink, storeUrl); setDismissed(true); }}
          onContinueWebsite={() => setDismissed(true)}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </div>
  );
};
