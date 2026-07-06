// Breadcrumbs (Wave 4, Part 3) — renders the derived breadcrumb trail + BreadcrumbList
// microdata. No lib/supabase.
import React from 'react';
import type { Breadcrumb } from '../../../website-platform/navigation/navigation';

export const Breadcrumbs: React.FC<{ items: ReadonlyArray<Breadcrumb>; onNavigate: (href: string) => void }> = ({ items, onNavigate }) => {
  if (items.length <= 1) return null;
  return (
    <nav aria-label="Breadcrumb" style={{ padding: '4px 0 16px' }}>
      <ol itemScope itemType="https://schema.org/BreadcrumbList" style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, margin: 0, padding: 0, fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
        {items.map((c, i) => (
          <li key={c.href} itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i < items.length - 1 ? (
              <button type="button" itemProp="item" onClick={() => onNavigate(c.href)} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary-fixed)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                <span itemProp="name">{c.label}</span>
              </button>
            ) : (
              <span itemProp="name" aria-current="page" style={{ color: 'var(--color-on-surface)' }}>{c.label}</span>
            )}
            <meta itemProp="position" content={String(i + 1)} />
            {i < items.length - 1 && <span aria-hidden="true">›</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
};
