// ─────────────────────────────────────────────────────────────────────────────
// Runtime Node Inspector (Phase 8B · 8C · 8D · 8F · 8G).
//
// Shows a selected Runtime component's real business identity — name, type, channel/screen,
// CMS source, hierarchy (breadcrumb / instance id / parent / children), binding references,
// and its editable properties with LOCAL editors. Phase 8G surfaces the Edit Transaction
// Engine: each edited property shows its Dirty State (Clean / Pending / Dirty / Invalid /
// Resolved), Validation State, and Previous → Current values, plus a live session-only
// Transaction Log. No Save/Publish button — edits are local, in-memory, transaction-managed.
// Unmapped DOM regions are shown honestly as "unmapped element", never a fake business name.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { MousePointerClick, Info, Layers, Link2, SlidersHorizontal, ChevronRight, Database, Pencil, AlertTriangle, ListChecks, Undo2, Redo2 } from 'lucide-react';
import type { RuntimeNode, ResolvedValue } from '../../runtime/selection/RuntimeNode';
import type { EditablePropSpec } from '../../runtime/StudioMetadata';
import type { RuntimeEditStore, RuntimeTransaction, DirtyState } from '../../runtime/selection/EditStore';
import { isEditable } from './runtimeWriter';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 12 };
const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const val: React.CSSProperties = { fontSize: 12, color: 'var(--color-on-surface)', fontWeight: 600, wordBreak: 'break-all' };
const chip: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' };

// Dirty-state → label + colours. One source of truth for every badge in the inspector.
const STATE_META: Record<DirtyState, { ar: string; en: string; color: string; bg: string }> = {
  clean: { ar: 'نظيف', en: 'Clean', color: 'var(--color-on-surface-variant)', bg: 'var(--color-surface-container-high)' },
  pending: { ar: 'قيد التحقق', en: 'Pending', color: '#c99a00', bg: 'color-mix(in srgb,#c99a00 20%,transparent)' },
  dirty: { ar: 'معدّل', en: 'Dirty', color: 'var(--color-primary-fixed,#a3f95b)', bg: 'color-mix(in srgb,var(--color-primary-fixed,#a3f95b) 20%,transparent)' },
  invalid: { ar: 'غير صالح', en: 'Invalid', color: '#ff6b6b', bg: 'color-mix(in srgb,#ff6b6b 20%,transparent)' },
  resolved: { ar: 'مُسوّى', en: 'Resolved', color: '#5aa9ff', bg: 'color-mix(in srgb,#5aa9ff 20%,transparent)' },
};

/** A small colour-coded pill naming a transaction/instance dirty state. */
const StatePill: React.FC<{ state: DirtyState; lang: 'ar' | 'en'; id?: string; className?: string; extra?: Record<string, string> }> = ({ state, lang, id, className, extra }) => {
  const m = STATE_META[state];
  return <span id={id} className={className} data-state={state} {...extra} style={{ ...chip, fontSize: 9.5, background: m.bg, color: m.color }}>{lang === 'ar' ? m.ar : m.en}</span>;
};

/** Compact, human display of a transaction value (empty → em dash, boolean → On/Off). */
const showVal = (v: string | boolean | undefined, L: (a: string, e: string) => string): string => {
  if (v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? L('نعم', 'On') : L('لا', 'Off');
  return String(v);
};

/** Roll the per-property transaction states up to one instance status. */
function instanceState(txns: RuntimeTransaction[]): DirtyState {
  if (!txns.length) return 'clean';
  if (txns.some(t => t.state === 'invalid')) return 'invalid';
  if (txns.some(t => t.state === 'pending')) return 'pending';
  if (txns.some(t => t.state === 'dirty')) return 'dirty';
  if (txns.some(t => t.state === 'resolved')) return 'resolved';
  return 'clean';
}

// Type-aware, READ-ONLY preview of a resolved live value (thumbnail / chip / disabled toggle …).
function renderValue(rv: ResolvedValue | undefined, L: (a: string, e: string) => string): React.ReactNode {
  if (!rv || rv.kind === 'empty' || rv.value === null || rv.value === '') {
    return <span className="rt-value-empty" style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>—</span>;
  }
  switch (rv.kind) {
    case 'image':
      return <img className="rt-value-image" src={String(rv.value)} alt="" style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-outline-variant)' }} />;
    case 'color':
      return <span className="rt-value-color" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 6, background: String(rv.value), border: '1px solid var(--color-outline-variant)' }} /><code style={{ fontSize: 11, color: 'var(--color-on-surface)' }}>{String(rv.value)}</code></span>;
    case 'bool':
      return (
        <span className="rt-value-bool" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
          <span style={{ width: 34, height: 19, borderRadius: 999, background: rv.value ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, insetInlineStart: rv.value ? 17 : 2, width: 15, height: 15, borderRadius: 999, background: '#fff' }} />
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{rv.value ? L('نعم', 'On') : L('لا', 'Off')}</span>
        </span>
      );
    case 'number':
      return <span className="rt-value-number" style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-on-surface)' }}>{String(rv.value)}</span>;
    case 'count':
      return <span className="rt-value-count" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{String(rv.value)} {L('عنصر', 'items')}</span>;
    default:
      return <span className="rt-value-text" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface)', wordBreak: 'break-word' }}>{String(rv.value)}</span>;
  }
}

export const RuntimeNodeInspector: React.FC<{
  node: RuntimeNode | null;
  lang: 'ar' | 'en';
  onEdit?: (key: string, value: string | boolean) => void;
  /** Phase 8G — the transaction store; drives dirty state, validation, and the transaction log. */
  store?: RuntimeEditStore;
  /** Bumped by the parent on every store change so the transaction UI re-renders live. */
  txTick?: number;
}> = ({ node, lang, onEdit, store }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const nm = (n?: { ar: string; en: string }) => (n ? (lang === 'ar' ? n.ar : n.en) : '');
  // Phase 8D — local edit state (in-memory only), reset when the selected node changes.
  const [edits, setEdits] = useState<Record<string, string | boolean>>({});
  useEffect(() => { setEdits({}); }, [node?.id]);
  const applyEdit = (key: string, value: string | boolean) => { setEdits(e => ({ ...e, [key]: value })); onEdit?.(key, value); };

  const editStyle: React.CSSProperties = { width: '100%', padding: '6px 9px', borderRadius: 8, fontSize: 11.5, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', outline: 'none' };
  // Live LOCAL editor for one editable prop (text / image / color / boolean).
  const renderEditor = (p: EditablePropSpec, rv: ResolvedValue | undefined): React.ReactNode => {
    const cur = p.key in edits ? edits[p.key] : (rv?.value ?? '');
    if (p.type === 'boolean') {
      const on = cur === true;
      return (
        <button id={`rt_toggle_${p.key}`} onClick={() => applyEdit(p.key, !on)} className="cursor-pointer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0 }}>
          <span style={{ width: 34, height: 19, borderRadius: 999, background: on ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, insetInlineStart: on ? 17 : 2, width: 15, height: 15, borderRadius: 999, background: '#fff', transition: 'inset-inline-start .12s' }} />
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{on ? L('نعم', 'On') : L('لا', 'Off')}</span>
        </button>
      );
    }
    if (p.type === 'color') {
      const s = String(cur || '');
      const hex = /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#a3f95b';
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id={`rt_color_${p.key}`} type="color" value={hex} onChange={e => applyEdit(p.key, e.target.value)} style={{ width: 34, height: 30, border: '1px solid var(--color-outline-variant)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
          <input value={s} onChange={e => applyEdit(p.key, e.target.value)} style={{ ...editStyle, flex: 1 }} />
        </div>
      );
    }
    if (p.type === 'image') {
      const s = String(cur || '');
      return (
        <div style={{ display: 'grid', gap: 6 }}>
          <input id={`rt_image_${p.key}`} value={s} placeholder="https://…" onChange={e => applyEdit(p.key, e.target.value)} style={editStyle} />
          {s && <img src={s} alt="" style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-outline-variant)' }} />}
        </div>
      );
    }
    // text / richtext / url
    return <input id={`rt_edit_${p.key}`} value={String(cur ?? '')} onChange={e => applyEdit(p.key, e.target.value)} style={editStyle} />;
  };

  if (!node) {
    return (
      <div id="runtime_node_inspector" data-empty="1" dir={dir} style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...card, padding: 14, display: 'grid', gap: 8, placeItems: 'center', textAlign: 'center' }}>
          <MousePointerClick size={22} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{L('اختر مكوّناً', 'Select a component')}</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('مرّر فوق التطبيق الحيّ ثم انقر أي مكوّن لتحديده.', 'Hover the live app and click any component to select it.')}</p>
        </div>
      </div>
    );
  }

  const md = node.studioComponent;
  const resolved = node.resolvedValues || {};
  // Phase 8G — the transactions for THIS instance drive its per-property + rolled-up status.
  const nodeTxns = store?.transactionsForNode(node.id) ?? [];
  const instState = instanceState(nodeTxns);
  // Phase 8H — undo/redo stack state for the timeline + controls.
  const canUndo = store?.canUndo() ?? false;
  const canRedo = store?.canRedo() ?? false;
  const histIndex = store?.historyIndex() ?? -1;
  const histCount = store?.historyCount() ?? 0;
  const hist = store?.historyView() ?? [];

  // Unmapped region — honest fallback (no fabricated business name).
  if (!node.mapped || !md) {
    return (
      <div id="runtime_node_inspector" data-node-id={node.id} data-mapped="0" dir={dir} style={{ display: 'grid', gap: 10 }}>
        <div>
          <span style={lbl}>{L('عنصر غير مُعرَّف', 'Unmapped element')}</span>
          <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface)' }}>{node.component}</h3>
        </div>
        <div style={{ ...card, padding: 12, display: 'grid', gap: 9 }}>
          <div style={{ display: 'grid', gap: 2 }}><span style={lbl}>{L('القناة/الشاشة', 'Channel / screen')}</span><span style={val}>{node.channel} · {node.screen}</span></div>
          <div style={{ display: 'grid', gap: 2 }}><span style={lbl}>{L('العمق', 'Depth')}</span><span style={val}>{node.path.length}</span></div>
          <div style={{ display: 'grid', gap: 2 }}><span style={lbl}>{L('الأبعاد', 'Bounds')}</span><span style={val}>{Math.round(node.bounds.width)}×{Math.round(node.bounds.height)}</span></div>
        </div>
        <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('هذا العنصر ليس مكوّن استوديو مُعرَّفاً. المكوّنات المُعرَّفة تُظهر هويّتها الكاملة.', 'This region is not a declared Studio component. Declared components resolve to their full identity.')}</p>
      </div>
    );
  }

  return (
    <div id="runtime_node_inspector" data-node-id={node.id} data-mapped="1" data-component={md.id} dir={dir} style={{ display: 'grid', gap: 10 }}>
      {/* Identity */}
      <div>
        <span style={lbl}>{L('مكوّن الاستوديو', 'Studio component')}</span>
        <h3 id="runtime_component_name" style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: 'var(--color-on-surface)' }}>{node.component}</h3>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {md.type && <span style={{ ...chip, background: 'color-mix(in srgb,var(--color-primary-fixed) 16%,transparent)', color: 'var(--color-primary-fixed,#a3f95b)' }}>{md.type}</span>}
          <span style={chip}>{node.channel}</span>
          <span style={chip}>{node.screen}</span>
          {md.cmsSection && <span style={chip}><Database size={9} style={{ display: 'inline', marginInlineEnd: 3 }} />{md.cmsSection}</span>}
          {onEdit && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginInlineStart: 'auto' }}>
              <span style={lbl}>{L('الحالة', 'Status')}</span>
              <StatePill state={instState} lang={lang} id="runtime_instance_status" className="rt-instance-status" />
            </span>
          )}
        </div>
      </div>

      {/* Undo / Redo controls (Phase 8H) — drive the transaction stack; keyboard Ctrl/⌘+Z / +Shift+Z / +Y too. */}
      {onEdit && store && (
        <div style={{ ...card, padding: 10, display: 'flex', alignItems: 'center', gap: 8 }} id="runtime_undo_redo" data-can-undo={canUndo ? '1' : '0'} data-can-redo={canRedo ? '1' : '0'}>
          <button id="runtime_undo_btn" onClick={() => store.undo()} disabled={!canUndo} title={L('تراجع (Ctrl+Z)', 'Undo (Ctrl+Z)')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--color-outline-variant)', fontSize: 11.5, fontWeight: 700, cursor: canUndo ? 'pointer' : 'not-allowed', opacity: canUndo ? 1 : 0.4, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
            <Undo2 size={13} />{L('تراجع', 'Undo')}
          </button>
          <button id="runtime_redo_btn" onClick={() => store.redo()} disabled={!canRedo} title={L('إعادة (Ctrl+Shift+Z)', 'Redo (Ctrl+Shift+Z)')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--color-outline-variant)', fontSize: 11.5, fontWeight: 700, cursor: canRedo ? 'pointer' : 'not-allowed', opacity: canRedo ? 1 : 0.4, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
            <Redo2 size={13} />{L('إعادة', 'Redo')}
          </button>
          <span style={{ marginInlineStart: 'auto', ...lbl }}>{L('المعاملة', 'Transaction')}</span>
          <span id="runtime_tx_index" style={{ ...chip, fontFamily: 'ui-monospace,monospace', fontSize: 10.5 }}>{histIndex + 1} / {histCount}</span>
        </div>
      )}

      {/* Hierarchy */}
      <div style={{ ...card, padding: 12, display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}><Layers size={12} />{L('التسلسل الهرمي', 'Hierarchy')}</p>
        <div id="runtime_breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', fontSize: 11 }}>
          <span style={{ color: 'var(--color-on-surface-variant)' }}>{node.channel}</span><ChevronRight size={11} />
          <span style={{ color: 'var(--color-on-surface-variant)' }}>{node.screen}</span>
          {(node.breadcrumb ?? []).map((b, i) => (
            <React.Fragment key={i}><ChevronRight size={11} /><span style={{ color: i === (node.breadcrumb!.length - 1) ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface)', fontWeight: 700 }}>{b}</span></React.Fragment>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 2 }}><span style={lbl}>{L('معرّف النسخة', 'Instance ID')}</span><span id="runtime_instance_id" style={{ ...val, color: 'var(--color-primary-fixed,#a3f95b)' }}>{node.instanceId ?? '—'}</span></div>
        <div style={{ display: 'grid', gap: 2 }}><span style={lbl}>{L('مسار وقت التشغيل', 'Runtime path')}</span><span style={{ ...val, fontFamily: 'ui-monospace,monospace', fontSize: 10.5 }}>{node.id}</span></div>
        <div style={{ display: 'grid', gap: 2 }}><span style={lbl}>{L('الأصل', 'Parent')}</span><span style={val}>{md.parent ?? L('الجذر', 'root')}{node.parentInstance ? ` · ${node.parentInstance}` : ''}</span></div>
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={lbl}>{L('الأبناء', 'Children')}</span>
          {(node.childComponents && node.childComponents.length) ? (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{node.childComponents.map(c => <span key={c} style={chip}>{c}</span>)}</div>
          ) : <span style={{ ...val, color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>{L('لا يوجد', 'none')}</span>}
        </div>
      </div>

      {/* Bindings */}
      <div style={{ ...card, padding: 12, display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}><Link2 size={12} />{L('مراجع الربط', 'Binding references')}</p>
        {md.bindings.length ? md.bindings.map((b, i) => (
          <div key={i} className="rt-binding" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ ...chip, background: 'var(--color-surface-container-high)' }}>{b.source}</span>
            <code style={{ fontSize: 11, color: 'var(--color-on-surface)' }}>{b.path}</code>
            {b.readonly && <span style={{ fontSize: 9, color: 'var(--color-on-surface-variant)' }}>{L('قراءة فقط', 'read-only')}</span>}
          </div>
        )) : <span style={{ ...val, color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>{L('لا مراجع ربط', 'no bindings')}</span>}
      </div>

      {/* Live property values — resolved from the running runtime, shown READ-ONLY */}
      <div style={{ ...card, padding: 12, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}><SlidersHorizontal size={12} />{onEdit ? L('القيم الحيّة (تحرير محلّي)', 'Live values (local editing)') : L('القيم الحيّة (قراءة فقط)', 'Live values (read-only)')}</p>
        {md.editableProps.length ? md.editableProps.map(p => {
          const rv = resolved[p.key];
          const canEdit = !!onEdit && isEditable(p.type);
          const tx = store?.transactionFor(node.id, p.key);
          return (
            <div key={p.key} className="rt-prop" data-prop={p.key} data-state={tx?.state ?? 'clean'} style={{ display: 'grid', gap: 4, paddingBottom: 8, borderBottom: '1px solid var(--color-outline-variant)' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-on-surface)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{canEdit && <Pencil size={10} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />}{nm(p.label)}</span>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  {tx && <StatePill state={tx.state} lang={lang} className="rt-prop-state" extra={{ 'data-prop-state': p.key }} />}
                  <span style={{ ...chip, fontSize: 9.5 }}>{p.type}</span>
                </span>
              </span>
              <div className="rt-value">{canEdit ? renderEditor(p, rv) : renderValue(rv, L)}</div>
              {/* Validation error — shown immediately, so an invalid edit is impossible to miss. */}
              {tx && !tx.valid && tx.error && (
                <span className="rt-prop-error" data-prop-error={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#ff6b6b' }}>
                  <AlertTriangle size={10} />{tx.error}
                </span>
              )}
              {p.binding && <code style={{ fontSize: 9.5, color: 'var(--color-on-surface-variant)' }}>{p.binding.path}</code>}
              {/* Transaction Status — previous → current for the managed transaction. */}
              {tx ? (
                <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9, color: 'var(--color-on-surface-variant)' }}>
                  <span className="rt-prop-prev">{L('السابق', 'Previous')}: <b style={{ color: 'var(--color-on-surface)' }}>{showVal(tx.previousValue, L)}</b></span>
                  <span className="rt-prop-current">{L('الحالي', 'Current')}: <b style={{ color: tx.valid ? 'var(--color-on-surface)' : '#ff6b6b' }}>{showVal(tx.currentValue, L)}</b></span>
                  <span className="rt-prop-txid" style={{ fontFamily: 'ui-monospace,monospace' }}>{tx.id}</span>
                </span>
              ) : (
                <span style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--color-on-surface-variant)' }}>
                  <span>{L('افتراضي', 'Default')}: {p.defaultValue ?? '—'}</span>
                  <span>{L('محلّي', 'local')}: {canEdit ? L('قابل للتحرير', 'editable') : L('قراءة فقط', 'read-only')}</span>
                </span>
              )}
            </div>
          );
        }) : <span style={{ ...val, color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>{L('لا خصائص معلنة', 'no declared properties')}</span>}
      </div>

      {/* Transaction history — the undo/redo timeline. Current step highlighted; undone steps stay
          visible (dimmed) and Redo restores them. In-memory, session-only. Updates live. */}
      {onEdit && (
        <div style={{ ...card, padding: 12, display: 'grid', gap: 8 }} id="runtime_transaction_log" data-count={histCount} data-pointer={histIndex}>
          <p style={{ margin: 0, ...lbl, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><ListChecks size={12} />{L('سجلّ المعاملات (تراجع/إعادة)', 'Transaction history (undo/redo)')}</span>
            <span style={{ ...chip, fontSize: 9.5 }}>{histCount}</span>
          </p>
          {histCount ? (
            <div style={{ display: 'grid', gap: 5, maxHeight: 200, overflow: 'auto' }}>
              {hist.map((e, i) => (
                <div key={`${e.id}-${i}`} className="rt-tx-hist-row" data-hist-index={i} data-active={e.active ? '1' : '0'} data-current={e.current ? '1' : '0'}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '4px 6px', borderRadius: 8,
                    background: e.current ? 'color-mix(in srgb,var(--color-primary-fixed,#a3f95b) 22%,transparent)' : 'var(--color-surface-container-high)',
                    border: e.current ? '1px solid var(--color-primary-fixed,#a3f95b)' : '1px solid transparent',
                    opacity: e.active ? 1 : 0.45 }}>
                  <span style={{ ...chip, fontSize: 8.5, padding: '1px 5px' }}>{i + 1}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.componentId.split('.').pop()}·{e.propKey}</span>
                  <span style={{ color: 'var(--color-on-surface-variant)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: e.active ? 'none' : 'line-through' }}>{showVal(e.from, L)} → {showVal(e.to, L)}</span>
                  {e.current && <span style={{ ...chip, fontSize: 8.5, padding: '1px 6px', background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#05310f)' }}>{L('الآن', 'now')}</span>}
                </div>
              ))}
            </div>
          ) : <span style={{ ...val, color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>{L('لا معاملات بعد — حرّر خاصية.', 'No transactions yet — edit a property.')}</span>}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.5, color: 'var(--color-on-surface-variant)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        {L('تحرير محلّي فقط — يظهر فوراً في المعاينة، بلا حفظ ولا قاعدة بيانات. يعيد التحديث القيم الأصلية.', 'Local editing only — updates the preview instantly, no save, no database. A refresh restores the originals.')}
      </p>
    </div>
  );
};

export default RuntimeNodeInspector;
