// ─────────────────────────────────────────────────────────────────────────────
// Email health aggregator — the data behind the email health endpoint. Combines
// provider status, DNS/deliverability readiness, queue size, and the metrics snapshot
// into one structured payload for a health route / dashboard.
// ─────────────────────────────────────────────────────────────────────────────
import type { EmailProvider, ProviderHealth } from './types';
import type { EmailQueue } from './emailQueue';
import { emailMetrics } from './emailMetrics';
import { deliverabilitySummary, type DeliverabilityEnv } from './deliverability';

export interface EmailHealth {
  status: 'ok' | 'degraded' | 'down';
  provider: ProviderHealth;
  dns: { ready: boolean; summary: ReturnType<typeof deliverabilitySummary> };
  queue: { pending: number; dead: number };
  failureRate: number;
  averageSendMs: number;
  retryCount: number;
  lastFailure: { at: number; template?: string; error?: string } | null;
  checkedAt: number;
}

const DEGRADED_FAILURE_RATE = 0.2; // >20% terminal failure ⇒ degraded

export async function emailHealth(deps: {
  provider: EmailProvider;
  queue?: EmailQueue;
  env: DeliverabilityEnv;
  now: number;
}): Promise<EmailHealth> {
  const provider = await deps.provider.healthCheck();
  const metrics = emailMetrics.snapshot();
  const qs = deps.queue?.snapshot();
  const dns = deliverabilitySummary(deps.env);
  const dnsReady = dns.actionRequired === 0 && dns.manual === 0;

  let status: EmailHealth['status'] = 'ok';
  if (!provider.configured || !provider.ok) status = 'down';
  else if (metrics.rates.failureRate > DEGRADED_FAILURE_RATE || (qs?.dead ?? 0) > 0 || !dnsReady) status = 'degraded';

  return {
    status,
    provider,
    dns: { ready: dnsReady, summary: dns },
    queue: { pending: qs?.pending ?? 0, dead: qs?.dead ?? 0 },
    failureRate: metrics.rates.failureRate,
    averageSendMs: metrics.averageSendMs,
    retryCount: metrics.retryCount,
    lastFailure: metrics.lastFailure,
    checkedAt: deps.now,
  };
}
