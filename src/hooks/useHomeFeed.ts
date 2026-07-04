import { useEffect, useState } from 'react';
import { homeService, type HomeFeed } from '../services/home.service';

// ─────────────────────────────────────────────────────────────────────────────
// useHomeFeed (Phase-2 architecture stabilization).
//
// Hook layer: owns the fetch lifecycle (loading + result state) and calls the SERVICE.
// Completes the target chain for the Home screen: UI → Hook → Service → Repository → Supabase.
// Guards against setting state after unmount.
// ─────────────────────────────────────────────────────────────────────────────

export function useHomeFeed(): HomeFeed & { loading: boolean } {
  const [feed, setFeed] = useState<HomeFeed>({ branches: [], offers: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const f = await homeService.getFeed();
        if (alive) setFeed(f);
      } catch (e) {
        console.error('HomeScreen fetch:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { ...feed, loading };
}
