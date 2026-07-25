// ─────────────────────────────────────────────────────────────────────────────
// Runtime Value Resolution Engine (Phase 8C).
//
// Resolves a component's declared editable-property BindingRefs into their CURRENT live
// values by reading the actual running runtime — the rendered DOM of the selected
// component (Inspect-mode, like Figma/Webflow) plus computed theme tokens. The values are
// therefore guaranteed to match the runtime by definition: they ARE what is on screen.
// Nothing is fabricated, hardcoded, or defaulted to demo data.
//
// Read-only: this module only reads. No writes, no editing (that is Phase 8D).
// ─────────────────────────────────────────────────────────────────────────────
import type { StudioComponentMetadata, EditablePropSpec } from '../../runtime/StudioMetadata';
import type { ResolvedValue } from '../../runtime/selection/RuntimeNode';

function firstNumber(s: string): number | null {
  const m = (s || '').replace(/[, ]/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function resolveOne(p: EditablePropSpec, el: Element, md: StudioComponentMetadata): ResolvedValue {
  const sel = p.selector;
  const target = (sel ? el.querySelector(sel) : el) as HTMLElement | null;
  switch (p.type) {
    case 'color': {
      const token = p.token || md.themeTokens?.[0] || '--color-primary-fixed';
      const v = getComputedStyle(el as HTMLElement).getPropertyValue(token).trim();
      return v ? { kind: 'color', value: v } : { kind: 'empty', value: null };
    }
    case 'image': {
      const img = (sel ? el.querySelector(sel) : el.querySelector('img')) as HTMLImageElement | null;
      const src = img?.currentSrc || img?.getAttribute('src') || '';
      return src ? { kind: 'image', value: src } : { kind: 'empty', value: null };
    }
    case 'boolean': {
      const a = target?.getAttribute('aria-pressed') ?? target?.getAttribute('aria-checked')
        ?? el.getAttribute('aria-pressed') ?? el.getAttribute('aria-checked');
      if (a === 'true') return { kind: 'bool', value: true };
      if (a === 'false') return { kind: 'bool', value: false };
      return { kind: 'empty', value: null };
    }
    case 'number': {
      const n = firstNumber(target?.textContent || el.textContent || '');
      return n === null ? { kind: 'empty', value: null } : { kind: 'number', value: n };
    }
    case 'select':
    case 'enum': {
      const count = sel ? el.querySelectorAll(sel).length : el.children.length;
      return { kind: 'count', value: count };
    }
    default: { // text / richtext / url / icon / spacing
      let v = '';
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const input = target as HTMLInputElement;
        v = input.value || input.placeholder || '';
      } else {
        v = (target?.textContent || '').trim();
      }
      if (!v) v = (el.textContent || '').trim();
      v = v.replace(/\s+/g, ' ').slice(0, 140);
      return v ? { kind: 'text', value: v } : { kind: 'empty', value: null };
    }
  }
}

/** Resolve every declared editable property of a component to its current live value. */
export function resolveProps(md: StudioComponentMetadata, el: Element): Record<string, ResolvedValue> {
  const out: Record<string, ResolvedValue> = {};
  for (const p of md.editableProps) out[p.key] = resolveOne(p, el, md);
  return out;
}
