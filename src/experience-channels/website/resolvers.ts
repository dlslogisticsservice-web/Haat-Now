// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · resolvers.
//
// The four engine services the Website channel supplies, all depending only on the injected
// WebsiteContentSource (not website.service directly) — so they are pure and testable. They
// WRAP the existing version/publish model; they change nothing about publishing or rollback.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ContextResolver, VersionResolver, RuleResolver, ExperienceResolver,
} from '../../experience-engine';
import type {
  ExperienceContext, ExperienceRequest, ExperienceResolution, SemVer, ExperienceId,
} from '../../experience-engine';
import type { WebsiteContentSource } from './types';
import { mapSiteToSchema } from './mapper';

// ── STEP 3 · Context Resolution ────────────────────────────────────────────────
export interface WebsiteContextInput {
  host: string; role: string; locale: string; env: 'production' | 'staging' | 'development' | 'sandbox';
  tenantId?: string; country?: string; device?: string; theme?: string; flags?: { [k: string]: boolean };
}

/** Builds an ExperienceContext for the Website channel. Independent — reads no service. */
export function createWebsiteContextResolver(): ContextResolver {
  return {
    async resolve(input): Promise<ExperienceContext> {
      const i = input as WebsiteContextInput;
      const locale = i.locale === 'en' ? 'en' : 'ar';
      return {
        tenantId: i.tenantId ?? i.host,
        channel: 'website',
        role: i.role,
        locale,
        direction: locale === 'ar' ? 'rtl' : 'ltr',
        device: (i.device as ExperienceContext['device']) ?? 'desktop',
        platform: 'web',
        environment: { environment: i.env },
        country: i.country,
        flags: i.flags ?? {},
      };
    },
  };
}

// ── STEP 4 · Version Resolution (wraps the existing version model) ─────────────
export function createWebsiteVersionResolver(source: WebsiteContentSource): VersionResolver {
  return {
    async pick(experienceId: ExperienceId, _context: ExperienceContext, _preview?: boolean): Promise<SemVer | null> {
      const v = source.getVersion(experienceId);
      return v == null ? null : String(v);
    },
  };
}

// ── STEP 5 · Rule Resolution (locale / country / theme / feature flags only) ───
export function createWebsiteRuleResolver(): RuleResolver {
  const SUPPORTED_DIMENSIONS = ['locale', 'country', 'theme', 'feature-flags'];
  return {
    async decide(context: ExperienceContext, candidates: ExperienceId[]): Promise<{ experienceId: ExperienceId | null; appliedRules: string[] }> {
      // Wave 2: no personalization. A website has one experience per tenant; select it and
      // record which dimensions were consulted (all deterministic, from the context).
      const applied = SUPPORTED_DIMENSIONS.filter(dim =>
        dim === 'locale' ? !!context.locale :
        dim === 'country' ? !!context.country :
        dim === 'theme' ? true :
        dim === 'feature-flags' ? !!context.flags && Object.keys(context.flags).length >= 0 :
        false,
      );
      return { experienceId: candidates[0] ?? null, appliedRules: applied };
    },
  };
}

// ── STEP 6 · Website Experience Resolver (adapters only) ───────────────────────
export function createWebsiteExperienceResolver(
  source: WebsiteContentSource,
  rules: RuleResolver,
  versions: VersionResolver,
): ExperienceResolver {
  return {
    async resolve(request: ExperienceRequest): Promise<ExperienceResolution> {
      const { experienceId, context, version: pinned, preview } = request;

      // 1 · Rule resolution — which experience for this context?
      const decision = await rules.decide(context, [experienceId]);
      const chosen = decision.experienceId;
      if (!chosen) {
        return { status: 'not-found', experienceId, channel: 'website', appliedRules: decision.appliedRules, diagnostics: ['no experience matched the website rules'] };
      }

      // 2 · Version resolution — pinned request wins, else the current published version.
      const version = pinned ?? (await versions.pick(chosen, context, preview));
      if (!version) {
        return { status: 'no-version', experienceId, channel: 'website', appliedRules: decision.appliedRules, diagnostics: [`no version available for '${chosen}'`] };
      }

      // 3 · Website adapter — fetch content (draft for preview, else published) + map to schema.
      const site = preview ? source.getDraftSite(chosen) : source.getPublishedSite(chosen);
      if (!site) {
        return { status: 'not-found', experienceId, channel: 'website', version, appliedRules: decision.appliedRules, diagnostics: [`website content not found for '${chosen}'`] };
      }
      const schema = mapSiteToSchema(site, context, Number(version));

      return {
        status: 'resolved',
        experienceId,
        channel: 'website',
        version,
        schema,
        appliedRules: decision.appliedRules,
        diagnostics: [`resolved website experience '${chosen}' v${version}`, preview ? 'preview(draft)' : 'published'],
      };
    },
  };
}
