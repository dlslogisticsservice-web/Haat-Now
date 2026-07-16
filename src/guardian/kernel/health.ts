// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · Health Engine.
//
// The ENGINE only — it owns the state machine, not the checks. It knows nothing
// about HTTP, SQL, orders or payments. Modules register checks and report results;
// the engine turns a stream of results into status transitions, incidents,
// escalation and recovery, and announces everything on the event bus.
//
//   report → hysteresis → status transition → incident open/escalate/recover
//                                   │
//                          ack / resolve (human, permission-gated by the caller)
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, HealthStatus, Id, IdGenerator, ISODateTime, Result, Severity } from './types';
import { ok, err, maxSeverity, worstStatus } from './types';
import type { EventBus } from './events';

export interface HealthCheckDef {
  key: string;
  /** Owning service/subsystem — used for roll-up and routing. */
  service: string;
  /** Module that registered it (provenance). */
  owner: string;
  /** Severity floor: an incident from this check can never be raised below this. */
  severityFloor?: Severity;
  /** Consecutive same-status reports required before a transition (flap damping). */
  hysteresis?: number;
  /** If no report within this many ms, status becomes `unknown` (stale ≠ green). */
  staleAfterMs?: number;
  /** Escalation ladder in ms from incident open. */
  escalationMs?: readonly number[];
}

export interface HealthReport { key: string; status: HealthStatus; value?: number; message?: string; at?: ISODateTime }

export interface CheckState {
  key: string; service: string; owner: string;
  status: HealthStatus; since: ISODateTime; lastAt: ISODateTime;
  streak: number; pendingStatus: HealthStatus | null; pendingStreak: number;
  lastValue?: number; lastMessage?: string; incidentId?: Id;
}

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

export interface Incident {
  id: Id; key: string; service: string; severity: Severity; status: IncidentStatus;
  openedAt: ISODateTime; acknowledgedAt?: ISODateTime; resolvedAt?: ISODateTime;
  acknowledgedBy?: string; resolvedBy?: string;
  occurrences: number; escalationLevel: number; lastMessage?: string;
}

const statusSeverity = (s: HealthStatus): Severity => (s === 'red' ? 'high' : s === 'yellow' ? 'medium' : s === 'unknown' ? 'low' : 'info');

export class HealthEngine {
  private readonly checks = new Map<string, HealthCheckDef>();
  private readonly states = new Map<string, CheckState>();
  private readonly incidents = new Map<Id, Incident>();

  constructor(
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  // ── registration ───────────────────────────────────────────────────────────
  registerCheck(def: HealthCheckDef): Result<true> {
    if (this.checks.has(def.key)) return err(`check already registered: ${def.key}`);
    this.checks.set(def.key, def);
    const now = this.clock.iso();
    this.states.set(def.key, {
      key: def.key, service: def.service, owner: def.owner,
      status: 'unknown', since: now, lastAt: now, streak: 0, pendingStatus: null, pendingStreak: 0,
    });
    void this.bus.emit('health.check.registered', { key: def.key }, 'health');
    return ok(true);
  }

  listChecks(): HealthCheckDef[] { return [...this.checks.values()]; }
  state(key: string): CheckState | undefined { return this.states.get(key); }
  states_(): CheckState[] { return [...this.states.values()]; }

  /** Roll-up for a service (worst-of-children). `unknown` never reads as green. */
  serviceStatus(service: string): HealthStatus {
    const list = [...this.states.values()].filter(s => s.service === service).map(s => s.status);
    return list.length ? worstStatus(list) : 'unknown';
  }
  overall(): HealthStatus { return worstStatus([...this.states.values()].map(s => s.status)); }

  // ── the state machine ──────────────────────────────────────────────────────
  /**
   * Feed a result in. Applies hysteresis, transitions status, and opens/recovers
   * incidents. Idempotent per report; safe to call at any frequency.
   */
  async report(r: HealthReport): Promise<Result<CheckState>> {
    const def = this.checks.get(r.key);
    const st = this.states.get(r.key);
    if (!def || !st) return err(`unknown check: ${r.key}`);

    const at = r.at ?? this.clock.iso();
    st.lastAt = at; st.lastValue = r.value; st.lastMessage = r.message;

    const need = Math.max(1, def.hysteresis ?? 1);
    if (r.status === st.status) { st.streak++; st.pendingStatus = null; st.pendingStreak = 0; return ok(st); }

    // different from current → accumulate toward a transition
    if (st.pendingStatus === r.status) st.pendingStreak++;
    else { st.pendingStatus = r.status; st.pendingStreak = 1; }
    if (st.pendingStreak < need) return ok(st);

    const from = st.status;
    st.status = r.status; st.since = at; st.streak = st.pendingStreak;
    st.pendingStatus = null; st.pendingStreak = 0;
    await this.bus.emit('health.status.changed', { key: st.key, from, to: st.status }, 'health');

    const bad = st.status === 'red' || st.status === 'yellow';
    if (bad) await this.openOrUpdateIncident(def, st, at);
    else if (st.status === 'green') await this.recover(st, at);
    return ok(st);
  }

  /** Mark checks stale when no report arrived in time. Stale is `unknown`, never green. */
  async sweepStale(nowMs: number): Promise<number> {
    let n = 0;
    for (const st of this.states.values()) {
      const def = this.checks.get(st.key);
      if (!def?.staleAfterMs || st.status === 'unknown') continue;
      if (nowMs - Date.parse(st.lastAt) > def.staleAfterMs) {
        const from = st.status;
        st.status = 'unknown'; st.since = this.clock.iso(); st.streak = 0;
        await this.bus.emit('health.status.changed', { key: st.key, from, to: 'unknown' }, 'health');
        n++;
      }
    }
    return n;
  }

  private async openOrUpdateIncident(def: HealthCheckDef, st: CheckState, at: ISODateTime): Promise<void> {
    const severity = maxSeverity(statusSeverity(st.status), def.severityFloor ?? 'info');
    const existing = st.incidentId ? this.incidents.get(st.incidentId) : undefined;
    if (existing && existing.status !== 'resolved') {
      existing.occurrences++;
      existing.severity = maxSeverity(existing.severity, severity);   // severity may rise, never fall
      existing.lastMessage = st.lastMessage;
      return;
    }
    const inc: Incident = {
      id: this.ids.next('inc'), key: st.key, service: st.service, severity, status: 'open',
      openedAt: at, occurrences: 1, escalationLevel: 0, lastMessage: st.lastMessage,
    };
    this.incidents.set(inc.id, inc);
    st.incidentId = inc.id;
    await this.bus.emit('health.incident.opened', { incidentId: inc.id, key: st.key, severity }, 'health');
  }

  private async recover(st: CheckState, _at: ISODateTime): Promise<void> {
    const inc = st.incidentId ? this.incidents.get(st.incidentId) : undefined;
    await this.bus.emit('health.recovered', { key: st.key, incidentId: inc?.id }, 'health');
    if (inc && inc.status !== 'resolved') {
      // Auto-resolve on recovery: the condition is gone. Humans still see the record.
      inc.status = 'resolved'; inc.resolvedAt = this.clock.iso(); inc.resolvedBy = 'auto:recovery';
      await this.bus.emit('health.incident.resolved', { incidentId: inc.id, by: 'auto:recovery' }, 'health');
    }
    st.incidentId = undefined;
  }

  // ── human actions (caller enforces permission; engine records intent) ───────
  async acknowledge(incidentId: Id, by: string): Promise<Result<Incident>> {
    const inc = this.incidents.get(incidentId);
    if (!inc) return err(`unknown incident: ${incidentId}`);
    if (inc.status === 'resolved') return err('incident already resolved');
    inc.status = 'acknowledged'; inc.acknowledgedAt = this.clock.iso(); inc.acknowledgedBy = by;
    await this.bus.emit('health.incident.acknowledged', { incidentId, by }, 'health');
    return ok(inc);
  }

  async resolve(incidentId: Id, by: string): Promise<Result<Incident>> {
    const inc = this.incidents.get(incidentId);
    if (!inc) return err(`unknown incident: ${incidentId}`);
    if (inc.status === 'resolved') return ok(inc);
    inc.status = 'resolved'; inc.resolvedAt = this.clock.iso(); inc.resolvedBy = by;
    const st = this.states.get(inc.key);
    if (st?.incidentId === incidentId) st.incidentId = undefined;
    await this.bus.emit('health.incident.resolved', { incidentId, by }, 'health');
    return ok(inc);
  }

  /** Advance the escalation ladder for unacked incidents. Driven by a job, not a timer here. */
  async escalateDue(nowMs: number): Promise<number> {
    let n = 0;
    for (const inc of this.incidents.values()) {
      if (inc.status !== 'open') continue;                    // ack stops escalation
      const def = this.checks.get(inc.key);
      const ladder = def?.escalationMs ?? [];
      const elapsed = nowMs - Date.parse(inc.openedAt);
      let level = 0;
      for (const step of ladder) if (elapsed >= step) level++;
      if (level > inc.escalationLevel) {
        inc.escalationLevel = level;
        await this.bus.emit('health.incident.escalated', { incidentId: inc.id, level }, 'health');
        n++;
      }
    }
    return n;
  }

  incident(id: Id): Incident | undefined { return this.incidents.get(id); }
  listIncidents(filter?: { status?: IncidentStatus; service?: string }): Incident[] {
    let out = [...this.incidents.values()];
    if (filter?.status) out = out.filter(i => i.status === filter.status);
    if (filter?.service) out = out.filter(i => i.service === filter.service);
    return out.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }
}
