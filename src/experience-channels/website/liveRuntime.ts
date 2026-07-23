// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · LIVE runtime bridge (Wave 16, STEP 2).
//
// Makes the Experience Engine load-bearing for the real public website. The live runtime keeps
// its SINGLE rendering path (BlockRenderer); the Engine only DECIDES which authored sections
// survive and with what props:
//
//   live sections → [ flags → enforcement → instructions → plan ] → decided sections → BlockRenderer
//
// SAFETY (this runs on real traffic):
//  · Gate is checked FIRST and is scoped — when it says no, the input array is returned BY
//    REFERENCE, so React sees literally the same value it would have without this wave.
//  · Fully SYNCHRONOUS — no effect, no state, no second paint, no content flash.
//  · Never throws: any failure returns the ORIGINAL sections and reports to the monitoring seam.
//  · No new renderer and no second render path — this only filters/patches the section list.
//
// The async Policy stage is intentionally not on this synchronous path; flags → enforcement is the
// complete chain for block-level decisions. Policy remains available via the full engine.execute().
// ─────────────────────────────────────────────────────────────────────────────
import type { WebsiteBlock } from '../../services/website.service';
import {
  createExperienceEngine, createFeatureFlagResolver, createTargetResolver,
  type ExperienceContext, type ExperienceEngine, type FeatureFlagResolver,
  type Json, type RenderPlan, type RenderPlanMetrics, type RolloutConfig, type RolloutGate, type TargetResolver,
} from '../../experience-engine';
import { assignBlockIds } from './blockId';

export interface LiveDecisionContext {
  tenantId: string;
  /** The website experience being rendered — the page path (e.g. '/'). */
  path: string;
  locale?: string;
  preview?: boolean;
}

export interface LiveDecision {
  sections: WebsiteBlock[];
  executed: boolean;
  reason: string;
  hidden: string[];
  nodesModified: number;
  ms: number;
  failed: boolean;
}

export interface WebsiteLiveRuntime {
  readonly engine: ExperienceEngine;
  readonly rollout: RolloutGate;
  readonly metrics: RenderPlanMetrics;
  decide(sections: WebsiteBlock[], ctx: LiveDecisionContext): LiveDecision;
}

/**
 * STEP 3 + STEP 4 · the shipped canary.
 * `enabled: true` here does NOT mean "on for everyone" — the gate denies anything that matches no
 * criterion (`no-criteria`). With a single-entry allowlist this is ON for exactly ONE website
 * experience (the homepage) and OFF everywhere else. With no feature flags registered, that one
 * experience also renders identically — the Engine runs, decides "no change", and the page is
 * byte-for-byte what it was. Registering a flag is what makes it visibly load-bearing.
 */
export const WEBSITE_CANARY: RolloutConfig = {
  enabled: true,
  experiences: ['/'],
  tripAfterFailures: 3,
};

const toExperienceContext = (ctx: LiveDecisionContext): ExperienceContext => ({
  tenantId: ctx.tenantId,
  channel: 'website',
  role: 'guest',
  locale: ctx.locale === 'ar' ? 'ar' : 'en',
  direction: ctx.locale === 'ar' ? 'rtl' : 'ltr',
  device: 'desktop',
  platform: 'web',
  environment: { environment: 'production' },
  segments: [],
  flags: {},
  now: '',
});

const nowMs = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);

export type LiveReporter = (event: string, props: Record<string, unknown>) => void;
export type LiveErrorReporter = (error: unknown, context: Record<string, unknown>) => void;

export interface WebsiteLiveRuntimeOptions {
  rollout?: RolloutConfig;
  /** STEP 5 · metrics sink. INJECTED — this module must not import the monitoring service, which
   *  reads `import.meta.env` at load time and would make the channel unusable outside Vite. */
  report?: LiveReporter;
  onError?: LiveErrorReporter;
  /** Wave 20.1 · per-visitor promo selection. Injected; see `setLiveRuntimePersonalizer`. */
  personalize?: LivePersonalizer;
}

// The reporters the lazy singleton uses. The host (the public website) injects the real
// monitoring seam via `setLiveRuntimeReporter`; everywhere else these stay no-ops.
let defaultReport: LiveReporter = () => { /* no sink until the host wires one */ };
let defaultOnError: LiveErrorReporter = () => { /* no sink until the host wires one */ };

/** STEP 5 · wire the live metrics/error export (called once by the public website host). */
export function setLiveRuntimeReporter(report: LiveReporter, onError: LiveErrorReporter): void {
  defaultReport = report;
  defaultOnError = onError;
}

// ── Wave 20.1 · personalization seam ────────────────────────────────────────────
// A visitor profile is built from the Experience Event log, which lives in the services layer.
// This channel must not import that layer, so the host INJECTS a personalizer — exactly the
// pattern the monitoring reporter above already uses. With nothing injected the site behaves
// precisely as it did before: authored order, nothing suppressed.
/** Given candidate section ids, return the subset worth showing this visitor, best first. */
export type LivePersonalizer = (candidateIds: string[]) => string[];

let defaultPersonalize: LivePersonalizer | null = null;

/** Wire the live personalizer (called once by the public website host). */
export function setLiveRuntimePersonalizer(fn: LivePersonalizer | null): void {
  defaultPersonalize = fn;
}

/**
 * Promotional block types only. Personalization may suppress a repeated promo a visitor keeps
 * ignoring; it must never remove the page's substance, so structural content (richtext, faq,
 * contact, merchants, categories…) is out of scope by construction.
 */
const PROMOTIONAL: ReadonlySet<string> = new Set(['hero', 'cta', 'deals', 'waitlist', 'app_download']);

export function createWebsiteLiveRuntime(opts: WebsiteLiveRuntimeOptions = {}): WebsiteLiveRuntime {
  const engine = createExperienceEngine({ rollout: opts.rollout ?? WEBSITE_CANARY });
  const report: LiveReporter = opts.report ?? ((e, p) => defaultReport(e, p));
  const onError: LiveErrorReporter = opts.onError ?? ((e, c) => defaultOnError(e, c));

  const targets: TargetResolver = createTargetResolver(engine.audiences);
  const flagResolver: FeatureFlagResolver = createFeatureFlagResolver(engine.flags);

  /** Apply a plan to the authored section list. Returns the SAME array when nothing changed. */
  const apply = (sections: WebsiteBlock[], plan: RenderPlan): { sections: WebsiteBlock[]; hidden: string[]; modified: number } => {
    const hidden = new Set(plan.nodes.filter(n => n.visibility === 'hidden').map(n => n.key));
    const overrideKeys = Object.keys(plan.overrides);
    if (hidden.size === 0 && overrideKeys.length === 0) return { sections, hidden: [], modified: 0 };

    const ids = assignBlockIds(sections);
    const hitHidden: string[] = [];
    let modified = 0;
    const out: WebsiteBlock[] = [];

    for (let i = 0; i < sections.length; i++) {
      const id = ids[i];
      if (hidden.has(id)) { hitHidden.push(id); modified++; continue; }

      const block = sections[i];
      if (overrideKeys.length > 0) {
        const b = block as unknown as Record<string, Json>;
        let patched: Record<string, Json> | null = null;
        for (const k of overrideKeys) {
          // Only rewrite props the block ALREADY has — never invent a field on authored content.
          if (Object.prototype.hasOwnProperty.call(b, k) && b[k] !== plan.overrides[k]) {
            if (!patched) patched = { ...b };
            patched[k] = plan.overrides[k];
          }
        }
        if (patched) { out.push(patched as unknown as WebsiteBlock); modified++; continue; }
      }
      out.push(block);
    }

    return { sections: out, hidden: hitHidden, modified };
  };

  /**
   * Wave 20.1 · ask the injected personalizer which promotional sections this visitor should see.
   * Fail-open in every direction: no personalizer, no promos, an empty answer or a throw all mean
   * "show what was authored". The engine may only ever REMOVE a promo it was asked about.
   */
  const personalizeSections = (
    sections: WebsiteBlock[],
    ctx: LiveDecisionContext,
  ): { sections: WebsiteBlock[]; dropped: string[] } => {
    const personalize = opts.personalize ?? defaultPersonalize;
    if (!personalize) return { sections, dropped: [] };

    const ids = assignBlockIds(sections);
    const promoIds = sections
      .map((b, i) => (PROMOTIONAL.has(String((b as { type?: string }).type)) ? ids[i] : ''))
      .filter(Boolean);
    if (promoIds.length === 0) return { sections, dropped: [] };

    let keep: string[];
    try { keep = personalize(promoIds); } catch { return { sections, dropped: [] }; }
    if (!Array.isArray(keep) || keep.length === 0) return { sections, dropped: [] };

    const keepSet = new Set(keep);
    const dropped = promoIds.filter(id => !keepSet.has(id));
    if (dropped.length === 0) return { sections, dropped: [] };

    const droppedSet = new Set(dropped);
    report('experience.personalized', { tenantId: ctx.tenantId, path: ctx.path, dropped });
    return { sections: sections.filter((_, i) => !droppedSet.has(ids[i])), dropped };
  };

  return {
    engine,
    rollout: engine.rollout,
    metrics: engine.renderPlanMetrics,

    decide(sections: WebsiteBlock[], ctx: LiveDecisionContext): LiveDecision {
      // 1 · gate first — the cheap path for every non-canary request.
      const gate = engine.rollout.shouldExecute({ tenantId: ctx.tenantId, experienceId: ctx.path, channel: 'website' });
      if (!gate.execute) {
        return { sections, executed: false, reason: gate.reason, hidden: [], nodesModified: 0, ms: 0, failed: false };
      }

      const t0 = nowMs();
      try {
        // 2 · the existing decision chain, reused verbatim (synchronous portion).
        const expCtx = toExperienceContext(ctx);
        const audiences = targets.resolve(expCtx, { preview: ctx.preview, experienceId: ctx.path }).matched;
        const flags = flagResolver.resolve(expCtx, { audiences, preview: ctx.preview, experienceId: ctx.path });
        const enforced = engine.enforcement.enforce({ flags: flags.flags, experienceId: ctx.path });
        const instructions = engine.renderAdapter.adapt(enforced.state);
        const plan = engine.renderPlanBuilder.build(instructions);

        // 3 · project the plan onto the authored sections.
        const result = apply(sections, plan);

        // 3b · Wave 20.1 · personalize the promotional surfaces that survived the plan. Fatigue and
        // frequency caps come from the visitor's own history; authored order is otherwise kept.
        const personalized = personalizeSections(result.sections, ctx);
        if (personalized.dropped.length > 0) {
          result.sections = personalized.sections;
          result.hidden = [...result.hidden, ...personalized.dropped];
          result.modified += personalized.dropped.length;
        }

        const ms = nowMs() - t0;

        engine.renderPlanMetrics.record({
          executionMs: ms, planSize: plan.metadata.planSize, nodesModified: result.modified,
          applied: enforced.applied.length, skipped: enforced.skipped.length, redirected: false, failed: false,
        });
        engine.rollout.recordOutcome(true);

        // 4 · STEP 5 · export to the existing monitoring seam (only when it actually did something).
        if (result.modified > 0) {
          report('experience.plan_applied', {
            tenantId: ctx.tenantId, path: ctx.path, reason: gate.reason,
            hidden: result.hidden, nodesModified: result.modified, planSize: plan.metadata.planSize, ms: Math.round(ms * 100) / 100,
          });
        }

        return { sections: result.sections, executed: true, reason: gate.reason, hidden: result.hidden, nodesModified: result.modified, ms, failed: false };
      } catch (e) {
        // 5 · failure isolation — the page always renders its authored content.
        engine.rollout.recordOutcome(false);
        engine.renderPlanMetrics.record({ executionMs: nowMs() - t0, planSize: 0, nodesModified: 0, applied: 0, skipped: 0, redirected: false, failed: true });
        onError(e, { where: 'website.liveRuntime.decide', tenantId: ctx.tenantId, path: ctx.path });
        return { sections, executed: false, reason: 'error', hidden: [], nodesModified: 0, ms: nowMs() - t0, failed: true };
      }
    },
  };
}

// ── The live singleton the public website uses ──────────────────────────────────
let singleton: WebsiteLiveRuntime | null = null;

/** The process-wide live runtime (lazily created so importing this module is side-effect free). */
export function websiteLiveRuntime(): WebsiteLiveRuntime {
  if (!singleton) singleton = createWebsiteLiveRuntime();
  return singleton;
}

/**
 * The one call the public website makes. Returns the input array unchanged (by reference) unless
 * the canary is on for this experience AND a registered flag actually changes something.
 */
export function decideLiveSections(sections: WebsiteBlock[], ctx: LiveDecisionContext): WebsiteBlock[] {
  try {
    return websiteLiveRuntime().decide(sections, ctx).sections;
  } catch {
    return sections; // belt-and-braces: construction itself must never break the site
  }
}
