// ─────────────────────────────────────────────────────────────────────────────
// Visual Component Platform (Phase 9A).
//
// The professional visual builder: Component Library (search / categories / favorites / recent /
// pinned) · Canvas (drag & drop insert, reorder, nest, duplicate, delete, wrap/unwrap, selection,
// responsive device frame with RTL + safe areas) · Property Inspector (typography/colors/spacing/
// borders/background/effects/visibility/animation + responsive overrides + accessibility + metadata)
// · Reusable components (save / instance / override / sync-restore / detach / update-everywhere).
//
// Rendering goes THROUGH the Component Registry's render functions — no second rendering engine.
// All state lives in a session BuilderStore. Live: every edit updates the canvas instantly.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  Search, Star, Pin, Undo2, Redo2, Monitor, Laptop, Tablet, Smartphone, RotateCw, Sun, Moon,
  ChevronUp, ChevronDown, Copy, Trash2, Group, Ungroup, Component as ComponentIcon, Unlink, RefreshCw,
  Eye, EyeOff, Lock, LockOpen, Languages, Layers, Play, Bug,
} from 'lucide-react';
import { LogicTab, LogicDock } from './LogicPanels';
import { AIAssistant } from './AIAssistant';
import { Sparkles } from 'lucide-react';
import { BuilderStore } from '../../../component-platform/BuilderStore';
// Side-effect: register the full component library so the registry is populated.
import '../../../component-platform/components';
import { getComponent, componentsByCategory, searchComponents, listComponents } from '../../../component-platform/registry';
import { tok, tokensIn } from '../../../component-platform/tokens';
import type { BuilderNode, Breakpoint, PropSpec } from '../../../component-platform/types';
import { BREAKPOINTS } from '../../../component-platform/types';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 12 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const iconBtn: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', cursor: 'pointer' };
const seg = (on: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: on ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' });
const DEVICE_DIM: Record<string, { w: number; h: number }> = { desktop: { w: 900, h: 560 }, laptop: { w: 720, h: 480 }, tablet: { w: 560, h: 720 }, phone: { w: 320, h: 640 } };

// Module-scoped drag payload (drag & drop between library and canvas).
let DRAG: { type: 'new'; specId: string } | { type: 'move'; id: string } | null = null;

// ── Canvas node renderer ──
const NodeView: React.FC<{ node: BuilderNode; store: BuilderStore; selectedId: string | null; bp: Breakpoint; runMode: boolean }> = ({ node, store, selectedId, bp, runMode }) => {
  const spec = getComponent(node.masterId ? (store.getMaster(node.masterId)?.root.specId ?? node.specId) : node.specId);
  if (!spec) return null;
  const isInstance = !!node.masterId;
  // Phase 9B — effective props apply data bindings + expressions over the live logic scope.
  const props = store.effectiveProps(node, spec);
  const cond = store.evalConditions(node);
  if (runMode && !cond.visible) return null; // conditional visibility at runtime
  const childNodes = isInstance ? store.resolveInstanceChildren(node) : node.children;
  const rendered = spec.container ? childNodes.map(ch => <NodeView key={ch.id} node={ch} store={store} selectedId={selectedId} bp={bp} runMode={runMode} />) : null;
  const selected = selectedId === node.id;
  const hidden = node.meta?.hidden || (!cond.visible);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!DRAG) return;
    const parentIsContainer = !!spec.container;
    if (DRAG.type === 'new') {
      if (parentIsContainer) store.insert(DRAG.specId, node.id);
      else { const loc = store.find(node.id); if (loc?.parent) store.insert(DRAG.specId, loc.parent.id, loc.index + 1); }
    } else if (DRAG.type === 'move') {
      if (parentIsContainer) store.move(DRAG.id, node.id);
      else { const loc = store.find(node.id); if (loc?.parent) store.move(DRAG.id, loc.parent.id, loc.index + 1); }
    }
    DRAG = null;
  };

  // Accessibility: the declared (or overridden) ARIA role + label reach the rendered DOM.
  const role = node.a11y?.role || spec.a11y.role || undefined;
  const ariaLabel = node.a11y?.label || spec.a11y.label || undefined;
  return (
    <div className={`cp-node${selected ? ' sel' : ''}`} data-node={node.id} data-spec={node.specId} data-instance={isInstance ? '1' : '0'}
      role={role} aria-label={ariaLabel}
      draggable onDragStart={e => { e.stopPropagation(); DRAG = { type: 'move', id: node.id }; }}
      onDragOver={e => { if (DRAG) { e.preventDefault(); e.stopPropagation(); } }}
      onDrop={onDrop}
      onClick={e => { e.stopPropagation(); if (runMode) store.runActions(node.id, 'click'); else store.select(node.id); }}
      style={{ position: 'relative', outline: selected ? '2px solid var(--color-primary-fixed,#a3f95b)' : '1px dashed transparent', outlineOffset: 1, borderRadius: 4, opacity: hidden ? 0.4 : (cond.enabled ? 1 : 0.55), cursor: 'pointer' }}>
      {selected && <span style={{ position: 'absolute', top: -16, insetInlineStart: 0, zIndex: 5, fontSize: 8.5, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#05310f)' }}>{spec.name}{isInstance ? ' ⟐' : ''}</span>}
      {spec.render({ props, children: rendered, editing: true })}
    </div>
  );
};

export const ComponentPlatform: React.FC<{ lang: 'ar' | 'en'; store?: BuilderStore }> = ({ lang, store: ext }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  // Shared BuilderStore (Phase 9C) — the same store backs the Data Platform, so entities are
  // available to bindings as db.*. Falls back to a private store when used standalone.
  const fallback = useRef(new BuilderStore()).current;
  const store = ext ?? fallback;
  const [, force] = useReducer(c => c + 1, 0);
  useEffect(() => store.subscribe(() => force()), [store]);

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [device, setDevice] = useState<'desktop' | 'laptop' | 'tablet' | 'phone'>('desktop');
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [safe, setSafe] = useState(false);
  const [inspTab, setInspTab] = useState<'props' | 'logic' | 'responsive' | 'a11y' | 'meta'>('props');
  const [runMode, setRunMode] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const bp = store.getBreakpoint();
  const selected = store.getSelected();
  const selSpec = selected ? getComponent(selected.specId) : null;
  const dim = DEVICE_DIM[device];
  const w = orient === 'landscape' ? dim.h : dim.w;
  const h = orient === 'landscape' ? dim.w : dim.h;

  const doInsert = (specId: string) => {
    // Insert into the selected container if possible, else root.
    const sel = store.getSelected();
    const parentId = sel && getComponent(sel.specId)?.container ? sel.id : 'root';
    store.insert(specId, parentId);
    setRecent(r => [specId, ...r.filter(x => x !== specId)].slice(0, 8));
  };
  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  const libraryGroups = query.trim()
    ? [{ category: 'Results' as string, items: searchComponents(query) }]
    : componentsByCategory().filter(g => catFilter === 'all' || g.category === catFilter);
  const favSpecs = favorites.map(id => getComponent(id)).filter(Boolean);
  const pinSpecs = pinned.map(id => getComponent(id)).filter(Boolean);
  const recentSpecs = recent.map(id => getComponent(id)).filter(Boolean);

  const LibItem: React.FC<{ id: string; name: string }> = ({ id, name }) => (
    <div className="cp-lib-item" data-spec={id} draggable onDragStart={() => { DRAG = { type: 'new', specId: id }; }} onClick={() => doInsert(id)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: 'var(--color-surface-container-high)', cursor: 'grab', fontSize: 11, color: 'var(--color-on-surface)' }}>
      <ComponentIcon size={12} style={{ color: 'var(--color-primary-fixed,#a3f95b)', flexShrink: 0 }} />
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{name}</span>
      <button id={`cp_pin_${id}`} onClick={e => { e.stopPropagation(); toggle(pinned, setPinned, id); }} title="Pin" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: pinned.includes(id) ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)', padding: 0 }}><Pin size={11} /></button>
      <button id={`cp_fav_${id}`} onClick={e => { e.stopPropagation(); toggle(favorites, setFavorites, id); }} title="Favorite" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: favorites.includes(id) ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)', padding: 0 }}><Star size={11} /></button>
    </div>
  );

  // Inspector prop editor for one PropSpec (routes to base or responsive override by breakpoint).
  const editor = (p: PropSpec) => {
    if (!selected) return null;
    const isInstance = !!selected.masterId;
    const baseVal = (isInstance ? store.resolveInstanceProps(selected) : { ...(selSpec?.defaultProps || {}), ...selected.props })[p.key];
    const val = bp === 'desktop' ? baseVal : (selected.responsive?.[bp]?.[p.key] ?? baseVal);
    const set = (v: unknown) => bp === 'desktop' ? store.setProp(selected.id, p.key, v) : store.setResponsive(selected.id, bp, p.key, v);
    const es: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 11 };
    if (p.type === 'boolean') return <button id={`cp_prop_${p.key}`} onClick={() => set(!(val === true))} style={{ ...seg(val === true), justifyContent: 'center' }}>{val === true ? L('مفعّل', 'On') : L('معطّل', 'Off')}</button>;
    if (p.type === 'longtext') return <textarea id={`cp_prop_${p.key}`} value={String(val ?? '')} onChange={e => set(e.target.value)} rows={2} style={{ ...es, resize: 'vertical' }} />;
    if (p.type === 'number') return <input id={`cp_prop_${p.key}`} type="number" value={Number(val ?? 0)} onChange={e => set(Number(e.target.value))} style={es} />;
    if (p.type === 'select') return <select id={`cp_prop_${p.key}`} value={String(val ?? '')} onChange={e => set(e.target.value)} style={es}>{(p.options || []).map(o => <option key={o} value={o}>{o}</option>)}</select>;
    if (p.type === 'token' || p.type === 'space') {
      const opts = tokensIn(p.type === 'token' ? 'color' : 'space');
      return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{p.type === 'token' && <span style={{ width: 16, height: 16, borderRadius: 4, background: tok(String(val || '')), border: '1px solid var(--color-outline-variant)' }} />}<select id={`cp_prop_${p.key}`} value={String(val ?? '')} onChange={e => set(e.target.value)} style={es}>{opts.map(o => <option key={o} value={o}>{o.split('.').slice(1).join('.')}</option>)}</select></div>;
    }
    return <input id={`cp_prop_${p.key}`} value={String(val ?? '')} onChange={e => set(e.target.value)} style={es} />;
  };

  const groups = selSpec ? [...new Set(selSpec.props.map(p => p.group || 'Content'))] : [];

  return (
    <div id="component_platform" style={{ display: 'flex', gap: 10, width: '100%', height: '100%', minHeight: 620 }}>
      {/* ── LEFT · Library ── */}
      <div id="cp_library" style={{ ...card, width: 230, flexShrink: 0, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...(card as object), padding: '5px 8px' }}>
          <Search size={13} style={{ color: 'var(--color-on-surface-variant)' }} />
          <input id="cp_search" value={query} onChange={e => setQuery(e.target.value)} placeholder={L('بحث المكوّنات…', 'Search components…')} style={{ border: 'none', background: 'transparent', color: 'var(--color-on-surface)', outline: 'none', fontSize: 11.5, flex: 1 }} />
          <span id="cp_lib_count" style={{ ...lbl }}>{listComponents().length}</span>
        </div>
        <select id="cp_cat_filter" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ fontSize: 11, padding: '5px 6px', borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
          <option value="all">{L('كل الفئات', 'All categories')}</option>
          {componentsByCategory().map(g => <option key={g.category} value={g.category}>{g.category}</option>)}
        </select>
        {pinSpecs.length > 0 && <div id="cp_pinned"><p style={{ ...lbl, margin: '2px 0 4px' }}>📌 {L('مثبّت', 'Pinned')}</p><div style={{ display: 'grid', gap: 3 }}>{pinSpecs.map(c => <LibItem key={c!.id} id={c!.id} name={c!.name} />)}</div></div>}
        {favSpecs.length > 0 && <div id="cp_favorites"><p style={{ ...lbl, margin: '2px 0 4px' }}>★ {L('المفضّلة', 'Favorites')}</p><div style={{ display: 'grid', gap: 3 }}>{favSpecs.map(c => <LibItem key={c!.id} id={c!.id} name={c!.name} />)}</div></div>}
        {recentSpecs.length > 0 && !query && <div id="cp_recent"><p style={{ ...lbl, margin: '2px 0 4px' }}>🕐 {L('المستخدمة حديثاً', 'Recently used')}</p><div style={{ display: 'grid', gap: 3 }}>{recentSpecs.map(c => <LibItem key={c!.id} id={c!.id} name={c!.name} />)}</div></div>}
        {libraryGroups.map(g => (
          <div key={g.category} id={`cp_cat_${g.category}`}>
            <p style={{ ...lbl, margin: '4px 0 4px', textTransform: 'uppercase' }}>{g.category} · {g.items.length}</p>
            <div style={{ display: 'grid', gap: 3 }}>{g.items.map(c => <LibItem key={c.id} id={c.id} name={c.name} />)}</div>
          </div>
        ))}
      </div>

      {/* ── CENTER · Canvas ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ ...card, padding: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button id="cp_device_desktop" onClick={() => setDevice('desktop')} style={seg(device === 'desktop')}><Monitor size={13} /></button>
          <button id="cp_device_laptop" onClick={() => setDevice('laptop')} style={seg(device === 'laptop')}><Laptop size={13} /></button>
          <button id="cp_device_tablet" onClick={() => setDevice('tablet')} style={seg(device === 'tablet')}><Tablet size={13} /></button>
          <button id="cp_device_phone" onClick={() => setDevice('phone')} style={seg(device === 'phone')}><Smartphone size={13} /></button>
          <span style={{ width: 1, height: 18, background: 'var(--color-outline-variant)' }} />
          <button id="cp_orient" onClick={() => setOrient(o => o === 'portrait' ? 'landscape' : 'portrait')} style={seg(orient === 'landscape')}><RotateCw size={13} /></button>
          <button id="cp_dir" onClick={() => setDir(d => d === 'ltr' ? 'rtl' : 'ltr')} style={seg(dir === 'rtl')}><Languages size={13} />{dir.toUpperCase()}</button>
          <button id="cp_theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={seg(theme === 'light')}>{theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}</button>
          <button id="cp_safe" onClick={() => setSafe(v => !v)} style={seg(safe)}>{L('آمن', 'Safe')}</button>
          <span style={{ width: 1, height: 18, background: 'var(--color-outline-variant)' }} />
          {BREAKPOINTS.map(x => <button key={x} id={`cp_bp_${x}`} onClick={() => store.setBreakpoint(x)} style={{ ...seg(bp === x), fontSize: 9.5, padding: '5px 7px' }}>{x}</button>)}
          <span style={{ width: 1, height: 18, background: 'var(--color-outline-variant)' }} />
          <button id="cp_undo" onClick={() => store.undo()} disabled={!store.canUndo()} style={{ ...iconBtn, opacity: store.canUndo() ? 1 : 0.4 }}><Undo2 size={13} /></button>
          <button id="cp_redo" onClick={() => store.redo()} disabled={!store.canRedo()} style={{ ...iconBtn, opacity: store.canRedo() ? 1 : 0.4 }}><Redo2 size={13} /></button>
          <span style={{ width: 1, height: 18, background: 'var(--color-outline-variant)' }} />
          <button id="cp_run" onClick={() => setRunMode(r => !r)} style={{ ...seg(runMode), background: runMode ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: runMode ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}><Play size={12} />{runMode ? L('تشغيل', 'Run: ON') : L('تحرير', 'Run')}</button>
          <button id="cp_logic_toggle" onClick={() => setDockOpen(d => !d)} style={seg(dockOpen)}><Bug size={12} />{L('المنطق', 'Logic')}</button>
          <button id="cp_ai_toggle" onClick={() => setAiOpen(a => !a)} style={{ ...seg(aiOpen), background: aiOpen ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: aiOpen ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}><Sparkles size={12} />{L('ذكاء', 'AI')}</button>
          <span id="cp_node_count" style={{ ...lbl, marginInlineStart: 'auto' }}>{store.count()} {L('عنصر', 'nodes')}</span>
        </div>
        <div style={{ ...card, flex: 1, overflow: 'auto', display: 'grid', placeItems: 'start center', padding: 20, background: 'var(--color-background)' }}>
          <div id="cp_device" data-device={device} data-orient={orient} data-dir={dir} data-theme={theme} data-safe={safe ? '1' : '0'} data-breakpoint={bp} dir={dir}
            style={{ ...(store.getTheme() as React.CSSProperties), width: w, maxWidth: '100%', minHeight: h, borderRadius: 16, border: '1px solid var(--color-outline-variant)', background: theme === 'light' ? '#f4f6f5' : 'var(--color-background)', padding: safe ? 22 : 0, position: 'relative', overflow: 'hidden' }}>
            <div id="cp_canvas" onClick={() => store.select(null)}
              onDragOver={e => { if (DRAG) e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); if (!DRAG) return; if (DRAG.type === 'new') store.insert(DRAG.specId, 'root'); else store.move(DRAG.id, 'root'); DRAG = null; }}
              style={{ minHeight: h - (safe ? 44 : 0), display: 'flex', flexDirection: 'column', gap: 2, padding: 8 }}>
              {store.getRoot().children.length === 0
                ? <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 12.5, display: 'grid', gap: 6, placeItems: 'center', padding: 40 }}><Layers size={22} /><span>{L('اسحب مكوّناً هنا أو انقره من المكتبة', 'Drag a component here, or click one in the library')}</span></div>
                : store.getRoot().children.map(ch => <NodeView key={ch.id} node={ch} store={store} selectedId={store.getSelectedId()} bp={bp} runMode={runMode} />)}
            </div>
          </div>
        </div>
        {aiOpen && <AIAssistant store={store} lang={lang} />}
        {dockOpen && <LogicDock store={store} lang={lang} />}
      </div>

      {/* ── RIGHT · Inspector ── */}
      <div id="cp_inspector" style={{ ...card, width: 260, flexShrink: 0, padding: 10, overflow: 'auto', display: 'grid', gap: 8, alignContent: 'start' }}>
        {!selected ? (
          <div style={{ textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 12, padding: 20 }}>{L('اختر عنصراً لتحرير خصائصه', 'Select an element to edit its properties')}</div>
        ) : (
          <>
            <div>
              <span style={lbl}>{selected.masterId ? L('نسخة مكوّن', 'Component instance') : L('مكوّن', 'Component')}</span>
              <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface)' }}>{selSpec?.name}</h3>
              <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                <span style={{ ...lbl, ...card, padding: '2px 7px' }}>{selSpec?.category}</span>
                <span style={{ ...lbl, ...card, padding: '2px 7px' }}>v{selSpec?.version}</span>
                {selSpec?.motion && <span style={{ ...lbl, ...card, padding: '2px 7px' }}>motion</span>}
                <span style={{ ...lbl, ...card, padding: '2px 7px' }}>responsive</span>
              </div>
            </div>

            {/* Node op toolbar */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button id="cp_op_up" onClick={() => store.reorder(selected.id, -1)} title={L('لأعلى', 'Up')} style={iconBtn}><ChevronUp size={13} /></button>
              <button id="cp_op_down" onClick={() => store.reorder(selected.id, 1)} title={L('لأسفل', 'Down')} style={iconBtn}><ChevronDown size={13} /></button>
              <button id="cp_op_dup" onClick={() => store.duplicate(selected.id)} title={L('تكرار', 'Duplicate')} style={iconBtn}><Copy size={13} /></button>
              <button id="cp_op_wrap" onClick={() => store.wrap(selected.id)} title={L('لفّ', 'Wrap')} style={iconBtn}><Group size={13} /></button>
              <button id="cp_op_unwrap" onClick={() => store.unwrap(selected.id)} title={L('فكّ اللفّ', 'Unwrap')} style={iconBtn}><Ungroup size={13} /></button>
              <button id="cp_op_del" onClick={() => store.remove(selected.id)} title={L('حذف', 'Delete')} style={{ ...iconBtn, color: '#ff6b6b' }}><Trash2 size={13} /></button>
            </div>

            {/* Reusable component actions */}
            <div style={{ ...card, padding: 8, display: 'grid', gap: 6, background: 'var(--color-surface-container-high)' }} id="cp_reusable">
              <span style={lbl}>{L('مكوّن قابل لإعادة الاستخدام', 'Reusable component')}</span>
              {!selected.masterId ? (
                <button id="cp_save_component" onClick={() => { const n = prompt('Component name', selSpec?.name || 'Component'); if (n !== null) store.saveAsComponent(selected.id, n || (selSpec?.name ?? 'Component')); }} style={{ ...seg(false), justifyContent: 'center' }}><ComponentIcon size={12} />{L('حفظ كمكوّن', 'Save as Component')}</button>
              ) : (
                <div style={{ display: 'grid', gap: 5 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 700 }} id="cp_instance_of">⟐ {store.getMaster(selected.masterId)?.name} · v{store.getMaster(selected.masterId)?.version}</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button id="cp_restore" onClick={() => store.restoreInstance(selected.id)} style={{ ...seg(false), flex: 1, justifyContent: 'center', fontSize: 10 }}><RefreshCw size={11} />{L('مزامنة', 'Sync')}</button>
                    <button id="cp_detach" onClick={() => store.detach(selected.id)} style={{ ...seg(false), flex: 1, justifyContent: 'center', fontSize: 10 }}><Unlink size={11} />{L('فصل', 'Detach')}</button>
                  </div>
                </div>
              )}
            </div>

            {/* Inspector tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {([['props', L('الخصائص', 'Props')], ['logic', L('المنطق', 'Logic')], ['responsive', L('تجاوب', 'Responsive')], ['a11y', L('وصول', 'A11y')], ['meta', L('بيانات', 'Meta')]] as const).map(([id, label]) => (
                <button key={id} id={`cp_insp_${id}`} onClick={() => setInspTab(id)} style={{ ...seg(inspTab === id), fontSize: 10, padding: '4px 8px' }}>{label}</button>
              ))}
            </div>

            {inspTab === 'logic' && <LogicTab store={store} node={selected} lang={lang} />}

            {inspTab === 'props' && selSpec && groups.map(gr => (
              <div key={gr} style={{ ...card, padding: 8, display: 'grid', gap: 6 }}>
                <span style={lbl}>{gr}</span>
                {selSpec.props.filter(p => (p.group || 'Content') === gr).map(p => (
                  <label key={p.key} style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 10.5, color: 'var(--color-on-surface)' }}>{p.label}</span>{editor(p)}</label>
                ))}
              </div>
            ))}

            {inspTab === 'responsive' && (
              <div style={{ ...card, padding: 8, display: 'grid', gap: 6 }} id="cp_responsive_panel" data-breakpoint={bp}>
                <span style={lbl}>{L('تجاوز حسب المقاس', 'Per-breakpoint overrides')}</span>
                <span style={{ fontSize: 10.5, color: bp === 'desktop' ? 'var(--color-on-surface-variant)' : 'var(--color-primary-fixed,#a3f95b)', fontWeight: 700 }}>
                  {bp === 'desktop' ? L('التحرير يطبّق على القاعدة (Desktop)', 'Editing the BASE (desktop)') : L(`التحرير يطبّق كتجاوز لمقاس ${bp}`, `Editing ${bp.toUpperCase()} override`)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)' }} id="cp_responsive_summary">{Object.keys(selected.responsive || {}).length ? Object.entries(selected.responsive || {}).map(([k, v]) => `${k}:${Object.keys(v).length}`).join(' · ') : L('لا تجاوزات', 'No overrides yet')}</span>
                <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)' }}>{L('بدّل المقاس من الشريط أعلاه ثم حرّر أي خاصية.', 'Switch breakpoint above, then edit any property.')}</span>
              </div>
            )}

            {inspTab === 'a11y' && (
              <div style={{ ...card, padding: 8, display: 'grid', gap: 6 }}>
                <span style={lbl}>{L('إتاحة الوصول', 'Accessibility')}</span>
                <label style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 10.5 }}>{L('التسمية (aria-label)', 'Label (aria-label)')}</span>
                  <input id="cp_a11y_label" value={String(selected.a11y?.label ?? selSpec?.a11y.label ?? '')} onChange={e => store.setA11y(selected.id, { label: e.target.value })} style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 11 }} /></label>
                <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)' }}>{L('الدور', 'Role')}: <b>{selSpec?.a11y.role || 'generic'}</b></div>
              </div>
            )}

            {inspTab === 'meta' && (
              <div style={{ ...card, padding: 8, display: 'grid', gap: 6 }}>
                <span style={lbl}>{L('بيانات وصفية', 'Metadata')}</span>
                <label style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 10.5 }}>{L('الاسم', 'Name')}</span>
                  <input id="cp_meta_name" value={String(selected.meta?.name ?? '')} placeholder={selSpec?.name} onChange={e => store.setMeta(selected.id, { name: e.target.value })} style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 11 }} /></label>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button id="cp_meta_hide" onClick={() => store.setMeta(selected.id, { hidden: !selected.meta?.hidden })} style={{ ...seg(!!selected.meta?.hidden), flex: 1, justifyContent: 'center' }}>{selected.meta?.hidden ? <EyeOff size={12} /> : <Eye size={12} />}{L('إخفاء', 'Hide')}</button>
                  <button id="cp_meta_lock" onClick={() => store.setMeta(selected.id, { locked: !selected.meta?.locked })} style={{ ...seg(!!selected.meta?.locked), flex: 1, justifyContent: 'center' }}>{selected.meta?.locked ? <Lock size={12} /> : <LockOpen size={12} />}{L('قفل', 'Lock')}</button>
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--color-on-surface-variant)', fontFamily: 'ui-monospace,monospace' }}>id: {selected.id} · spec: {selected.specId}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ComponentPlatform;
