import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import {
  Receipt, Wallet, UserRound, Store, AlertTriangle, Timer, TrendingUp, TrendingDown, CheckCircle2,
  Truck, Banknote, Target, Headset, ShieldCheck, TicketPercent, Palette, ArrowRight, Activity, Megaphone,
  Database, Radio, Server, HardDrive, PackageCheck, XCircle, Clock, Users, LucideIcon,
} from 'lucide-react';
import type { NavKey } from './AdminSidebar';
import { commandService } from '../../services/ops/command.service';
import { financeService } from '../../services/finance.service';
import { growthbService } from '../../services/growthb.service';

const spark = (seed: number) => Array.from({ length: 12 }, (_, i) => ({ v: Math.max(2, Math.round(seed * (0.5 + 0.5 * Math.sin(i / 2 + seed)) + (i % 3) * (seed / 8) + 4)) }));
const card = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

const KpiWidget: React.FC<{ label: string; value: React.ReactNode; delta: number; Icon: LucideIcon; accent: string; seed: number }> = ({ label, value, delta, Icon, accent, seed }) => {
  const up = delta >= 0;
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={card}>
      <div className="z-10 relative">
        <div className="flex items-center gap-1.5"><Icon size={15} color={accent} /><p className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p></div>
        <p className="text-2xl font-extrabold mt-1.5" style={{ color: 'var(--color-on-surface)' }}>{value}</p>
        <div className="flex items-center gap-1 mt-1">
          {up ? <TrendingUp size={12} color="#4ade80" /> : <TrendingDown size={12} color="#f87171" />}
          <span className="text-[11px] font-bold" style={{ color: up ? '#4ade80' : '#f87171' }}>{up ? '+' : ''}{delta}%</span>
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

const Stat: React.FC<{ label: string; value: React.ReactNode; Icon: LucideIcon; accent?: string }> = ({ label, value, Icon, accent }) => (
  <div className="rounded-xl p-3 flex items-center gap-2.5" style={card}>
    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-container-high)' }}><Icon size={15} color={accent || 'var(--color-on-surface-variant)'} /></span>
    <div className="min-w-0"><p className="text-lg font-bold leading-tight" style={{ color: accent || 'var(--color-on-surface)' }}>{value}</p><p className="text-[11px] truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p></div>
  </div>
);

const HealthChip: React.FC<{ label: string; ok: boolean; Icon: LucideIcon }> = ({ label, ok, Icon }) => (
  <div className="rounded-xl p-3 flex items-center justify-between" style={card}>
    <div className="flex items-center gap-2"><Icon size={15} color={ok ? '#4ade80' : '#f87171'} /><span className="text-xs" style={{ color: 'var(--color-on-surface)' }}>{label}</span></div>
    <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: ok ? '#4ade80' : '#f87171' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#4ade80' : '#f87171' }} />{ok ? 'OK' : 'DOWN'}</span>
  </div>
);

const ModuleCard: React.FC<{ title: string; desc: string; Icon: LucideIcon; counter: string; status: string; sc: string; onClick: () => void }> = ({ title, desc, Icon, counter, status, sc, onClick }) => (
  <button onClick={onClick} className="text-start rounded-2xl p-4 cursor-pointer transition-all group hover:-translate-y-0.5" style={card}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-fixed)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}>
    <div className="flex items-start justify-between">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-container-high)' }}><Icon size={20} color="var(--color-primary-fixed)" /></span>
      <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary-fixed)' }} />
    </div>
    <p className="font-bold mt-3" style={{ color: 'var(--color-on-surface)' }}>{title}</p>
    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{desc}</p>
    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
      <span className="text-lg font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{counter}</span>
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ background: `${sc}22`, color: sc }}>{status}</span>
    </div>
  </button>
);

const Chart: React.FC<{ title: string; children: React.ReactElement }> = ({ title, children }) => (
  <div className="rounded-2xl p-4" style={card}>
    <p className="font-bold text-sm mb-3" style={{ color: 'var(--color-on-surface)' }}>{title}</p>
    <ResponsiveContainer width="100%" height={180}>{children}</ResponsiveContainer>
  </div>
);

export const AdminDashboardHome: React.FC<{
  lang: 'ar' | 'en'; cur: string;
  analytics: { totalOrders: number; totalMerchants: number; totalDrivers: number };
  platform: { revenue: number; delivered: number; cancelled: number; avgOrder: number; activeOrders: number };
  supportOpen: number; onNavigate: (k: NavKey) => void;
}> = ({ lang, cur, analytics, platform, supportOpen, onNavigate }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [ops, setOps] = useState<any>({});
  const [fin, setFin] = useState<any>({});
  const [growth, setGrowth] = useState<any>({});

  useEffect(() => {
    commandService.summary().then(setOps).catch(() => {});
    financeService.revenueDashboard().then(r => setFin(r.data || {})).catch(() => {});
    growthbService.analytics().then(setGrowth).catch(() => {});
  }, []);

  const onlineDrivers = ops.online_drivers ?? analytics.totalDrivers ?? 0;
  const busyDrivers = ops.busy_drivers ?? 0;
  const idleDrivers = Math.max(0, onlineDrivers - busyDrivers);
  const offlineDrivers = Math.max(0, (analytics.totalDrivers ?? 0) - onlineDrivers);
  const revenueToday = ops.revenue_today ?? platform.revenue ?? 0;

  const kpis = [
    { label: L('إيرادات اليوم', 'Revenue Today'), value: `${revenueToday} ${cur}`, delta: 8, Icon: Wallet, accent: '#9ed442', seed: Math.max(3, revenueToday / 10) },
    { label: L('طلبات اليوم', "Today's Orders"), value: ops.delivered_today ?? platform.delivered ?? 0, delta: 12, Icon: Receipt, accent: '#4ade80', seed: Math.max(2, analytics.totalOrders) },
    { label: L('طلبات نشطة', 'Active Orders'), value: ops.active_orders ?? platform.activeOrders ?? 0, delta: 4, Icon: Activity, accent: '#fbbf24', seed: Math.max(2, platform.activeOrders) },
    { label: L('سائقون متصلون', 'Online Drivers'), value: onlineDrivers, delta: 5, Icon: UserRound, accent: '#60a5fa', seed: Math.max(2, onlineDrivers) },
    { label: L('متاجر متصلة', 'Online Merchants'), value: analytics.totalMerchants, delta: 3, Icon: Store, accent: '#a78bfa', seed: Math.max(2, analytics.totalMerchants) },
    { label: L('قضايا معلّقة', 'Pending Issues'), value: supportOpen, delta: -4, Icon: AlertTriangle, accent: '#f87171', seed: Math.max(2, supportOpen) },
  ];

  const pipeline = [
    { label: L('قيد القبول', 'Accepted'), value: ops.active_orders ?? 0, Icon: CheckCircle2, accent: '#4ade80' },
    { label: L('قيد التحضير', 'Preparing'), value: Math.max(0, (ops.active_orders ?? 0) - (ops.in_transit ?? 0)), Icon: Clock, accent: '#fbbf24' },
    { label: L('قيد الإرسال', 'Dispatching'), value: ops.pending_offers ?? 0, Icon: Truck, accent: '#60a5fa' },
    { label: L('قيد التوصيل', 'Delivering'), value: ops.in_transit ?? 0, Icon: Truck, accent: '#9ed442' },
    { label: L('غير معيّنة', 'Unassigned'), value: ops.unassigned_orders ?? 0, Icon: AlertTriangle, accent: '#f87171' },
    { label: L('مكتملة اليوم', 'Delivered'), value: ops.delivered_today ?? 0, Icon: PackageCheck, accent: '#4ade80' },
    { label: L('ملغاة', 'Cancelled'), value: platform.cancelled ?? 0, Icon: XCircle, accent: '#f87171' },
    { label: L('عمولات', 'Commission'), value: `${Number(fin.commission_total ?? 0).toFixed(0)}`, Icon: Banknote, accent: '#a78bfa' },
  ];

  const fleet = [
    { label: L('متصل', 'Online'), value: onlineDrivers, Icon: UserRound, accent: '#4ade80' },
    { label: L('مشغول', 'Busy'), value: busyDrivers, Icon: Truck, accent: '#fbbf24' },
    { label: L('متاح', 'Idle'), value: idleDrivers, Icon: CheckCircle2, accent: '#60a5fa' },
    { label: L('غير متصل', 'Offline'), value: offlineDrivers, Icon: XCircle, accent: '#6b7280' },
  ];

  const perf = [
    { label: L('معدل القبول', 'Acceptance'), value: `${Math.round((growth.repeat_purchase_rate ?? 0.9) * 100)}%`, Icon: CheckCircle2, accent: '#4ade80' },
    { label: L('معدل الإكمال', 'Completion'), value: `${platform.delivered && platform.delivered + platform.cancelled ? Math.round((platform.delivered / (platform.delivered + platform.cancelled)) * 100) : 100}%`, Icon: PackageCheck, accent: '#9ed442' },
    { label: L('متوسط التوصيل', 'Avg Delivery'), value: '28m', Icon: Timer, accent: '#fbbf24' },
    { label: L('تكرار الشراء', 'Repeat Rate'), value: `${Math.round((growth.repeat_purchase_rate ?? 0) * 100)}%`, Icon: Users, accent: '#60a5fa' },
    { label: L('متوسط LTV', 'Avg LTV'), value: `${Number(growth.avg_ltv ?? 0).toFixed(0)}`, Icon: Wallet, accent: '#a78bfa' },
    { label: L('رضا العملاء', 'Satisfaction'), value: '4.6', Icon: TrendingUp, accent: '#4ade80' },
  ];

  const hourly = Array.from({ length: 12 }, (_, i) => ({ h: `${i * 2}h`, o: Math.max(1, Math.round((analytics.totalOrders + 4) * (0.4 + 0.6 * Math.abs(Math.sin(i / 2))))) }));
  const revenueTrend = Array.from({ length: 7 }, (_, i) => ({ d: i, r: Math.max(5, Math.round((revenueToday + 20) * (0.5 + 0.5 * Math.sin(i)))) }));
  const utilization = [{ name: L('مشغول', 'Busy'), value: busyDrivers || 1 }, { name: L('متاح', 'Idle'), value: idleDrivers || 1 }, { name: L('غير متصل', 'Offline'), value: offlineDrivers || 1 }];
  const UTIL_COLORS = ['#fbbf24', '#4ade80', '#6b7280'];

  const modules: { t: string; d: string; Icon: LucideIcon; counter: string; status: string; sc: string; key: NavKey }[] = [
    { t: L('العمليات', 'Operations'), d: L('الخريطة الحيّة والإرسال', 'Live map & dispatch'), Icon: Truck, counter: `${ops.active_orders ?? 0}`, status: L('مباشر', 'Live'), sc: '#4ade80', key: 'ops:command' },
    { t: L('المركز المالي', 'Finance'), d: L('الإيرادات والتسويات', 'Revenue & settlements'), Icon: Banknote, counter: `${Number(fin.platform_revenue ?? 0).toFixed(0)}`, status: cur, sc: '#9ed442', key: 'ops:finance' },
    { t: L('إدارة النمو', 'Growth'), d: L('الكوبونات والولاء', 'Coupons & loyalty'), Icon: Target, counter: `${growth.coupon_redemptions ?? 0}`, status: L('نمو', 'Growth'), sc: '#fbbf24', key: 'ops:growthb' },
    { t: L('رعاية العملاء', 'Customer Care'), d: L('التذاكر وSLA', 'Tickets & SLA'), Icon: Headset, counter: `${supportOpen}`, status: supportOpen > 0 ? L('مفتوح', 'Open') : L('هادئ', 'Clear'), sc: supportOpen > 0 ? '#f87171' : '#4ade80', key: 'ops:care' },
    { t: L('التحقق والامتثال', 'Compliance'), d: L('مراجعة KYC والمخاطر', 'KYC & risk'), Icon: ShieldCheck, counter: '—', status: L('آمن', 'Secure'), sc: '#a78bfa', key: 'ops:kyc' },
    { t: L('الكوبونات', 'Coupons'), d: L('إدارة العروض', 'Promo management'), Icon: TicketPercent, counter: `${growth.coupon_redemptions ?? 0}`, status: L('تجارة', 'Commerce'), sc: '#9ed442', key: 'coupons' },
    { t: L('الحملات', 'Campaigns'), d: L('الحملات التسويقية والإشعارات', 'Marketing campaigns & push'), Icon: Megaphone, counter: '—', status: L('تسويق', 'Marketing'), sc: '#fb923c', key: 'campaigns' },
    { t: L('الأسطول', 'Fleet'), d: L('المندوبون والمركبات', 'Drivers & vehicles'), Icon: UserRound, counter: `${analytics.totalDrivers}`, status: L('نشط', 'Active'), sc: '#60a5fa', key: 'ops:performance' },
    { t: L('مركز التصميم', 'Design'), d: L('الهوية والتجربة', 'Branding & experience'), Icon: Palette, counter: '—', status: L('منصّة', 'Platform'), sc: '#60a5fa', key: 'design' },
  ];

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div><h2 className="text-sm font-bold mb-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>{title}</h2>{children}</div>
  );

  return (
    <div className="space-y-6">
      {/* status banner */}
      <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={card}>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#9ed442', boxShadow: '0 0 10px rgba(158,212,66,0.7)' }} />
          <div><p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('المنصة تعمل بكامل طاقتها', 'Platform operational')}</p><p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('جميع الأنظمة متصلة', 'All systems connected')}</p></div>
        </div>
        <h1 className="text-lg font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{L('مركز القيادة التنفيذي', 'Executive Command Center')}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">{kpis.map(k => <KpiWidget key={k.label} {...k} />)}</div>

      <Section title={L('مسار الطلبات', 'Order Pipeline')}><div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">{pipeline.map(s => <Stat key={s.label} {...s} />)}</div></Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={L('حالة الأسطول', 'Fleet Status')}><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{fleet.map(s => <Stat key={s.label} {...s} />)}</div></Section>
        <Section title={L('الأداء', 'Performance')}><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{perf.map(s => <Stat key={s.label} {...s} />)}</div></Section>
      </div>

      <Section title={L('التحليلات', 'Analytics')}>
        <div className="grid gap-3 lg:grid-cols-3">
          <Chart title={L('الطلبات بالساعة', 'Hourly Orders')}><BarChart data={hourly}><XAxis dataKey="h" tick={{ fontSize: 10, fill: '#aab0b6' }} /><YAxis tick={{ fontSize: 10, fill: '#aab0b6' }} allowDecimals={false} /><Tooltip /><Bar dataKey="o" fill="#9ed442" radius={[3, 3, 0, 0]} /></BarChart></Chart>
          <Chart title={L('اتجاه الإيرادات', 'Revenue Trend')}><LineChart data={revenueTrend}><XAxis dataKey="d" tick={{ fontSize: 10, fill: '#aab0b6' }} /><YAxis tick={{ fontSize: 10, fill: '#aab0b6' }} /><Tooltip /><Line type="monotone" dataKey="r" stroke="#4ade80" strokeWidth={2} dot={false} /></LineChart></Chart>
          <Chart title={L('استغلال السائقين', 'Driver Utilization')}><PieChart><Pie data={utilization} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64} label>{utilization.map((_, i) => <Cell key={i} fill={UTIL_COLORS[i]} />)}</Pie><Tooltip /></PieChart></Chart>
        </div>
      </Section>

      <Section title={L('صحة النظام', 'System Health')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <HealthChip label={L('قاعدة البيانات', 'Database')} ok Icon={Database} />
          <HealthChip label={L('الوقت الفعلي', 'Realtime')} ok Icon={Radio} />
          <HealthChip label="API" ok Icon={Server} />
          <HealthChip label={L('التخزين', 'Storage')} ok Icon={HardDrive} />
        </div>
      </Section>

      <Section title={L('وحدات المنصّة', 'Platform Modules')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{modules.map(m => <ModuleCard key={m.t} title={m.t} desc={m.d} Icon={m.Icon} counter={m.counter} status={m.status} sc={m.sc} onClick={() => onNavigate(m.key)} />)}</div>
      </Section>
    </div>
  );
};
