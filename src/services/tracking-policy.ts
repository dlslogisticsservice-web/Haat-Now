// ─────────────────────────────────────────────────────────────────────────────
// Live-tracking update policy — WHEN a GPS fix should be pushed, and whether a stream
// has gone unhealthy. This is the "efficient intervals / avoid unnecessary polling /
// battery / offline" logic, as PURE functions.
//
// It does NOT compute distance or ETA itself — it reuses location.service
// (calculateDistanceKm). There is exactly one Haversine in this codebase, and it stays
// in location.service. This module only DECIDES, using that number.
//
// PURE. No React, no DOM, no geolocation, no clock — the caller passes `now`.
// ─────────────────────────────────────────────────────────────────────────────
import { calculateDistanceKm } from './location.service';

export interface TrackFix { lat: number; lng: number; at: number; accuracyM?: number }

export interface TrackState {
  /** The last fix actually pushed to the backend. */
  lastPushed: TrackFix | null;
}

export type PushReason = 'first' | 'moved' | 'heartbeat' | 'too_soon' | 'idle';
export interface PushDecision { push: boolean; reason: PushReason; movedMeters?: number }

export const TRACK_POLICY = {
  /** Never push more often than this — the floor that protects battery + network. */
  minIntervalMs: 5_000,
  /** When the driver is not moving, still send a heartbeat this often (proves the stream is alive). */
  heartbeatMs: 30_000,
  /** Movement below this is GPS jitter, not travel — do not push for it. */
  minMoveMeters: 25,
  /** A fix older than this is stale (offline / signal loss) — callers should show last-known. */
  staleAfterMs: 60_000,
  /** A gap between pushes beyond this means the stream is slow / interrupted. */
  slowUpdateMs: 20_000,
} as const;

export const emptyTrackState = (): TrackState => ({ lastPushed: null });

const metersBetween = (a: TrackFix, b: TrackFix): number =>
  calculateDistanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;

/**
 * Should this fix be pushed?
 *   · first fix                    → push
 *   · arrived < minIntervalMs ago  → skip (rate limit, protects battery/network)
 *   · moved ≥ minMoveMeters        → push (real travel)
 *   · otherwise, ≥ heartbeatMs gap → push (liveness heartbeat)
 *   · else                         → skip (idle, no meaningful change)
 */
export function shouldPush(state: TrackState, fix: TrackFix, now: number): PushDecision {
  const last = state.lastPushed;
  if (!last) return { push: true, reason: 'first' };

  const gap = now - last.at;
  if (gap < TRACK_POLICY.minIntervalMs) return { push: false, reason: 'too_soon' };

  const movedMeters = metersBetween(last, fix);
  if (movedMeters >= TRACK_POLICY.minMoveMeters) return { push: true, reason: 'moved', movedMeters };
  if (gap >= TRACK_POLICY.heartbeatMs) return { push: true, reason: 'heartbeat', movedMeters };
  return { push: false, reason: 'idle', movedMeters };
}

export function recordPush(_state: TrackState, fix: TrackFix): TrackState {
  return { lastPushed: fix };
}

/** Is the most recent fix too old to trust (signal loss / offline)? */
export function isStale(fix: TrackFix | null, now: number): boolean {
  return !fix || now - fix.at > TRACK_POLICY.staleAfterMs;
}

/** Has the stream slowed/stalled since the last push (tracking interruption)? */
export function isSlowUpdate(state: TrackState, now: number): boolean {
  return !!state.lastPushed && now - state.lastPushed.at > TRACK_POLICY.slowUpdateMs;
}
