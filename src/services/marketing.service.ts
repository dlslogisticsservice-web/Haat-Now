// ─────────────────────────────────────────────────────────────────────────────
// Marketing OS — per-tenant marketing configuration store (Phase 1).
// This is NOT a CMS and NOT a website builder: pages/SEO/publish/rollback stay in
// websiteService. This stores the MARKETING layer (campaigns, conversion widgets,
// personalization, experiments, audit) that Website Studio drives. It REUSES the
// website-platform domain vocabulary (conversion targeting/triggers/content, the
// experiment winner detector) rather than redefining it. Sandbox persistence mirrors
// the established localStorage pattern (haat_ws_* / haat_crud_*). Owner: Marketing.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversionTargeting, ConversionTrigger, ConversionContent, ConversionFrequency } from '../website-platform/conversion/conversion';
import { detectWinner, type VariantStats } from '../website-platform/growth/experiments';

// ── Campaign Center ──────────────────────────────────────────────────────────
export type CampaignKind =
  | 'homepage' | 'restaurant' | 'grocery' | 'pharmacy'
  | 'seasonal' | 'ramadan' | 'eid' | 'black_friday' | 'national_day' | 'back_to_school'
  | 'flash_sale' | 'coupon' | 'free_delivery' | 'referral' | 'app_install' | 'merchant' | 'driver';
export type CampaignStatus = 'draft' | 'scheduled' | 'published' | 'archived';
// `channels` makes a campaign cross-channel: which experience channels it targets
// (website / customer / merchant / driver). Optional and defaulting to "all channels"
// so every existing campaign keeps working unchanged.
export interface CampaignTargeting { countries: string[]; cities: string[]; languages: string[]; audience: string; channels?: string[] }

/**
 * Does a campaign target a channel? PURE. An empty/absent `channels` list means the
 * campaign is cross-channel (targets everything) — the backward-compatible default, so a
 * campaign authored before channels existed still shows on every channel.
 */
export function campaignMatchesChannel(c: { targeting: CampaignTargeting }, channel: string): boolean {
  const chans = c.targeting.channels;
  return !chans || chans.length === 0 || chans.includes(channel);
}
export interface Campaign {
  id: string; name: string; kind: CampaignKind; status: CampaignStatus; priority: number;
  targeting: CampaignTargeting; startDate?: string; endDate?: string;
  headline: string; body: string; discount?: string; coupon?: string; ctaLabel?: string; ctaHref?: string; image?: string;
  createdAt: string; updatedAt: string;
}

// ── Conversion Center + App Download Engine (reuses conversion domain sub-types) ──
export type WidgetKind =
  | 'hero_cta' | 'floating_cta' | 'sticky_cta' | 'top_banner' | 'bottom_banner' | 'inline_banner'
  | 'exit_popup' | 'checkout_promo' | 'app_download' | 'discount_prompt' | 'waitlist_prompt' | 'referral_prompt';
export type AppFormat = 'popup' | 'sheet' | 'banner' | 'floating' | 'smart';
export interface ConversionWidget {
  id: string; kind: WidgetKind; name: string; enabled: boolean; priority: number;
  content: ConversionContent;
  targeting: ConversionTargeting;
  triggers: ConversionTrigger[];
  frequency: ConversionFrequency;
  delaySeconds?: number;
  // App Download Engine extras (only meaningful when kind === 'app_download')
  format?: AppFormat; abVariant?: 'A' | 'B'; animation?: 'fade' | 'slide' | 'pop';
}

// ── Website Personalization ──────────────────────────────────────────────────
export type PersonalizationDim = 'country' | 'city' | 'language' | 'device' | 'time' | 'campaign' | 'returning' | 'new' | 'referral' | 'traffic' | 'channel';
export interface PersonalizationRule { id: string; name: string; enabled: boolean; dimension: PersonalizationDim; match: string; action: string }

// ── Growth Experiments (A/B) ─────────────────────────────────────────────────
export type ExperimentElement = 'hero' | 'button' | 'offer' | 'card' | 'banner' | 'headline' | 'image' | 'color' | 'layout';
export interface ExperimentVariant { key: string; label: string; exposures: number; conversions: number }
export interface Experiment { id: string; name: string; element: ExperimentElement; status: 'draft' | 'running' | 'stopped'; variants: ExperimentVariant[]; winner?: string }

// ── Governance ───────────────────────────────────────────────────────────────
export interface AuditEntry { at: string; user: string; action: string; detail?: string }

export interface MarketingState {
  campaigns: Campaign[];
  widgets: ConversionWidget[];
  personalization: PersonalizationRule[];
  experiments: Experiment[];
  audit: AuditEntry[];
  /** Capabilities proven on the flagship and released to white-label tenants. */
  promoted: string[];
}

const KEY = (tenantId: string) => `haat_marketing_${tenantId}`;
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

const emptyContent = (title: string, body: string): ConversionContent => ({ title, body, ctas: [{ label: 'Open the app', action: 'store' }] });
const emptyFreq = (): ConversionFrequency => ({ dismissible: true, showOnce: false, maxPerSession: 1, cooldownSeconds: 0 });

/** Seeded defaults for the FLAGSHIP so new capabilities exist on HAAT NOW first. */
function flagshipSeed(): MarketingState {
  const t = now();
  return {
    campaigns: [
      { id: rid('c'), name: 'Ramadan Kareem — Homepage', kind: 'ramadan', status: 'scheduled', priority: 10, targeting: { countries: ['SA'], cities: [], languages: ['ar', 'en'], audience: 'all' }, startDate: '', endDate: '', headline: 'Ramadan Kareem 🌙', body: 'Iftar delivered on time, every night — with special Ramadan offers.', discount: '', coupon: 'RAMADAN', ctaLabel: 'Order iftar', ctaHref: '/restaurants', image: '', createdAt: t, updatedAt: t },
      { id: rid('c'), name: 'App Install — 15% off', kind: 'app_install', status: 'published', priority: 8, targeting: { countries: [], cities: [], languages: [], audience: 'guest' }, headline: 'Continue in the app', body: 'Get 15% off your first order when you finish in the HaaT app.', discount: '15%', coupon: 'APP15', ctaLabel: 'Open the app', ctaHref: '/app', image: '', createdAt: t, updatedAt: t },
    ],
    widgets: [
      { id: rid('w'), kind: 'app_download', name: 'App download popup', enabled: true, priority: 10, content: { ...emptyContent('Continue in the app', 'Get 15% off your next order in the HaaT app.'), couponCode: 'APP15' }, targeting: { visitor: ['guest' as any], devices: ['mobile', 'desktop'] }, triggers: [{ type: 'time_on_page', threshold: 5 }], frequency: emptyFreq(), delaySeconds: 5, format: 'popup', abVariant: 'A', animation: 'pop' },
      { id: rid('w'), kind: 'exit_popup', name: 'Exit-intent waitlist', enabled: false, priority: 5, content: emptyContent('Before you go…', 'Join the waitlist for a launch-day offer.'), targeting: { devices: ['desktop'] }, triggers: [{ type: 'exit_intent' }], frequency: { ...emptyFreq(), showOnce: true } },
    ],
    personalization: [
      { id: rid('p'), name: 'Arabic-first for SA', enabled: true, dimension: 'country', match: 'SA', action: 'Show Arabic hero + Ramadan campaign' },
      { id: rid('p'), name: 'Returning visitors', enabled: true, dimension: 'returning', match: 'true', action: 'Skip waitlist, show reorder CTA' },
    ],
    experiments: [
      { id: rid('x'), name: 'Hero headline test', element: 'headline', status: 'running', variants: [{ key: 'A', label: 'Everything delivered', exposures: 1200, conversions: 84 }, { key: 'B', label: 'Your city, delivered', exposures: 1180, conversions: 150 }] },
    ],
    audit: [{ at: t, user: 'system', action: 'seed', detail: 'Flagship marketing workspace initialised' }],
    promoted: ['campaigns', 'conversion', 'app_download', 'seo'],
  };
}

function empty(): MarketingState { return { campaigns: [], widgets: [], personalization: [], experiments: [], audit: [], promoted: [] }; }

export const marketingService = {
  isFlagship(slugOrId: string): boolean { return /haat/i.test(slugOrId); },

  get(tenantId: string, flagship = false): MarketingState {
    try {
      const raw = localStorage.getItem(KEY(tenantId));
      if (raw) return { ...empty(), ...JSON.parse(raw) };
    } catch { /* ignore */ }
    const seed = flagship ? flagshipSeed() : empty();
    this.set(tenantId, seed);
    return seed;
  },
  set(tenantId: string, state: MarketingState) { try { localStorage.setItem(KEY(tenantId), JSON.stringify(state)); } catch { /* ignore */ } },

  audit(tenantId: string, user: string, action: string, detail?: string): MarketingState {
    const s = this.get(tenantId);
    s.audit = [{ at: now(), user, action, detail }, ...s.audit].slice(0, 200);
    this.set(tenantId, s);
    return s;
  },

  // Collection upserts (generic; each returns the new state)
  saveCampaign(tenantId: string, user: string, c: Campaign): MarketingState { const s = this.get(tenantId); c.updatedAt = now(); s.campaigns = s.campaigns.some(x => x.id === c.id) ? s.campaigns.map(x => x.id === c.id ? c : x) : [c, ...s.campaigns]; this.set(tenantId, s); return this.audit(tenantId, user, 'campaign.save', `${c.name} → ${c.status}`); },
  removeCampaign(tenantId: string, user: string, id: string): MarketingState { const s = this.get(tenantId); const c = s.campaigns.find(x => x.id === id); s.campaigns = s.campaigns.filter(x => x.id !== id); this.set(tenantId, s); return this.audit(tenantId, user, 'campaign.remove', c?.name); },
  /** Published campaigns that target a channel (cross-channel query). Empty targeting = all. */
  campaignsForChannel(tenantId: string, channel: string): Campaign[] {
    return this.get(tenantId).campaigns.filter(c => c.status === 'published' && campaignMatchesChannel(c, channel));
  },

  saveWidget(tenantId: string, user: string, w: ConversionWidget): MarketingState { const s = this.get(tenantId); s.widgets = s.widgets.some(x => x.id === w.id) ? s.widgets.map(x => x.id === w.id ? w : x) : [w, ...s.widgets]; this.set(tenantId, s); return this.audit(tenantId, user, 'conversion.save', `${w.name} (${w.kind})`); },
  removeWidget(tenantId: string, user: string, id: string): MarketingState { const s = this.get(tenantId); s.widgets = s.widgets.filter(x => x.id !== id); this.set(tenantId, s); return this.audit(tenantId, user, 'conversion.remove', id); },

  savePersonalization(tenantId: string, user: string, r: PersonalizationRule): MarketingState { const s = this.get(tenantId); s.personalization = s.personalization.some(x => x.id === r.id) ? s.personalization.map(x => x.id === r.id ? r : x) : [r, ...s.personalization]; this.set(tenantId, s); return this.audit(tenantId, user, 'personalization.save', r.name); },
  removePersonalization(tenantId: string, user: string, id: string): MarketingState { const s = this.get(tenantId); s.personalization = s.personalization.filter(x => x.id !== id); this.set(tenantId, s); return this.audit(tenantId, user, 'personalization.remove', id); },

  saveExperiment(tenantId: string, user: string, x: Experiment): MarketingState { const s = this.get(tenantId); s.experiments = s.experiments.some(e => e.id === x.id) ? s.experiments.map(e => e.id === x.id ? x : e) : [x, ...s.experiments]; this.set(tenantId, s); return this.audit(tenantId, user, 'experiment.save', `${x.name} → ${x.status}`); },
  removeExperiment(tenantId: string, user: string, id: string): MarketingState { const s = this.get(tenantId); s.experiments = s.experiments.filter(e => e.id !== id); this.set(tenantId, s); return this.audit(tenantId, user, 'experiment.remove', id); },

  promote(tenantId: string, user: string, cap: string): MarketingState { const s = this.get(tenantId); if (!s.promoted.includes(cap)) s.promoted = [...s.promoted, cap]; this.set(tenantId, s); return this.audit(tenantId, user, 'whitelabel.promote', cap); },

  /** Reuse the platform winner detector for experiments. Only a statistically CONFIDENT
   *  winner is returned (the detector sorts by conversionRate, so it must be computed). */
  winner(x: Experiment): string | null {
    const stats: VariantStats[] = x.variants.map(v => ({ variantKey: v.key, exposures: v.exposures, conversions: v.conversions, installs: 0, couponRedemptions: 0, conversionRate: v.exposures ? v.conversions / v.exposures : 0 }));
    const w = detectWinner(stats, 100, 1.64);
    return w && w.confident ? w.variantKey : null;
  },
  newCampaignId: () => rid('c'),
  newWidgetId: () => rid('w'),
  newRuleId: () => rid('p'),
  newExperimentId: () => rid('x'),
  emptyContent, emptyFreq,
};
