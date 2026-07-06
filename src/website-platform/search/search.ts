// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Search Experience (Wave 4, Part 4).
// A pure, reusable search engine over merchant/product data supplied by the ordering
// port: autocomplete, recent/popular/trending, nearby, filters, sorting. Config (popular/
// trending terms) is admin-editable. No duplicated logic; reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchableItem {
  id: string;
  name: string;
  type: 'restaurant' | 'store' | 'product' | 'pharmacy' | 'grocery';
  keywords?: string[];
  rating?: number;              // 0..5
  deliveryMinutes?: number;
  popularity?: number;          // arbitrary metric
  category?: string;
  city?: string;
  openNow?: boolean;
  lat?: number;
  lng?: number;
}

export interface SearchFilters {
  type?: SearchableItem['type'];
  category?: string;
  city?: string;
  minRating?: number;
  maxDeliveryMinutes?: number;
  openNow?: boolean;
}

export type SearchSort = 'relevance' | 'rating' | 'delivery_time' | 'popularity';

function norm(s: string): string { return s.trim().toLowerCase(); }

/** True when the query textually matches the item's name or keywords (ignores rating). */
export function textMatches(item: SearchableItem, q: string): boolean {
  const query = norm(q);
  if (!query) return true;
  return norm(item.name).includes(query) || (item.keywords ?? []).some(k => norm(k).includes(query));
}

/** Relevance score: exact/prefix/substring on name + keywords, weighted by rating. */
export function relevance(item: SearchableItem, q: string): number {
  const name = norm(item.name);
  const query = norm(q);
  if (!query) return (item.rating ?? 0);
  let score = 0;
  if (name === query) score += 100;
  else if (name.startsWith(query)) score += 60;
  else if (name.includes(query)) score += 30;
  if ((item.keywords ?? []).some(k => norm(k).includes(query))) score += 20;
  score += (item.rating ?? 0) * 2;
  return score;
}

export function filterItems(items: ReadonlyArray<SearchableItem>, f: SearchFilters): SearchableItem[] {
  return items.filter(i =>
    (!f.type || i.type === f.type)
    && (!f.category || i.category === f.category)
    && (!f.city || i.city === f.city)
    && (f.minRating === undefined || (i.rating ?? 0) >= f.minRating)
    && (f.maxDeliveryMinutes === undefined || (i.deliveryMinutes ?? Infinity) <= f.maxDeliveryMinutes)
    && (!f.openNow || i.openNow === true),
  );
}

export function sortItems(items: ReadonlyArray<SearchableItem>, sort: SearchSort, q = ''): SearchableItem[] {
  const arr = [...items];
  switch (sort) {
    case 'rating': return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'delivery_time': return arr.sort((a, b) => (a.deliveryMinutes ?? Infinity) - (b.deliveryMinutes ?? Infinity));
    case 'popularity': return arr.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    default: return arr.sort((a, b) => relevance(b, q) - relevance(a, q));
  }
}

export interface SearchQuery { q: string; filters?: SearchFilters; sort?: SearchSort }

/** Full search: filter → rank/sort. Pure. */
export function searchItems(items: ReadonlyArray<SearchableItem>, query: SearchQuery): SearchableItem[] {
  const q = query.q ?? '';
  let result = filterItems(items, query.filters ?? {});
  if (q.trim()) result = result.filter(i => textMatches(i, q));
  return sortItems(result, query.sort ?? 'relevance', q);
}

/** Autocomplete suggestions (names), ranked by relevance, deduped. */
export function autocomplete(items: ReadonlyArray<SearchableItem>, q: string, limit = 8): string[] {
  if (!norm(q)) return [];
  const scored = items
    .filter(i => textMatches(i, q))
    .map(i => ({ name: i.name, score: relevance(i, q) }))
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of scored) { const key = norm(s.name); if (!seen.has(key)) { seen.add(key); out.push(s.name); } if (out.length >= limit) break; }
  return out;
}

/** Haversine distance (km). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Nearby items sorted by distance (items must have lat/lng). */
export function nearbyItems(items: ReadonlyArray<SearchableItem>, lat: number, lng: number, radiusKm = 10): SearchableItem[] {
  return items
    .filter(i => i.lat !== undefined && i.lng !== undefined)
    .map(i => ({ i, d: distanceKm(lat, lng, i.lat!, i.lng!) }))
    .filter(x => x.d <= radiusKm)
    .sort((a, b) => a.d - b.d)
    .map(x => x.i);
}

// ── Recent searches (pure list ops; the client persists the array) ────────────────
export function addRecentSearch(recent: ReadonlyArray<string>, term: string, max = 8): string[] {
  const t = term.trim();
  if (!t) return [...recent];
  return [t, ...recent.filter(r => norm(r) !== norm(t))].slice(0, max);
}

// ── Admin-editable config (popular / trending terms) ──────────────────────────────
export interface SearchConfig {
  popularTerms: string[];
  trendingTerms: string[];
}
export function defaultSearchConfig(): SearchConfig {
  return { popularTerms: [], trendingTerms: [] };
}
