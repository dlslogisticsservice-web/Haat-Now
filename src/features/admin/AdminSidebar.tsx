import React, { useState } from 'react';
import {
  LayoutDashboard, Map, Route, MapPin, UserRound, Truck, Wallet, Banknote, TicketPercent,
  Headset, ShieldCheck, LifeBuoy, Target, Megaphone, Palette, Settings2, ChevronDown, LogOut,
  Languages, RefreshCw, LucideIcon, Layers, Bell, ScrollText, Search,
  Store, Building2, ClipboardList, Users,
} from 'lucide-react';

export type NavKey =
  | 'kpi' | 'coupons' | 'config' | 'support' | 'campaigns' | 'design' | 'notifications' | 'logs' | 'tenants'
  | 'catalog:categories' | 'catalog:zones'
  | 'mgmt:drivers' | 'mgmt:vehicles' | 'mgmt:merchants' | 'mgmt:branches' | 'mgmt:orders' | 'mgmt:customers'
  | 'ops:command' | 'ops:dispatch' | 'ops:zones' | 'ops:performance' | 'ops:vehicles'
  | 'ops:finance' | 'ops:payouts' | 'ops:care' | 'ops:kyc' | 'ops:growthb';

type Item = { key: NavKey; ar: string; en: string; Icon: LucideIcon; badge?: number; super?: boolean };
type Group = { ar: string; en: string; items: Item[] };

const GROUPS: Group[] = [
  { ar: 'القيادة', en: 'Executive', items: [{ key: 'kpi', ar: 'لوحة المعلومات', en: 'Dashboard', Icon: LayoutDashboard }] },
  { ar: 'العمليات', en: 'Operations', items: [
    { key: 'ops:command', ar: 'غرفة العمليات', en: 'Command Center', Icon: Map },
    { key: 'ops:dispatch', ar: 'الإرسال', en: 'Dispatch', Icon: Route },
    { key: 'ops:zones', ar: 'المناطق', en: 'Zones', Icon: MapPin },
  ] },
  { ar: 'الأسطول', en: 'Fleet', items: [
    { key: 'ops:performance', ar: 'المندوبون', en: 'Drivers', Icon: UserRound },
    { key: 'ops:vehicles', ar: 'المركبات', en: 'Vehicles', Icon: Truck },
  ] },
  { ar: 'التجارة', en: 'Commerce', items: [{ key: 'coupons', ar: 'الكوبونات', en: 'Coupons', Icon: TicketPercent }] },
  { ar: 'الكتالوج', en: 'Catalog', items: [
    { key: 'catalog:categories', ar: 'الفئات', en: 'Categories', Icon: Layers },
    { key: 'catalog:zones', ar: 'مناطق الكتالوج', en: 'Zones', Icon: MapPin },
  ] },
  { ar: 'السجلّات', en: 'Records', items: [
    { key: 'mgmt:drivers', ar: 'إدارة المندوبين', en: 'Drivers', Icon: UserRound },
    { key: 'mgmt:vehicles', ar: 'إدارة المركبات', en: 'Vehicles', Icon: Truck },
    { key: 'mgmt:merchants', ar: 'إدارة التجّار', en: 'Merchants', Icon: Store },
    { key: 'mgmt:branches', ar: 'إدارة الفروع', en: 'Branches', Icon: Building2 },
    { key: 'mgmt:orders', ar: 'إدارة الطلبات', en: 'Orders', Icon: ClipboardList },
    { key: 'mgmt:customers', ar: 'إدارة العملاء', en: 'Customers', Icon: Users },
  ] },
  { ar: 'المالية', en: 'Finance', items: [
    { key: 'ops:finance', ar: 'المركز المالي', en: 'Finance Center', Icon: Wallet },
    { key: 'ops:payouts', ar: 'المدفوعات', en: 'Payouts', Icon: Banknote },
  ] },
  { ar: 'العملاء', en: 'CRM', items: [
    { key: 'support', ar: 'الدعم', en: 'Support', Icon: LifeBuoy },
    { key: 'ops:care', ar: 'رعاية العملاء', en: 'Customer Care', Icon: Headset },
  ] },
  { ar: 'التسويق', en: 'Marketing', items: [
    { key: 'ops:growthb', ar: 'إدارة النمو', en: 'Growth', Icon: Target },
    { key: 'campaigns', ar: 'الحملات', en: 'Campaigns', Icon: Megaphone, super: true },
  ] },
  { ar: 'الأمان', en: 'Security', items: [
    { key: 'ops:kyc', ar: 'التحقق والامتثال', en: 'Compliance', Icon: ShieldCheck },
    { key: 'logs', ar: 'سجلّات النظام', en: 'System Logs', Icon: ScrollText, super: true },
  ] },
  { ar: 'المنصّة', en: 'Platform', items: [
    { key: 'design', ar: 'مركز التصميم', en: 'Design', Icon: Palette, super: true },
    { key: 'tenants', ar: 'العلامة البيضاء', en: 'White Label', Icon: Building2, super: true },
  ] },
  { ar: 'النظام', en: 'System', items: [
    { key: 'notifications', ar: 'الإشعارات', en: 'Notifications', Icon: Bell },
    { key: 'config', ar: 'الإعدادات', en: 'Settings', Icon: Settings2 },
  ] },
];

export const AdminSidebar: React.FC<{
  active: NavKey; onSelect: (k: NavKey) => void; lang: 'ar' | 'en'; isSuper: boolean;
  supportBadge?: number; notifBadge?: number; onSearch?: () => void;
  onLogout: () => void; onToggleLang: () => void; onRefresh: () => void;
  mobileOpen?: boolean; onClose?: () => void;
}> = ({ active, onSelect, lang, isSuper, supportBadge, notifBadge, onSearch, onLogout, onToggleLang, onRefresh, mobileOpen, onClose }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const toggle = (g: string) => setCollapsed(c => ({ ...c, [g]: !c[g] }));
  // Persistent on desktop; slide-in Drawer on mobile (off-canvas toward the start edge when closed).
  const closedTransform = mobileOpen ? '' : (lang === 'ar' ? 'max-md:translate-x-full' : 'max-md:-translate-x-full');
  const select = (k: NavKey) => { onSelect(k); onClose?.(); };

  return (
    <>
      {/* Mobile drawer backdrop */}
      {mobileOpen && <div className="md:hidden fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} aria-hidden="true" />}
    <aside className={`fixed inset-y-0 start-0 w-[260px] flex flex-col z-50 md:z-40 transition-transform duration-200 md:translate-x-0 ${closedTransform}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'} role="navigation" aria-label={L('التنقل الرئيسي', 'Main navigation')}
      style={{ background: 'var(--color-surface-container-lowest, #0a0f14)', borderInlineEnd: '1px solid var(--color-outline-variant)' }}>
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-fixed)' }}>
          <Layers size={18} color="var(--color-on-primary-fixed)" />
        </span>
        <div>
          <p className="font-extrabold text-sm tracking-tight" style={{ color: 'var(--color-on-surface)' }}>HAAT NOW</p>
          <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('منصة الإدارة', 'Admin Platform')}</p>
        </div>
      </div>

      {/* Global search trigger */}
      <div className="px-3 pt-3">
        <button onClick={onSearch} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer"
          style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
          <Search size={15} />
          <span className="flex-1 text-start">{L('بحث شامل…', 'Search…')}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'var(--color-surface-container-lowest)' }}>Ctrl K</span>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {GROUPS.map(g => {
          const items = g.items.filter(i => !i.super || isSuper);
          if (items.length === 0) return null;
          const isCollapsed = collapsed[g.en];
          return (
            <div key={g.en}>
              <button onClick={() => toggle(g.en)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span>{L(g.ar, g.en)}</span>
                <ChevronDown size={13} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 mt-0.5">
                  {items.map(it => {
                    const on = active === it.key;
                    const badge = it.key === 'support' ? supportBadge : it.key === 'notifications' ? notifBadge : undefined;
                    return (
                      <button key={it.key} onClick={() => select(it.key)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                        style={on
                          ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontWeight: 700 }
                          : { color: 'var(--color-on-surface)', background: 'transparent' }}
                        onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--color-surface-container-high)'; }}
                        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                        <it.Icon size={17} />
                        <span className="flex-1 text-start">{L(it.ar, it.en)}</span>
                        {badge ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-error)', color: '#fff' }}>{badge}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="px-3 py-3 space-y-1" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
        <button onClick={onRefresh} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}><RefreshCw size={16} />{L('تحديث', 'Refresh')}</button>
        <button onClick={onToggleLang} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}><Languages size={16} />{lang === 'ar' ? 'English' : 'العربية'}</button>
        <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer" style={{ color: '#f87171' }}><LogOut size={16} />{L('تسجيل الخروج', 'Sign out')}</button>
      </div>
    </aside>
    </>
  );
};
