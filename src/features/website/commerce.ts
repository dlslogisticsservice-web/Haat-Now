// ─────────────────────────────────────────────────────────────────────────────
// Website commerce adapter (Launch Sprint 2, Part 1).
// Feeds the public site's discovery blocks from LIVE services — reusing the exact same
// home.service + merchant-settings.service the customer app uses (never duplicated). When
// the live catalog is empty (e.g. sandbox mode ships an empty stub, exactly as HomeScreen
// experiences), callers keep their curated content — the established graceful fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { homeService, type BranchWithMerchant } from '../../services/home.service';
import { merchantSettingsService } from '../../services/merchant-settings.service';
import type { MerchantCard, DealCard } from '../../services/website.service';

export interface LiveCommerce { merchants: MerchantCard[]; deals: DealCard[] }

const EMPTY: LiveCommerce = { merchants: [], deals: [] };
/** Enrich open/ETA for at most this many visible branches (bounds per-branch settings reads). */
const ENRICH_LIMIT = 12;

function toMerchantCard(b: BranchWithMerchant): MerchantCard {
  return {
    name: b.merchants?.business_name || b.name,
    image: b.merchants?.logo_url || undefined,
    cuisine: b.zones?.name || undefined,
    href: `/restaurants?m=${encodeURIComponent(b.id)}`,
    closed: b.is_active === false,
  };
}

/**
 * Load live merchants + offers for the discovery surface. Reuses homeService.getFeed()
 * (branches + active offers) and enriches the first N branches with live open/ETA from
 * merchantSettingsService. Never throws — returns empty so callers fall back to curated.
 */
export async function loadLiveCommerce(): Promise<LiveCommerce> {
  try {
    const feed = await homeService.getFeed();
    const branches = (feed.branches || []).filter(Boolean);
    if (branches.length === 0) return EMPTY;

    const merchants = branches.map(toMerchantCard);
    // Enrich the visible head with real open-state + prep-time (ETA) — bounded, parallel.
    await Promise.all(merchants.slice(0, ENRICH_LIMIT).map(async (card, i) => {
      try {
        const s = await merchantSettingsService.get(branches[i].id);
        const prep = merchantSettingsService.effectivePrepTime(s);
        card.eta = `${prep}–${prep + 15} min`;
        if (!merchantSettingsService.isAcceptingOrders(s)) card.closed = true;
      } catch { /* keep base card */ }
    }));

    const deals: DealCard[] = (feed.offers || []).map(o => ({
      title: o.title,
      merchant: o.description || undefined,
      discount: typeof o.discount_percent === 'number' ? `-${o.discount_percent}%` : undefined,
      href: '/offers',
    }));

    return { merchants, deals };
  } catch {
    return EMPTY;
  }
}
