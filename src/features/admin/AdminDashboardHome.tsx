import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  Receipt, Wallet, UserRound, Store, AlertTriangle, Timer, TrendingUp, TrendingDown,
  Map, Truck, Banknote, Target, Headset, ShieldCheck, TicketPercent, Palette, ArrowRight, LucideIcon,
} from 'lucide-react';
import type { NavKey } from './AdminSidebar';

const spark = (seed: number) => Array.from({ length: 12 }, (_, i) => ({ v: Math.max(2, Math.round(seed * (0.5 + 0.5 * Math.sin(i / 2 + seed)) + (i % 3) * (seed / 8) + 4)) }));

const KpiWidget: React.FC<{ label: string; value: React.ReactNode; delta: number; Icon: LucideIcon; accent: string; seed: number }> = ({ label, value, delta, Icon, accent, seed }) => {
  const up = delta >= 0;
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' }}>
      <div className="flex items-start justify-between">
        <div className="z-10">
          <div className="flex items-center gap-1.5"><Icon size={15} color={accent} /><p className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p></div>
          <p className="text-2xl font-extrabold mt-1.5" style={{ color: 'var(--color-on-surface)' }}>{value}</p>
          <div className="flex items-center gap-1 mt-1">
            {up ? <TrendingUp size={12} color="#4ade80" /> : <TrendingDown size={12} color="#f87171" />}
            <span className="text-[11px] font-bold" style={{ color: up ? '#4ade80' : '#f87171' }}>{up ? '+' : ''}{delta}%</span>
            <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>vs yesterday</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-10 opacity-70">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark(seed)} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs><linearGradient id={`g${seed}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity={0.5} /><stop offset="100%" stopColor={accent} stopOpacity={0} /></linearGradient></defs>
            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.5} fill={`url(#g${seed})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const ModuleCard: React.FC<{ title: string; desc: string; Icon: LucideIcon; counter: string; status: string; statusColor: string; onClick: () => void }> = ({ title, desc, Icon, counter, status, statusColor, onClick }) => (
  <button onClick={onClick}
    className="text-start rounded-2xl p-4 cursor-pointer transition-all group hover:-translate-y-0.5"
    style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-fixed)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}>
    <div className="flex items-start justify-between">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-container-high)' }}><Icon size={20} color="var(--color-primary-fixed)" /></span>
      <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary-fixed)' }} />
    </div>
    <p className="font-bold mt-3" style={{ color: 'var(--color-on-surface)' }}>{title}</p>
    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{desc}</p>
    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
      <span className="text-lg font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{counter}</span>
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ background: `${statusColor}22`, color: statusColor }}>{status}</span>
    </div>
  </button>
);

export const AdminDashboardHome: React.FC<{
  lang: 'ar' | 'en'; cur: string;
  analytics: { totalOrders: number; totalMerchants: number; totalDrivers: number };
  platform: { revenue: number; delivered: number; cancelled: number; avgOrder: number; activeOrders: number };
  supportOpen: number; onNavigate: (k: NavKey) => void;
}> = ({ lang, cur, analytics, platform, supportOpen, onNavigate }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const kpis = [
    { label: L('طلبات اليوم', "Today's Orders"), value: analytics.totalOrders, delta: 12, Icon: Receipt, accent: '#9ed442', seed: Math.max(2, analytics.totalOrders) },
    { label: L('الإيرادات', 'Revenue'), value: `${platform.revenue} ${cur}`, delta: 8, Icon: Wallet, accent: '#4ade80', seed: Math.max(3, platform.revenue / 10) },
    { label: L('سائقون نشطون', 'Active Drivers'), value: analytics.totalDrivers, delta: 5, Icon: UserRound, accent: '#60a5fa', seed: Math.max(2, analytics.totalDrivers) },
    { label: L('متاجر متصلة', 'Online Merchants'), value: analytics.totalMerchants, delta: 3, Icon: Store, accent: '#fbbf24', seed: Math.max(2, analytics.totalMerchants) },
    { label: L('قضايا معلّقة', 'Pending Issues'), value: supportOpen, delta: -4, Icon: AlertTriangle, accent: '#f87171', seed: Math.max(2, supportOpen) },
    { label: L('متوسط زمن الحل', 'Support SLA'), value: '2.4h', delta: -9, Icon: Timer, accent: '#a78bfa', seed: 6 },
  ];
  const modules: { t: string; d: string; Icon: LucideIcon; counter: string; status: string; sc: string; key: NavKey }[] = [
    { t: L('غرفة العمليات', 'Operations'), d: L('الخريطة الحيّة والإرسال', 'Live map & dispatch'), Icon: Map, counter: `${platform.activeOrders}`, status: L('مباشر', 'Live'), sc: '#4ade80', key: 'ops:command' },
    { t: L('الأسطول', 'Fleet'), d: L('المندوبون والمركبات', 'Drivers & vehicles'), Icon: Truck, counter: `${analytics.totalDrivers}`, status: L('نشط', 'Active'), sc: '#60a5fa', key: 'ops:performance' },
    { t: L('المركز المالي', 'Finance'), d: L('الإيرادات والتسويات', 'Revenue & settlements'), Icon: Banknote, counter: `${platform.revenue}`, status: cur, sc: '#9ed442', key: 'ops:finance' },
    { t: L('التسويق', 'Marketing'), d: L('الكوبونات والولاء والحملات', 'Coupons, loyalty, campaigns'), Icon: Target, counter: '—', status: L('نمو', 'Growth'), sc: '#fbbf24', key: 'ops:growthb' },
    { t: L('رعاية العملاء', 'Customer Care'), d: L('التذاكر وSLA', 'Tickets & SLA'), Icon: Headset, counter: `${supportOpen}`, status: supportOpen > 0 ? L('مفتوح', 'Open') : L('هادئ', 'Clear'), sc: supportOpen > 0 ? '#f87171' : '#4ade80', key: 'ops:care' },
    { t: L('التحقق والامتثال', 'Compliance'), d: L('مراجعة KYC والحظر', 'KYC & risk'), Icon: ShieldCheck, counter: '—', status: L('آمن', 'Secure'), sc: '#a78bfa', key: 'ops:kyc' },
    { t: L('الكوبونات', 'Coupons'), d: L('إدارة العروض', 'Promo management'), Icon: TicketPercent, counter: '—', status: L('تجارة', 'Commerce'), sc: '#9ed442', key: 'coupons' },
    { t: L('مركز التصميم', 'Design'), d: L('الهوية والتجربة', 'Branding & experience'), Icon: Palette, counter: '—', status: L('منصّة', 'Platform'), sc: '#60a5fa', key: 'design' },
  ];

  return (
    <div className="space-y-6">
      {/* live status banner */}
      <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#9ed442', boxShadow: '0 0 10px rgba(158,212,66,0.7)' }} />
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('المنصة تعمل بكامل طاقتها', 'Platform operational')}</p>
            <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('جميع الأنظمة متصلة', 'All systems connected')}</p>
          </div>
        </div>
        <h1 className="text-lg font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{L('لوحة المعلومات التنفيذية', 'Executive Dashboard')}</h1>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => <KpiWidget key={k.label} {...k} />)}
      </div>

      {/* Module workspace cards */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>{L('وحدات المنصّة', 'Platform Modules')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {modules.map(m => <ModuleCard key={m.t} title={m.t} desc={m.d} Icon={m.Icon} counter={m.counter} status={m.status} statusColor={m.sc} onClick={() => onNavigate(m.key)} />)}
        </div>
      </div>
    </div>
  );
};
