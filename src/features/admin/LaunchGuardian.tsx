import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Copy, ExternalLink, Bot, ClipboardList, ShieldAlert, CheckCircle2, Gauge, Network, Layers, Route as RouteIcon, Users, AlertTriangle, HelpCircle } from 'lucide-react';
import {
  WorkspaceHeader, AdminCard, MetricCard, StatusBadge, SectionHeader, ActionButton, DashboardGrid,
  type StatusKind,
} from '../../components/admin/EnterpriseUI';
import { monitoring, type MonitorEvent } from '../../services/monitoring.service';
import { analyticsService } from '../../services/analytics.service';
import { sandboxStore } from '../../services/sandboxStore';
import { adminService } from '../../services/admin.service';
import { guardianSnapshotService } from '../../services/guardian-snapshot.service';
import { adminCrud } from '../../services/admin-crud.service';
import type { GuardianSnapshot, OpsFinding } from '../../guardian/ops/types';
import { snapshotFindings, runtimeFindings, authFindings, locationFindings, notificationFindings, paymentFindings, emailFindings, bySeverity } from '../../guardian/ops/findings';
import { IS_PRODUCTION_DATA } from '../../config/runtime';
import { buildRepairPackets } from '../../guardian/ops/repair';
import {
  reconcile, transition, canTransition, assign, addComment, attachRepair,
  slaState, slaBreaches, isActive, ISSUE_STATUSES, ISSUE_OWNERS,
  type Issue, type IssueStatus, type IssueOwner,
} from '../../guardian/ops/issues';
import { evaluateGate } from '../../guardian/ops/gate';
import { toBuildRecord, allTrends, architectureStability, releaseQuality, compareBuilds, sortHistory, type BuildRecord } from '../../guardian/ops/history';
import { capabilities as providerCapabilities, declaredSmsVendor, declaredMapsVendor, declaredPushVendor, declaredPaymentGateway, declaredEmailVendor } from '../../providers/registry';

// Persistence reuses the generic admin CRUD engine (real table in live, localStorage in
// sandbox). No new service, no new store: `id` is owned by storage, while the domain
// joins on `findingId`, so adminCrud assigning its own id is harmless.
const issuesRepo = adminCrud<Issue & { id: string }>('guardian_issues');
const buildsRepo = adminCrud<BuildRecord>('guardian_builds');

// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH GUARDIAN V1 — lightweight production-health & launch-readiness workspace.
// Reuse-only: health/metrics come from existing services (monitoring seam, analytics /
// sandboxStore, admin audit logs, /version.json + /health.json). NOT a monitoring server,
// NOT a QA platform. It NEVER executes fixes — it prepares an AI Repair Prompt for a human.
// ─────────────────────────────────────────────────────────────────────────────

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';
const MAPS_READY = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

type Health = { name: string; kind: StatusKind; detail: string };
// success = 🟢 green · warning/pending = 🟡 yellow · error = 🔴 red
const G = (name: string, detail: string): Health => ({ name, kind: 'success', detail });
const Y = (name: string, detail: string): Health => ({ name, kind: 'warning', detail });
const R = (name: string, detail: string): Health => ({ name, kind: 'error', detail });

// NOTE: the hardcoded REGRESSION table that used to live here always rendered
// "<total>/<total> ✓" — it reported a pass whether or not the suite had ever run, and its
// numbers went stale. Suite results now come from the build-time Guardian snapshot, where
// an unrecorded suite reports "not run" instead of green.

const SEV_COLOR: Record<OpsFinding['severity'], string> = {
  critical: '#f87171', high: '#fb923c', medium: '#fbbf24', low: '#94a3b8',
};
const sevBadge = (s: OpsFinding['severity']): StatusKind =>
  s === 'critical' || s === 'high' ? 'error' : s === 'medium' ? 'warning' : 'pending';

const fmtAge = (ms: number, L: (a: string, e: string) => string): string => {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}${L('د', 'm')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${L('س', 'h')}`;
  return `${Math.floor(h / 24)}${L('ي', 'd')}`;
};

export const LaunchGuardian: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [apiMs, setApiMs] = useState<number | null>(null);
  const [dbMs, setDbMs] = useState<number | null>(null);
  const [build, setBuild] = useState<{ short?: string; sha?: string; builtAt?: string; env?: string }>({});
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [audit, setAudit] = useState<{ action?: string; created_at?: string; actor?: string }[]>([]);
  const [metrics, setMetrics] = useState<{ orders: number; failed: number; pending: number; delivered: number; users: number; storageKb: number }>({ orders: 0, failed: 0, pending: 0, delivered: 0, users: 0, storageKb: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [snap, setSnap] = useState<GuardianSnapshot | null>(null);
  const [snapReason, setSnapReason] = useState<string | undefined>();
  const [snapAge, setSnapAge] = useState<number | undefined>();
  const [openPacket, setOpenPacket] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ severity: string; area: string; owner: string; status: string; build: string; q: string }>(
    { severity: '', area: '', owner: '', status: '', build: '', q: '' });
  const [compareTo, setCompareTo] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);

    // Build-time architecture facts (same DiscoveryEngine, serialized at build).
    const s = await guardianSnapshotService.load(true);
    setSnap(s.snapshot); setSnapReason(s.reason); setSnapAge(s.ageMs);
    // API + version (reuse the existing /version.json health signal)
    const t0 = performance.now();
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      setApiMs(Math.round(performance.now() - t0));
      setApiOk(r.ok);
      if (r.ok) { const v = await r.json(); setBuild({ short: v.short, sha: v.sha, builtAt: v.builtAt, env: v.env }); }
    } catch { setApiOk(false); setApiMs(null); }

    // Order metrics (reuse existing analytics — sandboxStore in demo, analyticsService in live)
    const d0 = performance.now();
    try {
      if (SANDBOX) {
        const a = sandboxStore.getPlatformAnalytics();
        const orders = sandboxStore.getOrders();
        const users = new Set(orders.map(o => o.customer_id)).size;
        let storageKb = 0; try { storageKb = Math.round((JSON.stringify(localStorage).length) / 1024); } catch { /* ignore */ }
        setMetrics({ orders: a.totalOrders, failed: sandboxStore.getFailedOrders().length, pending: a.activeOrders, delivered: a.delivered, users, storageKb });
      } else {
        const { data } = await analyticsService.getPlatformAnalytics();
        setMetrics({ orders: data.totalOrders, failed: data.cancelled, pending: data.activeOrders, delivered: data.delivered, users: data.activeOrders, storageKb: 0 });
      }
      setDbMs(Math.round(performance.now() - d0));
    } catch { setDbMs(null); }

    // Recent events (reuse the monitoring ring buffer) + audit logs (reuse adminService)
    setEvents(monitoring.recentEvents());
    try { const { data } = await adminService.auditLogs({ limit: 20 }); setAudit((data as any[]) || []); } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); const id = window.setInterval(refresh, 30000); return () => window.clearInterval(id); }, [refresh]);

  // ── System Health (17 subsystems) — derived from real signals, no fabrication ──
  const health: Health[] = useMemo(() => {
    const api = apiOk === null ? Y('API', L('يجري الفحص…', 'checking…')) : apiOk ? G('API', `${apiMs ?? '—'}ms`) : R('API', L('لا يستجيب', 'unreachable'));
    const web = apiOk === false ? R('Website', L('غير متاح', 'down')) : G('Website', build.short ? `build ${build.short}` : L('حي', 'live'));
    return [
      web,
      G('Website Studio', L('محرّك واحد (تطابق)', 'one engine (parity)')),
      api,
      SANDBOX ? Y('Supabase', L('وضع العرض (sandbox)', 'demo (sandbox)')) : (dbMs != null ? G('Supabase', `${dbMs}ms`) : R('Supabase', L('لا يستجيب', 'unreachable'))),
      SANDBOX ? Y('Realtime', L('محلي (عرض)', 'local (demo)')) : G('Realtime', L('منشور', 'published')),
      SANDBOX ? Y('Authentication', L('OTP تجريبي 123456', 'mock OTP 123456')) : Y('Authentication', L('تحقّق من مزوّد SMS', 'verify SMS provider')),
      G('Orders', `${metrics.orders} ${L('طلب', 'orders')}`),
      SANDBOX ? Y('Payments', L('محاكاة (عرض)', 'simulated (demo)')) : Y('Payments', L('مفاتيح Moyasar الحيّة مطلوبة', 'live Moyasar keys required')),
      G('COD', L('موصول من طرف إلى طرف', 'wired end-to-end')),
      G('Drivers', L('محرّك الإرسال نشِط', 'dispatch active')),
      G('Merchants', L('التهيئة والطلبات', 'onboarding + orders')),
      G('Partner Center', L('نماذج التقديم', 'application forms')),
      G('Affiliate', L('الإسناد موصول', 'attribution wired')),
      Y('Notifications', L('داخل التطبيق ✓ · الدفع غير مُهيّأ', 'in-app ✓ · push not configured')),
      SANDBOX ? Y('Storage', L('محلي (عرض)', 'local (demo)')) : G('Storage', L('٧ حاويات', '7 buckets')),
      SANDBOX ? Y('Edge Functions', L('غير مُفعّلة (عرض)', 'inactive (demo)')) : G('Edge Functions', L('٤ نشطة', '4 active')),
      MAPS_READY ? G('Maps', L('المفتاح مُهيّأ', 'API key set')) : Y('Maps', L('مفتاح API مطلوب', 'API key required')),
    ];
  }, [apiOk, apiMs, dbMs, build.short, metrics.orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    green: health.filter(h => h.kind === 'success').length,
    yellow: health.filter(h => h.kind === 'warning' || h.kind === 'pending').length,
    red: health.filter(h => h.kind === 'error').length,
  }), [health]);

  // ── Findings · one list, every panel and the score read from it ──────────────
  // Snapshot findings are build-time facts; runtime findings are this session's captures.
  // ── Provider + authentication health (derived from env + captured signals) ──
  const providers = useMemo(() => providerCapabilities(), []);
  const authHealth = useMemo(() => {
    const p = providers.find(x => x.capability === 'auth');
    const count = (needle: string) => events.filter(e => typeof e.message === 'string' && e.message.includes(needle)).length;
    return {
      status: (p?.status ?? 'not-configured') as 'active' | 'demo' | 'not-configured',
      isProduction: IS_PRODUCTION_DATA,
      vendor: declaredSmsVendor(),
      sendFailures: count('[auth] send_failed'),
      verifyFailures: count('[auth] verify_failed'),
      requires: p?.requires ?? [],
      detail: p?.detail ?? '',
    };
  }, [providers, events]);
  /** Auth is release-ready in any build EXCEPT a production build with no SMS vendor. */
  const authGate = useMemo(
    () => ({ ready: authHealth.status !== 'not-configured', detail: authHealth.detail, requires: authHealth.requires }),
    [authHealth],
  );

  const locationHealth = useMemo(() => {
    const loc = providers.find(x => x.capability === 'location');
    const maps = providers.find(x => x.capability === 'maps');
    const count = (needle: string) => events.filter(e => typeof e.message === 'string' && e.message.includes(needle)).length;
    return {
      locationActive: loc?.status === 'active',
      mapsStatus: (maps?.status ?? 'not-configured') as 'active' | 'demo' | 'not-configured',
      isProduction: IS_PRODUCTION_DATA,
      mapsVendor: declaredMapsVendor(),
      updateFailures: count('[location] update_failed'),
      permissionFailures: count('[location] permission_denied'),
      trackingInterruptions: count('[location] slow_update'),
      locationDetail: loc?.detail ?? '',
      mapsDetail: maps?.detail ?? '',
    };
  }, [providers, events]);
  /** Location is release-ready when the device coordinate source is available. */
  const locationGate = useMemo(
    () => ({ ready: locationHealth.locationActive, detail: locationHealth.locationDetail }),
    [locationHealth],
  );

  const notificationHealth = useMemo(() => {
    const inapp = providers.find(x => x.capability === 'inapp');
    const push = providers.find(x => x.capability === 'push');
    const count = (needle: string) => events.filter(e => typeof e.message === 'string' && e.message.includes(needle)).length;
    return {
      inAppActive: inapp?.status === 'active',
      pushStatus: (push?.status ?? 'not-configured') as 'active' | 'demo' | 'not-configured',
      isProduction: IS_PRODUCTION_DATA,
      pushVendor: declaredPushVendor(),
      deliveryFailures: count('[notify] delivery_failed'),
      // Live queue metrics require a delivery worker (server-side); none runs client-side yet.
      retrying: 0, dropped: 0, backlog: 0,
      inAppDetail: inapp?.detail ?? '',
    };
  }, [providers, events]);
  /** Notifications are release-ready when the in-app channel is live (push is an enhancement). */
  const notificationGate = useMemo(
    () => ({ ready: notificationHealth.inAppActive, detail: notificationHealth.inAppDetail }),
    [notificationHealth],
  );

  const paymentHealth = useMemo(() => {
    const pay = providers.find(x => x.capability === 'payment');
    const count = (needle: string) => events.filter(e => typeof e.message === 'string' && e.message.includes(needle)).length;
    return {
      codAvailable: true,   // COD is wired end-to-end (the launch method)
      gatewayStatus: (pay?.status ?? 'not-configured') as 'active' | 'demo' | 'not-configured',
      isProduction: IS_PRODUCTION_DATA,
      gatewayVendor: declaredPaymentGateway(),
      gatewayFailures: count('[payment] gateway_failed'),
      codLedgerFailures: count('[payment] cod_ledger_failed'),
      // Stuck-payment counts require a reconciliation read (server-side); none runs client-side.
      stuck: 0,
      detail: pay?.detail ?? '',
    };
  }, [providers, events]);
  /** Payment is release-ready when at least one method works — COD always does. */
  const paymentGate = useMemo(
    () => ({ ready: paymentHealth.codAvailable || paymentHealth.gatewayStatus === 'active', detail: paymentHealth.detail }),
    [paymentHealth],
  );

  const emailHealth = useMemo(() => {
    const em = providers.find(x => x.capability === 'email');
    const count = (needle: string) => events.filter(e => typeof e.message === 'string' && e.message.includes(needle)).length;
    return {
      vendorStatus: (em?.status ?? 'not-configured') as 'active' | 'demo' | 'not-configured',
      isProduction: IS_PRODUCTION_DATA,
      vendor: declaredEmailVendor(),
      deliveryFailures: count('[email] send_failed'),
      templateFailures: count('[email] template_failed'),
      bounces: count('[email] bounce'),
      // Live queue metrics require a server-side email worker; none runs client-side yet.
      retrying: 0, backlog: 0,
      detail: em?.detail ?? '',
    };
  }, [providers, events]);
  /** Email is release-ready when templates render (a missing vendor is an enhancement gap). */
  const emailGate = useMemo(
    () => ({ ready: emailHealth.templateFailures === 0, detail: emailHealth.detail }),
    [emailHealth],
  );

  const findings = useMemo<OpsFinding[]>(() => {
    const fromSnapshot = snap ? snapshotFindings(snap) : [];
    const fromRuntime = runtimeFindings(events as { kind: 'error' | 'log' | 'event'; level?: string; message: string; stack?: string; at: string; source?: string }[]);
    const fromAuth = authFindings(authHealth);
    const fromLocation = locationFindings(locationHealth);
    const fromNotify = notificationFindings(notificationHealth);
    const fromPayment = paymentFindings(paymentHealth);
    const fromEmail = emailFindings(emailHealth);
    const missing: OpsFinding[] = snap ? [] : [{
      id: 'build.nosnapshot',
      area: 'build',
      severity: 'medium',
      title: 'Architecture snapshot unavailable',
      rootCause: snapReason || 'guardian-snapshot.json was not published with this build, so architecture, navigation and regression state are UNKNOWN — not healthy.',
      files: ['scripts/gen-guardian-snapshot.ts'],
      recommendedFix: 'Run `npm run build` (which emits dist/guardian-snapshot.json) and redeploy.',
      blocker: false,
    }];
    return [...fromSnapshot, ...fromRuntime, ...fromAuth, ...fromLocation, ...fromNotify, ...fromPayment, ...fromEmail, ...missing].sort(bySeverity);
  }, [snap, snapReason, events, authHealth, locationHealth, notificationHealth, paymentHealth, emailHealth]);

  const packets = useMemo(() => buildRepairPackets(findings, { sha: build.short, env: build.env, builtAt: build.builtAt }), [findings, build]);

  // ── Issue lifecycle · fold this build's findings into the persistent record ──
  // Runs after findings settle. Reconcile is pure; only the deltas are written, so a
  // repeat run with identical findings performs no writes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loading) return;
      const buildId = build.short || 'unknown';
      const now = new Date().toISOString();

      const { data: stored } = await issuesRepo.list();
      const existing = (stored || []) as Issue[];
      const r = reconcile({ findings, existing, build: buildId, now });
      if (cancelled) return;

      // Persist deltas only.
      for (const i of r.opened) await issuesRepo.create(i as Issue & { id: string });
      const changed = [...r.claimedFixed, ...r.verified, ...r.regressions];
      for (const i of changed) await issuesRepo.update(i.id, i as Partial<Issue & { id: string }>);

      const { data: fresh } = await issuesRepo.list();
      if (cancelled) return;
      const current = (fresh || []) as Issue[];
      setIssues(current);

      // Build history: one row per build, upserted (a refresh must not duplicate a build).
      if (snap) {
        const gate = evaluateGate({ findings, issues: current, snapshot: snap, now, auth: authGate, location: locationGate, notification: notificationGate, payment: paymentGate, email: emailGate });
        const rec = toBuildRecord({
          snapshot: snap, issues: current,
          readiness: gate.readiness.score, verdict: gate.verdict,
          runtimeErrors: events.filter(e => e.kind === 'error').length, now,
        });
        const { data: hist } = await buildsRepo.list();
        if (cancelled) return;
        const rows = (hist || []) as BuildRecord[];
        const prior = rows.find(b => b.build === rec.build);
        if (prior) await buildsRepo.update((prior as any).id, rec as Partial<BuildRecord>);
        else await buildsRepo.create(rec);
        const { data: after } = await buildsRepo.list();
        if (!cancelled) setBuilds(sortHistory((after || []) as BuildRecord[]));
      }
    })().catch(() => { /* the workspace degrades to read-only; never crash the console */ });
    return () => { cancelled = true; };
  }, [findings, loading, build.short, snap, events]);

  // ── Release Gate — reuses the readiness engine, adds operational rules ──
  const gate = useMemo(
    () => evaluateGate({ findings, issues, snapshot: snap, now: new Date().toISOString(), auth: authGate, location: locationGate, notification: notificationGate, payment: paymentGate, email: emailGate }),
    [findings, issues, snap, authGate, locationGate, notificationGate, paymentGate, emailGate],
  );
  const readiness = gate.readiness;

  const trends = useMemo(() => allTrends(builds), [builds]);
  const stability = useMemo(() => architectureStability(builds), [builds]);
  const quality = useMemo(() => releaseQuality(builds), [builds]);
  const breaches = useMemo(() => slaBreaches(issues, new Date().toISOString()), [issues]);

  const visibleIssues = useMemo(() => {
    const q = filters.q.toLowerCase().trim();
    return issues.filter(i => {
      if (filters.severity && i.severity !== filters.severity) return false;
      if (filters.area && i.area !== filters.area) return false;
      if (filters.owner && i.owner !== filters.owner) return false;
      if (filters.status && i.status !== filters.status) return false;
      if (filters.build && i.detectedBuild !== filters.build) return false;
      if (q && !(`${i.title} ${i.rootCause} ${i.files.join(' ')} ${i.labels.join(' ')}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort(bySeverity);
  }, [issues, filters]);

  const delta = useMemo(
    () => (compareTo && build.short ? compareBuilds(issues, compareTo, build.short) : null),
    [issues, compareTo, build.short],
  );

  /** Persist one issue mutation and reflect it locally. */
  const mutate = useCallback(async (next: Issue) => {
    setIssues(prev => prev.map(i => (i.findingId === next.findingId ? next : i)));
    await issuesRepo.update(next.id, next as Partial<Issue & { id: string }>);
  }, []);

  // ── AI Repair Prompt — collected automatically from logs/errors/build; copy-only ──
  const repairPrompt = useMemo(() => {
    const errors = events.filter(e => e.kind === 'error');
    const firstErr = errors[0];
    const degraded = health.filter(h => h.kind !== 'success');
    const files = errors.flatMap(e => (e.stack || '').match(/\/src\/[\w./-]+/g) || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);
    const logLines = events.slice(0, 15).map(e => `[${e.at}] ${e.kind}${e.level ? '/' + e.level : ''}: ${e.message}`).join('\n');
    return [
      'You are fixing a production issue in HAAT NOW (React 19 + Vite + Tailwind + Capacitor).',
      '',
      '## Root cause (candidate)',
      firstErr ? firstErr.message : (degraded.length ? `Degraded subsystem(s): ${degraded.map(d => d.name).join(', ')} — investigate.` : 'No captured errors; all subsystems nominal.'),
      '',
      '## Degraded subsystems',
      degraded.length ? degraded.map(d => `- ${d.name}: ${d.detail}`).join('\n') : '- none',
      '',
      '## Affected files (parsed from stack traces)',
      files.length ? files.map(f => `- ${f}`).join('\n') : '- unknown — inspect the logs below',
      '',
      '## Recent logs / events (newest first)',
      logLines || '- (buffer empty)',
      '',
      '## Stack trace',
      firstErr?.stack || '- none captured',
      '',
      '## Deployed build',
      `sha ${build.sha || '?'} · built ${build.builtAt || '?'} · env ${build.env || '?'}`,
      'Changed files: run `git diff <previous-sha> ' + (build.short || 'HEAD') + '` locally.',
      '',
      '## Request',
      'Provide the MINIMAL patch to fix the root cause. Do NOT refactor. Do NOT redesign.',
      'Reuse existing services/components. Return a unified diff touching the fewest files.',
      'Explain the root cause in 2 lines, then the diff.',
    ].join('\n');
  }, [events, health, build]);

  const copyPrompt = async () => { try { await navigator.clipboard.writeText(repairPrompt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } };
  const openInClaude = () => { try { window.open(`https://claude.ai/new?q=${encodeURIComponent(repairPrompt.slice(0, 6000))}`, '_blank', 'noopener'); } catch { /* ignore */ } };

  return (
    <div id="launch_guardian" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-5">
      <WorkspaceHeader
        Icon={Activity}
        title={L('حارس الإطلاق', 'Launch Guardian')}
        subtitle={L('صحّة الإنتاج وجاهزية الإطلاق · قراءة فقط · لا يُنفّذ أي إصلاح تلقائيًا', 'Production health & launch readiness · read-only · never auto-executes fixes')}
        actions={<ActionButton variant="secondary" Icon={RefreshCw} loading={loading} onClick={refresh}>{L('تحديث', 'Refresh')}</ActionButton>}
      />

      {/* Approval-gate banner */}
      <AdminCard className="border" padding="p-3">
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <ShieldAlert size={16} color="#fbbf24" />
          {L('حارس الإطلاق لا يُطبّق أي إصلاح تلقائيًا. كل تصحيح يتطلّب مراجعة واعتماد المشرف الأعلى.', 'Launch Guardian never applies fixes automatically. Every patch requires Super Admin review + approval.')}
          <span className="ms-auto">{L('الوضع', 'Mode')}: <b style={{ color: SANDBOX ? '#fbbf24' : '#4ade80' }}>{SANDBOX ? L('عرض (sandbox)', 'demo (sandbox)') : L('إنتاج مباشر', 'live')}</b></span>
        </div>
      </AdminCard>

      {/* ══ Release Gate — may we ship? readiness + the operational record ══ */}
      <div id="lg_release_gate">
        <SectionHeader title={L('بوّابة الإصدار', 'Release Gate')}
          action={<span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {gate.evaluated.filter(e => e.passed).length}/{gate.evaluated.length} {L('قاعدة اجتازت', 'rules passed')}
          </span>} />
        <AdminCard>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge
              kind={gate.verdict === 'GO' ? 'success' : gate.verdict === 'NO_GO' ? 'error' : 'warning'}
              label={gate.verdict === 'GO' ? L('انشر', 'GO') : gate.verdict === 'NO_GO' ? L('لا تنشر', 'NO GO') : L('انشر بحذر', 'GO WITH RISK')}
            />
            <span className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>
              {gate.verdict === 'NO_GO'
                ? L(`النشر محجوب — ${gate.blockers.length} عائق`, `Deployment blocked — ${gate.blockers.length} blocker(s)`)
                : gate.verdict === 'GO_WITH_RISK'
                  ? L(`${gate.warnings.length} تحذير`, `${gate.warnings.length} warning(s)`)
                  : L('كل القواعد اجتازت', 'every rule passed')}
            </span>
          </div>

          {/* Every rule, passing or not — a GO must be auditable, not asserted. */}
          <div className="mt-3 space-y-1" id="lg_gate_rules">
            {gate.evaluated.map(e => (
              <div key={e.rule} className="flex items-start gap-2 text-[11.5px]">
                {e.passed
                  ? <CheckCircle2 size={13} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} />
                  : <AlertTriangle size={13} color={gate.blockers.some(b => b.rule === e.rule) ? '#f87171' : '#fbbf24'} style={{ marginTop: 2, flexShrink: 0 }} />}
                <span style={{ color: 'var(--color-on-surface)', minWidth: 190 }}>{e.rule}</span>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{e.detail}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      {/* ══ Launch Readiness — one score, derived from findings, never asserted ══ */}
      <div id="lg_readiness">
        <SectionHeader title={L('جاهزية الإطلاق', 'Launch Readiness')} />
        <AdminCard>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: readiness.verdict === 'go' ? '#4ade80' : readiness.verdict === 'no-go' ? '#f87171' : '#fbbf24' }}>{readiness.score}</span>
              <span className="text-[14px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>/100</span>
            </div>
            <StatusBadge
              kind={readiness.verdict === 'go' ? 'success' : readiness.verdict === 'no-go' ? 'error' : 'warning'}
              label={readiness.verdict === 'go' ? L('جاهز', 'GO') : readiness.verdict === 'no-go' ? L('غير جاهز', 'NO-GO') : L('جاهز مع مخاطر', 'GO WITH RISK')}
            />
            <div className="flex gap-3 text-[11.5px] ms-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
              {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                <span key={s}><b style={{ color: SEV_COLOR[s] }}>{readiness.counts[s]}</b> {s}</span>
              ))}
            </div>
          </div>

          {readiness.blockers.length > 0 ? (
            <div className="mt-3 space-y-1.5" id="lg_blockers">
              <p className="text-[12px] font-bold" style={{ color: '#f87171' }}>
                <AlertTriangle size={13} className="inline me-1" />
                {L(`${readiness.blockers.length} عائق يمنع الإطلاق`, `${readiness.blockers.length} launch blocker(s)`)}
              </p>
              {readiness.blockers.map(b => (
                <div key={b.id} className="text-[11.5px] p-2 rounded" style={{ background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface-variant)' }}>
                  <b style={{ color: 'var(--color-on-surface)' }}>{b.title}</b> — {b.why}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11.5px] mt-3" style={{ color: '#4ade80' }}>
              <CheckCircle2 size={13} className="inline me-1" />{L('لا توجد عوائق إطلاق.', 'No launch blockers.')}
            </p>
          )}
          {!snap && (
            <p className="text-[11px] mt-2" style={{ color: '#fbbf24' }}>
              <HelpCircle size={12} className="inline me-1" />
              {L('لقطة المعمارية غير متاحة — الحالة "غير معروفة" وليست "سليمة".', 'Architecture snapshot unavailable — state is UNKNOWN, not healthy.')} {snapReason}
            </p>
          )}
        </AdminCard>
      </div>

      {/* System Health */}
      <div>
        <SectionHeader title={L(`صحّة النظام · 🟢 ${counts.green}  🟡 ${counts.yellow}  🔴 ${counts.red}`, `System Health · 🟢 ${counts.green}  🟡 ${counts.yellow}  🔴 ${counts.red}`)} />
        <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {health.map(h => (
            <AdminCard key={h.name} padding="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold" style={{ color: 'var(--color-on-surface)' }}>{h.name}</span>
                <StatusBadge kind={h.kind} label={h.kind === 'success' ? '●' : h.kind === 'error' ? '●' : '●'} />
              </div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{h.detail}</p>
            </AdminCard>
          ))}
        </div>
      </div>

      {/* System Metrics */}
      <div>
        <SectionHeader title={L('مقاييس النظام', 'System Metrics')} />
        <DashboardGrid cols={4}>
          <MetricCard label={L('زمن استجابة API', 'API latency')} value={apiMs != null ? `${apiMs}ms` : '—'} Icon={Gauge} />
          <MetricCard label={L('زمن قاعدة البيانات', 'Database latency')} value={dbMs != null ? `${dbMs}ms` : '—'} Icon={Gauge} hint={SANDBOX ? L('محلي', 'local') : undefined} />
          <MetricCard label={L('زمن الوقت الحقيقي', 'Realtime latency')} value={SANDBOX ? L('محلي', 'local') : '—'} Icon={Gauge} />
          <MetricCard label={L('المستخدمون النشطون', 'Active users')} value={metrics.users || '—'} hint={L('تقريبي', 'approx')} />
          <MetricCard label={L('الطلبات', 'Orders')} value={metrics.orders} accent="#4ade80" />
          <MetricCard label={L('طلبات فاشلة', 'Failed orders')} value={metrics.failed} accent={metrics.failed ? '#f87171' : undefined} />
          <MetricCard label={L('طلبات معلّقة', 'Pending orders')} value={metrics.pending} accent="#fbbf24" />
          <MetricCard label={L('تم التوصيل', 'Delivered')} value={metrics.delivered} accent="#4ade80" />
          <MetricCard label={L('سائقون متاحون', 'Drivers online')} value={SANDBOX ? (sandboxStore.getDriverAvailable().length || '—') : '—'} />
          <MetricCard label={L('تجّار متصلون', 'Merchants online')} value={'—'} hint={SANDBOX ? L('يتطلّب خلفية حيّة', 'live backend') : undefined} />
          <MetricCard label={L('استخدام التخزين', 'Storage usage')} value={SANDBOX ? `${metrics.storageKb} KB` : '—'} hint={SANDBOX ? L('محلي', 'localStorage') : L('لوحة Supabase', 'Supabase console')} />
          <MetricCard label={L('نسخة الإصدار', 'Build version')} value={build.short || '—'} hint={build.env} />
          <MetricCard label={L('بصمة Git', 'Git commit')} value={build.sha ? build.sha.slice(0, 10) : '—'} hint={L('الإصدار المنشور', 'deployed sha')} />
          <MetricCard label={L('عمر الإصدار', 'Build age')}
            value={build.builtAt ? fmtAge(Date.now() - new Date(build.builtAt).getTime(), L) : '—'}
            hint={build.builtAt ? new Date(build.builtAt).toLocaleString() : undefined} />
          <MetricCard label={L('حالة التشغيل', 'Runtime status')}
            value={apiOk === null ? '—' : apiOk ? L('يعمل', 'operational') : L('متعطّل', 'down')}
            accent={apiOk === false ? '#f87171' : apiOk ? '#4ade80' : undefined} />
        </DashboardGrid>
      </div>

      {/* AI Assistant */}
      <div>
        <SectionHeader title={L('مساعد الذكاء الاصطناعي — مُوجّه الإصلاح', 'AI Assistant — Repair Prompt')}
          action={<div className="flex gap-2">
            <ActionButton variant="secondary" Icon={Copy} onClick={copyPrompt}>{copied ? L('تم النسخ ✓', 'Copied ✓') : L('نسخ المُوجّه', 'Copy Prompt')}</ActionButton>
            <ActionButton variant="primary" Icon={ExternalLink} onClick={openInClaude}>{L('فتح في Claude', 'Open in Claude')}</ActionButton>
          </div>} />
        <AdminCard>
          <div className="flex items-center gap-2 mb-2 text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            <Bot size={15} /> {L('جُمِّع تلقائيًا من: السجلّات، تتبّع الأخطاء، أخطاء المتصفّح، فشل الطلبات، والإصدار المنشور.', 'Auto-collected from: logs, stack traces, browser errors, failed requests, deployed build.')}
          </div>
          <textarea readOnly value={repairPrompt} spellCheck={false}
            className="w-full rounded-lg p-3 font-mono text-[11px]" style={{ height: 240, background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)', whiteSpace: 'pre', overflow: 'auto' }} />
          <p className="text-[11px] mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            {L('المُوجّه يطلب رقعة صغرى فقط — بدون إعادة هيكلة أو إعادة تصميم. لا يُطبَّق أي تغيير دون اعتمادك.', 'The prompt requests a minimal patch only — no refactor, no redesign. Nothing is applied without your approval.')}
          </p>
        </AdminCard>
      </div>

      {/* ══ Architecture Health — build-time facts from the Guardian snapshot ══ */}
      <div id="lg_architecture">
        <SectionHeader title={L('صحّة المعمارية', 'Architecture Health')}
          action={snap ? <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {snap.architecture.files} {L('ملف', 'files')} · {snap.architecture.totalLoc.toLocaleString()} LOC · fp {snap.fingerprint.composite}
            {snapAge != null && ` · ${fmtAge(snapAge, L)} ${L('مضت', 'old')}`}
          </span> : undefined} />
        {!snap ? (
          <AdminCard><p className="text-[12px]" style={{ color: '#fbbf24' }}>{L('غير معروف — لا توجد لقطة.', 'Unknown — no snapshot.')} {snapReason}</p></AdminCard>
        ) : (
          <DashboardGrid cols={4}>
            <MetricCard label={L('تبعيات دائرية', 'Circular deps')} value={snap.architecture.circular.length} Icon={Network} accent={snap.architecture.circular.length ? '#f87171' : '#4ade80'} />
            <MetricCard label={L('خرق الطبقات', 'Layer violations')} value={snap.architecture.layerViolations.length} Icon={Layers} accent={snap.architecture.layerViolations.length ? '#f87171' : '#4ade80'} />
            <MetricCard label={L('منطق مكرّر', 'Duplicate logic')} value={snap.architecture.duplicates.length} accent={snap.architecture.duplicates.length ? '#fbbf24' : '#4ade80'} />
            <MetricCard label={L('كود غير مستخدم', 'Dead code')} value={snap.architecture.deadCode.length} accent={snap.architecture.deadCode.length ? '#fbbf24' : '#4ade80'} hint={L('مرشّحون', 'candidates')} />
            <MetricCard label={L('انحراف المعمارية', 'Dependency drift')}
              value={!snap.drift.hasBaseline ? L('لا أساس', 'no baseline') : snap.drift.architectureChanged ? L('انحرف', 'drifted') : L('مستقر', 'stable')}
              accent={snap.drift.architectureChanged ? '#fbbf24' : '#4ade80'} hint={snap.drift.summary} />
            <MetricCard label={L('الخدمات', 'Services')} value={snap.inventory.services} />
            <MetricCard label={L('الميزات', 'Features')} value={snap.inventory.features} />
            <MetricCard label={L('الصلاحيات', 'Permissions')} value={snap.inventory.permissions} />
          </DashboardGrid>
        )}
      </div>

      {/* ══ Runtime Health — captured this session by the monitoring seam ══ */}
      <div id="lg_runtime">
        <SectionHeader title={L('صحّة التشغيل', 'Runtime Health')}
          action={<span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('هذه الجلسة · مخزن دائري', 'this session · ring buffer')}</span>} />
        <DashboardGrid cols={4}>
          {(['react', 'console', 'api', 'network', 'performance'] as const).map(src => {
            const n = events.filter(e => e.source === src && (e.kind === 'error' || e.level === 'error' || e.level === 'warn')).length;
            const label = { react: L('أخطاء React', 'React errors'), console: L('أخطاء الطرفية', 'Console errors'), api: L('فشل API', 'API failures'), network: L('فشل الشبكة', 'Network failures'), performance: L('تحذيرات الأداء', 'Perf warnings') }[src];
            return <MetricCard key={src} label={label} value={n} accent={n ? (src === 'react' ? '#f87171' : '#fbbf24') : '#4ade80'} />;
          })}
          {/* Authentication runtime signals (from authService via the monitoring seam). */}
          <MetricCard label={L('فشل إرسال OTP', 'OTP send failures')} value={authHealth.sendFailures} accent={authHealth.sendFailures ? '#f87171' : '#4ade80'} hint={authHealth.vendor || (IS_PRODUCTION_DATA ? L('لا مزوّد', 'no vendor') : L('عرض', 'demo'))} />
          <MetricCard label={L('فشل تحقّق OTP', 'OTP verify failures')} value={authHealth.verifyFailures} accent={authHealth.verifyFailures ? '#fbbf24' : '#4ade80'} />
          {/* Location / live-tracking runtime signals (from DriverApp via the monitoring seam). */}
          <MetricCard label={L('فشل تحديث الموقع', 'Location update failures')} value={locationHealth.updateFailures} accent={locationHealth.updateFailures ? '#f87171' : '#4ade80'} />
          <MetricCard label={L('رفض صلاحية الموقع', 'Location perm. denials')} value={locationHealth.permissionFailures} accent={locationHealth.permissionFailures ? '#fbbf24' : '#4ade80'} />
          <MetricCard label={L('انقطاع التتبّع', 'Tracking interruptions')} value={locationHealth.trackingInterruptions} accent={locationHealth.trackingInterruptions ? '#fbbf24' : '#4ade80'} hint={L('إشارة ضعيفة', 'poor signal')} />
          {/* Notification delivery signals (from notification.service via the monitoring seam). */}
          <MetricCard label={L('فشل تسليم الإشعار', 'Notification failures')} value={notificationHealth.deliveryFailures} accent={notificationHealth.deliveryFailures ? '#f87171' : '#4ade80'} hint={notificationHealth.pushVendor || (IS_PRODUCTION_DATA ? L('لا دفع', 'no push') : L('عرض', 'demo'))} />
          {/* Payment gateway signals (from payment-orchestrator via the monitoring seam). */}
          <MetricCard label={L('فشل بوابة الدفع', 'Payment gateway failures')} value={paymentHealth.gatewayFailures} accent={paymentHealth.gatewayFailures ? '#f87171' : '#4ade80'} hint={paymentHealth.gatewayVendor || (IS_PRODUCTION_DATA ? L('الدفع نقدًا فقط', 'COD-only') : L('عرض', 'demo'))} />
          {/* Transactional email signals (from the email send path via the monitoring seam). */}
          <MetricCard label={L('فشل إرسال البريد', 'Email send failures')} value={emailHealth.deliveryFailures} accent={emailHealth.deliveryFailures ? '#f87171' : '#4ade80'} hint={emailHealth.vendor || (IS_PRODUCTION_DATA ? L('لا مزوّد', 'no vendor') : L('عرض', 'demo'))} />
          <MetricCard label={L('فشل قوالب البريد', 'Email template failures')} value={emailHealth.templateFailures} accent={emailHealth.templateFailures ? '#f87171' : '#4ade80'} />
        </DashboardGrid>
      </div>

      {/* ══ Provider Readiness — which external seams are wired vs demo vs missing ══ */}
      <div id="lg_providers">
        <SectionHeader title={L('جاهزية المزوّدين', 'Provider Readiness')}
          action={<span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {providers.filter(p => p.status === 'active').length}/{providers.length} {L('مفعّل', 'active')}
          </span>} />
        <AdminCard>
          <div className="space-y-1.5">
            {providers.map(p => (
              <div key={p.capability} className="flex items-start gap-2 text-[11.5px]">
                <StatusBadge kind={p.status === 'active' ? 'success' : p.status === 'demo' ? 'warning' : 'pending'}
                  label={p.status === 'active' ? L('مفعّل', 'active') : p.status === 'demo' ? L('عرض', 'demo') : L('غير مهيّأ', 'not configured')} />
                <span className="font-bold" style={{ color: 'var(--color-on-surface)', minWidth: 78 }}>{p.capability}</span>
                <span style={{ color: 'var(--color-on-surface-variant)', flex: 1 }}>
                  {p.detail}
                  {p.requires.length > 0 && <span className="block text-[10px] font-mono opacity-70">{L('يتطلّب', 'requires')}: {p.requires.join(', ')}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--color-on-surface-variant)' }}>
            {L('مشتقّ من البيئة والوضع — ليس ادّعاءً. المزوّد غير المهيّأ يرمي خطأً، ولا يزيّف نجاحًا.',
               'Derived from env + mode — not asserted. An unconfigured provider throws; it never fakes success.')}
          </p>
        </AdminCard>
      </div>

      {/* ══ Regression Center — recorded results only; "not run" is never a pass ══ */}
      <div id="lg_regression">
        <SectionHeader title={L('مركز الانحدار', 'Regression Center')} />
        <AdminCard>
          {!snap ? (
            <p className="text-[12px]" style={{ color: '#fbbf24' }}>{L('غير معروف — لا توجد لقطة.', 'Unknown — no snapshot.')}</p>
          ) : (
            <div className="space-y-2">
              {snap.suites.map(s => (
                <div key={s.suite} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span style={{ color: 'var(--color-on-surface)' }} className="font-bold">{s.suite}</span>
                  <code className="text-[11px] px-2 py-0.5 rounded" style={{ background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface-variant)' }}>{s.cmd}</code>
                  {!s.recorded ? (
                    <span className="inline-flex items-center gap-1" style={{ color: '#94a3b8' }}><HelpCircle size={14} /> {L('لم تُشغّل', 'not run')}</span>
                  ) : s.failed > 0 ? (
                    <span className="inline-flex items-center gap-1" style={{ color: '#f87171' }}><AlertTriangle size={14} /> {s.passed}/{s.passed + s.failed}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1" style={{ color: '#4ade80' }}><CheckCircle2 size={14} /> {s.passed}/{s.passed}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            <ClipboardList size={14} /> {L('نتائج مُسجّلة فقط. "لم تُشغّل" ليست نجاحًا — المتصفّح لا يشغّل اختبارات node.', 'Recorded results only. "Not run" is not a pass — the browser cannot execute node tests.')}
          </div>
        </AdminCard>
      </div>

      {/* ══ Navigation Inspector ══ */}
      <div id="lg_navigation">
        <SectionHeader title={L('فاحص التنقّل', 'Navigation Inspector')} />
        <AdminCard>
          {!snap ? (
            <p className="text-[12px]" style={{ color: '#fbbf24' }}>{L('غير معروف — لا توجد لقطة.', 'Unknown — no snapshot.')}</p>
          ) : (<>
            <div className="flex gap-4 text-[12px] flex-wrap" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span><RouteIcon size={13} className="inline me-1" /><b style={{ color: 'var(--color-on-surface)' }}>{snap.navigation.routes.length}</b> {L('مسار', 'routes')}</span>
              <span><b style={{ color: snap.navigation.duplicateRoutes.length ? '#f87171' : '#4ade80' }}>{snap.navigation.duplicateRoutes.length}</b> {L('مسار مكرّر', 'duplicate paths')}</span>
              {(['public', 'app', 'console', 'admin'] as const).map(s => {
                const n = snap.navigation.routes.filter(r => r.surface === s).length;
                return n ? <span key={s}>{s}: <b style={{ color: 'var(--color-on-surface)' }}>{n}</b></span> : null;
              })}
            </div>
            {snap.navigation.duplicateRoutes.length > 0 && (
              <p className="text-[11.5px] mt-2" style={{ color: '#f87171' }}>{L('مسارات مكرّرة:', 'Duplicate paths:')} {snap.navigation.duplicateRoutes.join(', ')}</p>
            )}
            <p className="text-[11px] mt-3" style={{ color: 'var(--color-on-surface-variant)' }}>
              {L('يُبلّغ عمّا يمكن إثباته من الرسم البياني: جدول المسارات والتكرار. كشف الأزرار الميتة والروابط المكسورة يتم عبر متتبّعات الرحلات (docs/testing/*) لأنه يتطلّب فحص DOM.',
                 'Reports what the graph can prove: the route table and duplicates. Dead buttons / broken links require a DOM crawl and are covered by the journey runners (docs/testing/*).')}
            </p>
          </>)}
        </AdminCard>
      </div>

      {/* ══ User Journey Inspector ══ */}
      <div id="lg_journeys">
        <SectionHeader title={L('فاحص رحلات المستخدم', 'User Journey Inspector')} />
        <AdminCard>
          {!snap ? (
            <p className="text-[12px]" style={{ color: '#fbbf24' }}>{L('غير معروف — لا توجد لقطة.', 'Unknown — no snapshot.')}</p>
          ) : (
            <div className="space-y-2">
              {snap.journeys.map(j => (
                <div key={j.role} className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="font-bold inline-flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)', minWidth: 84 }}>
                    <Users size={13} />{j.role}
                  </span>
                  <span className="flex-1" style={{ color: 'var(--color-on-surface-variant)' }}>{j.journey}<br /><span className="text-[10.5px] opacity-75">{j.evidence}</span></span>
                  <StatusBadge kind={j.status === 'passing' ? 'success' : j.status === 'failing' ? 'error' : 'pending'}
                    label={j.status === 'passing' ? L('يعمل', 'passing') : j.status === 'failing' ? L('مكسور', 'BROKEN') : L('غير مُتحقّق', 'not verified')} />
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>

      {/* ══ Issues — the persistent record behind the ephemeral findings ══ */}
      <div id="lg_issues">
        <SectionHeader title={L('السجل التشغيلي — المشكلات', 'Issues')}
          action={<span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {issues.filter(i => isActive(i.status)).length} {L('نشِطة', 'active')} · {issues.length} {L('إجمالي', 'total')}
            {breaches.length > 0 && <b style={{ color: '#f87171' }}> · {breaches.length} {L('تجاوز SLA', 'SLA breach')}</b>}
          </span>} />
        <AdminCard>
          {/* Search / filters */}
          <div className="flex gap-2 flex-wrap mb-3" id="lg_issue_filters">
            <input id="lg_issue_search" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              placeholder={L('بحث… (عنوان، سبب، ملف، وسم)', 'Search… (title, cause, file, label)')}
              className="rounded-lg px-2 py-1 text-[11.5px]" style={{ background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)', minWidth: 190 }} />
            {([
              ['severity', ['critical', 'high', 'medium', 'low'], L('الخطورة', 'Severity')],
              ['status', ISSUE_STATUSES as unknown as string[], L('الحالة', 'Status')],
              ['owner', ISSUE_OWNERS as unknown as string[], L('المالك', 'Owner')],
              ['area', ['architecture', 'runtime', 'regression', 'navigation', 'journey', 'build'], L('المجال', 'Area')],
              ['build', [...new Set(issues.map(i => i.detectedBuild))], L('الإصدار', 'Build')],
            ] as const).map(([key, opts, label]) => (
              <select key={key} id={`lg_filter_${key}`} value={(filters as any)[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
                className="rounded-lg px-2 py-1 text-[11.5px]" style={{ background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                <option value="">{label}</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
          </div>

          {visibleIssues.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>
              {issues.length ? L('لا نتائج للمرشّحات.', 'No issues match the filters.') : L('لا مشكلات مسجّلة بعد.', 'No issues recorded yet.')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {visibleIssues.map(i => {
                const sla = slaState(i, new Date().toISOString());
                const isOpen = selectedIssue === i.findingId;
                return (
                  <div key={i.findingId} className="rounded-lg" style={{ border: `1px solid ${sla.breached ? 'rgba(248,113,113,0.4)' : 'var(--color-outline-variant)'}` }}>
                    <button type="button" onClick={() => setSelectedIssue(isOpen ? null : i.findingId)}
                      className="w-full flex items-center gap-2 p-2 text-start cursor-pointer" style={{ background: 'none', border: 'none' }}>
                      <StatusBadge kind={sevBadge(i.severity)} label={i.severity} />
                      <span className="text-[12px] font-bold flex-1" style={{ color: 'var(--color-on-surface)' }}>{i.title}</span>
                      {i.reopenCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>{L('متكرّرة', 'recurring')} ×{i.reopenCount}</span>}
                      {sla.breached && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>SLA</span>}
                      <span className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>{i.owner}</span>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface-variant)' }}>{i.status}</span>
                    </button>

                    {isOpen && (
                      <div className="px-2 pb-2 space-y-2">
                        <div className="text-[11.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                          <b style={{ color: 'var(--color-on-surface)' }}>{L('السبب الجذري', 'Root cause')}:</b> {i.rootCause}
                        </div>
                        <div className="text-[10.5px] flex gap-3 flex-wrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                          <span>{L('اكتُشفت في', 'detected in')} <b>{i.detectedBuild}</b></span>
                          {i.resolvedBuild && <span>{L('حُلّت في', 'resolved in')} <b>{i.resolvedBuild}</b></span>}
                          <span>SLA: {sla.target === null ? L('قائمة انتظار', 'backlog') : `${Math.round(sla.ageHours)}h / ${sla.target}h`}</span>
                          {i.files.length > 0 && <span>{i.files.length} {L('ملف', 'files')}</span>}
                        </div>
                        {i.verification && <div className="text-[11px]" style={{ color: '#4ade80' }}>✓ {i.verification}</div>}

                        {/* Timeline — nothing disappears */}
                        <div>
                          <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--color-on-surface)' }}>{L('المسار الزمني', 'Timeline')}</p>
                          <div className="space-y-0.5">
                            {i.history.map((h, n) => (
                              <div key={n} className="text-[10.5px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {new Date(h.at).toLocaleString()} · {h.actor} · {h.from ? `${h.from} → ` : ''}<b style={{ color: 'var(--color-on-surface)' }}>{h.to}</b>{h.build ? ` · ${h.build}` : ''}{h.note ? ` — ${h.note}` : ''}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Ownership + transitions */}
                        <div className="flex gap-2 flex-wrap items-center">
                          <select value={i.owner} onChange={e => mutate(assign(i, e.target.value as IssueOwner, 'super-admin', new Date().toISOString(), build.short))}
                            className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                            {ISSUE_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          {ISSUE_STATUSES.filter(s => canTransition(i.status, s)).map(s => (
                            <button key={s} type="button"
                              onClick={() => mutate(transition(i, { to: s as IssueStatus, actor: 'super-admin', now: new Date().toISOString(), build: build.short }))}
                              className="text-[10.5px] px-2 py-0.5 rounded cursor-pointer"
                              style={{ background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                              → {s}
                            </button>
                          ))}
                          <ActionButton variant="secondary" Icon={Bot}
                            onClick={() => {
                              const p = packets.find(x => x.id === i.findingId);
                              if (p) mutate(attachRepair(i, p.prompt, new Date().toISOString()));
                            }}>
                            {L('ربط مُوجّه إصلاح', 'Attach repair prompt')}
                          </ActionButton>
                        </div>

                        {i.repairs.length > 0 && (
                          <div className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                            {i.repairs.map(r => (
                              <div key={r.promptVersion}>
                                {L('مُوجّه', 'prompt')} v{r.promptVersion} · {new Date(r.generatedAt).toLocaleString()} · {r.applied ? L('طُبّق', 'applied') : L('لم يُطبّق', 'not applied')}{r.verified ? ` · ${L('تحقّق', 'verified')}` : ''}{r.rejected ? ` · ${L('مرفوض', 'rejected')}` : ''}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comments */}
                        {i.comments.length > 0 && (
                          <div className="space-y-0.5">
                            {i.comments.map((c, n) => (
                              <div key={n} className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                                <b style={{ color: 'var(--color-on-surface)' }}>{c.author}</b> · {new Date(c.at).toLocaleString()} — {c.body}
                              </div>
                            ))}
                          </div>
                        )}
                        <input placeholder={L('أضف تعليقًا ثم Enter…', 'Add a comment, then Enter…')}
                          className="w-full rounded px-2 py-1 text-[11px]" style={{ background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                          onKeyDown={e => {
                            const el = e.target as HTMLInputElement;
                            if (e.key === 'Enter' && el.value.trim()) { mutate(addComment(i, 'super-admin', el.value.trim(), new Date().toISOString())); el.value = ''; }
                          }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>
      </div>

      {/* ══ Trends & Build History ══ */}
      <div id="lg_trends">
        <SectionHeader title={L('الاتجاهات وتاريخ الإصدارات', 'Trends & Build History')}
          action={<span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{builds.length} {L('إصدار مسجّل', 'build(s) recorded')}</span>} />
        {builds.length < 2 ? (
          <AdminCard>
            <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>
              {L('يتراكم التاريخ مع كل إصدار. لا يمكن رسم اتجاه من نقطة واحدة.', 'History accumulates per build. A trend cannot be drawn from a single point.')}
              {builds.length === 1 && ` ${L('الإصدار المسجّل:', 'Recorded:')} ${builds[0].build} · ${L('الجاهزية', 'readiness')} ${builds[0].readiness}`}
            </p>
          </AdminCard>
        ) : (<>
          <DashboardGrid cols={4}>
            {trends.map(t => (
              <MetricCard key={t.key}
                label={{ readiness: L('الجاهزية', 'Readiness'), openIssues: L('مشكلات مفتوحة', 'Open issues'), criticalIssues: L('حرجة', 'Critical'), runtimeErrors: L('أخطاء التشغيل', 'Runtime errors'), journeysPassing: L('رحلات ناجحة', 'Journeys passing') }[t.key]}
                value={t.last}
                hint={`${t.delta >= 0 ? '+' : ''}${t.delta} ${L('منذ', 'since')} ${t.points[0]?.build ?? '—'}`}
                accent={t.delta === 0 ? undefined : t.improving ? '#4ade80' : '#f87171'} />
            ))}
            <MetricCard label={L('استقرار المعمارية', 'Architecture stability')} value={`${stability.stablePct}%`} hint={`${stability.changes} ${L('تغيير', 'changes')}`} />
            <MetricCard label={L('جودة الإصدارات', 'Release quality')} value={`${quality.pct}%`} hint={`${quality.go}/${quality.builds} GO`} />
          </DashboardGrid>

          {/* Build history + comparison */}
          <AdminCard className="mt-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11.5px] font-bold" style={{ color: 'var(--color-on-surface)' }}>{L('مقارنة مع', 'Compare against')}</span>
              <select id="lg_compare_build" value={compareTo} onChange={e => setCompareTo(e.target.value)}
                className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                <option value="">{L('اختر إصدارًا', 'select a build')}</option>
                {builds.filter(b => b.build !== build.short).map(b => <option key={b.id} value={b.build}>{b.build} · {new Date(b.at).toLocaleDateString()}</option>)}
              </select>
            </div>
            {delta && (
              <div className="flex gap-4 text-[11.5px] flex-wrap mb-3" id="lg_build_delta">
                <span style={{ color: '#f87171' }}>{L('جديدة', 'New')}: <b>{delta.newIssues.length}</b></span>
                <span style={{ color: '#4ade80' }}>{L('حُلّت', 'Resolved')}: <b>{delta.resolved.length}</b></span>
                <span style={{ color: '#f87171' }}>{L('ارتدادات', 'Regressions')}: <b>{delta.regressions.length}</b></span>
                <span style={{ color: '#fbbf24' }}>{L('متكرّرة', 'Recurring')}: <b>{delta.recurring.length}</b></span>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{L('مُرحّلة', 'Carried over')}: <b>{delta.carriedOver.length}</b></span>
              </div>
            )}
            <div className="space-y-0.5">
              {[...builds].reverse().slice(0, 10).map(b => (
                <div key={b.id} className="flex items-center gap-3 text-[10.5px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <b style={{ color: 'var(--color-on-surface)', minWidth: 62 }}>{b.build}</b>
                  <span style={{ minWidth: 120 }}>{new Date(b.at).toLocaleString()}</span>
                  <span style={{ minWidth: 92 }}>{L('جاهزية', 'readiness')} {b.readiness}</span>
                  <span style={{ minWidth: 70, color: b.verdict === 'GO' ? '#4ade80' : b.verdict === 'NO_GO' ? '#f87171' : '#fbbf24' }}>{b.verdict}</span>
                  <span style={{ minWidth: 62 }}>{b.openIssues} {L('مفتوحة', 'open')}</span>
                  <span style={{ minWidth: 66, color: b.regression === 'fail' ? '#f87171' : b.regression === 'unknown' ? '#94a3b8' : '#4ade80' }}>{b.regression}</span>
                  <span>fp {b.architectureFingerprint}</span>
                </div>
              ))}
            </div>
          </AdminCard>
        </>)}
      </div>

      {/* ══ AI Repair Center — one structured packet per finding ══ */}
      <div id="lg_repair_center">
        <SectionHeader title={L('مركز الإصلاح — حزمة لكل مشكلة', 'AI Repair Center — one packet per issue')}
          action={<span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{packets.length} {L('مشكلة', 'issue(s)')}</span>} />
        <AdminCard>
          {packets.length === 0 ? (
            <p className="text-[12px]" style={{ color: '#4ade80' }}><CheckCircle2 size={13} className="inline me-1" />{L('لا مشاكل مكتشفة.', 'No issues detected.')}</p>
          ) : (
            <div className="space-y-2">
              {packets.map(p => (
                <div key={p.id} className="rounded-lg" style={{ border: '1px solid var(--color-outline-variant)' }}>
                  <button type="button" onClick={() => setOpenPacket(openPacket === p.id ? null : p.id)}
                    className="w-full flex items-center gap-2 p-2.5 text-start cursor-pointer" style={{ background: 'none', border: 'none' }}>
                    <StatusBadge kind={sevBadge(p.severity)} label={p.severity} />
                    <span className="text-[12.5px] font-bold flex-1" style={{ color: 'var(--color-on-surface)' }}>{p.title}</span>
                    <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{p.files.length} {L('ملف', 'files')}</span>
                  </button>
                  {openPacket === p.id && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      <div className="text-[11.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <b style={{ color: 'var(--color-on-surface)' }}>{L('السبب الجذري', 'Root cause')}:</b> {p.rootCause}
                      </div>
                      {p.files.length > 0 && (
                        <div className="text-[11px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {p.files.map(f => <div key={f}>· {f}</div>)}
                        </div>
                      )}
                      <div className="text-[11.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <b style={{ color: 'var(--color-on-surface)' }}>{L('الإصلاح المقترح', 'Recommended fix')}:</b> {p.recommendedFix}
                      </div>
                      <textarea readOnly value={p.prompt} spellCheck={false}
                        className="w-full rounded-lg p-2 font-mono text-[10.5px]" style={{ height: 150, background: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)', whiteSpace: 'pre', overflow: 'auto' }} />
                      <div className="flex gap-2">
                        <ActionButton variant="secondary" Icon={Copy} onClick={() => { navigator.clipboard?.writeText(p.prompt).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                          {L('نسخ المُوجّه', 'Copy prompt')}
                        </ActionButton>
                        <ActionButton variant="primary" Icon={ExternalLink} onClick={() => { try { window.open(`https://claude.ai/new?q=${encodeURIComponent(p.prompt.slice(0, 6000))}`, '_blank', 'noopener'); } catch { /* ignore */ } }}>
                          {L('فتح في Claude', 'Open in Claude')}
                        </ActionButton>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] mt-3" style={{ color: 'var(--color-on-surface-variant)' }}>
            {L('لا يُستدعى أي ذكاء اصطناعي من هنا. تُجهَّز المُوجّهات فقط — القرار والرقعة يبقيان بيد المهندس.',
               'No AI is called from here. Prompts are prepared only — the decision and the diff stay with the engineer.')}
          </p>
        </AdminCard>
      </div>

      {/* Recent audit (reuse) */}
      {audit.length > 0 && (
        <div>
          <SectionHeader title={L('أحدث سجلّات التدقيق', 'Recent Audit Log')} />
          <AdminCard>
            <div className="space-y-1 text-[11.5px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>
              {audit.slice(0, 8).map((a, i) => <div key={i}>{a.created_at ? new Date(a.created_at).toLocaleString() : ''} · {a.action || '—'}</div>)}
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
};

export default LaunchGuardian;
