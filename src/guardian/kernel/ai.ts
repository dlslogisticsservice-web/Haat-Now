// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · AI Abstraction Layer.
//
// NO PROVIDER IS IMPLEMENTED OR IMPORTED HERE. This file defines the single
// interface every future provider (Claude, OpenAI, Gemini, DeepSeek, Grok, local)
// must satisfy, plus the registry/routing that keeps Guardian provider-agnostic
// forever. Swapping vendors must never touch a calling module.
//
// Guardian's AI is an ANALYST: it consumes a KnowledgeEngine ContextBundle and
// returns text/structured output. The kernel gives it no capability to act — no
// repo write, no deploy, no DB mutation. Safety by absence of capability.
// ─────────────────────────────────────────────────────────────────────────────
import type { Result } from './types';
import { ok, err, isOk } from './types';
import type { ContextBundle } from './knowledge';

export type AiCapability = 'text' | 'structured' | 'streaming' | 'vision' | 'embedding' | 'tools';

export interface AiMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface AiRequest {
  /** Logical task, not a model name — routing decides the model. */
  task: string;
  messages: AiMessage[];
  /** The ONLY grounding an AI request may use (Knowledge Engine output). */
  context?: ContextBundle;
  /** JSON schema for structured output; providers without 'structured' must reject. */
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
  /** Correlates the call to an incident/audit entry. */
  correlationId?: string;
}

export interface AiUsage { inputTokens: number; outputTokens: number; costUsd?: number }

export interface AiResponse {
  providerId: string;
  model: string;
  text?: string;
  data?: unknown;          // when schema was supplied
  usage: AiUsage;
  finishReason: 'stop' | 'length' | 'refusal' | 'error';
  raw?: unknown;
}

/**
 * THE contract. A provider module implements this and registers it:
 *   Guardian.use(ClaudeProvider)  →  ctx.ai.register(provider)
 * The kernel never constructs one and never holds a key.
 */
export interface AiProvider {
  readonly id: string;                        // 'claude' | 'openai' | 'gemini' | 'deepseek' | 'grok' | 'local'
  readonly models: readonly string[];
  readonly capabilities: readonly AiCapability[];
  /** Cheap liveness/credential probe — no side effects. */
  health?(): Promise<boolean>;
  complete(req: AiRequest): Promise<Result<AiResponse, string>>;
}

/** Which provider serves which task; falls back in order. Pure data — configurable, not compiled in. */
export interface AiRoutingRule { task: string; providers: readonly string[]; requires?: readonly AiCapability[] }

export class AiRegistry {
  private readonly providers = new Map<string, AiProvider>();
  private readonly rules: AiRoutingRule[] = [];
  private defaultOrder: string[] = [];

  register(provider: AiProvider): Result<true> {
    if (this.providers.has(provider.id)) return err(`ai provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
    if (!this.defaultOrder.includes(provider.id)) this.defaultOrder.push(provider.id);
    return ok(true);
  }

  unregister(id: string): void { this.providers.delete(id); this.defaultOrder = this.defaultOrder.filter(p => p !== id); }
  get(id: string): AiProvider | undefined { return this.providers.get(id); }
  list(): { id: string; models: readonly string[]; capabilities: readonly AiCapability[] }[] {
    return [...this.providers.values()].map(p => ({ id: p.id, models: p.models, capabilities: p.capabilities }));
  }
  has(id: string): boolean { return this.providers.has(id); }

  /** Explicit preference order when no rule matches. */
  setDefaultOrder(order: string[]): void { this.defaultOrder = [...order]; }
  addRule(rule: AiRoutingRule): void { this.rules.push(rule); }

  /** Resolve the provider chain for a task: rule order → default order, filtered by capability. */
  resolve(task: string, requires: readonly AiCapability[] = []): AiProvider[] {
    const rule = this.rules.find(r => r.task === task);
    const order = rule?.providers ?? this.defaultOrder;
    const need = [...(rule?.requires ?? []), ...requires];
    return order
      .map(id => this.providers.get(id))
      .filter((p): p is AiProvider => !!p && need.every(c => p.capabilities.includes(c)));
  }

  /**
   * Provider-agnostic invocation with failover. Callers name a TASK, never a vendor.
   * Returns the first success; aggregates errors if all fail.
   */
  async complete(req: AiRequest): Promise<Result<AiResponse, string>> {
    const need: AiCapability[] = req.schema ? ['structured'] : ['text'];
    const chain = this.resolve(req.task, need);
    if (chain.length === 0) return err(`no AI provider available for task '${req.task}' (need: ${need.join(',')})`);
    const errors: string[] = [];
    for (const p of chain) {
      try {
        const r = await p.complete(req);
        if (isOk(r)) return r;
        errors.push(`${p.id}: ${r.error}`);
      } catch (e) { errors.push(`${p.id}: ${String(e)}`); }
    }
    return err(`all providers failed → ${errors.join(' | ')}`);
  }
}
