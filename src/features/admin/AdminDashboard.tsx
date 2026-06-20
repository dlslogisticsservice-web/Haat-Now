import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminService } from '../../services/admin.service';
import { Icon } from '../../components/ui/Icon';
import { Card, StatCard } from '../../components/ui/Card';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EnterpriseSidebar, SidebarSection } from '../../components/ui/EnterpriseSidebar';
import { sandboxStore } from '../../services/sandboxStore';
import { Loader, EmptyState, Divider } from '../../components/ui/Primitives';

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

type AdminTab = 'kpi' | 'config' | 'support';

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    items: [
      { id: 'kpi',     label: 'الإحصائيات',   icon: 'bar_chart' },
      { id: 'config',  label: 'المتغيرات',     icon: 'tune' },
      { id: 'support', label: 'Helpdesk',      icon: 'support_agent' },
    ],
  },
];

const PRIORITY_VARIANT: Record<string, 'error' | 'warning' | 'neutral' | 'secondary'> = {
  critical: 'error', high: 'error', medium: 'warning', low: 'neutral',
};

interface AdminDashboardProps { adminId: string; onLogout: () => void }

export const AdminDashboard = ({ adminId, onLogout }: AdminDashboardProps) => {
  const { country, lang, toggleLang } = useAppConfig();
  const cur = country.currency.symbolAr;
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

  useEffect(() => { fetchAdminModuleData(); }, []);

  // ── Business logic (ALL UNCHANGED) ───────────────────────
  const fetchAdminModuleData = async () => {
    try {
      setLoading(true);
      if (import.meta.env.VITE_AUTH_MODE === 'sandbox') {
        const sb = sandboxStore.getOrders();
        setAnalytics({ totalOrders: sb.length, totalMerchants: 1, totalDrivers: 1 });
        setTickets([]);
        return;
      }
      const { data: analyticsData } = await adminService.getGlobalAnalytics();
      if (analyticsData) setAnalytics(analyticsData);
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
    if (error) alert(`خطأ في الحفظ: ${(error as any).message}`);
    else { alert('تم تحديث التكوين بنجاح 🟢'); await fetchAdminModuleData(); }
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
    if (error) alert((error as any).message);
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
    alert('تم تحديد التذكرة كـ "محلول" 🟢');
    await fetchAdminModuleData(); setSelectedTicketId(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" id="admin_module_loader">
        <Loader size={36} />
        <p className="text-body-md text-[var(--color-on-surface-variant)]">جاري تحميل لوحة الإدارة...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" id="admin_dashboard_full">

      {/* ── Enterprise Sidebar ──────────────────────────────── */}
      <EnterpriseSidebar
        sections={SIDEBAR_SECTIONS.map(s => ({
          ...s,
          items: s.items.map(item => ({
            ...item,
            badge: item.id === 'support' && tickets.filter(t => t.status === 'open').length > 0
              ? tickets.filter(t => t.status === 'open').length : undefined,
          })),
        }))}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as AdminTab)}
        brandName="HAAT NOW"
        brandSubtitle="لوحة الإدارة"
        userInfo={{ name: 'مشغّل النظام', role: 'Super Admin' }}
      />

      {/* ── Main Content ───────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen overflow-y-auto p-6 md:p-8 space-y-6 md:ms-[280px]"
        id="admin_main_content"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3" id="admin_title_card">
          <div className="flex items-center gap-1.5">
            <Button
              variant="danger"
              size="sm"
              onClick={onLogout}
              id="admin_logout_btn"
              leftIcon={<Icon name="logout" size={16} />}
            >
              تسجيل الخروج
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLang}
              id="admin_lang_btn"
              leftIcon={<Icon name="language" size={16} />}
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAdminModuleData}
              id="admin_refresh_btn"
              leftIcon={<Icon name="refresh" size={16} />}
            >
              تحديث
            </Button>
          </div>
          <div className="text-end hidden sm:block">
            <div className="flex items-center gap-2.5 justify-end">
              <h1 className="text-headline-lg-mobile font-bold text-[var(--color-on-surface)]">
                لوحة تحكم الإدارة
              </h1>
              <Icon name="admin_panel_settings" size={24} className="text-[var(--color-primary-container)]" fill={1} />
            </div>
            <p className="text-body-md text-[var(--color-on-surface-variant)] mt-0.5">
              إدارة الرسوم والمتغيرات وتذاكر الدعم
            </p>
          </div>
        </div>

        {/* ── Mobile tab navigation (sidebar is desktop-only) ── */}
        <div className="md:hidden flex gap-2" id="admin_mobile_tabs">
          {SIDEBAR_SECTIONS[0].items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`admin_mtab_${item.id}`}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[var(--radius-lg)] text-label-md font-medium transition-all cursor-pointer"
                style={{
                  background: isActive ? 'var(--color-secondary-container)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? 'var(--color-on-secondary-container)' : 'var(--color-on-surface-variant)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon name={item.icon} size={16} fill={isActive ? 1 : 0} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB: KPI ANALYTICS                                 */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'kpi' && (
          <div className="space-y-5" id="admin_kpis_tab">

            {/* Platform Health Hero */}
            <div
              className="surface-z4 rounded-[var(--radius-sheet)] p-6 flex items-center justify-between"
              id="admin_platform_health_hero"
            >
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--color-lime-vb, #9ed442)', boxShadow: '0 0 10px rgba(158,212,66,0.6)' }} />
                <div>
                  <p className="text-label-sm font-semibold" style={{ color: 'var(--color-lime-vb, #9ed442)', textTransform: 'none' }}>المنصة تعمل بكامل طاقتها</p>
                  <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>Supabase · Sandbox Mode</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-headline-sm font-bold" style={{ color: 'var(--color-t2, #f2f4f6)' }}>{analytics.totalMerchants}</p>
                  <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>تاجر</p>
                </div>
                <div>
                  <p className="text-headline-sm font-bold" style={{ color: 'var(--color-t2, #f2f4f6)' }}>{analytics.totalOrders}</p>
                  <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>طلب</p>
                </div>
                <div>
                  <p className="text-headline-sm font-bold" style={{ color: 'var(--color-t2, #f2f4f6)' }}>{analytics.totalDrivers}</p>
                  <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>سائق</p>
                </div>
              </div>
            </div>

            {/* ── ASYMMETRIC KPI AREA: dominant orders (col-7) + stacked metrics (col-5) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="admin_kpis_grid">

              {/* DOMINANT: Total orders with trend visualization */}
              <Card variant="z3" radius="xl" padding="p-6" className="lg:col-span-7 space-y-5">
                <div className="flex items-start justify-between">
                  <Icon name="receipt_long" size={20} className="text-[var(--color-secondary)]" fill={1} />
                  <div className="text-end">
                    <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>إجمالي نشاط المنصة</p>
                    <p className="text-display-md font-bold leading-none mt-1" style={{ color: 'var(--color-t2, #f2f4f6)' }}>{analytics.totalOrders}</p>
                    <p className="text-label-sm mt-0.5" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>إجمالي الطلبات</p>
                  </div>
                </div>

                {/* Trend bars visualization */}
                <div>
                  <p className="text-label-sm mb-2 text-end" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>نشاط المنصة (7 أيام)</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {[35, 55, 40, 80, 60, 90, Math.min(100, analytics.totalOrders * 5 + 20)].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${h}%`, background: i === 6 ? 'rgba(158,212,66,0.55)' : 'rgba(255,255,255,0.08)' }} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    {['أحد','اث','ثلا','أرب','خم','جم','اليوم'].map(d => (
                      <span key={d} style={{ fontSize: '9px', color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>{d}</span>
                    ))}
                  </div>
                </div>

                {/* Supporting metrics row */}
                <div className="grid grid-cols-3 gap-4 border-t border-[rgba(255,255,255,0.06)] pt-4">
                  {[
                    { label: 'معدل الاكتمال', val: '94%',       color: 'var(--color-tertiary-container)' },
                    { label: 'متوسط التوصيل', val: '28 دقيقة',  color: 'var(--color-secondary)' },
                    { label: 'تقييم المنصة',  val: '4.7 ⭐',   color: 'var(--color-primary-container)' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="text-center">
                      <p className="text-label-md font-bold" style={{ color, textTransform: 'none' }}>{val}</p>
                      <p className="text-label-sm mt-0.5" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* SECONDARY: Merchants + Drivers stacked */}
              <div className="lg:col-span-5 space-y-3">
                <StatCard
                  label="الشركاء التجاريون"
                  value={analytics.totalMerchants}
                  icon={<Icon name="storefront" size={18} fill={1} />}
                  accentColor="var(--color-primary-container)"
                />
                <StatCard
                  label="كباتن التوصيل"
                  value={analytics.totalDrivers}
                  icon={<Icon name="delivery_dining" size={18} fill={1} />}
                  accentColor="var(--color-tertiary-container)"
                />
                {/* Ticket queue card */}
                <Card variant="z3" radius="xl" padding="p-4" className="space-y-3">
                  <div className="flex items-center justify-end gap-2">
                    <h4 className="text-label-md font-semibold text-[var(--color-on-surface)]">حالة الدعم</h4>
                    <Icon name="queue" size={16} className="text-[var(--color-secondary)]" fill={1} />
                  </div>
                  {[
                    { label: 'مفتوحة',    val: tickets.filter(t => t.status === 'open').length,        color: 'var(--color-error)' },
                    { label: 'قيد المعالجة', val: tickets.filter(t => t.status === 'in_progress').length, color: 'var(--color-primary-container)' },
                    { label: 'محلولة',    val: tickets.filter(t => t.status === 'resolved').length,    color: 'var(--color-tertiary-container)' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-headline-sm font-bold" style={{ color }}>{val}</span>
                      <span className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none' }}>{label}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>

            {/* ── ACTIVITY FEED ── */}
            <Card variant="z3" radius="xl" padding="p-5" className="space-y-4" id="admin_activity_feed">
              <div className="flex items-center justify-end gap-2.5">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">آخر النشاطات</h3>
                <Icon name="history" size={20} className="text-[var(--color-primary-container)]" fill={1} />
              </div>
              {tickets.length === 0 ? (
                <p className="text-label-md text-[var(--color-on-surface-variant)] text-center py-4" style={{ textTransform: 'none' }}>لا توجد نشاطات بعد.</p>
              ) : (
                <div className="space-y-0 divide-y divide-[rgba(255,255,255,0.04)]">
                  {tickets.slice(0, 5).map((tkt) => (
                    <div key={tkt.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={tkt.status === 'open' ? 'error' : tkt.status === 'resolved' ? 'success' : 'secondary'}>
                          {tkt.status}
                        </Badge>
                        <span className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none', letterSpacing: 0 }}>
                          #{tkt.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <div className="text-end">
                        <p className="text-label-md font-medium text-[var(--color-on-surface)]" style={{ textTransform: 'none' }}>
                          {tkt.customers?.full_name || 'عميل'}
                        </p>
                        <p className="text-label-sm text-[var(--color-on-surface-variant)] truncate max-w-[200px]" style={{ textTransform: 'none' }}>
                          {tkt.subject}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB: APP CONFIG                                    */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="admin_config_tab">

            {/* Config form */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-6" id="config_form_box">
              <div className="flex items-center justify-end gap-2.5 pb-4 border-b border-[rgba(255,255,255,0.06)]">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">تعديل المتغيرات</h3>
                <Icon name="tune" size={20} className="text-[var(--color-primary-container)]" fill={1} />
              </div>

              <div className="space-y-5" id="config_inputs">
                {/* Delivery fee */}
                <div className="space-y-3">
                  <Input
                    label={`رسوم التوصيل الافتراضية (${cur})`}
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
                      onClick={() => handleSaveConfig('MIN_DELIVERY_FEE', configFee, 'الحد الأدنى لرسوم التوصيل')}
                    >
                      تحديث الرسوم
                    </Button>
                  </div>
                </div>

                <Divider />

                {/* Welcome SMS */}
                <div className="space-y-3">
                  <label className="text-label-sm text-[var(--color-on-surface-variant)] block text-end">
                    رسالة الترحيب (SMS)
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
                      onClick={() => handleSaveConfig('WELCOME_SMS_MESSAGE', configMessage, 'نص رسالة التحقق')}
                    >
                      حفظ الرسالة
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Info card */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-4" id="config_db_status_card">
              <div className="flex items-center justify-end gap-2.5">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">دليل التكوين</h3>
                <Icon name="help" size={20} className="text-[var(--color-secondary)]" fill={1} />
              </div>
              <div className="space-y-3">
                {[
                  'الضغط على تحديث يُنفّذ UPSERT على جدول app_config في Supabase.',
                  'تقرأ اللوحات التجارية هذه المتغيرات عند الدخول.',
                  'جميع التغييرات فورية وتطبق على جميع المستخدمين.',
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
                البلاغات الواردة ({tickets.length})
              </h3>

              <Card variant="z3" radius="xl" padding="p-3" className="max-h-[60vh] overflow-y-auto space-y-2" id="tickets_scroller">
                {tickets.length === 0 ? (
                  <EmptyState icon="inbox" title="لا توجد بلاغات" description="لا توجد تذاكر دعم مفتوحة" />
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
                            {tkt.customers?.full_name || 'عميل'}
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
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">المحادثة</h3>

              {!selectedTicketId ? (
                <EmptyState
                  icon="forum"
                  title="لم يتم تحديد تذكرة"
                  description="اختر تذكرة من القائمة للرد"
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
                      تحديد كـ محلول
                    </Button>
                    <div className="text-end">
                      <p className="text-label-md font-semibold text-[var(--color-on-surface)]">
                        البلاغ #{selectedTicketId.slice(-6).toUpperCase()}
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
                          لا توجد رسائل سابقة.
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
                              {msg.sender_type === 'admin' ? 'الإدارة' : 'العميل'}
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
                      رد
                    </Button>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      placeholder="اكتب ردك..."
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
