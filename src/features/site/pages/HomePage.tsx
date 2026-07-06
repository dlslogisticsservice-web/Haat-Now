// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · HomePage (Wave 4, Parts 1/2). A fully CONFIG-DRIVEN homepage:
// it renders the resolved homepage sections (order/visibility/personalization decided
// by the Homepage Builder), with configurable promo banners (Promotion Engine) and
// collections (Collections Platform). No hardcoded content. No lib/supabase.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { GlassCard, PrimaryButton, Badge, AnimateIn, EmptyState } from '../ui/primitives';
import type { HomepageSection } from '../../../website-platform/homepage/homepage';
import type { PromotionBanner } from '../../../website-platform/promotions/promotions';
import type { Collection } from '../../../website-platform/collections/collections';
import type { SearchableItem } from '../../../website-platform/search/search';

export interface HomeCollection { def: Collection; items: SearchableItem[] }

export interface HomePageProps {
  sections: ReadonlyArray<HomepageSection>;
  banners: ReadonlyArray<PromotionBanner>;
  collections: ReadonlyArray<HomeCollection>;
  onNavigate: (href: string) => void;
}

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

export const HomePage: React.FC<HomePageProps> = ({ sections, banners, collections, onNavigate }) => {
  if (sections.length === 0) {
    return <EmptyState title="Homepage not configured yet" hint="Add sections in Website Center." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {sections.map((section, i) => (
        <AnimateIn key={section.id} delayMs={i * 40}>
          {renderSection(section, banners, collections, onNavigate)}
        </AnimateIn>
      ))}
    </div>
  );
};

function renderSection(section: HomepageSection, banners: ReadonlyArray<PromotionBanner>, collections: ReadonlyArray<HomeCollection>, onNavigate: (href: string) => void): React.ReactNode {
  const cfg = section.config;
  switch (section.type) {
    case 'hero':
      return (
        <GlassCard style={{ padding: '40px 28px' }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-on-surface)', margin: 0 }}>{str(cfg.title, section.title ?? 'Everything delivered, fast')}</h1>
          {cfg.subtitle && <p style={{ fontSize: 16, color: 'var(--color-on-surface-variant)', marginTop: 10 }}>{str(cfg.subtitle)}</p>}
          <PrimaryButton onClick={() => onNavigate(str(cfg.ctaHref, '/restaurants'))} style={{ marginTop: 18 }}>{str(cfg.ctaLabel, 'Order now')}</PrimaryButton>
        </GlassCard>
      );
    case 'promo_banners':
      return <BannerRow banners={banners} onNavigate={onNavigate} />;
    case 'collections':
      return <CollectionsRegion collections={collections} onlyKey={str(cfg.collectionKey) || undefined} onNavigate={onNavigate} />;
    case 'categories':
      return <CategoriesRow onNavigate={onNavigate} />;
    case 'app_cta':
      return (
        <GlassCard style={{ padding: '28px', textAlign: 'center' }}>
          <Badge tone="promo">App</Badge>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 6px' }}>{str(cfg.title, 'Get the HaaT Now app')}</h2>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>{str(cfg.subtitle, 'Order in one tap. Track in real time.')}</p>
          <PrimaryButton onClick={() => onNavigate(str(cfg.ctaHref, '/'))} style={{ marginTop: 14 }}>{str(cfg.ctaLabel, 'Get the app')}</PrimaryButton>
        </GlassCard>
      );
    default:
      return section.title ? <h2 style={{ fontSize: 20, fontWeight: 800 }}>{section.title}</h2> : null;
  }
}

const BannerRow: React.FC<{ banners: ReadonlyArray<PromotionBanner>; onNavigate: (href: string) => void }> = ({ banners, onNavigate }) => {
  const homepage = banners.filter(b => b.placement === 'homepage' || b.placement === 'global');
  if (homepage.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
      {homepage.map(b => (
        <GlassCard key={b.id} interactive style={{ padding: 18, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...(b.content.imageUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)), url(${b.content.imageUrl})`, backgroundSize: 'cover', color: '#fff' } : {}) }}>
          <div>
            {b.content.couponCode && <Badge tone="promo">{b.content.couponCode}</Badge>}
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 4px' }}>{b.content.title}</h3>
            {b.content.subtitle && <p style={{ fontSize: 13, opacity: 0.9 }}>{b.content.subtitle}</p>}
          </div>
          {b.content.cta && <PrimaryButton onClick={() => onNavigate(b.content.cta!.href)} style={{ alignSelf: 'flex-start', marginTop: 12 }}>{b.content.cta.label}</PrimaryButton>}
        </GlassCard>
      ))}
    </div>
  );
};

const CollectionsRegion: React.FC<{ collections: ReadonlyArray<HomeCollection>; onlyKey?: string; onNavigate: (href: string) => void }> = ({ collections, onlyKey, onNavigate }) => {
  const shown = onlyKey ? collections.filter(c => c.def.key === onlyKey) : collections;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {shown.map(({ def, items }) => (
        <section key={def.id} aria-label={def.title}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{def.title}</h2>
          {items.length === 0 ? (
            <EmptyState title="Nothing here yet" hint="Check back soon." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {items.map(it => (
                <GlassCard key={it.id} interactive style={{ padding: 14 }} ariaLabel={it.name}>
                  <button type="button" onClick={() => onNavigate(`/restaurants?item=${encodeURIComponent(it.id)}`)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>{it.name}</h3>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                      {it.rating !== undefined && <span>★ {it.rating.toFixed(1)}</span>}
                      {it.deliveryMinutes !== undefined && <span>{it.deliveryMinutes} min</span>}
                    </div>
                  </button>
                </GlassCard>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

const CATEGORIES: Array<{ label: string; href: string }> = [
  { label: 'Restaurants', href: '/restaurants' }, { label: 'Grocery', href: '/grocery' },
  { label: 'Pharmacy', href: '/pharmacy' }, { label: 'Parcels', href: '/parcel-delivery' },
];
const CategoriesRow: React.FC<{ onNavigate: (href: string) => void }> = ({ onNavigate }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
    {CATEGORIES.map(c => (
      <GlassCard key={c.href} interactive style={{ padding: '22px 14px', textAlign: 'center' }}>
        <button type="button" onClick={() => onNavigate(c.href)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', fontWeight: 700, color: 'var(--color-on-surface)' }}>{c.label}</button>
      </GlassCard>
    ))}
  </div>
);
