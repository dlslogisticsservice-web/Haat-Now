// ─────────────────────────────────────────────────────────────────────────────
// Go-Live decision rules — PURE.
//
// No env, no Supabase, no clock, no React. Every input is passed in. This exists for
// the same reason experience-engine does: the rules that decide "are we allowed to
// launch" and "is this an alert" are exactly the rules that must be testable, and
// they cannot be if the module that holds them reads `import.meta.env` at load.
//
// golive.service.ts fetches; this decides. Nothing here duplicates a service — the
// services call into these functions rather than reimplementing them.
// ─────────────────────────────────────────────────────────────────────────────

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface OpsAlert {
  id: string;
  level: AlertLevel;
  ar: string;
  en: string;
  action_ar?: string;
  action_en?: string;
}

export interface QueueDepth {
  key: string;
  ar: string;
  en: string;
  depth: number;
  /** Depth at which a human should intervene. */
  threshold: number;
}

export type HealthBand = 'healthy' | 'watch' | 'at_risk' | 'no_data';

/**
 * Band a merchant by operational health score.
 *
 * Thresholds are deliberately conservative: a merchant is only "at risk" when the
 * number is bad enough to act on. An alert nobody acts on trains operators to ignore
 * alerts, which is worse than having no alert at all.
 *
 * A null score means NO DATA, never zero — a merchant with no orders yet is unknown,
 * not bad, and must not be shown alongside genuinely failing merchants.
 */
export function healthBand(score: number | null | undefined): HealthBand {
  if (score === null || score === undefined || !Number.isFinite(score)) return 'no_data';
  if (score >= 85) return 'healthy';
  if (score >= 65) return 'watch';
  return 'at_risk';
}

export function summariseHealth(scores: Array<number | null | undefined>): {
  healthy: number; watch: number; atRisk: number; noData: number;
} {
  const out = { healthy: 0, watch: 0, atRisk: 0, noData: 0 };
  for (const s of scores) {
    const band = healthBand(s);
    if (band === 'healthy') out.healthy++;
    else if (band === 'watch') out.watch++;
    else if (band === 'at_risk') out.atRisk++;
    else out.noData++;
  }
  return out;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface AlertInput {
  apiOk: boolean | null;
  isSandbox: boolean;
  activeOrders: number;
  unassignedOrders: number;
  availableDrivers: number;
  openSev1: number;
  expiredDocuments: number;
  merchantsAtRisk: number;
  unconfiguredProviders: string[];
}

/** Depth at which each queue becomes actionable. One definition, used everywhere. */
export const QUEUE_THRESHOLDS = {
  unassigned: 5,
  offers: 10,
  incidents: 3,
  docs: 1,
} as const;

/**
 * Derive the alert list. ONE definition of "something is wrong", so the command
 * centre, the verdict and any future notifier cannot disagree about it.
 *
 * Ordered by how much they should scare you: platform down first, then anything
 * that stops orders flowing, then supply-side degradation.
 */
export function deriveAlerts(i: AlertInput): OpsAlert[] {
  const alerts: OpsAlert[] = [];

  if (i.apiOk === false) {
    alerts.push({
      id: 'api_down', level: 'critical',
      ar: 'المنصّة لا تستجيب', en: 'Platform not responding',
      action_ar: 'ابدأ إجراء التراجع', action_en: 'Start the rollback checklist',
    });
  }

  if (i.openSev1 > 0) {
    alerts.push({
      id: 'sev1', level: 'critical',
      ar: `${i.openSev1} حادث حرج مفتوح`,
      en: `${i.openSev1} critical incident${i.openSev1 > 1 ? 's' : ''} open`,
      action_ar: 'مركز الحوادث', action_en: 'Incident Center',
    });
  }

  // Orders in flight with nobody able to take them is the failure mode that turns
  // into refunds and lost merchants fastest.
  if (i.activeOrders > 0 && i.availableDrivers === 0) {
    alerts.push({
      id: 'no_drivers', level: 'critical',
      ar: 'لا يوجد مندوبون متاحون وهناك طلبات نشطة',
      en: 'No available drivers while orders are active',
      action_ar: 'اتصل بالمندوبين', action_en: 'Contact drivers',
    });
  }

  if (i.expiredDocuments > 0) {
    alerts.push({
      id: 'docs_expired', level: 'critical',
      ar: `${i.expiredDocuments} وثيقة منتهية الصلاحية`,
      en: `${i.expiredDocuments} expired document${i.expiredDocuments > 1 ? 's' : ''}`,
      action_ar: 'تعليق الحساب حتى التجديد', action_en: 'Suspend until renewed',
    });
  }

  if (i.unassignedOrders > QUEUE_THRESHOLDS.unassigned) {
    alerts.push({
      id: 'unassigned', level: 'warning',
      ar: `${i.unassignedOrders} طلب بانتظار مندوب`,
      en: `${i.unassignedOrders} orders waiting for a driver`,
      action_ar: 'غرفة العمليات', action_en: 'Command Center',
    });
  }

  if (i.merchantsAtRisk > 0) {
    alerts.push({
      id: 'merchants_at_risk', level: 'warning',
      ar: `${i.merchantsAtRisk} تاجر في خطر تشغيلي`,
      en: `${i.merchantsAtRisk} merchant${i.merchantsAtRisk > 1 ? 's' : ''} operationally at risk`,
      action_ar: 'صحة التجار', action_en: 'Merchant health',
    });
  }

  if (i.unconfiguredProviders.length > 0) {
    alerts.push({
      id: 'providers',
      // In a demo build an unconfigured provider is expected, not a problem.
      level: i.isSandbox ? 'info' : 'warning',
      ar: `${i.unconfiguredProviders.length} مزوّد غير مُهيّأ: ${i.unconfiguredProviders.join('، ')}`,
      en: `${i.unconfiguredProviders.length} provider${i.unconfiguredProviders.length > 1 ? 's' : ''} not configured: ${i.unconfiguredProviders.join(', ')}`,
    });
  }

  // Always last, always critical: a sandbox build cannot take a real order, and
  // forgetting that is the single most expensive mistake available on launch night.
  if (i.isSandbox) {
    alerts.push({
      id: 'sandbox', level: 'critical',
      ar: 'هذا بناء تجريبي — لا توجد طلبات أو مدفوعات حقيقية',
      en: 'This is a demo build — no real orders, drivers or payments exist',
      action_ar: 'أعد البناء بـ HAAT_LIVE_BACKEND=1', action_en: 'Rebuild with HAAT_LIVE_BACKEND=1',
    });
  }

  return alerts;
}

// ── Verdict ───────────────────────────────────────────────────────────────────

export interface ChecklistItemRule { key: string; ar: string; en: string; blocking: boolean }
export interface ChecklistStateRule { [itemKey: string]: { checked: boolean } | undefined }

export interface Verdict {
  go: boolean;
  blockers: string[];
  blockersAr: string[];
  completed: number;
  totalBlocking: number;
}

/**
 * The Go / No-Go verdict.
 *
 * Mechanical and conservative by design: NO-GO unless every blocking checklist item
 * is ticked AND no critical alert is outstanding. It cannot be talked into a GO —
 * there is no override parameter, because the value of this function is precisely
 * that it says no when someone wants it to say yes.
 */
export function computeVerdict(
  items: readonly ChecklistItemRule[],
  state: ChecklistStateRule,
  alerts: readonly OpsAlert[],
): Verdict {
  const blocking = items.filter(i => i.blocking);
  const unticked = blocking.filter(i => !state[i.key]?.checked);
  const criticals = alerts.filter(a => a.level === 'critical');
  return {
    go: unticked.length === 0 && criticals.length === 0,
    blockers: [...unticked.map(i => i.en), ...criticals.map(a => a.en)],
    blockersAr: [...unticked.map(i => i.ar), ...criticals.map(a => a.ar)],
    completed: blocking.length - unticked.length,
    totalBlocking: blocking.length,
  };
}

// ── Incident timing ───────────────────────────────────────────────────────────

export interface IncidentTimestamps {
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

/**
 * Minutes from detection to each milestone. `nowMs` is injected — this module never
 * reads a clock, so the same incident always yields the same numbers in a test.
 */
export function incidentTiming(i: IncidentTimestamps, nowMs: number): {
  toAcknowledge: number | null; toResolve: number | null; openFor: number | null;
} {
  const detected = Date.parse(i.detected_at);
  if (!Number.isFinite(detected)) return { toAcknowledge: null, toResolve: null, openFor: null };
  const mins = (t: string | null) => {
    const v = t ? Date.parse(t) : NaN;
    return Number.isFinite(v) ? Math.max(0, Math.round((v - detected) / 60000)) : null;
  };
  return {
    toAcknowledge: mins(i.acknowledged_at),
    toResolve: mins(i.resolved_at),
    openFor: i.resolved_at ? null : Math.max(0, Math.round((nowMs - detected) / 60000)),
  };
}

// ── SLA ───────────────────────────────────────────────────────────────────────

/**
 * Order statuses that count as in-flight. These MUST match the vocabulary the
 * database actually uses (services/types.ts + migration 20260614000012). The SLA
 * monitor previously used 'confirmed' and 'delivering' — values that exist nowhere
 * in this schema — and so was silently blind to every accepted and in-transit order.
 */
export const ACTIVE_ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'on_the_way'] as const;
export const FAILED_ORDER_STATUSES = ['cancelled', 'rejected'] as const;

/** Is this order past its SLA? Ages are computed against an injected `nowMs`. */
export function isBreaching(createdAt: string, targetMinutes: number, nowMs: number): boolean {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return (nowMs - t) / 60000 > targetMinutes;
}
