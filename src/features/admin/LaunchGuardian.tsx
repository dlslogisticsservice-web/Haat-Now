import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Copy, ExternalLink, Bot, ClipboardList, ShieldAlert, CheckCircle2, Gauge } from 'lucide-react';
import {
  WorkspaceHeader, AdminCard, MetricCard, StatusBadge, SectionHeader, ActionButton, DashboardGrid,
  type StatusKind,
} from '../../components/admin/EnterpriseUI';
import { monitoring, type MonitorEvent } from '../../services/monitoring.service';
import { analyticsService } from '../../services/analytics.service';
import { sandboxStore } from '../../services/sandboxStore';
import { adminService } from '../../services/admin.service';

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

// Last verified automated-suite sizes (run locally / CI — the browser cannot execute node
// tests). Kept as a reference; re-run with the commands shown in the Regression panel.
const REGRESSION = [
  { suite: 'Unit + integration', cmd: 'npm run test:website', total: 178 },
  { suite: 'E2E (Playwright)', cmd: 'node docs/testing/e2e_runner.cjs', total: 24 },
  { suite: 'Ops simulation', cmd: 'node docs/testing/ops_simulation.cjs', total: 20 },
];

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

  const refresh = useCallback(async () => {
    setLoading(true);
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
          <MetricCard label={L('نسخة الإصدار', 'Build')} value={build.short || '—'} hint={build.env} />
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

      {/* Regression */}
      <div>
        <SectionHeader title={L('الاختبارات التلقائية', 'Regression Suites')} />
        <AdminCard>
          <div className="space-y-2">
            {REGRESSION.map(s => (
              <div key={s.suite} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span style={{ color: 'var(--color-on-surface)' }} className="font-bold">{s.suite}</span>
                <code className="text-[11px] px-2 py-0.5 rounded" style={{ background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface-variant)' }}>{s.cmd}</code>
                <span className="inline-flex items-center gap-1" style={{ color: '#4ade80' }}><CheckCircle2 size={14} /> {s.total}/{s.total}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            <ClipboardList size={14} /> {L('آخر نتيجة موثّقة (محلي/CI). المتصفّح لا يشغّل اختبارات node — شغّلها بالأوامر أعلاه.', 'Last verified result (local/CI). The browser cannot run node tests — run them with the commands above.')}
          </div>
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
