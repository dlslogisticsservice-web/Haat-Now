// Production location platform — the tracking policy, the live-ETA extension, and
// Guardian's location detection. The policy's whole job is EFFICIENT updates: push real
// movement, drop jitter and sub-interval fires (battery + network), and stay honest about
// stale / interrupted streams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyTrackState, shouldPush, recordPush, isStale, isSlowUpdate, TRACK_POLICY, type TrackFix,
} from '../../services/tracking-policy';
import { liveEtaMinutes, predictArrivalIso, calculateEtaMinutes, calculateDistanceKm } from '../../services/location.service';
import { locationFindings, type LocationHealthInput } from '../ops/findings';
import { evaluateGate } from '../ops/gate';
import type { GuardianSnapshot } from '../ops/types';

const T = 1_000_000_000_000;
const fix = (lat: number, lng: number, at: number): TrackFix => ({ lat, lng, at });
// ~0.001° latitude ≈ 111 m; ~0.0001° ≈ 11 m (below the 25 m jitter floor).
const RIYADH = { lat: 24.7136, lng: 46.6753 };

// ── efficient updates ────────────────────────────────────────────────────────
test('the first fix is always pushed', () => {
  const d = shouldPush(emptyTrackState(), fix(RIYADH.lat, RIYADH.lng, T), T);
  assert.equal(d.push, true);
  assert.equal(d.reason, 'first');
});

test('a fix arriving inside the minimum interval is dropped (rate limit)', () => {
  const s = recordPush(emptyTrackState(), fix(RIYADH.lat, RIYADH.lng, T));
  const d = shouldPush(s, fix(RIYADH.lat + 0.01, RIYADH.lng, T + 1000), T + 1000);
  assert.equal(d.push, false);
  assert.equal(d.reason, 'too_soon');
});

test('real movement past the interval is pushed', () => {
  const s = recordPush(emptyTrackState(), fix(RIYADH.lat, RIYADH.lng, T));
  const later = T + TRACK_POLICY.minIntervalMs + 1;
  const d = shouldPush(s, fix(RIYADH.lat + 0.001, RIYADH.lng, later), later);   // ~111 m
  assert.equal(d.push, true);
  assert.equal(d.reason, 'moved');
  assert.ok((d.movedMeters ?? 0) > TRACK_POLICY.minMoveMeters);
});

test('GPS jitter below the movement floor is NOT pushed (battery/network saving)', () => {
  const s = recordPush(emptyTrackState(), fix(RIYADH.lat, RIYADH.lng, T));
  const later = T + TRACK_POLICY.minIntervalMs + 1;
  const d = shouldPush(s, fix(RIYADH.lat + 0.0001, RIYADH.lng, later), later);  // ~11 m < 25 m
  assert.equal(d.push, false);
  assert.equal(d.reason, 'idle');
});

test('a stationary driver still emits a heartbeat once per heartbeat interval', () => {
  const s = recordPush(emptyTrackState(), fix(RIYADH.lat, RIYADH.lng, T));
  const later = T + TRACK_POLICY.heartbeatMs + 1;
  const d = shouldPush(s, fix(RIYADH.lat, RIYADH.lng, later), later);           // no movement
  assert.equal(d.push, true);
  assert.equal(d.reason, 'heartbeat');
});

test('the policy reuses location.service distance (no second Haversine)', () => {
  // A ~111 m move is above the floor precisely because calculateDistanceKm says so.
  const meters = calculateDistanceKm(RIYADH.lat, RIYADH.lng, RIYADH.lat + 0.001, RIYADH.lng) * 1000;
  assert.ok(meters > TRACK_POLICY.minMoveMeters && meters < 200, `expected ~111 m, got ${meters}`);
});

// ── offline / last-known ──────────────────────────────────────────────────────
test('a fix older than the stale window is reported stale (show last-known)', () => {
  const f = fix(RIYADH.lat, RIYADH.lng, T);
  assert.equal(isStale(f, T + 1000), false);
  assert.equal(isStale(f, T + TRACK_POLICY.staleAfterMs + 1), true);
  assert.equal(isStale(null, T), true, 'no fix at all is stale');
});

test('a stalled stream is flagged as a slow update (tracking interruption)', () => {
  const s = recordPush(emptyTrackState(), fix(RIYADH.lat, RIYADH.lng, T));
  assert.equal(isSlowUpdate(s, T + 1000), false);
  assert.equal(isSlowUpdate(s, T + TRACK_POLICY.slowUpdateMs + 1), true);
});

// ── live ETA extends, never replaces ──────────────────────────────────────────
test('liveEtaMinutes with no traffic equals the base ETA calculation', () => {
  const km = calculateDistanceKm(RIYADH.lat, RIYADH.lng, RIYADH.lat + 0.05, RIYADH.lng);
  assert.equal(
    liveEtaMinutes(RIYADH.lat, RIYADH.lng, RIYADH.lat + 0.05, RIYADH.lng),
    calculateEtaMinutes(km),
    'the live ETA must be the SAME base model when no traffic hook is given',
  );
});

test('a traffic hook only adjusts the base — it does not re-derive it', () => {
  const base = liveEtaMinutes(RIYADH.lat, RIYADH.lng, RIYADH.lat + 0.05, RIYADH.lng);
  const congested = liveEtaMinutes(RIYADH.lat, RIYADH.lng, RIYADH.lat + 0.05, RIYADH.lng, (b) => b * 1.5);
  assert.equal(congested, Math.max(1, Math.round(base * 1.5)));
});

test('arrival prediction is now + ETA', () => {
  assert.equal(predictArrivalIso(T, 10), new Date(T + 600_000).toISOString());
});

// ── Guardian location detection ───────────────────────────────────────────────
const loc = (over: Partial<LocationHealthInput> = {}): LocationHealthInput => ({
  locationActive: true, mapsStatus: 'active', isProduction: true, mapsVendor: 'google',
  updateFailures: 0, permissionFailures: 0, trackingInterruptions: 0, ...over,
});

test('a healthy location platform yields no findings', () => {
  assert.deepEqual(locationFindings(loc()), []);
});

test('an unavailable device source is a blocker', () => {
  const f = locationFindings(loc({ locationActive: false }));
  assert.equal(f[0].id, 'location.no-source');
  assert.equal(f[0].blocker, true);
});

test('maps not configured in production is surfaced but does NOT block (COD uses coordinates)', () => {
  const f = locationFindings(loc({ mapsStatus: 'not-configured' }));
  const m = f.find(x => x.id === 'location.maps-not-configured')!;
  assert.equal(m.severity, 'medium');
  assert.equal(m.blocker, false);
});

test('update failures are high; permission denials and interruptions are low and non-blocking', () => {
  const f = locationFindings(loc({ updateFailures: 2, permissionFailures: 3, trackingInterruptions: 4 }));
  assert.equal(f.find(x => x.id === 'location.update-failures')!.severity, 'high');
  assert.equal(f.find(x => x.id === 'location.permission')!.severity, 'low');
  assert.equal(f.find(x => x.id === 'location.tracking-interrupted')!.severity, 'low');
  assert.ok(f.every(x => x.id === 'location.update-failures' ? true : !x.blocker));
});

// ── Release Gate includes Location readiness ─────────────────────────────────
const snapshot = (): GuardianSnapshot => ({
  schema: 1, generatedAt: '2026-01-01T00:00:00.000Z', sha: 'abc', env: 'test',
  architecture: { files: 1, totalLoc: 1, circular: [], layerViolations: [], duplicates: [], deadCode: [], largeFiles: [], coupling: [] },
  navigation: { routes: [], duplicateRoutes: [], unreachable: [] },
  fingerprint: { composite: 'a', architecture: 'b', dependency: 'c', repository: 'd' },
  drift: { hasBaseline: true, changed: false, architectureChanged: false, dependencyChanged: false, summary: '' },
  suites: [{ suite: 'Unit', cmd: 'c', passed: 1, failed: 0, recorded: true }],
  journeys: [{ role: 'customer', journey: 'j', status: 'passing', evidence: 'e' }],
  inventory: { services: 0, features: 0, routes: 0, apis: 0, events: 0, permissions: 0, integrations: 0, envKeys: 0 },
});

test('the gate blocks when the device location source is unavailable', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    location: { ready: false, detail: 'no geolocation' } });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => b.rule === 'Location ready'));
});

test('the gate passes location when the source is available', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    location: { ready: true, detail: 'browser geolocation' } });
  assert.ok(g.evaluated.some(e => e.rule === 'Location ready' && e.passed));
});

test('the location rule is skipped when no location state is supplied (backward compatible)', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now' });
  assert.ok(!g.evaluated.some(e => e.rule === 'Location ready'));
});
