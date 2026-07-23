// ─────────────────────────────────────────────────────────────────────────────
// Runtime mode — the single source of truth for "demo build or production build?".
//
// The BUILD picks the mode: vite.config.ts injects VITE_AUTH_MODE from the
// HAAT_LIVE_BACKEND env var (`npm run build:live` → 'supabase', otherwise
// 'sandbox'). It is therefore a compile-time constant and cannot drift at runtime.
//
// WHY THIS FILE EXISTS: the mode was re-derived inline in ~15 files. Each of those
// gates happens to be correct, but a boundary that is stated fifteen times is a
// boundary that only holds until someone forgets it a sixteenth time — and the cost
// of forgetting is a real customer seeing invented merchants or invented money.
// ─────────────────────────────────────────────────────────────────────────────

export type AuthMode = 'sandbox' | 'supabase';

/** The mode this bundle was built for. */
export const AUTH_MODE: AuthMode =
  ((import.meta.env && import.meta.env.VITE_AUTH_MODE) === 'supabase' ? 'supabase' : 'sandbox');

/** True only in the self-contained, client-side demo build. */
export const IS_SANDBOX = AUTH_MODE === 'sandbox';

/** True only in the production build that talks to the real backend. */
export const IS_PRODUCTION_DATA = AUTH_MODE === 'supabase';

/**
 * Whether FABRICATED content (demo merchants, demo offers, sample transactions) may
 * render. Named separately from IS_SANDBOX on purpose: at a render site the question
 * being asked is "am I allowed to invent content here?", and that is the question a
 * reviewer must be able to answer by reading one identifier.
 *
 * NEVER widen this to a data-emptiness check. An empty catalogue in production means
 * an empty state — it does not mean "make something up".
 */
export const DEMO_CONTENT_ENABLED = IS_SANDBOX;

/**
 * COD-only launch gate. The flagship launches cash-on-delivery only — card payments are
 * deferred (their integration was the largest cluster of Critical defects in the launch
 * audit: unverifiable webhooks, mislabelled Apple Pay, fabricated saved cards). When true,
 * checkout offers ONLY Cash on Delivery, and the card-capture UI is never rendered.
 *
 * A single build-time switch, not a per-environment toggle, so a production build cannot
 * accidentally expose a half-wired card flow. Flip to false in the same change that lands
 * a verified card gateway end-to-end.
 */
export const PAYMENTS_COD_ONLY = true;
