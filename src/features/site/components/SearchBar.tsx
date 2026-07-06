// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · SearchBar (Wave 4, Part 4). Premium autocomplete search with
// recent/popular/trending suggestions. Uses the pure search engine; no lib/supabase.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { GlassCard } from '../ui/primitives';
import { autocomplete, type SearchableItem } from '../../../website-platform/search/search';

export interface SearchBarProps {
  items: ReadonlyArray<SearchableItem>;
  recent?: ReadonlyArray<string>;
  popular?: ReadonlyArray<string>;
  trending?: ReadonlyArray<string>;
  onSearch: (term: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ items, recent = [], popular = [], trending = [], onSearch, placeholder = 'Search restaurants, groceries, pharmacy…' }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => (q.trim() ? autocomplete(items, q, 8) : []), [items, q]);

  const submit = (term: string) => { setQ(term); setOpen(false); onSearch(term); };

  const Chip: React.FC<{ label: string }> = ({ label }) => (
    <button type="button" onClick={() => submit(label)} style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--color-outline-variant)', background: 'transparent', color: 'var(--color-on-surface-variant)', fontSize: 12, cursor: 'pointer' }}>{label}</button>
  );

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 640 }}>
      <label htmlFor="wp_search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search</label>
      <input
        id="wp_search"
        value={q}
        placeholder={placeholder}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter') submit(q); if (e.key === 'Escape') setOpen(false); }}
        role="combobox"
        aria-expanded={open}
        aria-controls="wp_search_pop"
        aria-autocomplete="list"
        style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 15, outline: 'none' }}
      />
      {open && (
        <GlassCard id="wp_search_pop" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 60, padding: 12 }}>
          {suggestions.length > 0 ? (
            <ul role="listbox" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {suggestions.map(s => (
                <li key={s} role="option" aria-selected={false}>
                  <button type="button" onClick={() => submit(s)} style={{ display: 'block', width: '100%', textAlign: 'start', padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-on-surface)', fontSize: 14, cursor: 'pointer' }}>{s}</button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recent.length > 0 && <Section title="Recent" chips={recent} render={Chip} />}
              {popular.length > 0 && <Section title="Popular" chips={popular} render={Chip} />}
              {trending.length > 0 && <Section title="Trending" chips={trending} render={Chip} />}
              {recent.length + popular.length + trending.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', margin: '4px 6px' }}>Start typing to search.</p>}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; chips: ReadonlyArray<string>; render: React.FC<{ label: string }> }> = ({ title, chips, render: Chip }) => (
  <div>
    <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-on-surface-variant)', margin: '0 6px 6px' }}>{title.toUpperCase()}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 4px' }}>{chips.map(c => <Chip key={c} label={c} />)}</div>
  </div>
);
