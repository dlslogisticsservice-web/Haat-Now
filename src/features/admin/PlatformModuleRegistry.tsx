import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes, ExternalLink, FileText, GitBranch, Flag, KeyRound, Layers3,
  CheckCircle2, AlertTriangle, Circle, Search as SearchIcon,
} from 'lucide-react';
import { MetricCard, WorkspaceHeader, EmptyStateBox } from '../../components/admin/EnterpriseUI';
import {
  PLATFORM_MODULES, MODULE_GROUPS, dependentsOf, moduleById, registrySummary,
  docUrl, sourceUrl, type PlatformModule, type ModuleGroup, type ModuleHealth, type ModuleStatus,
} from '../../platform/moduleRegistry';
import { platformService } from '../../platform/platform.service';
import { rbacService } from '../../services/rbac.service';
import type { FlagState } from '../../platform/platformModel';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 16 };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 });

const HEALTH_COLOR: Record<ModuleHealth, string> = { operational: '#4ade80', degraded: '#fbbf24', planned: '#60a5fa', unknown: '#9ca3af' };
const STATUS_COLOR: Record<ModuleStatus, string> = { stable: '#4ade80', beta: '#60a5fa', experimental: '#fbbf24', legacy: '#9ca3af', planned: '#a78bfa' };
const FLAG_COLOR: Record<FlagState, string> = { enabled: '#4ade80', beta: '#60a5fa', experimental: '#fbbf24', disabled: '#9ca3af' };

export const PlatformModuleRegistry: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const rtl = lang === 'ar';

  // Live metadata (reused, not duplicated): flag STATE from platform.service, permission LABELS from rbac.service.
  const [flagState, setFlagState] = useState<Record<string, FlagState>>({});
  const [permLabel, setPermLabel] = useState<Record<string, string>>({});
  useEffect(() => {
    try { setFlagState(Object.fromEntries(platformService.flags().map(f => [f.key, f.state]))); } catch { /* keep empty */ }
    try { setPermLabel(Object.fromEntries(rbacService.permissions().map(p => [p.key, lang === 'ar' ? p.ar : p.en]))); } catch { /* keep empty */ }
  }, [lang]);

  const [q, setQ] = useState('');
  const [group, setGroup] = useState<ModuleGroup | 'all'>('all');
  const [status, setStatus] = useState<ModuleStatus | 'all'>('all');
  const [prod, setProd] = useState<'all' | 'ready' | 'not'>('all');
  const [focus, setFocus] = useState<string | null>(null);   // dependency-graph focus (id)

  const summary = registrySummary();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return PLATFORM_MODULES.filter(m => {
      if (group !== 'all' && m.group !== group) return false;
      if (status !== 'all' && m.status !== status) return false;
      if (prod === 'ready' && !m.productionReady) return false;
      if (prod === 'not' && m.productionReady) return false;
      if (focus && !(m.id === focus || m.dependencies.includes(focus) || dependentsOf(focus).includes(m.id))) return false;
      if (term) {
        const hay = `${m.name} ${m.description} ${m.owner} ${m.id} ${m.relatedServices.join(' ')}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [q, group, status, prod, focus]);

  const grouped = useMemo(() => {
    const by: Record<string, PlatformModule[]> = {};
    for (const m of filtered) (by[m.group] ||= []).push(m);
    return MODULE_GROUPS.filter(g => by[g]?.length).map(g => ({ group: g, modules: by[g] }));
  }, [filtered]);

  const seg = (active: boolean): React.CSSProperties => ({
    ...card, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: active ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)',
    color: active ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)', border: 'none',
  });

  const focusModule = focus ? moduleById(focus) : null;

  return (
    <div id="platform_module_registry" dir={rtl ? 'rtl' : 'ltr'} className="space-y-4">
      <WorkspaceHeader Icon={Boxes} title={L('سجل المنصّة', 'Platform Registry')}
        subtitle={L('كل وحدات المنصّة: المالك، التبعيات، الحالة، الجاهزية، الأعلام والصلاحيات', 'Every platform module: owner, dependencies, status, readiness, flags & permissions')} />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label={L('إجمالي الوحدات', 'Total modules')} value={summary.total} Icon={Layers3} />
        <MetricCard label={L('جاهزة للإنتاج', 'Production ready')} value={summary.productionReady} Icon={CheckCircle2} accent="#4ade80" />
        <MetricCard label={L('تعمل', 'Operational')} value={summary.operational} Icon={Circle} accent="#4ade80" />
        <MetricCard label={L('منخفضة', 'Degraded')} value={summary.degraded} Icon={AlertTriangle} accent={summary.degraded ? '#fbbf24' : undefined} />
        <MetricCard label={L('مخطّطة', 'Planned')} value={summary.planned} Icon={Circle} accent="#60a5fa" />
      </div>

      {/* Search */}
      <div style={card} className="flex items-center gap-2 px-3 py-2">
        <SearchIcon size={16} color="var(--color-on-surface-variant)" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={L('ابحث بالاسم أو المالك أو الخدمة…', 'Search name, owner, service…')}
          className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--color-on-surface)' }} id="registry_search" />
        {q && <button onClick={() => setQ('')} className="text-xs cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}>{L('مسح', 'Clear')}</button>}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold me-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('المجموعة', 'Group')}</span>
          <button style={seg(group === 'all')} onClick={() => setGroup('all')}>{L('الكل', 'All')}</button>
          {MODULE_GROUPS.map(g => <button key={g} style={seg(group === g)} onClick={() => setGroup(g)}>{g}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold me-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الحالة', 'Status')}</span>
          {(['all', 'stable', 'beta', 'experimental', 'planned'] as const).map(s =>
            <button key={s} style={seg(status === s)} onClick={() => setStatus(s)}>{s === 'all' ? L('الكل', 'All') : s}</button>)}
          <span className="w-px h-4 mx-1" style={{ background: 'var(--color-outline-variant)' }} />
          {(['all', 'ready', 'not'] as const).map(p =>
            <button key={p} style={seg(prod === p)} onClick={() => setProd(p)}>{p === 'all' ? L('كل الجاهزية', 'Any readiness') : p === 'ready' ? L('جاهزة', 'Ready') : L('غير جاهزة', 'Not ready')}</button>)}
        </div>
        {focusModule && (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            <GitBranch size={13} />
            <span>{L('التركيز على التبعيات لـ', 'Dependency focus on')} <b style={{ color: 'var(--color-on-surface)' }}>{focusModule.name}</b> {L('(الوحدة + تبعياتها + معتمِدوها)', '(module + its dependencies + dependents)')}</span>
            <button style={seg(false)} onClick={() => setFocus(null)}>{L('إلغاء التركيز', 'Clear focus')}</button>
          </div>
        )}
      </div>

      {/* Grouped modules */}
      {grouped.length === 0
        ? <EmptyStateBox Icon={Boxes} title={L('لا توجد وحدات مطابقة', 'No matching modules')} description={L('عدّل البحث أو المرشّحات.', 'Adjust your search or filters.')} />
        : grouped.map(({ group: g, modules }) => (
          <div key={g} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide pt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{g} · {modules.length}</p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {modules.map(m => {
                const dependents = dependentsOf(m.id);
                return (
                  <div key={m.id} id={`mod_${m.id}`} style={{ ...card, outline: focus === m.id ? '2px solid var(--color-primary-fixed)' : 'none' }} className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-2">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-container-high)' }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: HEALTH_COLOR[m.health] }} title={m.health} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-[15px]" style={{ color: 'var(--color-on-surface)' }}>{m.name}</p>
                          <span style={chip(`${STATUS_COLOR[m.status]}22`, STATUS_COLOR[m.status])}>{m.status}</span>
                          <span style={chip(m.productionReady ? 'rgba(74,222,128,0.14)' : 'rgba(251,191,36,0.14)', m.productionReady ? '#4ade80' : '#fbbf24')}>
                            {m.productionReady ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{m.productionReady ? L('جاهزة', 'Prod-ready') : L('غير جاهزة', 'Not ready')}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>v{m.version}</span>
                        </div>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{m.description}</p>
                      </div>
                    </div>

                    {/* Facts */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                      <Fact label={L('المالك', 'Owner')} value={m.owner} />
                      <Fact label={L('الصحّة', 'Health')} value={<span style={{ color: HEALTH_COLOR[m.health], fontWeight: 700 }}>{m.health}</span>} />
                      <Fact label={L('تغطية الاختبار', 'Test coverage')} value={m.testCoverage} />
                      <Fact label={L('نقطة الدخول', 'Entry point')} value={<code className="text-[11px]" style={{ color: 'var(--color-primary-fixed)' }}>{m.entryPoint}</code>} />
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                      <a href={docUrl(m)} target="_blank" rel="noreferrer" style={chip('var(--color-surface-container-high)', 'var(--color-on-surface)')} className="cursor-pointer"><FileText size={12} />{L('التوثيق', 'Documentation')}<ExternalLink size={10} /></a>
                      <a href={sourceUrl(m)} target="_blank" rel="noreferrer" style={chip('var(--color-surface-container-high)', 'var(--color-on-surface)')} className="cursor-pointer"><GitBranch size={12} />{L('المصدر', 'Source entry')}<ExternalLink size={10} /></a>
                    </div>

                    {/* Dependencies visualization */}
                    {(m.dependencies.length > 0 || dependents.length > 0) && (
                      <div className="space-y-1.5">
                        {m.dependencies.length > 0 && (
                          <ChipRow label={L('يعتمد على', 'Depends on')}>
                            {m.dependencies.map(d => {
                              const dm = moduleById(d);
                              return <button key={d} style={chip('rgba(96,165,250,0.14)', '#60a5fa')} className="cursor-pointer" onClick={() => setFocus(d)} title={L('ركّز على التبعيات', 'Focus dependencies')}>{dm?.name || d}</button>;
                            })}
                          </ChipRow>
                        )}
                        {dependents.length > 0 && (
                          <ChipRow label={L('يُستخدَم بواسطة', 'Used by')}>
                            {dependents.map(d => <button key={d} style={chip('rgba(163,249,91,0.12)', 'var(--color-primary-fixed)')} className="cursor-pointer" onClick={() => setFocus(d)}>{moduleById(d)?.name || d}</button>)}
                          </ChipRow>
                        )}
                      </div>
                    )}

                    {/* Related services */}
                    {m.relatedServices.length > 0 && (
                      <ChipRow label={L('الخدمات المرتبطة', 'Related services')}>
                        {m.relatedServices.map(s => <span key={s} style={chip('var(--color-surface-container-high)', 'var(--color-on-surface-variant)')}><code className="text-[11px]">{s}</code></span>)}
                      </ChipRow>
                    )}

                    {/* Feature flags (live state) */}
                    {m.featureFlagKeys.length > 0 && (
                      <ChipRow label={L('الأعلام', 'Feature flags')}>
                        {m.featureFlagKeys.map(k => {
                          const st = flagState[k];
                          const color = st ? FLAG_COLOR[st] : '#9ca3af';
                          return <span key={k} style={chip(`${color}22`, color)} title={st ? `state: ${st}` : L('غير معرّف', 'unknown')}><Flag size={11} />{k}{st ? ` · ${st}` : ''}</span>;
                        })}
                      </ChipRow>
                    )}

                    {/* Permissions (labels resolved from rbac.service) */}
                    {m.permissionKeys.length > 0 && (
                      <ChipRow label={L('الصلاحيات', 'Permissions')}>
                        {m.permissionKeys.map(k => <span key={k} style={chip('rgba(167,139,250,0.14)', '#a78bfa')} title={permLabel[k] || k}><KeyRound size={11} />{k}</span>)}
                      </ChipRow>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      <p className="text-[11px] pt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
        {L('المصدر: سجل الوحدات (وقت التشغيل) — حالة الأعلام من مركز التكاملات والصلاحيات من نظام RBAC، بلا تكرار.',
           'Source: runtime module registry — flag state from the Integration Center and permissions from RBAC, no duplication.')}
      </p>
    </div>
  );
};

const Fact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center gap-1.5 min-w-0">
    <span className="shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>{label}:</span>
    <span className="truncate" style={{ color: 'var(--color-on-surface)' }}>{value}</span>
  </div>
);

const ChipRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start gap-2 flex-wrap">
    <span className="text-[11px] font-bold shrink-0 pt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);
