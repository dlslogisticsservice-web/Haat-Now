// ─────────────────────────────────────────────────────────────────────────────
// Production stability: self-healing dynamic imports.
//
// After a deploy, a tab still running the PREVIOUS build requests JS chunks whose
// content-hash filenames no longer exist on the new deployment. The dynamic
// import() then rejects with a ChunkLoadError, which — uncaught inside React.lazy
// — surfaces the global error boundary ("حدث خطأ غير متوقع / please reload").
//
// lazyRetry() detects that specific failure and force-reloads ONCE to fetch the
// fresh shell (guarded by sessionStorage so a genuinely broken chunk can never
// cause a reload loop — it falls through to the error boundary the second time).
// Non-chunk errors are re-thrown untouched so real bugs still surface.
// ─────────────────────────────────────────────────────────────────────────────

const RELOAD_KEY = 'haat_chunk_reload';

const CHUNK_ERROR = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module/i;

function isChunkLoadError(err: unknown): boolean {
  const msg = err && typeof err === 'object' ? String((err as { message?: string }).message || err) : String(err);
  const name = err && typeof err === 'object' ? String((err as { name?: string }).name || '') : '';
  return name === 'ChunkLoadError' || CHUNK_ERROR.test(msg);
}

export function lazyRetry<T>(factory: () => Promise<T>): Promise<T> {
  return factory()
    .then((mod) => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ } return mod; })
    .catch((err) => {
      if (!isChunkLoadError(err)) throw err;
      let alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1'; } catch { /* ignore */ }
      if (alreadyReloaded) {
        // We already reloaded once and the chunk still fails → a real problem, not a
        // stale-deploy race. Clear the flag and surface the error boundary.
        try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
        throw err;
      }
      try { sessionStorage.setItem(RELOAD_KEY, '1'); } catch { /* ignore */ }
      try { window.location.reload(); } catch { /* ignore */ }
      // Never resolve/reject before the reload takes over, so React neither renders
      // the stale tree nor trips the boundary during the reload.
      return new Promise<T>(() => { /* pending until navigation */ });
    });
}
