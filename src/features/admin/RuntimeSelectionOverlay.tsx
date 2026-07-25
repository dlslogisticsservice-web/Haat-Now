// ─────────────────────────────────────────────────────────────────────────────
// Runtime Selection Overlay (Phase 8A selection + Phase 8B component mapping).
//
// Makes any Runtime surface selectable using standard DOM APIs only (event.target,
// getComputedStyle, getBoundingClientRect, element.matches) — never a React fiber, never
// mutating the app DOM. On selection it RESOLVES the region to a declared Studio component
// via the Runtime Component Map (real business identity: Hero Banner, Category Grid, …),
// falling back to a DOM heuristic label only for unmapped regions (clearly flagged).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import type { SelectionManager } from '../../runtime/selection/SelectionManager';
import type { RuntimeNode, RuntimeNodeBounds } from '../../runtime/selection/RuntimeNode';
import { componentsFor, type MappedComponent } from '../../runtime/selection/componentMap';
import { resolveProps } from './runtimeValues';
import { instanceKeyOf } from './runtimeInstance';

const INLINE_TAGS = new Set(['SPAN', 'A', 'SVG', 'PATH', 'IMG', 'I', 'B', 'EM', 'STRONG', 'SMALL', 'CODE', 'BR', 'USE', 'CIRCLE', 'RECT', 'LINE']);

function resolveBlock(target: Element, root: Element): Element | null {
  let el: Element | null = target;
  while (el && el !== root && el.parentElement) {
    const inline = INLINE_TAGS.has(el.tagName) || getComputedStyle(el as HTMLElement).display === 'inline';
    if (!inline) return el;
    el = el.parentElement;
  }
  return el && el !== root ? el : (target !== root ? target : null);
}

function pathOf(el: Element, root: Element): number[] {
  const path: number[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root && cur.parentElement) {
    path.unshift(Array.prototype.indexOf.call(cur.parentElement.children, cur));
    cur = cur.parentElement;
  }
  return path;
}

function domLabel(el: Element): string {
  return el.getAttribute('aria-label') || el.getAttribute('role') || el.tagName.toLowerCase();
}

function boundsOf(el: Element, host: Element): RuntimeNodeBounds {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left, y: r.top - h.top, width: r.width, height: r.height };
}

/** Walk target→host, find the innermost declared component + its ancestor chain (root-first). */
function resolveMapped(target: Element, host: Element, mapped: MappedComponent[]): { comp: MappedComponent; element: Element; chainEls: { comp: MappedComponent; element: Element }[] } | null {
  if (!mapped.length) return null;
  const chain: { comp: MappedComponent; element: Element }[] = [];
  let cur: Element | null = target;
  while (cur && cur !== host) {
    for (const m of mapped) { try { if (cur.matches(m.match)) { chain.push({ comp: m, element: cur }); break; } } catch { /* invalid selector — skip */ } }
    cur = cur.parentElement;
  }
  if (!chain.length) return null;
  const inner = chain[0];
  return { comp: inner.comp, element: inner.element, chainEls: chain.slice().reverse() };
}

export interface RuntimeSelectionOverlayProps {
  hostRef: React.RefObject<HTMLElement>;
  enabled: boolean;
  channel: string;
  screen: string;
  lang: 'ar' | 'en';
  manager: SelectionManager;
  onSelect?: (node: RuntimeNode | null) => void;
  /** Phase 8D — the Studio reads the selected DOM element from here to apply live edits. */
  elementRef?: React.MutableRefObject<Element | null>;
}

export const RuntimeSelectionOverlay: React.FC<RuntimeSelectionOverlayProps> = ({ hostRef, enabled, channel, screen, lang, manager, onSelect, elementRef }) => {
  const hoverElRef = useRef<Element | null>(null);
  const selElRef = useRef<Element | null>(null);
  const [hoverB, setHoverB] = useState<RuntimeNodeBounds | null>(null);
  const [selB, setSelB] = useState<RuntimeNodeBounds | null>(null);
  const [selLabel, setSelLabel] = useState<string>('');

  useEffect(() => {
    const host = hostRef.current;
    if (!enabled || !host) return;
    const mapped = componentsFor(channel, screen);
    const nameOf = (n: { ar: string; en: string }) => (lang === 'ar' ? n.ar : n.en);

    // Build a RuntimeNode from a raw event target, resolving its declared component identity.
    const buildFrom = (target: Element): { node: RuntimeNode; element: Element } | null => {
      const resolved = resolveMapped(target, host, mapped);
      if (resolved) {
        const md = resolved.comp.metadata;
        const el = resolved.element;
        const instanceKey = instanceKeyOf(el);
        const chainEls = resolved.chainEls;
        const parentEl = chainEls.length >= 2 ? chainEls[chainEls.length - 2].element : null;
        const children = mapped
          .filter(m => m.metadata.id !== md.id && el !== el.querySelector(m.match) && !!el.querySelector(m.match))
          .map(m => nameOf(m.metadata.displayName));
        const node: RuntimeNode = {
          // Instance-scoped id: two cards of the same type get DIFFERENT node ids.
          id: `${channel}:${screen}:${md.id}#${instanceKey}`, channel, screen,
          component: nameOf(md.displayName), bounds: boundsOf(el, host), path: pathOf(el, host),
          metadataRef: md.id, studioComponent: md, mapped: true,
          breadcrumb: chainEls.map(c => nameOf(c.comp.metadata.displayName)),
          childComponents: [...new Set(children)],
          instanceId: instanceKey, parentInstance: parentEl ? instanceKeyOf(parentEl) : undefined,
        };
        return { node, element: el };
      }
      const el = resolveBlock(target, host);
      if (!el) return null;
      const path = pathOf(el, host);
      const node: RuntimeNode = {
        id: `${channel}:${screen}:${path.join('.')}`, channel, screen,
        component: domLabel(el), bounds: boundsOf(el, host), path, mapped: false,
      };
      return { node, element: el };
    };

    const onMove = (e: MouseEvent) => {
      const t = e.target as Element | null; if (!t || t === host) return;
      const built = buildFrom(t); if (!built) return;
      hoverElRef.current = built.element; setHoverB(boundsOf(built.element, host)); manager.setHover(built.node);
    };
    const onLeave = () => { hoverElRef.current = null; setHoverB(null); manager.setHover(null); };
    const onClick = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const t = e.target as Element | null;
      const built = t && t !== host ? buildFrom(t) : null;
      if (built) {
        // Phase 8C — resolve the component's editable props to their CURRENT live values.
        if (built.node.mapped && built.node.studioComponent) built.node.resolvedValues = resolveProps(built.node.studioComponent, built.element);
        selElRef.current = built.element; if (elementRef) elementRef.current = built.element;
        setSelB(boundsOf(built.element, host)); setSelLabel(built.node.component);
        manager.select(built.node); onSelect?.(built.node);
      } else { selElRef.current = null; if (elementRef) elementRef.current = null; setSelB(null); manager.clear(); onSelect?.(null); }
    };
    const refresh = () => {
      if (hoverElRef.current) setHoverB(boundsOf(hoverElRef.current, host));
      if (selElRef.current) setSelB(boundsOf(selElRef.current, host));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { selElRef.current = null; if (elementRef) elementRef.current = null; setSelB(null); manager.clear(); onSelect?.(null); } };

    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    host.addEventListener('click', onClick, true);
    host.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    window.addEventListener('keydown', onKey);
    return () => {
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
      host.removeEventListener('click', onClick, true);
      host.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled, channel, screen, lang, hostRef, manager, onSelect, elementRef]);

  useEffect(() => { if (!enabled) { setHoverB(null); setSelB(null); hoverElRef.current = null; selElRef.current = null; } }, [enabled]);

  if (!enabled) return null;

  const outline = (b: RuntimeNodeBounds, kind: 'hover' | 'selected'): React.CSSProperties => ({
    position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height,
    pointerEvents: 'none', zIndex: kind === 'selected' ? 9002 : 9001, borderRadius: 4,
    boxShadow: kind === 'selected'
      ? 'inset 0 0 0 2px var(--color-primary-fixed,#a3f95b)'
      : 'inset 0 0 0 2px color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 55%, transparent)',
    transition: 'left .05s linear, top .05s linear, width .05s linear, height .05s linear',
  });

  return (
    <div id="runtime_selection_overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9000 }} aria-hidden>
      {hoverB && (!selB || hoverB.x !== selB.x || hoverB.y !== selB.y) && <div className="rt-outline-hover" style={outline(hoverB, 'hover')} />}
      {selB && (
        <div className="rt-outline-selected" style={outline(selB, 'selected')}>
          <span className="rt-label" style={{ position: 'absolute', top: -18, insetInlineStart: 0, fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 6, whiteSpace: 'nowrap', background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#0c2000)' }}>{selLabel}</span>
        </div>
      )}
    </div>
  );
};

export default RuntimeSelectionOverlay;
