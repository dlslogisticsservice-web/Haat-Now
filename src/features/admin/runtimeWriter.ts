// ─────────────────────────────────────────────────────────────────────────────
// Runtime Binding Writer (Phase 8D · Live LOCAL editing).
//
// Applies an edited value to the CURRENTLY RUNNING runtime session and nothing else. The
// symmetric counterpart of the Value Resolution Engine (8C reads the live DOM; 8D writes
// it): it mutates the selected component's rendered DOM in place so the preview updates
// instantly. This is LOCAL-ONLY and EPHEMERAL — no store, no CMS/Supabase/API/localStorage,
// no persistence; a page refresh (or React's own next re-render of that subtree) restores
// the original data. Only Text / Image / Color / Boolean are editable.
//
// No React internals, no app code touched. Standard DOM writes only.
// ─────────────────────────────────────────────────────────────────────────────
import type { EditablePropSpec } from '../../runtime/StudioMetadata';

/** Which declared prop types accept a live edit (all others stay read-only). */
export function isEditable(type: string): boolean {
  return type === 'text' || type === 'richtext' || type === 'url' || type === 'image'
    || type === 'color' || type === 'boolean' || type === 'range' || type === 'option';
}

/** Props applied as a CSS custom property (theme colour, or a scoped animation value). */
export function isCssVarType(type: string): boolean {
  return type === 'color' || type === 'range' || type === 'option';
}

/** Where a CSS-var write lands: the component element itself ('self') or the preview root. */
function varTarget(el: Element, prop: EditablePropSpec, host?: Element | null): HTMLElement {
  return (prop.scope === 'self' ? el : (host || el.closest('#app_runtime_preview') || el)) as HTMLElement;
}

/**
 * Apply `value` to the live runtime for one property. Returns true if a DOM write happened.
 * `el` is the selected component element; `host` is the runtime root (for theme/color cascade).
 */
export function writeBinding(el: Element, prop: EditablePropSpec, value: string | boolean, host?: Element | null): boolean {
  const target = (prop.selector ? el.querySelector(prop.selector) : el) as HTMLElement | null;
  switch (prop.type) {
    case 'color':
    case 'range':
    case 'option': {
      // Set a CSS custom property. Colours default to the theme token on the preview root; scoped
      // animation values (scope:'self') write on the component element; ranges append their unit.
      const token = prop.token || '--color-primary-fixed';
      const v = prop.type === 'range' ? `${value}${prop.unit ?? ''}` : String(value);
      varTarget(el, prop, host).style.setProperty(token, v);
      return true;
    }
    case 'image': {
      const img = (prop.selector ? el.querySelector(prop.selector) : el.querySelector('img')) as HTMLImageElement | null;
      if (!img) return false;
      img.src = String(value);
      img.srcset = '';
      return true;
    }
    case 'boolean': {
      const on = value === true || value === 'true';
      // A tokened boolean drives a CSS var (1/0) — e.g. show/hide the CTA; else it flips aria state.
      if (prop.token) { varTarget(el, prop, host).style.setProperty(prop.token, on ? '1' : '0'); return true; }
      const t = (target || el) as HTMLElement;
      if (t.hasAttribute('aria-checked')) t.setAttribute('aria-checked', on ? 'true' : 'false');
      else t.setAttribute('aria-pressed', on ? 'true' : 'false');
      return true;
    }
    default: { // text / richtext / url
      if (!target) return false;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') (target as HTMLInputElement).placeholder = String(value);
      else target.textContent = String(value);
      return true;
    }
  }
}
