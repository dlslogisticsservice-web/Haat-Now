// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Feature flags (Wave 0).
// Every new capability is gated. Defaults are DISABLED so the legacy Website
// Center remains the active path until an operator opts a tenant in. Resolution
// is per-tenant + per-environment; nothing here mutates global app behavior.
// ─────────────────────────────────────────────────────────────────────────────

import type { FlagState } from '../domain/enums';

/** Canonical flag keys. Mirrors website_feature_flags.flag values. */
export const WEBSITE_FLAGS = {
  /** Master switch: route reads/writes through the new platform instead of localStorage. */
  DB_BACKEND: 'website.db_backend',
  /** Enable the Publishing Engine (snapshot compile + edge revalidate). */
  PUBLISHING: 'website.publishing',
  /** Enable the event backbone emission from platform mutations. */
  EVENTS: 'website.events',
  /** Enable the media library (tables + transform pipeline). */
  MEDIA_LIBRARY: 'website.media_library',
  /** Enable the SEO platform (server SEO + sitemap/redirects). */
  SEO_PLATFORM: 'website.seo_platform',
  /** Enable localization (per-block translations). */
  LOCALIZATION: 'website.localization',
  /** Enable the compatibility adapter that bridges legacy ↔ platform. */
  COMPAT_ADAPTER: 'website.compat_adapter',
  /** Enable the Publishing Engine (compile → snapshot → publish/rollback). */
  PUBLISHING_ENGINE: 'website.publishing_engine',
  /** Serve the platform-rendered public site (edge/static render from snapshot). */
  RENDER_PUBLIC: 'website.render_public',
  /** Enable ordering directly from the website (reuses the app backend). */
  WEBSITE_ORDERING: 'website.ordering',
  /** Enable the App Conversion Engine (install prompts, deferred deep linking). */
  CONVERSION_ENGINE: 'website.conversion_engine',
  /** Enable website analytics ingestion. */
  ANALYTICS: 'website.analytics',
  /** Enable the premium public website frontend (site shell mount). */
  SITE_FRONTEND: 'website.site_frontend',
  /** Enable the App Growth Engine (multi-campaign install prompts). */
  GROWTH_ENGINE: 'website.growth_engine',
  /** Enable the Smart Checkout Migration offer. */
  CHECKOUT_MIGRATION: 'website.checkout_migration',
  /** Enable A/B experimentation on growth campaigns. */
  EXPERIMENTS: 'website.experiments',
  /** Enable the marketing pages platform. */
  MARKETING: 'website.marketing',
  /** Enable the customer portal (wallet/loyalty/orders/favorites/notifications). */
  CUSTOMER_PORTAL: 'website.customer_portal',
  /** Enable PWA (install prompt, offline, push-ready). */
  PWA: 'website.pwa',
} as const;

export type WebsiteFlagKey = typeof WEBSITE_FLAGS[keyof typeof WEBSITE_FLAGS];

export type Environment = 'production' | 'staging' | 'development' | 'sandbox';

export interface FlagContext {
  tenantId?: string | null;
  siteId?: string | null;
  environment: Environment;
}

/** A resolved flag rule. `tenants`/`environments` narrow the scope; empty = all. */
export interface FlagRule {
  flag: WebsiteFlagKey;
  state: FlagState;
  tenants?: ReadonlyArray<string>;
  environments?: ReadonlyArray<Environment>;
}

export interface FlagResolver {
  isEnabled(flag: WebsiteFlagKey, ctx: FlagContext): boolean;
  state(flag: WebsiteFlagKey, ctx: FlagContext): FlagState;
}

/**
 * Static, in-memory resolver. Rules are matched most-specific-first; when no rule
 * matches, the flag is DISABLED. `beta` counts as enabled for gating purposes but
 * is reported distinctly by `state()`.
 */
export class StaticFlagResolver implements FlagResolver {
  private readonly rules: ReadonlyArray<FlagRule>;

  constructor(rules: ReadonlyArray<FlagRule> = []) {
    this.rules = rules;
  }

  private match(flag: WebsiteFlagKey, ctx: FlagContext): FlagRule | null {
    let best: FlagRule | null = null;
    let bestScore = -1;
    for (const rule of this.rules) {
      if (rule.flag !== flag) continue;
      if (rule.environments && !rule.environments.includes(ctx.environment)) continue;
      if (rule.tenants && (!ctx.tenantId || !rule.tenants.includes(ctx.tenantId))) continue;
      const score = (rule.tenants ? 2 : 0) + (rule.environments ? 1 : 0);
      if (score > bestScore) {
        best = rule;
        bestScore = score;
      }
    }
    return best;
  }

  state(flag: WebsiteFlagKey, ctx: FlagContext): FlagState {
    const rule = this.match(flag, ctx);
    return rule ? rule.state : 'disabled';
  }

  isEnabled(flag: WebsiteFlagKey, ctx: FlagContext): boolean {
    const s = this.state(flag, ctx);
    return s === 'enabled' || s === 'beta';
  }
}

/**
 * The default resolver: NO rules ⇒ every flag disabled everywhere. This is what
 * ships in Wave 0, guaranteeing the legacy Website Center is untouched.
 */
export const defaultFlagResolver: FlagResolver = new StaticFlagResolver([]);
