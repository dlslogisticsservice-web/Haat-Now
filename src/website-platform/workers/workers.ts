// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Background worker infrastructure (Wave 1) — INFRASTRUCTURE ONLY.
// A job queue + worker registry + runner for future async work (publishing, SEO,
// media processing, notifications, cleanup). NO domain execution logic is included —
// handlers are registered by later waves. The scheduled edge/pg_cron drainer will use
// the same JobQueue interface.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import { errors } from '../shared/errors';
import type { JsonObject } from '../domain/entities';
import type { CollectionRepository } from '../repositories/collection';
import { createCollection } from '../repositories/collection';
import type { RepositoryBackend } from '../repositories/registry';

export type WorkerKind = 'publishing' | 'seo' | 'media' | 'notifications' | 'cleanup';
export const WORKER_KINDS: ReadonlyArray<WorkerKind> = ['publishing', 'seo', 'media', 'notifications', 'cleanup'];

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'dead';
export const MAX_JOB_ATTEMPTS = 5;

export interface Job {
  id: UUID;
  kind: WorkerKind;
  tenantId: UUID;
  payload: JsonObject;
  status: JobStatus;
  attempts: number;
  runAfter: ISODateTime;
  lastError: string | null;
  createdAt: ISODateTime;
}

export interface EnqueueInput {
  kind: WorkerKind;
  tenantId: UUID;
  payload: JsonObject;
  runAfter?: ISODateTime;
}

export interface JobQueue {
  enqueue(input: EnqueueInput): Promise<Result<Job>>;
  claim(kind: WorkerKind, now: ISODateTime): Promise<Result<Job | null>>;
  complete(jobId: UUID): Promise<Result<true>>;
  fail(jobId: UUID, error: string): Promise<Result<true>>;
  list(kind?: WorkerKind): Promise<Result<Job[]>>;
}

/** In-memory queue (tests + local). A durable queue table impl lands with execution. */
export class MemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<UUID, Job>();
  constructor(
    private readonly clock: () => ISODateTime = () => new Date().toISOString(),
    private readonly idgen: () => UUID = () => crypto.randomUUID(),
  ) {}

  async enqueue(input: EnqueueInput): Promise<Result<Job>> {
    const now = this.clock();
    const job: Job = {
      id: this.idgen(), kind: input.kind, tenantId: input.tenantId, payload: input.payload,
      status: 'queued', attempts: 0, runAfter: input.runAfter ?? now, lastError: null, createdAt: now,
    };
    this.jobs.set(job.id, job);
    return ok({ ...job });
  }
  async claim(kind: WorkerKind, now: ISODateTime): Promise<Result<Job | null>> {
    for (const job of this.jobs.values()) {
      if (job.kind === kind && job.status === 'queued' && job.runAfter <= now) {
        job.status = 'running';
        job.attempts += 1;
        return ok({ ...job });
      }
    }
    return ok(null);
  }
  async complete(jobId: UUID): Promise<Result<true>> {
    const job = this.jobs.get(jobId);
    if (!job) return err(errors.notFound('Job', jobId));
    job.status = 'done';
    return ok(true);
  }
  async fail(jobId: UUID, error: string): Promise<Result<true>> {
    const job = this.jobs.get(jobId);
    if (!job) return err(errors.notFound('Job', jobId));
    job.status = job.attempts >= MAX_JOB_ATTEMPTS ? 'dead' : 'queued';
    job.lastError = error;
    return ok(true);
  }
  async list(kind?: WorkerKind): Promise<Result<Job[]>> {
    const all = Array.from(this.jobs.values()).filter(j => !kind || j.kind === kind).map(j => ({ ...j }));
    return ok(all);
  }
}

type JobRow = Job & Record<string, unknown>;

/** Durable job queue backed by the generic collection (website_jobs). Same interface as
 *  MemoryJobQueue; used by the platform context (memory or Supabase). Claim is a
 *  find-then-mark (non-atomic) — a SECURITY DEFINER claim RPC replaces it under load. */
export class CollectionJobQueue implements JobQueue {
  constructor(
    private readonly col: CollectionRepository<JobRow>,
    private readonly clock: () => ISODateTime = () => new Date().toISOString(),
    private readonly idgen: () => UUID = () => crypto.randomUUID(),
  ) {}

  async enqueue(input: EnqueueInput): Promise<Result<Job>> {
    const now = this.clock();
    const job: JobRow = { id: this.idgen(), kind: input.kind, tenantId: input.tenantId, payload: input.payload, status: 'queued', attempts: 0, runAfter: input.runAfter ?? now, lastError: null, createdAt: now };
    const r = await this.col.insert(job);
    return isOk(r) ? ok(r.value) : err(r.error);
  }
  async claim(kind: WorkerKind, now: ISODateTime): Promise<Result<Job | null>> {
    const found = await this.col.find({ kind, status: 'queued' });
    if (!isOk(found)) return err(found.error);
    const next = found.value.find(j => j.runAfter <= now);
    if (!next) return ok(null);
    const claimed: JobRow = { ...next, status: 'running', attempts: next.attempts + 1 };
    const up = await this.col.upsert(claimed, ['id']);
    return isOk(up) ? ok(up.value) : err(up.error);
  }
  async complete(jobId: UUID): Promise<Result<true>> {
    const found = await this.col.findOne({ id: jobId });
    if (!isOk(found)) return err(found.error);
    if (!found.value) return err(errors.notFound('Job', jobId));
    const up = await this.col.upsert({ ...found.value, status: 'done' }, ['id']);
    return isOk(up) ? ok(true) : err(up.error);
  }
  async fail(jobId: UUID, error: string): Promise<Result<true>> {
    const found = await this.col.findOne({ id: jobId });
    if (!isOk(found)) return err(found.error);
    if (!found.value) return err(errors.notFound('Job', jobId));
    const status: JobStatus = found.value.attempts >= MAX_JOB_ATTEMPTS ? 'dead' : 'queued';
    const up = await this.col.upsert({ ...found.value, status, lastError: error }, ['id']);
    return isOk(up) ? ok(true) : err(up.error);
  }
  async list(kind?: WorkerKind): Promise<Result<Job[]>> {
    return kind ? this.col.find({ kind }) : this.col.find();
  }
}

export function createJobQueue(backend: RepositoryBackend): JobQueue {
  return new CollectionJobQueue(createCollection<JobRow>(backend, 'website_jobs'));
}

/** A handler processes one job of a kind. Registered by later waves (execution). */
export type WorkerHandler = (job: Job) => Promise<Result<void>>;

export class WorkerRegistry {
  private readonly handlers = new Map<WorkerKind, WorkerHandler>();
  register(kind: WorkerKind, handler: WorkerHandler): this {
    this.handlers.set(kind, handler);
    return this;
  }
  get(kind: WorkerKind): WorkerHandler | undefined {
    return this.handlers.get(kind);
  }
}

/** Pulls one job for a kind and dispatches it to the registered handler (if any). */
export class WorkerRunner {
  constructor(
    private readonly queue: JobQueue,
    private readonly registry: WorkerRegistry,
    private readonly clock: () => ISODateTime = () => new Date().toISOString(),
  ) {}

  async processOnce(kind: WorkerKind): Promise<Result<'idle' | 'processed'>> {
    const claimed = await this.queue.claim(kind, this.clock());
    if (!isOk(claimed)) return err(claimed.error);
    const job = claimed.value;
    if (!job) return ok('idle');
    const handler = this.registry.get(kind);
    if (!handler) return err(errors.unavailable(`no handler registered for ${kind}`));
    const result = await handler(job);
    if (isOk(result)) { await this.queue.complete(job.id); return ok('processed'); }
    await this.queue.fail(job.id, result.error.message);
    return err(result.error);
  }
}
