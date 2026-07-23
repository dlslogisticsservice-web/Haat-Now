// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · browser visitor identity (Wave 18).
//
// The Engine derives a STABLE visitor id from a seed but never stores one — it has no storage and
// no clock. This host-side module owns that persistence for the website:
//
//   localStorage seed (durable) + sessionStorage seed (per session) → VisitorIdentity
//
// This is what turns experiment allocation from "same variant for the whole page" into a real
// per-visitor split (see EXPERIMENT_ENGINE.md). An authenticated user is keyed by ACCOUNT, so
// identity survives a cleared browser token and is consistent across devices.
//
// Degrades safely: if storage is unavailable (private mode, SSR, a Node test) it returns a
// session-only identity rather than throwing or inventing a "stable" id that isn't.
// ─────────────────────────────────────────────────────────────────────────────
import { anonymousVisitor, authenticatedVisitor, UNKNOWN_VISITOR, type VisitorIdentity } from '../../experience-engine';

const VISITOR_KEY = 'haat_visitor_v1';
const SESSION_KEY = 'haat_visitor_session_v1';

const read = (store: 'local' | 'session', key: string): string | null => {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage;
    return s.getItem(key);
  } catch { return null; }
};

const write = (store: 'local' | 'session', key: string, value: string): boolean => {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage;
    s.setItem(key, value);
    return true;
  } catch { return false; }
};

/**
 * A seed with enough entropy to be unique per visitor. `crypto.randomUUID` when available (this is
 * host code, so randomness is allowed here — the ENGINE stays deterministic because it only ever
 * hashes the seed it is given).
 */
function mintSeed(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    if (c && typeof c.getRandomValues === 'function') {
      const a = new Uint32Array(4);
      c.getRandomValues(a);
      return Array.from(a, n => n.toString(36)).join('');
    }
  } catch { /* fall through */ }
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Read (or create and persist) the durable anonymous seed. Null when storage is unavailable. */
export function durableSeed(): string | null {
  const existing = read('local', VISITOR_KEY);
  if (existing) return existing;
  const seed = mintSeed();
  return write('local', VISITOR_KEY, seed) ? seed : null;
}

/** Read (or create) the per-session seed. */
export function sessionSeed(): string | null {
  const existing = read('session', SESSION_KEY);
  if (existing) return existing;
  const seed = mintSeed();
  return write('session', SESSION_KEY, seed) ? seed : null;
}

export interface ResolveVisitorOptions {
  /** When signed in, pass the account id — identity is then keyed by ACCOUNT, not by browser. */
  userId?: string | null;
}

/**
 * Resolve the visitor identity for this browser.
 *  · signed in  → authenticated, keyed by account (stable across devices)
 *  · anonymous  → keyed by the durable localStorage seed (stable across sessions)
 *  · no storage → session-only identity; if even that fails, the explicit UNKNOWN_VISITOR
 *                 (never a fake "stable" id, which would silently corrupt allocation)
 */
export function resolveWebsiteVisitor(opts: ResolveVisitorOptions = {}): VisitorIdentity {
  const session = sessionSeed() ?? undefined;
  if (opts.userId) return authenticatedVisitor(String(opts.userId), { sessionId: session });

  const durable = durableSeed();
  if (durable) return anonymousVisitor(durable, { sessionId: session });
  if (session) return anonymousVisitor(session, { sessionId: session });
  return UNKNOWN_VISITOR;
}

/** Clear the durable seed (privacy / "forget me"). The next resolve mints a fresh identity. */
export function forgetWebsiteVisitor(): void {
  try { window.localStorage.removeItem(VISITOR_KEY); } catch { /* ignore */ }
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
