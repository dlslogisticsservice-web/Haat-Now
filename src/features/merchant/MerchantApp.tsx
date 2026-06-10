import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { merchantService } from '../../services/merchant.service';
import { orderService } from '../../services/order.service';
import { Icon } from '../../components/ui/Icon';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EnterpriseSidebar, SidebarSection } from '../../components/ui/EnterpriseSidebar';
import { Loader, EmptyState, Divider } from '../../components/ui/Primitives';

// ── Types (unchanged) ─────────────────────────────────────────
interface Order {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_id: string;
  customers?: { full_name: string; phone_number: string };
  order_items?: Array<{
    id: string; quantity: number; price: number;
    product_variants?: { name: string; products?: { name: string } };
  }>;
}
interface Product  { id: string; name: string; price: number; category_id: string }
interface Category { id: string; name: string }

type MerchantTab = 'incoming' | 'catalog' | 'wallet';

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    items: [
      { id: 'incoming', label: 'الطلبات النشطة',    icon: 'notifications_active' },
      { id: 'catalog',  label: 'المنيو والأسعار',    icon: 'restaurant_menu' },
      { id: 'wallet',   label: 'تقارير الأرباح',     icon: 'payments' },
    ],
  },
];

const ORDER_STATUS_CFG: Record<string, { label: string; variant: 'warning' | 'secondary' | 'primary' | 'success' | 'error' | 'neutral' }> = {
  pending:    { label: 'انتظار',      variant: 'warning' },
  accepted:   { label: 'مقبول',       variant: 'secondary' },
  preparing:  { label: 'يُحضَّر',     variant: 'secondary' },
  on_the_way: { label: 'في الطريق',   variant: 'primary' },
  delivered:  { label: 'مكتمل',       variant: 'success' },
  cancelled:  { label: 'ملغي',        variant: 'error' },
};

export const MerchantApp = () => {
  // ── State (unchanged) ─────────────────────────────────────
  const [branches,          setBranches]          = useState<any[]>([]);
  const [selectedBranchId,  setSelectedBranchId]  = useState<string>('');
  const [orders,            setOrders]            = useState<Order[]>([]);
  const [products,          setProducts]          = useState<Product[]>([]);
  const [categories,        setCategories]        = useState<Category[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [actionLoading,     setActionLoading]     = useState(false);
  const [newProductName,    setNewProductName]    = useState('');
  const [newProductPrice,   setNewProductPrice]   = useState('');
  const [selectedCategoryId,setSelectedCategoryId]= useState('');
  const [isAddingProduct,   setIsAddingProduct]   = useState(false);
  const [activeTab,         setActiveTab]         = useState<MerchantTab>('incoming');
  const [earnings,          setEarnings]          = useState(0);

  useEffect(() => { fetchMerchantMetadata(); }, []);

  // ── Business logic (ALL UNCHANGED) ───────────────────────
  const fetchMerchantMetadata = async () => {
    try {
      setLoading(true);
      const { data: bData } = await supabase.from('merchant_branches').select('*');
      if (bData && bData.length > 0) {
        setBranches(bData);
        setSelectedBranchId(bData[0].id);
        const { data: catData } = await supabase.from('categories').select('*');
        if (catData) { setCategories(catData); if (catData.length > 0) setSelectedCategoryId(catData[0].id); }
        await reloadBranchData(bData[0].id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const reloadBranchData = async (bId: string) => {
    try {
      const { data: ordData } = await merchantService.getBranchOrders(bId);
      if (ordData) {
        setOrders(ordData as unknown as Order[]);
        const total = ordData.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount - 10), 0);
        setEarnings(Math.max(0, total));
      }
      const { data: prodData } = await supabase.from('products').select('*').eq('branch_id', bId);
      if (prodData) setProducts(prodData);
    } catch (ex) { console.error(ex); }
  };

  const handleBranchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value; setSelectedBranchId(val); await reloadBranchData(val);
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setActionLoading(true);
    let notes = '';
    if (status === 'accepted')   notes = 'تم قبول طلبكم.';
    if (status === 'preparing')  notes = 'جاري تجهيز طلبكم الآن.';
    if (status === 'on_the_way') notes = 'خرج المندوب.';
    const { error } = await orderService.updateOrderStatus(orderId, status, notes);
    setActionLoading(false);
    if (error) alert(`خطأ: ${(error as any).message}`);
    else await reloadBranchData(selectedBranchId);
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice || !selectedCategoryId) return;
    setActionLoading(true);
    try {
      const { error } = await merchantService.upsertProduct({
        branch_id: selectedBranchId, category_id: selectedCategoryId,
        name: newProductName, price: Number(newProductPrice),
      });
      if (error) alert(`Failed to add product: ${(error as any).message}`);
      else { setNewProductName(''); setNewProductPrice(''); setIsAddingProduct(false); await reloadBranchData(selectedBranchId); }
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!window.confirm('مسح هذا المنتج نهائياً؟')) return;
    setActionLoading(true);
    const { error } = await merchantService.deleteProduct(prodId);
    setActionLoading(false);
    if (error) alert(`لا يمكن مسح المنتج. ${(error as any).message}`);
    else await reloadBranchData(selectedBranchId);
  };

  const handleQuickPriceUpdate = async (product: Product, newPrice: string) => {
    const val = Number(newPrice);
    if (isNaN(val) || val <= 0) return;
    setActionLoading(true);
    const { error } = await merchantService.upsertProduct({
      id: product.id, branch_id: selectedBranchId, category_id: product.category_id,
      name: product.name, price: val,
    });
    setActionLoading(false);
    if (error) alert((error as any).message);
    else await reloadBranchData(selectedBranchId);
  };

  const activeOrdersList = orders.filter(o => ['pending', 'accepted', 'preparing', 'on_the_way'].includes(o.status));
  const archOrdersList   = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));
  const deliveredCount   = archOrdersList.filter(o => o.status === 'delivered').length;
  const avgBasket        = deliveredCount > 0
    ? archOrdersList.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total_amount - 10), 0) / deliveredCount
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader size={36} />
        <p className="text-body-md text-[var(--color-on-surface-variant)]">جاري تحميل بيانات الفرع...</p>
      </div>
    );
  }

  const tabLabels: Record<MerchantTab, string> = {
    incoming: `الطلبات النشطة${activeOrdersList.length > 0 ? ` (${activeOrdersList.length})` : ''}`,
    catalog:  'المنيو والأسعار',
    wallet:   'تقارير الأرباح',
  };

  return (
    <div className="flex min-h-screen" id="merchant_portal_full">

      {/* ── Enterprise Sidebar ──────────────────────────────── */}
      <EnterpriseSidebar
        sections={SIDEBAR_SECTIONS.map(s => ({
          ...s,
          items: s.items.map(item => ({
            ...item,
            badge: item.id === 'incoming' && activeOrdersList.length > 0 ? activeOrdersList.length : undefined,
          })),
        }))}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as MerchantTab)}
        brandName="HAAT NOW"
        brandSubtitle="بوابة التاجر"
        userInfo={{ name: branches[0]?.name || 'الفرع', role: 'شريك تجاري' }}
      />

      {/* ── Main content ───────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen overflow-y-auto p-6 md:p-8 space-y-8"
        style={{ marginInlineStart: 'var(--spacing-sidebar)' }}
        id="merchant_main_content"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap" id="merchant_branch_header_card">
          <div className="flex flex-col gap-1.5" id="merch_main_title">
            <h1 className="text-headline-lg-mobile font-bold text-[var(--color-on-surface)]">
              {tabLabels[activeTab]}
            </h1>
            <p className="text-body-md text-[var(--color-on-surface-variant)]">
              إدارة الطلبات والمنيو بالوقت الفعلي
            </p>
          </div>

          {/* Branch selector */}
          <div className="flex flex-col gap-1.5 min-w-[200px]" id="select_field_wrapper">
            <label className="text-label-sm text-[var(--color-on-surface-variant)]">الفرع النشط</label>
            <select
              value={selectedBranchId || ''}
              onChange={handleBranchChange}
              className="h-11 px-4 rounded-[var(--radius)] text-label-md text-[var(--color-on-surface)] focus:outline-none cursor-pointer"
              style={{ background: 'var(--color-surface-container-high)', border: '1px solid rgba(255,255,255,0.1)' }}
              id="branch_selector"
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        {/* ── Stats Row ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="الطلبات النشطة"   value={activeOrdersList.length} icon={<Icon name="notifications_active" size={18} fill={1} />} accentColor="var(--color-primary-container)" />
          <StatCard label="الطلبات المكتملة" value={deliveredCount}           icon={<Icon name="task_alt" size={18} fill={1} />}             accentColor="var(--color-tertiary-container)" />
          <StatCard label="متوسط السلة"      value={`${avgBasket.toFixed(0)} ر.س`} icon={<Icon name="shopping_bag" size={18} fill={1} />}  accentColor="var(--color-secondary)" />
          <StatCard label="إجمالي الأرباح"   value={`${earnings.toFixed(0)} ر.س`} icon={<Icon name="payments" size={18} fill={1} />}       accentColor="var(--color-neon)" />
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB: ACTIVE ORDERS                                 */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'incoming' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="merch_orders_feed_grid">

            {/* Active orders — col 8 */}
            <div className="lg:col-span-8 space-y-4" id="active_orders_list_wrapper">
              {activeOrdersList.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title="لا توجد طلبات نشطة"
                  description="اطلب كعميل وستظهر هنا فوراً!"
                />
              ) : (
                <div className="space-y-4" id="active_orders_grid">
                  {activeOrdersList.map((ord) => {
                    const cfg = ORDER_STATUS_CFG[ord.status] || ORDER_STATUS_CFG.pending;
                    return (
                      <Card
                        key={ord.id}
                        variant="glass"
                        radius="xl"
                        padding="p-5"
                        className="space-y-4"
                        id={`merch_order_card_${ord.id}`}
                      >
                        {/* Order header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
                          <div className="flex items-center gap-2">
                            <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                          </div>
                          <div className="text-end">
                            <p className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                              {ord.customers?.full_name || 'عميل'}
                            </p>
                            <p className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none' }}>
                              {ord.customers?.phone_number || ''}
                            </p>
                          </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-2" id="merch_order_card_body">
                          {ord.order_items?.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between" id={`merch_it_${idx}`}>
                              <span className="text-label-md" style={{ color: 'var(--color-primary-container)', textTransform: 'none' }}>
                                {(it.price * it.quantity).toFixed(2)} ر.س
                              </span>
                              <span className="text-label-md text-[var(--color-on-surface)]" style={{ direction: 'rtl' }}>
                                {it.quantity} × {it.product_variants?.products?.name || 'وجبة'} ({it.product_variants?.name || 'أساسي'})
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between pt-3 border-t border-[rgba(255,255,255,0.06)]">
                          <span className="text-headline-sm font-bold" style={{ color: 'var(--color-primary-container)' }}>
                            {(ord.total_amount - 10).toFixed(2)} ر.س
                          </span>
                          <span className="text-label-md text-[var(--color-on-surface-variant)]">صافي الفرع</span>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 justify-end pt-1" id="merch_order_actions">
                          {ord.status === 'pending' && (
                            <Button
                              variant="primary" size="sm" loading={actionLoading}
                              onClick={() => handleUpdateStatus(ord.id, 'accepted')}
                              leftIcon={<Icon name="check_circle" size={16} fill={1} />}
                            >
                              قبول الطلب
                            </Button>
                          )}
                          {ord.status === 'accepted' && (
                            <Button
                              variant="secondary" size="sm" loading={actionLoading}
                              onClick={() => handleUpdateStatus(ord.id, 'preparing')}
                              leftIcon={<Icon name="restaurant" size={16} fill={1} />}
                            >
                              بدء التحضير
                            </Button>
                          )}
                          {ord.status === 'preparing' && (
                            <Button
                              variant="secondary" size="sm" loading={actionLoading}
                              onClick={() => handleUpdateStatus(ord.id, 'on_the_way')}
                              leftIcon={<Icon name="delivery_dining" size={16} fill={1} />}
                            >
                              تسليم للمندوب
                            </Button>
                          )}
                          <span
                            className="px-3 py-1.5 rounded-full text-label-sm"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}
                          >
                            #{ord.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Archived orders — col 4 */}
            <div className="lg:col-span-4 space-y-3" id="merchant_history_col">
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                الأرشيف ({archOrdersList.length})
              </h3>
              <Card variant="glass" radius="xl" padding="p-4" className="max-h-[500px] overflow-y-auto space-y-3" id="archived_orders_box">
                {archOrdersList.length === 0 ? (
                  <p className="text-label-md text-[var(--color-on-surface-variant)] text-center py-8" style={{ textTransform: 'none' }}>
                    لا توجد طلبات سابقة.
                  </p>
                ) : (
                  archOrdersList.map(o => {
                    const cfg = ORDER_STATUS_CFG[o.status] || ORDER_STATUS_CFG.delivered;
                    return (
                      <div
                        key={o.id}
                        className="p-3 rounded-[var(--radius-lg)] space-y-2"
                        style={{ background: 'var(--color-surface-container-high)' }}
                        id={`arch_card_${o.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                          <span className="text-label-sm font-semibold" style={{ color: 'var(--color-primary-container)', textTransform: 'none' }}>
                            {(o.total_amount - 10).toFixed(2)} ر.س
                          </span>
                        </div>
                        <p className="text-label-md text-[var(--color-on-surface)] text-end" style={{ textTransform: 'none' }}>
                          {o.customers?.full_name || 'عميل'}
                        </p>
                        <p className="text-label-sm text-[var(--color-on-surface-variant)] text-end" style={{ textTransform: 'none', letterSpacing: 0 }}>
                          #{o.id.slice(-6).toUpperCase()}
                        </p>
                      </div>
                    );
                  })
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB: CATALOG / MENU CRUD                           */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'catalog' && (
          <div className="space-y-6" id="catalog_manager_tab">
            <div className="flex items-center justify-between" id="catalog_nav_menu">
              <Button
                variant="primary" size="md"
                onClick={() => setIsAddingProduct(!isAddingProduct)}
                leftIcon={<Icon name="add" size={18} />}
                id="add_new_prod_btn"
              >
                إضافة صنف جديد
              </Button>
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                قائمة المنيو ({products.length} صنف)
              </h3>
            </div>

            {/* Add product form */}
            {isAddingProduct && (
              <Card variant="glass" radius="xl" padding="p-6" className="max-w-lg mx-auto space-y-5" id="add_prod_form_wrapper">
                <h4 className="text-headline-sm font-semibold text-[var(--color-on-surface)] text-end pb-3 border-b border-[rgba(255,255,255,0.06)]">
                  بيانات الصنف الجديد
                </h4>
                <form onSubmit={handleAddProductSubmit} className="space-y-4" id="add_prod_form">
                  <Input
                    label="اسم الصنف"
                    placeholder="مثال: شاورما عربي دبل جبن"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    required
                    id="add_prod_name_input"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="السعر (ر.س)"
                      type="number"
                      step="0.1"
                      placeholder="28.00"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      required
                      id="add_prod_price_input"
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-label-sm text-[var(--color-on-surface-variant)]">القسم</label>
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="flex-1 h-12 px-4 rounded-[var(--radius)] text-label-md text-[var(--color-on-surface)] focus:outline-none"
                        style={{ background: 'var(--color-surface-variant)', border: '1px solid transparent' }}
                        id="add_prod_cat_select"
                      >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddingProduct(false)}>إلغاء</Button>
                    <Button variant="primary" size="sm" type="submit" loading={actionLoading}>حفظ الصنف</Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Products grid */}
            {products.length === 0 ? (
              <EmptyState icon="restaurant_menu" title="قائمة الأصناف فارغة" description="أضف أول صنف من القائمة أعلاه" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="catalogs_rendered_grid">
                {products.map((product) => (
                  <Card
                    key={product.id}
                    variant="glass"
                    radius="xl"
                    padding="p-4"
                    hover
                    className="flex flex-col gap-4"
                    id={`cat_item_${product.id}`}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 justify-end">
                      <div className="text-end flex-1 min-w-0">
                        <h5 className="text-label-md font-semibold text-[var(--color-on-surface)] truncate">{product.name}</h5>
                        <p className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none', letterSpacing: 0 }}>
                          #{product.id.slice(-6).toUpperCase()}
                        </p>
                      </div>
                      <div
                        className="w-10 h-10 rounded-[var(--radius)] flex items-center justify-center text-xl shrink-0"
                        style={{ background: 'var(--color-surface-container-high)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        🥪
                      </div>
                    </div>

                    <Divider />

                    {/* Price editor + delete */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="flex items-center gap-1.5 text-label-md cursor-pointer transition-colors hover:opacity-80"
                        style={{ color: 'var(--color-error)' }}
                        id="delete_product_trigger"
                      >
                        <Icon name="delete" size={16} />
                        <span style={{ textTransform: 'none' }}>حذف</span>
                      </button>
                      <div className="flex items-center gap-2" id="quick_price_box">
                        <span className="text-label-sm text-[var(--color-on-surface-variant)]">ر.س</span>
                        <input
                          type="number"
                          defaultValue={product.price}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickPriceUpdate(product, (e.target as HTMLInputElement).value); }}
                          className="w-20 h-9 text-center rounded-[var(--radius)] text-label-md font-bold focus:outline-none transition-all"
                          style={{
                            background: 'var(--color-surface-container-high)',
                            color: 'var(--color-primary-container)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-container)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; handleQuickPriceUpdate(product, (e.target as HTMLInputElement).value); }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB: WALLET / EARNINGS                             */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'wallet' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="merchant_wallet_tab">

            {/* Balance card */}
            <Card variant="glass" radius="xl" padding="p-6" className="flex flex-col justify-between gap-6" id="earnings_balance_box">
              <div className="text-end">
                <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-3">رصيد الأرباح القابل للسحب</p>
                <p
                  className="text-display-md font-bold"
                  style={{ color: 'var(--color-primary-container)' }}
                >
                  {earnings.toFixed(2)}
                  <span className="text-headline-sm font-normal text-[var(--color-on-surface-variant)] mr-2">ر.س</span>
                </p>
              </div>

              <div className="space-y-3" id="earnings_analytics_rows">
                {[
                  { label: 'الطلبات المكتملة',     val: `${deliveredCount} طلب` },
                  { label: 'متوسط قيمة السلة',     val: `${avgBasket.toFixed(2)} ر.س` },
                  { label: 'رسوم المنصة',           val: 'مجاني للشركاء' },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-label-md text-[var(--color-on-surface)]" style={{ textTransform: 'none' }}>{val}</span>
                    <span className="text-label-md text-[var(--color-on-surface-variant)]">{label}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => alert('تم تسجيل طلب تحويل الأرباح للحساب البنكي 🟢')}
                id="payout_merch_trigger"
              >
                سحب الأرباح الفورية
              </Button>
            </Card>

            {/* Info FAQ card */}
            <Card variant="glass" radius="xl" padding="p-6" className="space-y-4" id="ledger_merch_faq">
              <div className="flex items-center gap-2.5 justify-end">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">إرشاد المحاسبة</h3>
                <Icon name="info" size={20} className="text-[var(--color-tertiary-container)]" fill={1} />
              </div>
              <div className="space-y-3">
                {[
                  'تحسب الأرباح بعد خصم رسوم التوصيل (10 ر.س) لصالح الكابتن.',
                  'بمجرد اكتمال التوصيل، تتحول الأموال تلقائياً للحساب البنكي المسجل.',
                  'لا تُحصَّل أي عمولات إضافية خلال الطور التجريبي الحالي.',
                ].map((text, i) => (
                  <div key={i} className="flex gap-3 items-start justify-end">
                    <p className="text-body-md text-[var(--color-on-surface-variant)] text-end leading-relaxed" style={{ direction: 'rtl' }}>{text}</p>
                    <Icon name="check_circle" size={16} fill={1} className="text-[var(--color-tertiary-container)] shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
