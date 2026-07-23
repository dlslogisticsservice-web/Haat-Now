// Pure location utilities — no external map dependencies.
// Safe to call from any React component or service.

const EARTH_RADIUS_KM = 6371;
const DEFAULT_DELIVERY_RADIUS_KM = 15;
const PICKUP_BASE_MINUTES = 10;
const DELIVERY_SPEED_KMH  = 30;

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ── Distance ─────────────────────────────────────────────────────────

/**
 * Haversine great-circle distance between two GPS coordinates.
 * Returns kilometres, accurate to ~0.5% for delivery-scale distances.
 */
export function calculateDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── ETA ──────────────────────────────────────────────────────────────

/**
 * Estimated delivery time in minutes.
 * Assumes urban speed of 30 km/h plus 10-minute pickup baseline.
 */
export function calculateEtaMinutes(distanceKm: number): number {
  return Math.round(PICKUP_BASE_MINUTES + (distanceKm / DELIVERY_SPEED_KMH) * 60);
}

// ── Nearest branch ───────────────────────────────────────────────────

export interface BranchLocation {
  id: string;
  name: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

export interface NearestBranchResult<T extends BranchLocation> {
  branch: T;
  distanceKm: number;
  etaMinutes: number;
}

/**
 * Returns the nearest branch and its distance/ETA from the customer.
 * Branches without coordinates are excluded.
 * Returns null if no branch has coordinates.
 */
export function findNearestBranch<T extends BranchLocation>(
  customerLat: number,
  customerLng: number,
  branches: T[],
): NearestBranchResult<T> | null {
  let nearest: NearestBranchResult<T> | null = null;

  for (const branch of branches) {
    if (branch.latitude == null || branch.longitude == null) continue;
    const distanceKm = calculateDistanceKm(
      customerLat, customerLng,
      branch.latitude, branch.longitude,
    );
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { branch, distanceKm, etaMinutes: calculateEtaMinutes(distanceKm) };
    }
  }

  return nearest;
}

/**
 * Sorts branches by distance from the customer, nearest first.
 * Branches without coordinates sort to the end.
 */
export function sortBranchesByDistance<T extends BranchLocation>(
  customerLat: number,
  customerLng: number,
  branches: T[],
): Array<T & { distanceKm: number; etaMinutes: number }> {
  return branches
    .map(branch => {
      if (branch.latitude == null || branch.longitude == null) {
        return { ...branch, distanceKm: Infinity, etaMinutes: Infinity };
      }
      const distanceKm = calculateDistanceKm(
        customerLat, customerLng,
        branch.latitude, branch.longitude,
      );
      return { ...branch, distanceKm, etaMinutes: calculateEtaMinutes(distanceKm) };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// ── Delivery eligibility ──────────────────────────────────────────────

/**
 * Returns true if the customer is within delivery range of the branch.
 * radiusKm defaults to 15 km if not specified.
 */
export function isWithinDeliveryRange(
  customerLat: number,
  customerLng: number,
  branchLat: number,
  branchLng: number,
  radiusKm: number = DEFAULT_DELIVERY_RADIUS_KM,
): boolean {
  return calculateDistanceKm(customerLat, customerLng, branchLat, branchLng) <= radiusKm;
}

// ── Formatting helpers ────────────────────────────────────────────────

/** Format distance for display: "2.3 كم" or "850 م" */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} م`;
  return `${distanceKm.toFixed(1)} كم`;
}

/** Format ETA for display: "~18 دقيقة" */
export function formatEta(etaMinutes: number): string {
  if (etaMinutes === Infinity) return '';
  if (etaMinutes < 60) return `~${etaMinutes} دقيقة`;
  const h = Math.floor(etaMinutes / 60);
  const m = etaMinutes % 60;
  return m > 0 ? `~${h} س ${m} د` : `~${h} ساعة`;
}

// ── Coordinate snapshot helper ────────────────────────────────────────

export interface CoordinateSnapshot {
  lat: number | null;
  lng: number | null;
}

/**
 * Extracts a safe coordinate snapshot from any object that may have
 * latitude/longitude. Returns nulls if coordinates are missing.
 * Use this when building the order payload to freeze branch location.
 */
export function snapshotCoordinates(
  source: { latitude?: number | null; longitude?: number | null },
): CoordinateSnapshot {
  return {
    lat: source.latitude ?? null,
    lng: source.longitude ?? null,
  };
}

// ── Live ETA (extends the base calc — does NOT replace it) ─────────────────────
//
// The base ETA (calculateEtaMinutes) is a pure geometric estimate. These helpers add the
// LIVE dimension for driver tracking, still built on the SAME base calc so there is one
// ETA model, not two. A traffic-aware provider plugs in via TrafficHook without touching
// any of this — the hook only ADJUSTS the base minutes; it never re-derives them.

/** Adjusts base ETA minutes given the trip distance. A real traffic provider supplies this. */
export type TrafficHook = (baseMinutes: number, distanceKm: number) => number;

/**
 * Live ETA between a moving driver and a destination. Reuses calculateDistanceKm +
 * calculateEtaMinutes; an optional traffic hook scales the result (e.g. ×1.4 in congestion).
 */
export function liveEtaMinutes(
  fromLat: number, fromLng: number, toLat: number, toLng: number, traffic?: TrafficHook,
): number {
  const distanceKm = calculateDistanceKm(fromLat, fromLng, toLat, toLng);
  const base = calculateEtaMinutes(distanceKm);
  return traffic ? Math.max(1, Math.round(traffic(base, distanceKm))) : base;
}

/** Predicted arrival wall-clock time (ISO) from a reference time + ETA minutes. */
export function predictArrivalIso(nowMs: number, etaMinutes: number): string {
  return new Date(nowMs + etaMinutes * 60_000).toISOString();
}
