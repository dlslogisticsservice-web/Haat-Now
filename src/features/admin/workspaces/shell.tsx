// Shared workspace shell — the reusable layout pieces extracted from the Driver
// Workspace reference (header, stat grid, tab bar, key/value row). NOT an engine:
// each workspace composes these with its OWN real-service data + tabs.
import React from 'react';
import type { LucideIcon } from 'lucide-react';

export const wsCard: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

export const wsFmt = (lang: 'ar' | 'en', d?: string) =>
  d ? new Date(d).toLocaleString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/** Profile header: icon tile + title + subtitle + optional right-side badge. */
export const WsHeader: React.FC<{ Icon: LucideIcon; title: string; subtitle?: React.ReactNode; badge?: React.ReactNode }> = ({ Icon, title, subtitle, badge }) => (
  <div className="flex items-center gap-3 p-3 rounded-2xl" style={wsCard}>
    <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-primary-fixed)' }}><Icon size={22} color="var(--color-on-primary-fixed)" /></span>
    <div className="min-w-0 flex-1">
      <p className="font-extrabold truncate" style={{ color: 'var(--color-on-surface)' }}>{title}</p>
      {subtitle && <p className="text-xs truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{subtitle}</p>}
    </div>
    {badge}
  </div>
);

/** Key/value row. */
export const WsRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={wsCard}>
    <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
    <span className="text-sm font-semibold text-end" style={{ color: 'var(--color-on-surface)' }}>{value ?? '—'}</span>
  </div>
);

export interface WsTab { k: string; ar: string; en: string; Icon: LucideIcon }
export const WsTabBar: React.FC<{ tabs: WsTab[]; active: string; onChange: (k: string) => void; lang: 'ar' | 'en' }> = ({ tabs, active, onChange, lang }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1">
    {tabs.map(t => (
      <button key={t.k} onClick={() => onChange(t.k)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        style={active === t.k ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : wsCard}>
        <t.Icon size={14} />{lang === 'ar' ? t.ar : t.en}
      </button>
    ))}
  </div>
);

/** Resolve a related row's display label by id from a table (real read, sandbox-safe). */
import { adminCrud } from '../../../services/admin-crud.service';
export async function wsResolve(table: string, id: string | undefined, labelKey: string): Promise<string> {
  if (!id) return '';
  try { const { data } = await adminCrud(table).list(); const r = data.find((x: any) => String(x.id) === String(id)); return r ? String(r[labelKey] ?? id) : ''; }
  catch { return ''; }
}
