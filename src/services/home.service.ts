import { catalogRepository } from '../repositories/catalog.repository';

// ─────────────────────────────────────────────────────────────────────────────
// home.service (Phase-2 architecture stabilization).
//
// Owns the Home feed business logic. It calls the catalog REPOSITORY (never Supabase
// directly) and returns typed, ready-to-render data. The HomeScreen component no longer
// knows the data source — it consumes this via the useHomeFeed hook.
//
// Behaviour is intentionally identical to the previous inline HomeScreen fetch: parallel
// branch+offer queries, errors logged (not thrown) so the UI keeps its mock fallback.
// ─────────────────────────────────────────────────────────────────────────────

export interface BranchWithMerchant {
  id: string; name: string; merchant_id: string; zone_id: string; is_active: boolean;
  merchants: { business_name: string; logo_url?: string | null };
  zones: { name: string };
}

export interface DBOffer {
  id: string; title: string; description: string | null; discount_percent: number | null;
}

export interface HomeFeed {
  branches: BranchWithMerchant[];
  offers: DBOffer[];
}

export const homeService = {
  /** Marketplace branches + active offers for the Home screen. */
  async getFeed(): Promise<HomeFeed> {
    const now = new Date().toISOString();
    const [branchRes, offerRes] = await Promise.all([
      catalogRepository.listBranches(),
      catalogRepository.listActiveOffers(now),
    ]);
    // Surface query errors instead of silently falling back to mock cards.
    if (branchRes.error) console.error('HomeScreen merchant_branches:', branchRes.error);
    if (offerRes.error) console.error('HomeScreen offers:', offerRes.error);
    return {
      branches: (branchRes.data as unknown as BranchWithMerchant[]) ?? [],
      offers: (offerRes.data as DBOffer[]) ?? [],
    };
  },
};
