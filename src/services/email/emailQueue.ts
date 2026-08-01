// ─────────────────────────────────────────────────────────────────────────────
// Email queue — durable-style delivery with retries, exponential backoff, a
// dead-letter queue, per-item delivery status, and provider-response logging.
//
// Time and the actual sender are INJECTED (processDue(now), constructor sender), so the
// whole retry/backoff/DLQ lifecycle is deterministic and unit-testable — no real sleeps.
// A production host drives it with a real clock + the Resend provider.
// ─────────────────────────────────────────────────────────────────────────────
import type { EmailMessage, EmailSendResult, QueueItem, QueueItemStatus } from './types';
import { backoffMs, DEFAULT_RETRY, type RetryOptions } from './retry';
import { emailMonitoring } from './emailMonitoring';

export type EmailSender = (message: EmailMessage) => Promise<EmailSendResult>;

export interface QueueSnapshot {
  pending: number;   // queued + deferred + sending
  sent: number;
  dead: number;
  total: number;
}

export class EmailQueue {
  private items = new Map<string, QueueItem>();
  private dead: QueueItem[] = [];
  private seq = 0;

  constructor(private sender: EmailSender, private opts: RetryOptions = DEFAULT_RETRY) {}

  /** Enqueue a message. Idempotent by idempotencyKey — re-enqueue never double-sends. */
  enqueue(message: EmailMessage, now: number): QueueItem {
    const id = message.idempotencyKey || `q_${++this.seq}`;
    const existing = this.items.get(id) || this.dead.find(d => d.id === id);
    if (existing) return existing;
    const item: QueueItem = {
      id, message, status: 'queued', attempts: 0, maxAttempts: this.opts.attempts,
      nextAttemptAt: now, createdAt: now, updatedAt: now,
    };
    this.items.set(id, item);
    emailMonitoring.record('queued', { to: message.to, template: message.templateId });
    return item;
  }

  /** Attempt every item whose backoff window has elapsed (nextAttemptAt <= now). */
  async processDue(now: number): Promise<void> {
    const due = [...this.items.values()].filter(i => (i.status === 'queued' || i.status === 'deferred') && i.nextAttemptAt <= now);
    for (const item of due) await this.attempt(item, now);
  }

  private async attempt(item: QueueItem, now: number): Promise<void> {
    item.status = 'sending';
    item.attempts += 1;
    item.updatedAt = now;
    if (item.attempts > 1) emailMonitoring.record('retry', { to: item.message.to, template: item.message.templateId });

    const result = await this.sender(item.message);
    item.providerId = result.id;

    if (result.ok) {
      item.status = 'sent';
      item.updatedAt = now;
      emailMonitoring.record('sent', { to: item.message.to, template: item.message.templateId, providerId: result.id, ms: result.ms });
      return;
    }

    item.lastError = result.error;
    const canRetry = !!result.error?.retryable && item.attempts < item.maxAttempts;
    if (canRetry) {
      item.status = 'deferred';
      item.nextAttemptAt = now + backoffMs(item.attempts, this.opts);
      item.updatedAt = now;
      emailMonitoring.record('deferred', { to: item.message.to, template: item.message.templateId, error: result.error?.message, ms: result.ms });
      return;
    }

    // Non-retryable, or attempts exhausted → dead-letter (terminal failure).
    item.status = 'dead';
    item.updatedAt = now;
    this.items.delete(item.id);
    this.dead.push(item);
    emailMonitoring.record('failed', { to: item.message.to, template: item.message.templateId, error: result.error?.message, ms: result.ms, at: now });
    emailMonitoring.record('dead_lettered', { to: item.message.to, template: item.message.templateId, error: result.error?.message, at: now });
  }

  /** Delivery status of an item. */
  statusOf(id: string): QueueItemStatus | 'unknown' {
    return this.items.get(id)?.status ?? this.dead.find(d => d.id === id)?.status ?? 'unknown';
  }

  get(id: string): QueueItem | undefined {
    return this.items.get(id) ?? this.dead.find(d => d.id === id);
  }

  /** Items still awaiting a successful send. */
  pendingSize(): number {
    return [...this.items.values()].filter(i => i.status === 'queued' || i.status === 'deferred' || i.status === 'sending').length;
  }

  deadLetter(): QueueItem[] { return [...this.dead]; }

  snapshot(): QueueSnapshot {
    const all = [...this.items.values()];
    return {
      pending: this.pendingSize(),
      sent: all.filter(i => i.status === 'sent').length,
      dead: this.dead.length,
      total: all.length + this.dead.length,
    };
  }
}
