// ─────────────────────────────────────────────────────────────────────────────
// Runtime Instance Identity (Phase 8F).
//
// Derives a STABLE key that uniquely identifies one component INSTANCE among its siblings,
// so editing (say) the "Restaurants" category card never affects "Supermarket". The key is
// read from stable, NON-editable signals — the element's own id, else an image alt, else an
// aria-label, else its text — in that order, so it does not change when the instance's
// visible text is edited (which would otherwise lose the edit on the next re-render).
//
// Shared by the selection overlay (to stamp each RuntimeNode with its instance) and the
// reconciler (to re-locate the exact instance when projecting edits). One implementation,
// no duplicate logic.
// ─────────────────────────────────────────────────────────────────────────────
export function instanceKeyOf(el: Element): string {
  if (el.id) return `id:${el.id}`;
  const alt = el.querySelector('img')?.getAttribute('alt');
  if (alt && alt.trim()) return `alt:${alt.trim().slice(0, 48)}`;
  const aria = el.getAttribute('aria-label');
  if (aria && aria.trim()) return `aria:${aria.trim().slice(0, 48)}`;
  const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return txt ? `txt:${txt}` : 'anon';
}
