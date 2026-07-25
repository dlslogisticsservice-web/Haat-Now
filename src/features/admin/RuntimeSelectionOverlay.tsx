// ─────────────────────────────────────────────────────────────────────────────
// Runtime Selection Overlay (Phase 8A · Runtime Selection Layer).
//
// Makes any Runtime-rendered surface selectable WITHOUT touching the runtime, the app
// components, or React internals. It reads the DOM with standard APIs only
// (event.target, getComputedStyle, getBoundingClientRect) and draws hover / selected
// outlines in its OWN pointer-safe layer — it never mutates the app's DOM and never
// reads a React fiber. Clicks are intercepted (capture phase) so the preview enters a
// "select" mode; disable the overlay to return the app to full interactivity.
//
// The visual language (primary outline, identity label) matches the Website Studio's
// selection styling — same tokens, no duplicated component.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import type { SelectionManager } from '../../runtime/selection/SelectionManager';
import type { RuntimeNode, RuntimeNodeBounds } from '../../runtime/selection/RuntimeNode';

const INLINE_TAGS = new Set(['SPAN', 'A', 'SVG', 'PATH', 'IMG', 'I', 'B', 'EM', 'STRONG', 'SMALL', 'CODE', 'BR', 'USE', 'CIRCLE', 'RECT', 'LINE']);

/** Walk up from a leaf/inline target to the nearest block-level element (capped at root). */
function resolveBlock(target: Element, root: Element): Element | null {
  let el: Element | null = target;
  while (el && el !== root && el.parentElement) {
    const inline = INLINE_TAGS.has(el.tagName) || getComputedStyle(el as HTMLElement).display === 'inline';
    if (!inline) return el;
    el = el.parentElement;
  }
  return el && el !== root ? el : (target !== root ? target : null);
}

/** Child-index path from root → el (stable id basis across re-renders). */
function pathOf(el: Element, root: Element): number[] {
  const path: number[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root && cur.parentElement) {
    path.unshift(Array.prototype.indexOf.call(cur.parentElement.children, cur));
    cur = cur.parentElement;
  }
  return path;
}

function labelOf(el: Element): string {
  return el.getAttribute('data-rt-name')
    || el.getAttribute('aria-label')
    || el.getAttribute('role')
    || el.tagName.toLowerCase();
}

function boundsOf(el: Element, host: Element): RuntimeNodeBounds {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left, y: r.top - h.top, width: r.width, height: r.height };
}

export interface RuntimeSelectionOverlayProps {
  hostRef: React.RefObject<HTMLElement>;
  enabled: boolean;
  channel: string;
  screen: string;
  manager: SelectionManager;
  onSelect?: (node: RuntimeNode | null) => void;
}

export const RuntimeSelectionOverlay: React.FC<RuntimeSelectionOverlayProps> = ({ hostRef, enabled, channel, screen, manager, onSelect }) => {
  // DOM element refs kept privately for bounds recomputation (never leaked into the node model).
  const hoverElRef = useRef<Element | null>(null);
  const selElRef = useRef<Element | null>(null);
  const [hoverB, setHoverB] = useState<RuntimeNodeBounds | null>(null);
  const [selB, setSelB] = useState<RuntimeNodeBounds | null>(null);
  const [selLabel, setSelLabel] = useState<string>('');

  useEffect(() => {
    const host = hostRef.current;
    if (!enabled || !host) return;

    const buildNode = (el: Element): RuntimeNode => {
      const path = pathOf(el, host);
      return { id: `${channel}:${screen}:${path.join('.')}`, channel, screen, component: labelOf(el), bounds: boundsOf(el, host), path };
    };

    const onMove = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || t === host) return;
      const el = resolveBlock(t, host);
      if (!el) return;
      hoverElRef.current = el;
      setHoverB(boundsOf(el, host));
      manager.setHover(buildNode(el));
    };
    const onLeave = () => { hoverElRef.current = null; setHoverB(null); manager.setHover(null); };
    const onClick = (e: MouseEvent) => {
      // Select mode: intercept so the underlying app does not act on the click.
      e.preventDefault(); e.stopPropagation();
      const t = e.target as Element | null;
      const el = t && t !== host ? resolveBlock(t, host) : null;
      if (el) {
        selElRef.current = el;
        const b = boundsOf(el, host);
        setSelB(b); setSelLabel(labelOf(el));
        const node = buildNode(el);
        manager.select(node); onSelect?.(node);
      } else {
        selElRef.current = null; setSelB(null); manager.clear(); onSelect?.(null);
      }
    };
    const refresh = () => {
      if (hoverElRef.current) setHoverB(boundsOf(hoverElRef.current, host));
      if (selElRef.current) setSelB(boundsOf(selElRef.current, host));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { selElRef.current = null; setSelB(null); manager.clear(); onSelect?.(null); } };

    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    host.addEventListener('click', onClick, true); // capture: beat the app's own handlers
    host.addEventListener('scroll', refresh, true); // catch inner scroll containers
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
  }, [enabled, channel, screen, hostRef, manager, onSelect]);

  // Clearing visuals when disabled.
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
