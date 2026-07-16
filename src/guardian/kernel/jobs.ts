// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · Job Orchestration.
//
// Modules declare jobs (probe sweeps, rollups, stale checks, escalation ticks).
// The kernel does NOT own a timer — the host drives `tick(now)` from whatever it
// has (browser interval, pg_cron, Edge invocation, a test). Same code everywhere.
//
// Guarantees: no overlapping run of the same job, failures isolated + announced,
// every run measured.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, Logger, Result } from './types';
import { ok, err } from './types';
import type { EventBus } from './events';

export interface JobDef {
  id: string;
  owner: string;
  /** Minimum ms between runs. The host tick cadence is the resolution. */
  intervalMs: number;
  /** Skip the run if the previous is still in-flight (default true). */
  singleton?: boolean;
  /** Abandon a run after this long (marks failed, frees the lock). */
  timeoutMs?: number;
  handler: () => void | Promise<void>;
}

export type JobState = 'idle' | 'running' | 'failed';

export interface JobRecord {
  def: JobDef;
  state: JobState;
  lastRunAt?: number;
  lastMs?: number;
  runs: number;
  failures: number;
  lastError?: string;
  enabled: boolean;
}

export class JobScheduler {
  private readonly jobs = new Map<string, JobRecord>();

  constructor(
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  define(def: JobDef): Result<true> {
    if (this.jobs.has(def.id)) return err(`job already defined: ${def.id}`);
    if (def.intervalMs <= 0) return err(`job ${def.id}: intervalMs must be > 0`);
    this.jobs.set(def.id, { def, state: 'idle', runs: 0, failures: 0, enabled: true });
    return ok(true);
  }

  remove(id: string): void { this.jobs.delete(id); }
  enable(id: string, on: boolean): void { const j = this.jobs.get(id); if (j) j.enabled = on; }
  get(id: string): JobRecord | undefined { return this.jobs.get(id); }
  list(): JobRecord[] { return [...this.jobs.values()]; }

  /** Which jobs are due at `now` (pure — useful for tests and for host planning). */
  due(now: number): string[] {
    return [...this.jobs.values()]
      .filter(j => j.enabled && j.state !== 'running' && (j.lastRunAt === undefined || now - j.lastRunAt >= j.def.intervalMs))
      .map(j => j.def.id);
  }

  /** Run every due job. The host calls this from its own timer/cron. Never throws. */
  async tick(now: number = this.clock.now()): Promise<{ ran: string[]; failed: string[] }> {
    const ran: string[] = [], failed: string[] = [];
    for (const id of this.due(now)) {
      const r = await this.run(id, now);
      (r.ok ? ran : failed).push(id);
    }
    return { ran, failed };
  }

  /** Force a run (manual trigger — caller enforces `guardian.job.run`). */
  async run(id: string, now: number = this.clock.now()): Promise<Result<{ ms: number }>> {
    const j = this.jobs.get(id);
    if (!j) return err(`unknown job: ${id}`);
    if (j.state === 'running' && (j.def.singleton ?? true)) return err(`job already running: ${id}`);

    j.state = 'running'; j.lastRunAt = now; j.runs++;
    await this.bus.emit('guardian.job.started', { jobId: id }, 'jobs');
    const started = this.clock.now();

    try {
      const work = Promise.resolve(j.def.handler());
      if (j.def.timeoutMs) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`job timeout after ${j.def.timeoutMs}ms`)), j.def.timeoutMs);
        });
        try { await Promise.race([work, timeout]); } finally { if (timer) clearTimeout(timer); }
      } else {
        await work;
      }
      const ms = this.clock.now() - started;
      j.state = 'idle'; j.lastMs = ms;
      await this.bus.emit('guardian.job.finished', { jobId: id, ms }, 'jobs');
      return ok({ ms });
    } catch (e) {
      const msg = String(e);
      j.state = 'failed'; j.failures++; j.lastError = msg;
      this.logger.error('job failed', { jobId: id, error: msg });
      await this.bus.emit('guardian.job.failed', { jobId: id, error: msg }, 'jobs');
      j.state = 'idle';                       // failure must not wedge the job forever
      return err(msg);
    }
  }
}
