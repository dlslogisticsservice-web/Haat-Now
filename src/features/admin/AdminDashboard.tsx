import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { supabase } from '../../lib/supabase';
import { adminService } from '../../services/admin.service';
import { Icon } from '../../components/ui/Icon';
import { Card, StatCard } from '../../components/ui/Card';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { sandboxStore, SbCoupon } from '../../services/sandboxStore';
import { authService } from '../../services/auth.service';
import { couponService } from '../../services/coupon.service';
import { analyticsService } from '../../services/analytics.service';

// Sandbox is only ever active in dev — keep this consistent with auth.service's
// IS_SANDBOX (`&& import.meta.env.DEV`) so this module never disagrees with the
// auth layer about which mode it is in (a mode mismatch previously mis-gated super-admin).
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox' && import.meta.env.DEV;
import { Loader, EmptyState, Divider } from '../../components/ui/Primitives';
import { DesignCenter } from './DesignCenter';
import { CampaignCenter } from './CampaignCenter';
import { OperationsCenter, OpsTab } from './OperationsCenter';
import { AdminSidebar, NavKey } from './AdminSidebar';
import { AdminDashboardHome } from './AdminDashboardHome';
import { NotificationCenter } from './NotificationCenter';
import { SystemLogs } from './SystemLogs';
import { GlobalSearch } from './GlobalSearch';
import { CrudManager } from '../../components/admin/CrudManager';
import { DriverWorkspace } from './workspaces/DriverWorkspace';
import { VehicleWorkspace } from './workspaces/VehicleWorkspace';
import { MerchantWorkspace } from './workspaces/MerchantWorkspace';
import { OrderWorkspace } from './workspaces/OrderWorkspace';
import { CustomerWorkspace } from './workspaces/CustomerWorkspace';
import { BranchWorkspace } from './workspaces/BranchWorkspace';
import { TenantWorkspace } from './workspaces/TenantWorkspace';
import { seedDemoData } from '../../services/demoSeed';
import { ZoneCoverageEditor } from './ZoneCoverageEditor';
import { Layers, MapPin, UserRound, Truck, Store, Building2, ClipboardList, Users } from 'lucide-react';
import { notificationService } from '../../services/notification.service';

// ── Types (unchanged) ─────────────────────────────────────────
interface Ticket {
  id: string;
  customer_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  customers?: { full_name: string; phone_number: string };
}
interface TicketMessage {
  id: string;
  sender_type: 'customer' | 'admin' | 'system';
  message_text: string;
}

type AdminTab = 'kpi' | 'coupons' | 'config' | 'support' | 'design' | 'campaigns' | 'ops' | 'notifications' | 'logs' | 'catalog' | 'mgmt' | 'tenants';
type CatTab = 'categories' | 'zones';
type MgmtTab = 'drivers' | 'vehicles' | 'merchants' | 'branches' | 'orders' | 'customers';

const PRIORITY_VARIANT: Record<string, 'error' | 'warning' | 'neutral' | 'secondary'> = {
  critical: 'error', high: 'error', medium: 'warning', low: 'neutral',
};

interface AdminDashboardProps { adminId: string; onLogout: () => void }

export const AdminDashboard = ({ adminId, onLogout }: AdminDashboardProps) => {
  const { country, lang, toggleLang } = useAppConfig();
  const cur = country.currency.symbolAr;
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  // ── State (unchanged) ─────────────────────────────────────
  const [analytics,         setAnalytics]         = useState({ totalOrders: 0, totalMerchants: 0, totalDrivers: 0 });
  const [tickets,           setTickets]           = useState<Ticket[]>([]);
  const [selectedTicketId,  setSelectedTicketId]  = useState<string | null>(null);
  const [ticketMessages,    setTicketMessages]    = useState<TicketMessage[]>([]);
  const [replyText,         setReplyText]         = useState('');
  const [configFee,         setConfigFee]         = useState('10.00');
  const [configMessage,     setConfigMessage]     = useState('أهلاً بك في هات الآن!');
  const [loading,           setLoading]           = useState(true);
  const [payoutLoading,     setPayoutLoading]     = useState(false);
  const [activeTab,         setActiveTab]         = useState<AdminTab>('kpi');
  const [opsTab,            setOpsTab]            = useState<OpsTab>('command');
  const [catTab,            setCatTab]            = useState<CatTab>('categories');
  const [mgmtTab,           setMgmtTab]           = useState<MgmtTab>('drivers');
  const [wsDriver,          setWsDriver]          = useState<any | null>(null);
  const [wsVehicle,         setWsVehicle]         = useState<any | null>(null);
  const [wsMerchant,        setWsMerchant]        = useState<any | null>(null);
  const [wsOrder,           setWsOrder]           = useState<any | null>(null);
  const [wsCustomer,        setWsCustomer]        = useState<any | null>(null);
  const [wsBranch,          setWsBranch]          = useState<any | null>(null);
  const [wsTenant,          setWsTenant]          = useState<any | null>(null);
  const [zoneCoverage,      setZoneCoverage]      = useState<any | null>(null);
  const [zoneReload,        setZoneReload]        = useState(0);
  const [tenantReload,      setTenantReload]      = useState(0);
  const [searchOpen,        setSearchOpen]        = useState(false);
  const [sidebarOpen,       setSidebarOpen]       = useState(false);
  const [notifBadge,        setNotifBadge]        = useState(0);
  const activeNav: NavKey = activeTab === 'ops' ? (`ops:${opsTab}` as NavKey) : activeTab === 'catalog' ? (`catalog:${catTab}` as NavKey) : activeTab === 'mgmt' ? (`mgmt:${mgmtTab}` as NavKey) : (activeTab as NavKey);
  const handleNav = (k: NavKey) => {
    if (k.startsWith('ops:')) { setActiveTab('ops'); setOpsTab(k.slice(4) as OpsTab); }
    else if (k.startsWith('catalog:')) { setActiveTab('catalog'); setCatTab(k.slice(8) as CatTab); }
    else if (k.startsWith('mgmt:')) { setActiveTab('mgmt'); setMgmtTab(k.slice(5) as MgmtTab); }
    else setActiveTab(k as AdminTab);
  };
  // Ctrl/Cmd+K opens global search; live unread notification badge.
  // Demo environment — populate the sandbox data layer so no admin page is empty.
  useEffect(() => { if (import.meta.env.VITE_AUTH_MODE === 'sandbox') seedDemoData(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(v => !v); } };
    window.addEventListener('keydown', onKey);
    let unsub = () => {};
    const refreshBadge = () => notificationService.getUnreadCount(adminId).then(({ count }) => setNotifBadge(count));
    refreshBadge();
    unsub = notificationService.subscribe(adminId, refreshBadge);
    return () => { window.removeEventListener('keydown', onKey); unsub(); };
  }, [adminId]);
  // ── Coupon administration ──
  const [coupons,           setCoupons]           = useState<SbCoupon[]>([]);
  const [cForm,             setCForm]             = useState({ code: '', discount: '15', maxUses: '100', expires: '2026-12-31', country: '' });
  // ── Expanded platform analytics (H2) ──
  const [platformStats,     setPlatformStats]     = useState({ totalOrders: 0, delivered: 0, cancelled: 0, revenue: 0, avgOrder: 0, activeOrders: 0 });
  const refreshCoupons = async () => {
    if (SANDBOX) { setCoupons(sandboxStore.getCoupons()); return; }
    const { data } = await couponService.listCoupons();
    setCoupons((data || []).map(c => ({
      id: c.id, code: c.code, discount_percent: c.discount_percent,
      max_uses: c.max_uses ?? 0, used: c.used_count ?? 0, expires_at: c.expires_at || '',
      country: c.country_code ?? null, active: c.is_active, created_at: c.created_at || '',
    })));
  };
  const handleCreateCoupon = async () => {
    if (!cForm.code.trim()) return;
    const discount = Math.max(1, Math.min(100, parseInt(cForm.discount) || 0));
    const max_uses = parseInt(cForm.maxUses) || 0;
    if (SANDBOX) {
      sandboxStore.createCoupon({ code: cForm.code.trim().toUpperCase(), discount_percent: discount, max_uses, expires_at: cForm.expires, country: cForm.country || null, active: true });
    } else {
      await couponService.createCoupon({ code: cForm.code.trim().toUpperCase(), discount_percent: discount, max_uses, expires_at: cForm.expires || null, country_code: cForm.country || null });
    }
    setCForm({ code: '', discount: '15', maxUses: '100', expires: '2026-12-31', country: '' });
    await refreshCoupons();
  };
  const toggleCoupon = async (id: string, active: boolean) => {
    if (SANDBOX) sandboxStore.updateCoupon(id, { active });
    else await couponService.updateCoupon(id, { is_active: active });
    await refreshCoupons();
  };

  // Super-admin gate: ONLY scope==='super' may see Design Center, Campaign Center,
  // global settings and cross-country data. Resolved from the authoritative,
  // mode-consistent authService.getAdminScope (no brittle UUID-prefix hack).
  const [isSuper, setIsSuper] = useState(false);
  useEffect(() => {
    let alive = true;
    authService.getAdminScope(adminId)
      .then(scope => { if (alive) setIsSuper(scope === 'super'); })
      .catch(() => { if (alive) setIsSuper(false); });
    return () => { alive = false; };
  }, [adminId]);

  useEffect(() => { fetchAdminModuleData(); refreshCoupons(); }, []);

  // ── Business logic (ALL UNCHANGED) ───────────────────────
  const fetchAdminModuleData = async () => {
    try {
      setLoading(true);
      if (SANDBOX) {
        const sb = sandboxStore.getOrders();
        setAnalytics({ totalOrders: sb.length, totalMerchants: 1, totalDrivers: 1 });
        setPlatformStats(sandboxStore.getPlatformAnalytics());
        setTickets([]);
        return;
      }
      const { data: analyticsData } = await adminService.getGlobalAnalytics();
      if (analyticsData) setAnalytics(analyticsData);
      const { data: platform } = await analyticsService.getPlatformAnalytics();
      if (platform) setPlatformStats(platform);
      const { data: feeConf } = await adminService.getAppConfig('MIN_DELIVERY_FEE');
      if (feeConf) setConfigFee(feeConf.value);
      const { data: bnrConf } = await adminService.getAppConfig('WELCOME_SMS_MESSAGE');
      if (bnrConf) setConfigMessage(bnrConf.value);
      const { data: tktData } = await adminService.getAllTickets();
      if (tktData) setTickets(tktData as unknown as Ticket[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSaveConfig = async (key: string, value: any, desc?: string) => {
    setPayoutLoading(true);
    const { error } = await adminService.updateAppConfig(key, value, desc);
    setPayoutLoading(false);
    if (error) toast.error(`${L('خطأ في الحفظ','Save error')}: ${(error as any).message}`);
    else { toast.success(L('تم تحديث التكوين بنجاح','Configuration updated successfully')); await fetchAdminModuleData(); }
  };

  const handleSelectTicket = async (tktId: string) => {
    setSelectedTicketId(tktId); setReplyText(''); setPayoutLoading(true);
    try {
      const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', tktId).order('created_at', { ascending: true });
      if (data) setTicketMessages(data);
    } catch (e) { console.error(e); }
    finally { setPayoutLoading(false); }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !selectedTicketId) return;
    setPayoutLoading(true);
    const { data, error } = await adminService.sendAdminReply(selectedTicketId, adminId, replyText);
    if (error) toast.error((error as any).message);
    else if (data) {
      setTicketMessages([...ticketMessages, data as unknown as TicketMessage]); setReplyText('');
      await adminService.updateTicketStatus(selectedTicketId, 'in_progress');
      const { data: tkts } = await adminService.getAllTickets();
      if (tkts) setTickets(tkts as unknown as Ticket[]);
    }
    setPayoutLoading(false);
  };

  const handleCloseTicket = async (tktId: string) => {
    setPayoutLoading(true);
    await adminService.updateTicketStatus(tktId, 'resolved');
    setPayoutLoading(false);
    toast.success(L('تم تحديد التذكرة كمحلول','Ticket marked as resolved'));
    await fetchAdminModuleData(); setSelectedTicketId(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" id="admin_module_loader">
        <Loader size={36} />
        <p className="text-body-md text-[var(--color-on-surface-variant)]">{L('جاري تحميل لوحة الإدارة...','Loading admin panel…')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" id="admin_dashboard_full">

      {/* ── Enterprise grouped sidebar ──────────────────────── */}
      <AdminSidebar
        active={activeNav}
        onSelect={handleNav}
        lang={lang}
        isSuper={isSuper}
        supportBadge={tickets.filter(t => t.status === 'open').length || undefined}
        notifBadge={notifBadge || undefined}
        onSearch={() => setSearchOpen(true)}
        onLogout={onLogout}
        onToggleLang={toggleLang}
        onRefresh={fetchAdminModuleData}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} lang={lang} onNavigate={handleNav} />

      {/* ── Main Content ───────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen overflow-y-auto px-5 pb-6 md:px-8 md:pb-8 space-y-6 md:ms-[260px]"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}
        id="admin_main_content"
      >
        {/* ── Mobile AppBar (hamburger opens the sidebar Drawer; no top tabs on mobile) ── */}
        <div className="md:hidden flex items-center justify-between mb-1 sticky top-0 z-30 -mx-5 px-5 py-2"
          style={{ background: 'var(--color-background)', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} aria-label={lang === 'ar' ? 'فتح القائمة' : 'Open menu'} id="admin_drawer_btn"
              className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'var(--color-surface-container-high)' }}>
              <Icon name="menu" size={18} className="text-[var(--color-on-surface)]" />
            </button>
            <span className="font-extrabold text-sm" style={{ color: 'var(--color-on-surface)' }}>HAAT NOW</span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)} leftIcon={<Icon name="search" size={16} />} />
            <Button variant="ghost" size="sm" onClick={toggleLang} leftIcon={<Icon name="language" size={16} />}>{lang === 'ar' ? 'EN' : 'ع'}</Button>
          </div>
        </div>

        {/* TAB: Executive Dashboard */}
        {activeTab === 'kpi' && (
          <AdminDashboardHome
            lang={lang}
            cur={cur}
            analytics={analytics}
            platform={platformStats}
            supportOpen={tickets.filter(t => t.status === 'open').length}
            onNavigate={handleNav}
          />
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB: COUPONS                                       */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="admin_coupons_tab">
            {/* Create coupon */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-4" id="coupon_create_box">
              <h3 className="text-title-md font-bold text-white text-end">{L('إنشاء كوبون جديد','Create new coupon')}</h3>
              <div className="space-y-3">
                <input id="coupon_code_input" value={cForm.code} onChange={e => setCForm({ ...cForm, code: e.target.value })} placeholder={L('كود الكوبون (مثال: HAAT20)','Coupon code (e.g. HAAT20)')} dir="ltr"
                  className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-label-sm text-[var(--color-on-surface-variant)] block mb-1 text-end">{L('نسبة الخصم %','Discount %')}</label>
                    <input type="number" value={cForm.discount} onChange={e => setCForm({ ...cForm, discount: e.target.value })} className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} /></div>
                  <div><label className="text-label-sm text-[var(--color-on-surface-variant)] block mb-1 text-end">{L('حد الاستخدام','Usage limit')}</label>
                    <input type="number" value={cForm.maxUses} onChange={e => setCForm({ ...cForm, maxUses: e.target.value })} className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-label-sm text-[var(--color-on-surface-variant)] block mb-1 text-end">{L('تاريخ الانتهاء','Expiry date')}</label>
                    <input type="date" value={cForm.expires} onChange={e => setCForm({ ...cForm, expires: e.target.value })} className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} /></div>
                  <div><label className="text-label-sm text-[var(--color-on-surface-variant)] block mb-1 text-end">{L('الدولة','Country')}</label>
                    <select value={cForm.country} onChange={e => setCForm({ ...cForm, country: e.target.value })} className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <option value="">{L('كل الدول','All countries')}</option><option value="EG">{L('مصر','Egypt')}</option><option value="SA">{L('السعودية','Saudi Arabia')}</option>
                    </select></div>
                </div>
                <button id="coupon_create_btn" onClick={handleCreateCoupon} className="w-full h-11 rounded-xl font-bold cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{L('إنشاء الكوبون','Create coupon')}</button>
              </div>
            </Card>
            {/* Coupon list */}
            <Card variant="z3" radius="xl" padding="p-0" className="overflow-hidden" id="coupon_list_box">
              <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}><h3 className="text-title-md font-bold text-white text-end">{L('الكوبونات','Coupons')} ({coupons.length})</h3></div>
              {coupons.map(c => {
                const expired = new Date(c.expires_at) < new Date('2026-06-20');
                return (
                  <div key={c.id} id={`coupon_row_${c.id}`} className="p-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <button onClick={() => toggleCoupon(c.id, !c.active)} className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer shrink-0" style={{ background: c.active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: c.active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>
                      {c.active ? L('مفعّل','Active') : L('معطّل','Disabled')}
                    </button>
                    <div className="text-end min-w-0">
                      <p className="font-bold text-white" dir="ltr" style={{ textAlign: 'end' }}>{c.code} · {c.discount_percent}%</p>
                      <p className="text-label-sm text-[var(--color-on-surface-variant)]">
                        {c.used}/{c.max_uses || '∞'} {L('استُخدم','used')} · {c.country || L('كل الدول','All countries')} · {expired ? L('منتهٍ','Expired') : `${L('حتى','until')} ${c.expires_at}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              {coupons.length === 0 && <p className="p-6 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا توجد كوبونات.','No coupons.')}</p>}
            </Card>
          </div>
        )}

        {/* TAB: DESIGN CENTER (super admin only)             */}
        {activeTab === 'ops' && <OperationsCenter tab={opsTab} onTab={setOpsTab} hideTabs />}
        {activeTab === 'catalog' && catTab === 'categories' && (
          <CrudManager table="categories" Icon={Layers} lang={lang}
            titleAr="الفئات" titleEn="Categories" subtitleAr="إدارة فئات المنتجات" subtitleEn="Manage product categories"
            fields={[{ key: 'name', ar: 'الاسم', en: 'Name', required: true, placeholder: 'e.g. Beverages' }]} />
        )}
        {activeTab === 'catalog' && catTab === 'zones' && (
          <CrudManager key={zoneReload} table="zones" Icon={MapPin} lang={lang} onRowOpen={setZoneCoverage}
            titleAr="إدارة المناطق" titleEn="Zone Manager" subtitleAr="التغطية · الرسوم · الأولوية · المضلّع" subtitleEn="Coverage · fees · priority · polygon"
            fields={[
              { key: 'name', ar: 'الاسم', en: 'Name', required: true, placeholder: 'e.g. Downtown' },
              { key: 'city', ar: 'المدينة', en: 'City', placeholder: 'e.g. Riyadh' },
              { key: 'country_code', ar: 'الدولة', en: 'Country', placeholder: 'SA' },
              { key: 'delivery_fee', ar: 'رسوم التوصيل', en: 'Delivery fee', type: 'number', placeholder: '10' },
              { key: 'min_order', ar: 'الحد الأدنى', en: 'Min order', type: 'number', placeholder: '30' },
              { key: 'eta_minutes', ar: 'زمن التوصيل (د)', en: 'ETA (min)', type: 'number', placeholder: '35' },
              { key: 'radius_km', ar: 'نطاق التغطية (كم)', en: 'Coverage radius (km)', type: 'number', placeholder: '5' },
              { key: 'priority', ar: 'الأولوية', en: 'Priority', type: 'select', options: [{ value: 'high', ar: 'عالية', en: 'High' }, { value: 'medium', ar: 'متوسطة', en: 'Medium' }, { value: 'low', ar: 'منخفضة', en: 'Low' }] },
              { key: 'is_active', ar: 'مفعّلة', en: 'Active', type: 'boolean' },
            ]} />
        )}
        {zoneCoverage && (
          <ZoneCoverageEditor zone={zoneCoverage} lang={lang} onClose={() => setZoneCoverage(null)} onSaved={() => { setZoneReload(n => n + 1); }} />
        )}

        {/* ── Business records CRUD (real Supabase tables, reusable engine) ── */}
        {activeTab === 'mgmt' && mgmtTab === 'drivers' && (
          <CrudManager table="drivers" Icon={UserRound} lang={lang} onRowOpen={setWsDriver}
            titleAr="إدارة المندوبين" titleEn="Drivers" subtitleAr="السائقون · الحالة · المركبة" subtitleEn="Drivers · status · vehicle"
            fields={[
              { key: 'full_name', ar: 'الاسم', en: 'Full name' },
              { key: 'phone_number', ar: 'الجوال', en: 'Phone', required: true, placeholder: '+201000000000' },
              { key: 'vehicle_plate', ar: 'لوحة المركبة', en: 'Plate' },
              { key: 'is_online', ar: 'متصل', en: 'Online', type: 'boolean' },
            ]} />
        )}
        {wsDriver && <DriverWorkspace driver={wsDriver} lang={lang} onClose={() => setWsDriver(null)} />}
        {wsVehicle && <VehicleWorkspace vehicle={wsVehicle} lang={lang} onClose={() => setWsVehicle(null)} />}
        {wsMerchant && <MerchantWorkspace merchant={wsMerchant} lang={lang} onClose={() => setWsMerchant(null)} />}
        {wsOrder && <OrderWorkspace order={wsOrder} lang={lang} onClose={() => setWsOrder(null)} />}
        {wsCustomer && <CustomerWorkspace customer={wsCustomer} lang={lang} onClose={() => setWsCustomer(null)} />}
        {wsBranch && <BranchWorkspace branch={wsBranch} lang={lang} onClose={() => setWsBranch(null)} />}

        {/* ── White Label — tenant provisioning + lifecycle (real multi-tenant control) ── */}
        {activeTab === 'tenants' && (
          <CrudManager key={tenantReload} table="tenants" Icon={Building2} lang={lang} onRowOpen={setWsTenant}
            titleAr="العلامة البيضاء" titleEn="White Label" subtitleAr="إدارة المستأجرين · الهوية · الاشتراك" subtitleEn="Tenants · branding · subscription"
            fields={[
              { key: 'brand_name', ar: 'اسم العلامة', en: 'Brand name', required: true },
              { key: 'subdomain', ar: 'النطاق الفرعي', en: 'Subdomain', placeholder: 'brand' },
              { key: 'status', ar: 'الحالة', en: 'Status', type: 'select', options: [{ value: 'draft', ar: 'مسودة', en: 'Draft' }, { value: 'active', ar: 'نشط', en: 'Active' }, { value: 'suspended', ar: 'معلّق', en: 'Suspended' }, { value: 'archived', ar: 'مؤرشف', en: 'Archived' }] },
              { key: 'plan', ar: 'الخطة', en: 'Plan', type: 'select', options: [{ value: 'free', ar: 'مجاني', en: 'Free' }, { value: 'starter', ar: 'مبتدئ', en: 'Starter' }, { value: 'business', ar: 'أعمال', en: 'Business' }, { value: 'enterprise', ar: 'مؤسسي', en: 'Enterprise' }] },
              { key: 'vertical', ar: 'القطاع', en: 'Vertical', type: 'select', options: [{ value: 'food', ar: 'طعام', en: 'Food' }, { value: 'market', ar: 'بقالة', en: 'Market' }, { value: 'pharmacy', ar: 'صيدلية', en: 'Pharmacy' }, { value: 'flowers', ar: 'ورود', en: 'Flowers' }, { value: 'express', ar: 'سريع', en: 'Express' }, { value: 'logistics', ar: 'لوجستيات', en: 'Logistics' }] },
              { key: 'country_code', ar: 'الدولة', en: 'Country', placeholder: 'SA' },
              { key: 'primary_color', ar: 'اللون الأساسي', en: 'Primary color', placeholder: '#A3F95B' },
            ]} />
        )}
        {wsTenant && <TenantWorkspace tenant={wsTenant} lang={lang} onClose={() => setWsTenant(null)} onChanged={() => setTenantReload(n => n + 1)} />}
        {activeTab === 'mgmt' && mgmtTab === 'vehicles' && (
          <CrudManager table="vehicles" Icon={Truck} lang={lang} onRowOpen={setWsVehicle}
            titleAr="إدارة المركبات" titleEn="Vehicles" subtitleAr="الأسطول · النوع · الصيانة · التأمين" subtitleEn="Fleet · type · maintenance · insurance"
            fields={[
              { key: 'plate', ar: 'اللوحة', en: 'Plate', required: true, placeholder: 'ABC-1234' },
              { key: 'vehicle_type', ar: 'النوع', en: 'Type', type: 'select', options: [{ value: 'motorcycle', ar: 'دراجة نارية', en: 'Motorcycle' }, { value: 'car', ar: 'سيارة', en: 'Car' }, { value: 'bicycle', ar: 'دراجة', en: 'Bicycle' }, { value: 'van', ar: 'شاحنة صغيرة', en: 'Van' }] },
              { key: 'status', ar: 'الحالة', en: 'Status', type: 'select', options: [{ value: 'active', ar: 'نشطة', en: 'Active' }, { value: 'maintenance', ar: 'صيانة', en: 'Maintenance' }, { value: 'retired', ar: 'متوقفة', en: 'Retired' }] },
              { key: 'insurance_expiry', ar: 'انتهاء التأمين', en: 'Insurance expiry', placeholder: 'YYYY-MM-DD' },
              { key: 'license_expiry', ar: 'انتهاء الرخصة', en: 'License expiry', placeholder: 'YYYY-MM-DD' },
              { key: 'driver_id', ar: 'المندوب المعيّن', en: 'Assigned driver', type: 'relation', relation: { table: 'drivers', labelKey: 'full_name' } },
            ]} />
        )}
        {activeTab === 'mgmt' && mgmtTab === 'merchants' && (
          <CrudManager table="merchants" Icon={Store} lang={lang} onRowOpen={setWsMerchant}
            titleAr="إدارة التجّار" titleEn="Merchants" subtitleAr="المتاجر · التواصل" subtitleEn="Stores · contact"
            fields={[
              { key: 'business_name', ar: 'اسم النشاط', en: 'Business name', required: true },
              { key: 'contact_email', ar: 'البريد', en: 'Email' },
              { key: 'contact_phone', ar: 'الجوال', en: 'Phone' },
            ]} />
        )}
        {activeTab === 'mgmt' && mgmtTab === 'branches' && (
          <CrudManager table="merchant_branches" Icon={Building2} lang={lang} onRowOpen={setWsBranch}
            titleAr="إدارة الفروع" titleEn="Branches" subtitleAr="فروع المتاجر · الحالة" subtitleEn="Store branches · status"
            fields={[
              { key: 'name', ar: 'اسم الفرع', en: 'Branch name', required: true },
              { key: 'merchant_id', ar: 'التاجر', en: 'Merchant', type: 'relation', relation: { table: 'merchants', labelKey: 'business_name' } },
              { key: 'zone_id', ar: 'المنطقة', en: 'Zone', type: 'relation', relation: { table: 'zones', labelKey: 'name' } },
              { key: 'is_active', ar: 'نشط', en: 'Active', type: 'boolean' },
            ]} />
        )}
        {activeTab === 'mgmt' && mgmtTab === 'orders' && (
          <CrudManager table="orders" Icon={ClipboardList} lang={lang} searchKeys={['status']} onRowOpen={setWsOrder}
            titleAr="إدارة الطلبات" titleEn="Orders" subtitleAr="الطلبات · الحالة · المبلغ" subtitleEn="Orders · status · amount"
            fields={[
              { key: 'status', ar: 'الحالة', en: 'Status', type: 'select', options: [{ value: 'pending', ar: 'قيد الانتظار', en: 'Pending' }, { value: 'confirmed', ar: 'مؤكد', en: 'Confirmed' }, { value: 'preparing', ar: 'قيد التحضير', en: 'Preparing' }, { value: 'delivering', ar: 'قيد التوصيل', en: 'Delivering' }, { value: 'delivered', ar: 'تم التوصيل', en: 'Delivered' }, { value: 'cancelled', ar: 'ملغي', en: 'Cancelled' }] },
              { key: 'total_amount', ar: 'المبلغ', en: 'Amount', type: 'number' },
              { key: 'driver_id', ar: 'المندوب', en: 'Driver', type: 'relation', relation: { table: 'drivers', labelKey: 'full_name' } },
              { key: 'customer_id', ar: 'العميل', en: 'Customer', type: 'relation', relation: { table: 'customers', labelKey: 'full_name' } },
              { key: 'branch_id', ar: 'الفرع', en: 'Branch', type: 'relation', relation: { table: 'merchant_branches', labelKey: 'name' } },
            ]} />
        )}
        {activeTab === 'mgmt' && mgmtTab === 'customers' && (
          <CrudManager table="customers" Icon={Users} lang={lang} onRowOpen={setWsCustomer}
            titleAr="إدارة العملاء" titleEn="Customers" subtitleAr="العملاء · التواصل" subtitleEn="Customers · contact"
            fields={[
              { key: 'full_name', ar: 'الاسم', en: 'Full name' },
              { key: 'phone_number', ar: 'الجوال', en: 'Phone', required: true, placeholder: '+201000000000' },
              { key: 'email', ar: 'البريد', en: 'Email' },
            ]} />
        )}
        {activeTab === 'notifications' && <NotificationCenter adminId={adminId} lang={lang} onUnread={setNotifBadge} />}
        {activeTab === 'logs' && isSuper && <SystemLogs lang={lang} />}

        {activeTab === 'design' && isSuper && <DesignCenter />}

        {/* TAB: CAMPAIGN CENTER (super admin only)           */}
        {activeTab === 'campaigns' && isSuper && <CampaignCenter />}

        {/* TAB: APP CONFIG                                    */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="admin_config_tab">

            {/* Config form */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-6" id="config_form_box">
              <div className="flex items-center justify-end gap-2.5 pb-4 border-b border-[rgba(255,255,255,0.06)]">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{L('تعديل المتغيرات','Edit settings')}</h3>
                <Icon name="tune" size={20} className="text-[var(--color-primary-container)]" fill={1} />
              </div>

              <div className="space-y-5" id="config_inputs">
                {/* Delivery fee */}
                <div className="space-y-3">
                  <Input
                    label={`${L('رسوم التوصيل الافتراضية','Default delivery fee')} (${cur})`}
                    type="number"
                    step="0.1"
                    value={configFee}
                    onChange={(e) => setConfigFee(e.target.value)}
                    id="config_fee_input"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={payoutLoading}
                      onClick={() => handleSaveConfig('MIN_DELIVERY_FEE', configFee, L('الحد الأدنى لرسوم التوصيل','Minimum delivery fee'))}
                    >
                      {L('تحديث الرسوم','Update fee')}
                    </Button>
                  </div>
                </div>

                <Divider />

                {/* Welcome SMS */}
                <div className="space-y-3">
                  <label className="text-label-sm text-[var(--color-on-surface-variant)] block text-end">
                    {L('رسالة الترحيب (SMS)','Welcome message (SMS)')}
                  </label>
                  <textarea
                    rows={3}
                    value={configMessage}
                    onChange={(e) => setConfigMessage(e.target.value)}
                    className="w-full p-4 rounded-[var(--radius-row)] text-body-md resize-none input-silver"
                    style={{ direction: 'rtl' }}
                    id="config_msg_input"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={payoutLoading}
                      onClick={() => handleSaveConfig('WELCOME_SMS_MESSAGE', configMessage, L('نص رسالة التحقق','Verification message text'))}
                    >
                      {L('حفظ الرسالة','Save message')}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Info card */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-4" id="config_db_status_card">
              <div className="flex items-center justify-end gap-2.5">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{L('دليل التكوين','Configuration guide')}</h3>
                <Icon name="help" size={20} className="text-[var(--color-secondary)]" fill={1} />
              </div>
              <div className="space-y-3">
                {[
                  L('الضغط على تحديث يُنفّذ UPSERT على جدول app_config في Supabase.','Clicking Update performs an UPSERT on the app_config table in Supabase.'),
                  L('تقرأ اللوحات التجارية هذه المتغيرات عند الدخول.','Business panels read these settings on login.'),
                  L('جميع التغييرات فورية وتطبق على جميع المستخدمين.','All changes are instant and apply to all users.'),
                ].map((text, i) => (
                  <div key={i} className="flex gap-3 items-start justify-end">
                    <p className="text-body-md text-[var(--color-on-surface-variant)] text-end leading-relaxed" style={{ direction: 'rtl' }}>{text}</p>
                    <Icon name="info" size={16} fill={1} className="text-[var(--color-secondary)] shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB: HELPDESK SUPPORT                              */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="admin_support_tab">

            {/* Ticket list — col 5 */}
            <div className="lg:col-span-5 space-y-3" id="tickets_list_col">
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                {L('البلاغات الواردة','Incoming reports')} ({tickets.length})
              </h3>

              <Card variant="z3" radius="xl" padding="p-3" className="max-h-[60vh] overflow-y-auto space-y-2" id="tickets_scroller">
                {tickets.length === 0 ? (
                  <EmptyState icon="inbox" title={L('لا توجد بلاغات','No reports')} description={L('لا توجد تذاكر دعم مفتوحة','No open support tickets')} />
                ) : (
                  tickets.map((tkt) => {
                    const isSelected = selectedTicketId === tkt.id;
                    return (
                      <div
                        key={tkt.id}
                        onClick={() => handleSelectTicket(tkt.id)}
                        className="p-4 rounded-[var(--radius-lg)] cursor-pointer transition-all space-y-2"
                        style={{
                          background: isSelected ? 'rgba(158,212,66,0.08)' : 'linear-gradient(180deg, #1e2227 0%, #15181b 100%)',
                          borderTop: isSelected ? '1px solid rgba(158,212,66,0.45)' : '1px solid rgba(255,255,255,0.06)',
                          borderLeft: '1px solid rgba(255,255,255,0.04)',
                          borderRight: '1px solid rgba(255,255,255,0.04)',
                          borderBottom: '1px solid rgba(255,255,255,0.02)',
                        }}
                        id={`ticket_item_${tkt.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant={PRIORITY_VARIANT[tkt.priority] || 'neutral'}>
                            {tkt.priority}
                          </Badge>
                          <span className="text-label-md font-semibold text-[var(--color-on-surface)]">
                            {tkt.customers?.full_name || L('عميل','Customer')}
                          </span>
                        </div>
                        <p className="text-label-md text-[var(--color-on-surface-variant)] line-clamp-2 text-end leading-relaxed" style={{ textTransform: 'none' }}>
                          {tkt.subject}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none', letterSpacing: 0 }}>
                            #{tkt.id.slice(-6).toUpperCase()}
                          </span>
                          <Badge variant={tkt.status === 'open' ? 'error' : tkt.status === 'resolved' ? 'success' : 'secondary'}>
                            {tkt.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>
            </div>

            {/* Conversation — col 7 */}
            <div className="lg:col-span-7 space-y-4" id="reply_ticket_box">
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{L('المحادثة','Conversation')}</h3>

              {!selectedTicketId ? (
                <EmptyState
                  icon="forum"
                  title={L('لم يتم تحديد تذكرة','No ticket selected')}
                  description={L('اختر تذكرة من القائمة للرد','Select a ticket from the list to reply')}
                />
              ) : (
                <Card variant="z3" radius="xl" padding="p-5" className="space-y-4" id="ticket_messages_card">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.06)]" id="ticket_details_header">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={payoutLoading}
                      onClick={() => handleCloseTicket(selectedTicketId)}
                      leftIcon={<Icon name="check_circle" size={14} fill={1} />}
                    >
                      {L('تحديد كـ محلول','Mark as resolved')}
                    </Button>
                    <div className="text-end">
                      <p className="text-label-md font-semibold text-[var(--color-on-surface)]">
                        {L('البلاغ','Report')} #{selectedTicketId.slice(-6).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  {payoutLoading ? (
                    <Loader className="mx-auto" size={28} />
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto" id="ticket_messages_list">
                      {ticketMessages.length === 0 ? (
                        <p className="text-label-md text-[var(--color-on-surface-variant)] text-center py-6" style={{ textTransform: 'none' }}>
                          {L('لا توجد رسائل سابقة.','No previous messages.')}
                        </p>
                      ) : (
                        ticketMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={[
                              'p-3 rounded-[var(--radius-lg)] max-w-[80%] space-y-1',
                              msg.sender_type === 'admin' ? 'ms-auto' : 'me-auto',
                            ].join(' ')}
                            style={{
                              background: msg.sender_type === 'admin'
                                ? 'rgba(158,212,66,0.12)'
                                : 'linear-gradient(180deg, #1e2227 0%, #15181b 100%)',
                              border: msg.sender_type === 'admin'
                                ? '1px solid rgba(158,212,66,0.3)'
                                : '1px solid rgba(255,255,255,0.06)',
                            }}
                            id={`tmsg_${msg.id}`}
                          >
                            <p className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none' }}>
                              {msg.sender_type === 'admin' ? L('الإدارة','Admin') : L('العميل','Customer')}
                            </p>
                            <p className="text-label-md text-[var(--color-on-surface)] leading-relaxed text-end" style={{ textTransform: 'none', direction: 'rtl' }}>
                              {msg.message_text}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <Divider />

                  {/* Reply form */}
                  <form onSubmit={handleSendAdminReply} className="flex gap-3" id="ticket_reply_form">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={payoutLoading}
                    >
                      {L('رد', 'Reply')}
                    </Button>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      placeholder={L('اكتب ردك...','Type your reply…')}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 h-11 px-4 rounded-[var(--radius-row)] text-label-md input-silver"
                      style={{ direction: 'rtl' }}
                      id="ticket_reply_inp"
                    />
                  </form>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
