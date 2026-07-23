// ─────────────────────────────────────────────────────────────────────────────
// Go-Live service — the aggregation behind the Operations Command Center.
//
// This computes NOTHING itself. Every number comes from a service that already owns
// it: commandService for live marketplace state, incidentService for incidents,
// supplyHealthService for merchant/document health, providers/registry for provider
// status, monitoring for client errors. The value added here is a single fetch and
// ONE definition of "is this an alert" — so the launch decision is not assembled by
// eye from six different screens.
//
// The launch and rollback checklists live here as data because they are the runbook:
// they belong with the code they describe, and they are versioned with it. Only the
// tick state is persisted (ops_checklist_state).
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from '../admin-crud.service';
import { authService } from '../auth.service';
import { monitoring } from '../monitoring.service';
import { capabilities } from '../../providers/registry';
import type { ProviderInfo } from '../../providers/contracts';
import { commandService } from './command.service';
import { incidentService, SEVERITY, type Incident } from './incident.service';
import { supplyHealthService, type MerchantHealth, type ExpiringDocument } from './supply-health.service';
import {
  deriveAlerts, computeVerdict, healthBand, summariseHealth, QUEUE_THRESHOLDS,
  type OpsAlert, type QueueDepth, type AlertLevel,
} from './golive-rules';

export type { OpsAlert, QueueDepth, AlertLevel };

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export interface GoLiveSnapshot {
  build: { sha: string; short: string; builtAt: string; env: string } | null;
  apiOk: boolean | null;
  apiMs: number | null;
  marketplace: {
    activeOrders: number; unassignedOrders: number; inTransit: number;
    onlineDrivers: number; availableDrivers: number; busyDrivers: number;
    deliveredToday: number; revenueToday: number; pendingOffers: number;
  };
  incidents: { open: number; sev1: number; unassigned: number; list: Incident[] };
  merchants: { healthy: number; watch: number; atRisk: number; noData: number; worst: MerchantHealth[] };
  documents: { expired: number; expiring: number; list: ExpiringDocument[] };
  providers: ProviderInfo[];
  queues: QueueDepth[];
  alerts: OpsAlert[];
  clientErrors: number;
  mode: 'sandbox' | 'live';
}

// ── Checklists ────────────────────────────────────────────────────────────────
export interface ChecklistItem {
  key: string;
  ar: string;
  en: string;
  /** Blocking items must be ticked before a Go recommendation is possible. */
  blocking: boolean;
}

/**
 * Launch checklist. Derived from the production readiness audit, so what the team
 * verified once is not re-derived from memory at 2am on launch night.
 */
export const LAUNCH_CHECKLIST: ChecklistItem[] = [
  { key: 'live_backend', blocking: true, ar: 'البناء يشير إلى الخلفية الحيّة (HAAT_LIVE_BACKEND=1)', en: 'Build points at the live backend (HAAT_LIVE_BACKEND=1)' },
  { key: 'env_gate', blocking: true, ar: 'فحص البيئة يمنع النشر عند الفشل', en: 'check:env is a blocking deploy gate' },
  { key: 'rls_verified', blocking: true, ar: 'تم تفعيل RLS على كل الجداول والتحقق منه مقابل قاعدة البيانات الحيّة', en: 'RLS enabled on every table and diffed against the live database' },
  { key: 'sentry', blocking: true, ar: 'تتبّع الأخطاء يصل فعلياً إلى Sentry', en: 'Crash reports actually arriving in Sentry' },
  { key: 'order_e2e', blocking: true, ar: 'طلب حقيقي كامل: عميل ← تاجر ← مندوب ← تسليم', en: 'A real order completed end to end: customer → merchant → driver → delivered' },
  { key: 'cod_reconcile', blocking: true, ar: 'مطابقة الدفع عند الاستلام: دفتر الحسابات = إجمالي الطلب', en: 'COD reconciliation verified: ledger total equals order total' },
  { key: 'dispatch_live', blocking: true, ar: 'المندوب يستقبل عروض الإسناد ويقبلها', en: 'Driver receives and accepts a dispatch offer' },
  { key: 'support_staffed', blocking: true, ar: 'قناة الدعم حيّة ومزوّدة بفريق', en: 'Support channel live and staffed' },
  { key: 'oncall', blocking: true, ar: 'جدول المناوبة لأسبوع الإطلاق معتمد', en: 'On-call rota agreed for launch week' },
  { key: 'legal', blocking: true, ar: 'الصفحات القانونية مكتملة (اسم الشركة والسجل التجاري)', en: 'Legal pages complete (company name and registration filled)' },
  { key: 'merchants_onboarded', blocking: true, ar: 'التجار الأوائل مُعتمدون عبر KYC', en: 'First merchants onboarded and KYC-approved' },
  { key: 'drivers_onboarded', blocking: true, ar: 'المندوبون الأوائل مُعتمدون ووثائقهم سارية', en: 'First drivers onboarded with valid documents' },
  { key: 'zones', blocking: true, ar: 'مناطق التوصيل والرسوم مضبوطة', en: 'Delivery zones and fees configured' },
  { key: 'backup', blocking: true, ar: 'استعادة النسخ الاحتياطية مُجرَّبة فعلياً', en: 'Backup restore actually rehearsed (not just enabled)' },
  { key: 'analytics', blocking: false, ar: 'التحليلات تجمع بيانات المسار', en: 'Analytics collecting funnel data' },
  { key: 'maps_key', blocking: false, ar: 'مفتاح الخرائط مُهيّأ في الإنتاج', en: 'Maps API key configured in production' },
  { key: 'perf', blocking: false, ar: 'حزمة الدخول ضمن الميزانية', en: 'Entry bundle within budget' },
  { key: 'seo', blocking: false, ar: 'خريطة الموقع تغطي كل الصفحات', en: 'Sitemap covers all pages' },
];

/**
 * Rollback checklist. Written as actions, in the order you would actually take them,
 * because a rollback is executed under pressure by whoever happens to be awake.
 */
export const ROLLBACK_CHECKLIST: ChecklistItem[] = [
  { key: 'declare', blocking: true, ar: 'أعلن حادثاً (SEV1) وعيّن مسؤولاً', en: 'Declare a SEV1 incident and name an owner' },
  { key: 'stop_intake', blocking: true, ar: 'أوقف استقبال الطلبات الجديدة (أوقف تفعيل الفروع)', en: 'Stop new order intake (deactivate branches)' },
  { key: 'drain', blocking: true, ar: 'اترك الطلبات الجارية تكتمل — لا تلغِ طلباً مدفوعاً', en: 'Let in-flight orders finish — never cancel a paid order' },
  { key: 'revert_frontend', blocking: true, ar: 'أعد النشر السابق من Vercel', en: 'Roll back the frontend to the previous Vercel deployment' },
  { key: 'verify_version', blocking: true, ar: 'تحقّق من version.json أن الإصدار عاد', en: 'Verify version.json reports the previous build' },
  { key: 'db_assess', blocking: true, ar: 'قرّر: هل تحتاج قاعدة البيانات استعادة؟ (الترحيلات لا تملك مسار تراجع)', en: 'Decide whether the database needs restoring (migrations have no down path)' },
  { key: 'comms_merchants', blocking: true, ar: 'أبلغ التجار', en: 'Notify merchants' },
  { key: 'comms_drivers', blocking: true, ar: 'أبلغ المندوبين', en: 'Notify drivers' },
  { key: 'comms_customers', blocking: false, ar: 'أبلغ العملاء المتأثرين', en: 'Notify affected customers' },
  { key: 'reconcile_money', blocking: true, ar: 'طابق المدفوعات والدفع عند الاستلام قبل الاستئناف', en: 'Reconcile payments and COD before resuming' },
  { key: 'postmortem', blocking: true, ar: 'سجّل السبب الجذري في الحادث قبل إغلاقه', en: 'Record the root cause on the incident before closing it' },
];

export interface ChecklistState { [itemKey: string]: { checked: boolean; note?: string; checked_at?: string } }

const checklistRepo = adminCrud<any>('ops_checklist_state');

// ── Aggregation ───────────────────────────────────────────────────────────────

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const goLiveService = {
  async checklistState(checklist: 'launch' | 'rollback'): Promise<ChecklistState> {
    const out: ChecklistState = {};
    try {
      const { data } = await checklistRepo.list();
      (data ?? []).filter((r: any) => r.checklist === checklist).forEach((r: any) => {
        out[r.item_key] = { checked: !!r.checked, note: r.note ?? undefined, checked_at: r.checked_at ?? undefined };
      });
    } catch { /* unreachable storage leaves everything unticked — the safe default */ }
    return out;
  },

  async setChecklistItem(checklist: 'launch' | 'rollback', itemKey: string, checked: boolean, note?: string): Promise<void> {
    let actor: string | null = null;
    try { actor = await authService.getAuthUserId(); } catch { /* best effort */ }
    const patch = {
      checked, note: note ?? null,
      checked_by: checked ? actor : null,
      checked_at: checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    try {
      const { data } = await checklistRepo.list();
      const existing = (data ?? []).find((r: any) => r.checklist === checklist && r.item_key === itemKey);
      if (existing) await checklistRepo.update(existing.id, patch);
      else await checklistRepo.create({ checklist, item_key: itemKey, ...patch });
    } catch { /* the UI reflects intent; a failed write surfaces on next load */ }
  },

  /** One fetch for the whole command centre. */
  async snapshot(): Promise<GoLiveSnapshot> {
    const [summary, incidentsAll, merchantRows, docs] = await Promise.all([
      commandService.summary().catch(() => ({} as any)),
      incidentService.list().then(r => r.data).catch(() => [] as Incident[]),
      supplyHealthService.merchantHealth().then(r => r.data).catch(() => [] as MerchantHealth[]),
      supplyHealthService.expiringDocuments(30).then(r => r.data).catch(() => [] as ExpiringDocument[]),
    ]);

    // Build + API reachability — reuses the existing /version.json health signal.
    let build: GoLiveSnapshot['build'] = null;
    let apiOk: boolean | null = null;
    let apiMs: number | null = null;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      apiMs = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null;
      // If the fetch RESOLVED, the platform answered — that is what "up" means. A 404
      // only means version.json was not built (the dev server does not emit it), which
      // is not an outage. Treating it as one produced a false "platform not responding"
      // alert, and a false critical alert is worse than no alert: it teaches operators
      // to scroll past the panel that will one day be telling the truth.
      apiOk = true;
      if (r.ok) build = await r.json();
    } catch {
      // Only a thrown fetch — DNS failure, connection refused, offline — is an outage.
      apiOk = false;
    }

    const openIncidents = incidentsAll.filter(i => i.status !== 'closed' && i.status !== 'resolved');
    const sev1 = openIncidents.filter(i => i.severity === 'sev1');
    const merchantCounts = summariseHealth(merchantRows.map(m => m.health_score));
    const expired = docs.filter(d => d.status === 'expired');

    const marketplace = {
      activeOrders: num(summary.active_orders),
      unassignedOrders: num(summary.unassigned_orders),
      inTransit: num(summary.in_transit),
      onlineDrivers: num(summary.online_drivers),
      availableDrivers: num(summary.available_drivers),
      busyDrivers: num(summary.busy_drivers),
      deliveredToday: num(summary.delivered_today),
      revenueToday: num(summary.revenue_today),
      pendingOffers: num(summary.pending_offers),
    };

    // Queue depths. Thresholds are the point at which a human should intervene.
    const queues: QueueDepth[] = [
      { key: 'unassigned', ar: 'طلبات بلا مندوب', en: 'Orders awaiting a driver', depth: marketplace.unassignedOrders, threshold: QUEUE_THRESHOLDS.unassigned },
      { key: 'offers', ar: 'عروض إسناد معلّقة', en: 'Pending dispatch offers', depth: marketplace.pendingOffers, threshold: QUEUE_THRESHOLDS.offers },
      { key: 'incidents', ar: 'حوادث مفتوحة', en: 'Open incidents', depth: openIncidents.length, threshold: QUEUE_THRESHOLDS.incidents },
      { key: 'docs', ar: 'وثائق منتهية', en: 'Expired documents', depth: expired.length, threshold: QUEUE_THRESHOLDS.docs },
    ];

    const providers = capabilities();
    const clientErrors = (() => {
      try { return monitoring.recentEvents().filter((e: any) => e.level === 'error').length; } catch { return 0; }
    })();

    const alerts = deriveAlerts({
      apiOk,
      isSandbox: SANDBOX,
      activeOrders: marketplace.activeOrders,
      unassignedOrders: marketplace.unassignedOrders,
      availableDrivers: marketplace.availableDrivers,
      openSev1: sev1.length,
      expiredDocuments: expired.length,
      merchantsAtRisk: merchantCounts.atRisk,
      unconfiguredProviders: providers.filter(p => p.status === 'not-configured').map(p => p.capability),
    });

    return {
      build, apiOk, apiMs, marketplace,
      incidents: {
        open: openIncidents.length,
        sev1: sev1.length,
        unassigned: openIncidents.filter(i => !i.assigned_to).length,
        list: openIncidents.slice(0, 8),
      },
      merchants: {
        ...merchantCounts,
        atRisk: merchantCounts.atRisk,
        worst: merchantRows.filter(m => healthBand(m.health_score) === 'at_risk').slice(0, 5),
      },
      documents: { expired: expired.length, expiring: docs.length - expired.length, list: docs.slice(0, 8) },
      providers, queues, alerts, clientErrors,
      mode: SANDBOX ? 'sandbox' : 'live',
    };
  },

  /**
   * The Go / No-Go verdict.
   *
   * Deliberately conservative and mechanical: it is NO-GO unless every blocking
   * checklist item is ticked AND there is no critical alert. It will never return GO
   * on a sandbox build, because a demo build cannot take a real order — which is the
   * single most important thing this function exists to prevent someone forgetting.
   */
  verdict(snapshot: GoLiveSnapshot, launchState: ChecklistState) {
    return computeVerdict(LAUNCH_CHECKLIST, launchState, snapshot.alerts);
  },

  /** Severity metadata, re-exported so the command centre does not import two modules. */
  severity: SEVERITY,
};
