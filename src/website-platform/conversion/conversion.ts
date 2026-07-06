// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · App Conversion Engine (Wave 2). Config-driven — nothing is
// hardcoded. Administrators control everything (title/body/CTAs/media/timing/triggers/
// frequency/targeting/coupon/deep-links) from Website Center; rules are stored per
// tenant (website_conversion_rules) and evaluated against a runtime context. Reusable
// by every white-label tenant. Deep linking lives in ./deeplink.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { Auditable } from '../domain/entities';
import { Validator, isNonEmptyString, isUuid } from '../shared/validation';
import type { Repository } from '../repositories/repository';
import { defineAggregate } from '../repositories/mapping';
import type { RepositoryBackend } from '../repositories/registry';
import { resolveDeferredLink, type StoreLinks, type MobilePlatform, type ResumePayload, type DeferredLinkResult } from './deeplink';

// ── Configuration model (all admin-controlled) ────────────────────────────────────
export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type Platform = 'mobile' | 'desktop';
export type VisitorType = 'new' | 'returning';

export interface ConversionTargeting {
  countries?: string[];
  languages?: string[];
  devices?: DeviceClass[];
  platforms?: Platform[];
  visitor?: VisitorType[];
  // ── Decision-engine audience signals (Launch Sprint 2, Part 6). All optional and
  // additive: an unset field never narrows the audience, so existing rules are unchanged.
  loyaltyTiers?: string[];        // e.g. ['gold','platinum'] — matches runtime.loyaltyTier
  minClv?: number;                // customer lifetime value ≥ (audience: high-value customers)
  minVisitCount?: number;         // returning depth ≥
  referrers?: string[];           // referral source (domain or code)
  utmSources?: string[];
  utmMediums?: string[];
  utmCampaigns?: string[];
  merchants?: string[];           // scope to specific merchant/branch ids
  categories?: string[];          // scope to specific category ids
  cities?: string[];              // geo (city/zone)
  daysOfWeek?: number[];          // 0=Sun..6=Sat
  hourRange?: { start: number; end: number }; // 0..23 inclusive; wraps when start > end
}

export type TriggerType =
  | 'checkout_progress' | 'cart_value' | 'time_on_page' | 'exit_intent'
  | 'scroll_depth' | 'visit_count' | 'campaign_source';

export interface ConversionTrigger {
  type: TriggerType;
  /** Numeric threshold for %/amount/seconds/depth/count triggers. */
  threshold?: number;
  /** String match (campaign_source). */
  value?: string;
}

export type CtaAction = 'store' | 'deeplink' | 'dismiss' | 'coupon' | 'url';
export interface ConversionCta {
  label: string;
  action: CtaAction;
  href?: string;
}

export interface ConversionContent {
  title: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  ctas: ConversionCta[];
  couponCode?: string;
  deepLinkPath?: string;      // e.g. 'checkout'
  appScheme?: string;         // e.g. 'haatnow'
  storeLinks?: StoreLinks;
}

export interface ConversionFrequency {
  dismissible: boolean;
  showOnce?: boolean;
  maxPerSession?: number;
  cooldownSeconds?: number;
}

export interface ConversionTiming {
  delaySeconds?: number;      // wait before eligible to show
}

export interface ConversionRule extends Auditable {
  siteId: UUID | null;
  name: string;
  enabled: boolean;
  priority: number;
  triggerMatch: 'all' | 'any';
  targeting: ConversionTargeting;
  triggers: ConversionTrigger[];
  content: ConversionContent;
  frequency: ConversionFrequency;
  timing: ConversionTiming;
}

export interface CreateConversionRuleDto {
  tenantId: UUID;
  siteId?: UUID | null;
  name: string;
  priority?: number;
  enabled?: boolean;
  triggerMatch?: 'all' | 'any';
  targeting?: ConversionTargeting;
  triggers?: ConversionTrigger[];
  content: ConversionContent;
  frequency?: ConversionFrequency;
  timing?: ConversionTiming;
}
export interface UpdateConversionRuleDto {
  name?: string;
  enabled?: boolean;
  priority?: number;
  triggerMatch?: 'all' | 'any';
  targeting?: ConversionTargeting;
  triggers?: ConversionTrigger[];
  content?: ConversionContent;
  frequency?: ConversionFrequency;
  timing?: ConversionTiming;
  expectedVersion?: number;
}

export function validateCreateConversionRule(i: CreateConversionRuleDto): Result<CreateConversionRuleDto> {
  return new Validator()
    .field(i.tenantId, 'tenantId', isUuid, 'uuid')
    .check(isNonEmptyString(i.name), 'name', 'required')
    .check(!!i.content && isNonEmptyString(i.content.title), 'content.title', 'required')
    .check(Array.isArray(i.content?.ctas), 'content.ctas', 'required')
    .toResult(i);
}

// ── Runtime evaluation ──────────────────────────────────────────────────────────────
export interface ConversionRuntime {
  country: string;
  language: string;
  device: DeviceClass;
  platform: Platform;
  visitor: VisitorType;
  cartValue?: number;
  checkoutProgress?: number;    // 0..100
  timeOnPageSeconds?: number;
  scrollDepthPct?: number;      // 0..100
  visitCount?: number;
  campaignSource?: string;
  exitIntent?: boolean;
  // ── Decision-engine runtime signals (Launch Sprint 2, Part 6) ──
  loyaltyTier?: string;
  clv?: number;                 // customer lifetime value
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  merchantId?: string;
  categoryId?: string;
  city?: string;
  dayOfWeek?: number;           // 0=Sun..6=Sat
  hourOfDay?: number;           // 0..23 (local)
}

export interface ConversionSession {
  /** Per-rule display history within the session. */
  shown: Record<UUID, { count: number; lastAt: number }>;
  /** Rules the visitor dismissed this session. */
  dismissed: UUID[];
}

export function emptySession(): ConversionSession {
  return { shown: {}, dismissed: [] };
}

function inList<T>(value: T, list: T[] | undefined): boolean {
  return !list || list.length === 0 || list.includes(value);
}
/** Numeric floor: an unset threshold always passes; otherwise value (default 0) must be ≥ min. */
function atLeast(value: number | undefined, min: number | undefined): boolean {
  return min === undefined || (value ?? 0) >= min;
}
/** Hour-of-day window (inclusive), wrapping across midnight when start > end. */
function hourMatch(hour: number | undefined, range: { start: number; end: number } | undefined): boolean {
  if (!range) return true;
  if (hour === undefined) return false;
  return range.start <= range.end ? hour >= range.start && hour <= range.end : hour >= range.start || hour <= range.end;
}

export function matchTargeting(t: ConversionTargeting, r: ConversionRuntime): boolean {
  return inList(r.country, t.countries)
    && inList(r.language, t.languages)
    && inList(r.device, t.devices)
    && inList(r.platform, t.platforms)
    && inList(r.visitor, t.visitor)
    // Decision-engine signals (Part 6) — each is a no-op unless the rule configures it.
    && inList(r.loyaltyTier, t.loyaltyTiers)
    && atLeast(r.clv, t.minClv)
    && atLeast(r.visitCount, t.minVisitCount)
    && inList(r.referrer, t.referrers)
    && inList(r.utmSource, t.utmSources)
    && inList(r.utmMedium, t.utmMediums)
    && inList(r.utmCampaign, t.utmCampaigns)
    && inList(r.merchantId, t.merchants)
    && inList(r.categoryId, t.categories)
    && inList(r.city, t.cities)
    && (!t.daysOfWeek || t.daysOfWeek.length === 0 || (r.dayOfWeek !== undefined && t.daysOfWeek.includes(r.dayOfWeek)))
    && hourMatch(r.hourOfDay, t.hourRange);
}

/** Build a decision-engine runtime from the browser context (URL params, session, profile).
 *  Pure + isomorphic — callers pass raw values; nothing here reads globals. */
export function buildRuntimeSignals(base: ConversionRuntime, extra: Partial<ConversionRuntime> = {}): ConversionRuntime {
  return { ...base, ...extra };
}

export function matchTrigger(trigger: ConversionTrigger, r: ConversionRuntime): boolean {
  const th = trigger.threshold ?? 0;
  switch (trigger.type) {
    case 'checkout_progress': return (r.checkoutProgress ?? 0) >= th;
    case 'cart_value': return (r.cartValue ?? 0) >= th;
    case 'time_on_page': return (r.timeOnPageSeconds ?? 0) >= th;
    case 'scroll_depth': return (r.scrollDepthPct ?? 0) >= th;
    case 'visit_count': return (r.visitCount ?? 0) >= th;
    case 'exit_intent': return r.exitIntent === true;
    case 'campaign_source': return !!trigger.value && r.campaignSource === trigger.value;
    default: return false;
  }
}

export function triggersMatch(rule: ConversionRule, r: ConversionRuntime): boolean {
  if (rule.triggers.length === 0) return true;
  return rule.triggerMatch === 'any'
    ? rule.triggers.some(t => matchTrigger(t, r))
    : rule.triggers.every(t => matchTrigger(t, r));
}

/** Frequency gate for any id+frequency (reused by the Growth Engine — no duplicate logic). */
export function frequencyAllowsFor(id: UUID, f: ConversionFrequency, session: ConversionSession, now: number): boolean {
  if (session.dismissed.includes(id)) return false;
  const hist = session.shown[id];
  if (!hist) return true;
  if (f.showOnce) return false;
  if (f.maxPerSession !== undefined && hist.count >= f.maxPerSession) return false;
  if (f.cooldownSeconds !== undefined && now - hist.lastAt < f.cooldownSeconds * 1000) return false;
  return true;
}
export function frequencyAllows(rule: ConversionRule, session: ConversionSession, now: number): boolean {
  return frequencyAllowsFor(rule.id, rule.frequency, session, now);
}

export interface ConversionMatch {
  rule: ConversionRule;
  /** Deferred deep-link destinations, when the rule has app/store config + a resume payload. */
  deferred?: DeferredLinkResult;
}

/**
 * Pick the highest-priority eligible rule for the runtime + session. Optionally build a
 * deferred deep link (continue-in-app / store-fallback) from the winning rule's content.
 */
export function evaluateConversion(
  rules: ReadonlyArray<ConversionRule>,
  runtime: ConversionRuntime,
  session: ConversionSession,
  now: number,
  mobilePlatform: MobilePlatform = 'unknown',
  resume?: ResumePayload,
): ConversionMatch | null {
  const eligible = rules
    .filter(r => r.enabled && r.deletedAt === null)
    .filter(r => matchTargeting(r.targeting, runtime))
    .filter(r => triggersMatch(r, runtime))
    .filter(r => frequencyAllows(r, session, now))
    .sort((a, b) => b.priority - a.priority);

  const rule = eligible[0];
  if (!rule) return null;

  let deferred: DeferredLinkResult | undefined;
  if (rule.content.appScheme && rule.content.deepLinkPath && rule.content.storeLinks) {
    deferred = resolveDeferredLink({
      scheme: rule.content.appScheme,
      deepPath: rule.content.deepLinkPath,
      storeLinks: rule.content.storeLinks,
      platform: mobilePlatform,
      resume,
    });
  }
  return { rule, deferred };
}

/** Record a display in the session (call after showing a rule). */
export function markShown(session: ConversionSession, ruleId: UUID, now: number): void {
  const hist = session.shown[ruleId] ?? { count: 0, lastAt: 0 };
  session.shown[ruleId] = { count: hist.count + 1, lastAt: now };
}
/** Record a dismissal. */
export function markDismissed(session: ConversionSession, ruleId: UUID): void {
  if (!session.dismissed.includes(ruleId)) session.dismissed.push(ruleId);
}

// ── Repository + service (config CRUD, repository-only) ────────────────────────────
const conversionAggregate = defineAggregate<ConversionRule, CreateConversionRuleDto, UpdateConversionRuleDto>({
  table: 'website_conversion_rules',
  entityName: 'ConversionRule',
  defaults: i => ({
    siteId: i.siteId ?? null,
    enabled: i.enabled ?? true,
    priority: i.priority ?? 0,
    triggerMatch: i.triggerMatch ?? 'all',
    targeting: i.targeting ?? {},
    triggers: i.triggers ?? [],
    frequency: i.frequency ?? { dismissible: true },
    timing: i.timing ?? {},
  }),
});

export class ConversionService {
  constructor(private readonly repo: Repository<ConversionRule, CreateConversionRuleDto, UpdateConversionRuleDto>) {}

  async create(input: CreateConversionRuleDto): Promise<Result<ConversionRule>> {
    const v = validateCreateConversionRule(input);
    if (!isOk(v)) return err(v.error);
    return this.repo.create(input);
  }
  update(tenantId: UUID, id: UUID, patch: UpdateConversionRuleDto, expectedVersion?: number): Promise<Result<ConversionRule>> {
    return this.repo.update(tenantId, id, patch, expectedVersion);
  }
  remove(tenantId: UUID, id: UUID): Promise<Result<ConversionRule>> {
    return this.repo.softDelete(tenantId, id);
  }
  async listEnabled(tenantId: UUID): Promise<Result<ConversionRule[]>> {
    const r = await this.repo.list(tenantId, { pageSize: 200, filters: [{ field: 'enabled', operator: 'eq', value: true }] });
    return isOk(r) ? ok(r.value.items) : err(r.error);
  }
  /** Resolve the winning rule for a runtime (the Website Center + edge entry point). */
  async resolve(tenantId: UUID, runtime: ConversionRuntime, session: ConversionSession, now: number, platform: MobilePlatform = 'unknown', resume?: ResumePayload): Promise<Result<ConversionMatch | null>> {
    const rules = await this.listEnabled(tenantId);
    if (!isOk(rules)) return err(rules.error);
    return ok(evaluateConversion(rules.value, runtime, session, now, platform, resume));
  }
}

export function createConversionService(backend: RepositoryBackend): ConversionService {
  return new ConversionService(backend === 'supabase' ? conversionAggregate.supabase() : conversionAggregate.memory());
}
