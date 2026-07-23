import React, { useState } from 'react';
import { ImageIcon, Plus, Trash2 } from 'lucide-react';
import { MediaPicker } from '../website/MediaPicker';

// ─────────────────────────────────────────────────────────────────────────────
// Website Studio · shared UI primitives. Extracted so the Studio shell AND the
// Marketing OS panels reuse ONE set of atoms (inputs, toggles, buttons, media
// fields) — no duplicated component library. Theme-token styled, RTL-safe.
// ─────────────────────────────────────────────────────────────────────────────

export const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 14 };
export const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', borderRadius: 10, padding: '9px 11px', color: 'var(--color-on-surface)', fontSize: 14, outline: 'none' };
export const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, background: 'var(--color-surface-container-high)', border: 'none', color: 'var(--color-on-surface-variant)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
export const thumb: React.CSSProperties = { width: 44, height: 44, borderRadius: 8, background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', display: 'inline-block', fontSize: 14, textAlign: 'center', lineHeight: '44px' };
export function swap<T>(arr: T[], i: number, j: number): T[] { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; }

// ── Shared Studio interaction core ─────────────────────────────────────────────
// The ONE selection / hover / overlay rendering layer for every Studio. Website Studio
// (`#preview_frame`) is the golden reference; the Application Studio (`#channel_preview`)
// renders the SAME rules by passing its own scope. There is no second copy: the outline,
// the floating toolbar visibility and the identity tag all come from here.
//
// The only per-Studio nuance is the outline radius (website sections are square, app
// surfaces are rounded), exposed as `--wsx-sec-radius` so the rule stays single-sourced.
export const StudioInteractionStyles: React.FC<{ scope: string }> = ({ scope }) => (
  <style>{`${scope} .wsx-sec{position:relative;border-radius:var(--wsx-sec-radius,0);transition:box-shadow .12s ease}${scope} .wsx-sec:hover{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--color-primary-fixed) 55%,transparent)}${scope} .wsx-sec.sel{box-shadow:inset 0 0 0 2px var(--color-primary-fixed)}${scope} .wsx-sec.locked{box-shadow:inset 0 0 0 2px color-mix(in srgb,#f5a623 55%,transparent)}${scope} .wsx-bar{position:absolute;top:8px;inset-inline-end:8px;z-index:5;display:none;gap:4px}${scope} .wsx-sec:hover .wsx-bar,${scope} .wsx-sec.sel .wsx-bar{display:flex}${scope} .wsx-tag{position:absolute;top:8px;inset-inline-start:8px;z-index:5;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--color-primary-fixed);color:var(--color-on-primary-fixed);display:none;align-items:center;gap:4px}${scope} .wsx-sec.sel .wsx-tag,${scope} .wsx-sec.locked .wsx-tag{display:inline-flex}`}</style>
);

/** The floating-toolbar button, shared by both Studios (was pvBtn in WebsiteCenter). */
export const studioOverlayBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 8, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

export const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string; id?: string }> = ({ label, value, onChange, textarea, placeholder, id }) => (
  <label className="block">
    <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
    {textarea
      ? <textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...inputStyle, resize: 'vertical', marginTop: 4 }} />
      : <input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, marginTop: 4 }} />}
  </label>
);
export const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { v: string; label: string }[]; id?: string }> = ({ label, value, onChange, options, id }) => (
  <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
    <select id={id} value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>{options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select>
  </label>
);
export const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; id?: string }> = ({ label, checked, onChange, hint, id }) => (
  <button id={id} onClick={() => onChange(!checked)} className="flex items-center justify-between w-full cursor-pointer" style={{ ...card, padding: '10px 12px' }}>
    <span className="text-left"><span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{label}</span>{hint && <span className="block text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</span>}</span>
    <span style={{ width: 40, height: 22, borderRadius: 999, background: checked ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)', position: 'relative', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, insetInlineStart: checked ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'inset-inline-start .15s' }} />
    </span>
  </button>
);
export const Btn: React.FC<{ onClick: () => void; children: React.ReactNode; primary?: boolean; danger?: boolean; id?: string }> = ({ onClick, children, primary, danger, id }) => (
  <button id={id} onClick={onClick} className="inline-flex items-center gap-1.5 cursor-pointer" style={{
    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
    background: primary ? 'var(--color-primary-fixed)' : danger ? 'rgba(248,113,113,0.14)' : 'var(--color-surface-container-high)',
    color: primary ? 'var(--color-on-primary-fixed)' : danger ? '#f87171' : 'var(--color-on-surface)',
  }}>{children}</button>
);
export const Chip: React.FC<{ label: string; on: boolean; onClick: () => void }> = ({ label, on, onClick }) => (
  <button onClick={onClick} className="text-[11px] px-2.5 py-1 rounded-full cursor-pointer" style={{ background: on ? 'color-mix(in srgb, var(--color-primary-fixed) 18%, transparent)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)', border: on ? '1px solid var(--color-primary-fixed)' : '1px solid var(--color-outline-variant)', fontWeight: 700 }}>{label}</button>
);

export const ItemDel: React.FC<{ onClick: () => void }> = ({ onClick }) => <button onClick={onClick} style={{ ...iconBtn, color: '#f87171', marginBottom: 2 }}><Trash2 size={14} /></button>;

// Editable list of plain strings (feature bullets, tags…). Add / edit / remove inline.
export const StringListField: React.FC<{ label: string; values: string[]; onChange: (v: string[]) => void; L: (a: string, e: string) => string }> = ({ label, values, onChange, L }) => (
  <div>
    <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
    <div className="space-y-1.5 mt-1">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input value={v} onChange={e => onChange(values.map((x, j) => j === i ? e.target.value : x))} style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} />
          <ItemDel onClick={() => onChange(values.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button onClick={() => onChange([...values, ''])} className="text-[11px] font-bold cursor-pointer" style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: 'none' }}>+ {L('إضافة', 'Add')}</button>
    </div>
  </div>
);

// Media field — reuses the Media Library picker (assets.service). No free-text media entry.
export const MediaField: React.FC<{ label: string; value: string; kind?: 'image' | 'video'; onChange: (u: string) => void; lang: 'ar' | 'en' }> = ({ label, value, kind = 'image', onChange, lang }) => {
  const [open, setOpen] = useState(false);
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  return (
    <div>
      <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <div className="flex items-center gap-2 mt-1">
        {value ? (kind === 'video' ? <span style={thumb}>▶</span> : <img src={value} alt="" style={{ ...thumb, objectFit: 'cover' } as any} />) : <span style={{ ...thumb, display: 'grid', placeItems: 'center', color: 'var(--color-on-surface-variant)' }}><ImageIcon size={16} /></span>}
        <button onClick={() => setOpen(true)} className="text-[12px] font-bold cursor-pointer" style={{ padding: '7px 12px', borderRadius: 9, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: 'none' }}>{L('من المكتبة', 'From library')}</button>
        {value && <button onClick={() => onChange('')} className="text-[12px] cursor-pointer" style={{ color: '#f87171', background: 'transparent', border: 'none' }}>{L('مسح', 'Clear')}</button>}
      </div>
      <MediaPicker open={open} kind={kind} onPick={onChange} onClose={() => setOpen(false)} lang={lang} />
    </div>
  );
};
export const MediaListField: React.FC<{ label: string; values: string[]; kind?: 'image' | 'video'; onChange: (v: string[]) => void; lang: 'ar' | 'en' }> = ({ label, values, kind = 'image', onChange, lang }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <div className="flex flex-wrap gap-2 mt-1">
        {values.map((v, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img src={v} alt="" style={{ ...thumb, objectFit: 'cover' } as any} />
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 18, height: 18, borderRadius: 999, background: '#f87171', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: '18px' }}>×</button>
          </div>
        ))}
        <button onClick={() => setOpen(true)} style={{ ...thumb, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px dashed var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}><Plus size={16} /></button>
      </div>
      <MediaPicker open={open} kind={kind} onPick={u => onChange([...values, u])} onClose={() => setOpen(false)} lang={lang} />
    </div>
  );
};
