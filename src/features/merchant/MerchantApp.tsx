import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { merchantService } from '../../services/merchant.service';
import { orderService } from '../../services/order.service';
import { storageService } from '../../services/storage.service';
import { Icon } from '../../components/ui/Icon';
import { sandboxStore } from '../../services/sandboxStore';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EnterpriseSidebar, SidebarSection } from '../../components/ui/EnterpriseSidebar';
import { Loader, EmptyState, Divider } from '../../components/ui/Primitives';

// ── Types ──────────────────────────────────────────────────────────────────
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
interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  product_images?: { id: string; url: string }[];
}
interface Category    { id: string; name: string }
interface MerchantData { id: string; business_name: string; logo_url?: string | null }

type MerchantTab = 'incoming' | 'catalog' | 'wallet' | 'profile';

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    items: [
      { id: 'incoming', label: 'الطلبات النشطة',  icon: 'notifications_active' },
      { id: 'catalog',  label: 'المنيو والأسعار',  icon: 'restaurant_menu' },
      { id: 'wallet',   label: 'تقارير الأرباح',   icon: 'payments' },
      { id: 'profile',  label: 'الملف التجاري',    icon: 'store' },
    ],
  },
];

const ORDER_STATUS_CFG: Record<string, { label: string; variant: 'warning' | 'secondary' | 'primary' | 'success' | 'error' | 'neutral' }> = {
  pending:    { label: 'انتظار',    variant: 'warning' },
  accepted:   { label: 'مقبول',     variant: 'secondary' },
  preparing:  { label: 'يُحضَّر',   variant: 'secondary' },
  on_the_way: { label: 'في الطريق', variant: 'primary' },
  delivered:  { label: 'مكتمل',     variant: 'success' },
  cancelled:  { label: 'ملغي',      variant: 'error' },
};

// ── Image validation ───────────────────────────────────────────────────────
const ALLOWED_IMG_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImage(file: File): string | null {
  if (!ALLOWED_IMG_TYPES.includes(file.type)) return 'يُسمح فقط بصور JPG أو PNG أو WebP';
  if (file.size > MAX_IMG_BYTES) return 'حجم الصورة يتجاوز الحد المسموح به (5 ميغابايت)';
  return null;
}

function readAsPreview(file: File, setFn: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => setFn(e.target?.result as string);
  reader.readAsDataURL(file);
}

// ── Shared inline status chip ──────────────────────────────────────────────
function UploadStatus({ error, success, successMsg = 'تم الحفظ بنجاح ✓' }: { error: string | null; success: boolean; successMsg?: string }) {
  if (error)   return <p className="text-label-sm text-end" style={{ color: 'var(--color-error)', textTransform: 'none' }}>{error}</p>;
  if (success) return <p className="text-label-sm text-end" style={{ color: 'var(--color-neon)', textTransform: 'none' }}>{successMsg}</p>;
  return null;
}

interface MerchantAppProps { merchantId: string; onLogout: () => void }

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export const MerchantApp = ({ merchantId, onLogout }: MerchantAppProps) => {
  const { country, lang, toggleLang, price: money } = useAppConfig();
  const cur = country.currency.symbolAr;

  // ── Core state ─────────────────────────────────────────────────────────
  const [branches,           setBranches]           = useState<any[]>([]);
  const [selectedBranchId,   setSelectedBranchId]   = useState<string>('');
  const [orders,             setOrders]             = useState<Order[]>([]);
  const [products,           setProducts]           = useState<Product[]>([]);
  const [categories,         setCategories]         = useState<Category[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [actionLoading,      setActionLoading]      = useState(false);
  const [newProductName,     setNewProductName]     = useState('');
  const [newProductPrice,    setNewProductPrice]    = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [isAddingProduct,    setIsAddingProduct]    = useState(false);
  const [activeTab,          setActiveTab]          = useState<MerchantTab>('incoming');
  const [earnings,           setEarnings]           = useState(0);

  // ── Media state ─────────────────────────────────────────────────────────
  const [merchantData,       setMerchantData]       = useState<MerchantData | null>(null);

  const [pendingLogoFile,    setPendingLogoFile]    = useState<File | null>(null);
  const [logoPreview,        setLogoPreview]        = useState<string | null>(null);
  const [logoUploading,      setLogoUploading]      = useState(false);
  const [logoError,          setLogoError]          = useState<string | null>(null);
  const [logoSuccess,        setLogoSuccess]        = useState(false);

  const [pendingCoverFile,   setPendingCoverFile]   = useState<File | null>(null);
  const [coverPreview,       setCoverPreview]       = useState<string | null>(null);
  const [coverUploading,     setCoverUploading]     = useState(false);
  const [coverError,         setCoverError]         = useState<string | null>(null);
  const [coverSuccess,       setCoverSuccess]       = useState(false);

  const [newProductImgFile,  setNewProductImgFile]  = useState<File | null>(null);
  const [newProdImgPreview,  setNewProdImgPreview]  = useState<string | null>(null);
  const [imgFormError,       setImgFormError]       = useState<string | null>(null);

  const [uploadingProdId,    setUploadingProdId]    = useState<string | null>(null);
  const [prodImgError,       setProdImgError]       = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────
  const logoInputRef      = useRef<HTMLInputElement>(null);
  const coverInputRef     = useRef<HTMLInputElement>(null);
  const prodImgInputRef   = useRef<HTMLInputElement>(null);
  const formImgInputRef   = useRef<HTMLInputElement>(null);
  const pendingProdIdRef  = useRef<string | null>(null);
  const ordersChannelRef  = useRef<any>(null);

  useEffect(() => { fetchMerchantMetadata(); }, []);

  // G-01 — Realtime subscription: re-fetch orders when any order for this branch changes.
  useEffect(() => {
    if (!selectedBranchId) return;

    if (ordersChannelRef.current) {
      supabase.removeChannel(ordersChannelRef.current);
      ordersChannelRef.current = null;
    }

    const channel = supabase
      .channel(`merchant-orders-${selectedBranchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `branch_id=eq.${selectedBranchId}` }, () => {
        reloadBranchData(selectedBranchId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `branch_id=eq.${selectedBranchId}` }, () => {
        reloadBranchData(selectedBranchId);
      })
      .subscribe();

    ordersChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      ordersChannelRef.current = null;
    };
  }, [selectedBranchId]);

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchMerchantMetadata = async () => {
    try {
      setLoading(true);
      // Sandbox mode has no backend session — provide demo merchant data so the
      // portal renders with content instead of an empty/blank state.
      if (SANDBOX) {
        setMerchantData({ id: merchantId, business_name: 'متجر تجريبي', logo_url: null } as any);
        const demoBranch: any = { id: 'demo-branch-1', merchant_id: merchantId, name: 'الفرع التجريبي', is_active: true, cover_image_url: null };
        setBranches([demoBranch]);
        setSelectedBranchId(demoBranch.id);
        setCategories([{ id: 'c1', name: 'مطاعم' } as any]);
        setSelectedCategoryId('c1');
        setProducts([
          { id: 'p1', name: 'كبسة لحم فاخرة', price: 45, product_images: [] },
          { id: 'p2', name: 'مندي دجاج', price: 38, product_images: [] },
        ] as any);
        const sbOrders = sandboxStore.getMerchantOrders();
        setOrders(sbOrders.map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, customers: { full_name: o.customer_name } })) as any);
        setEarnings(sbOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount - o.delivery_fee), 0));
        return;
      }
      const [bRes, mRes] = await Promise.all([
        supabase.from('merchant_branches').select('*').eq('merchant_id', merchantId),
        supabase.from('merchants').select('id, business_name, logo_url').eq('id', merchantId).maybeSingle(),
      ]);
      if (mRes.data) setMerchantData(mRes.data);
      if (bRes.data && bRes.data.length > 0) {
        setBranches(bRes.data);
        setSelectedBranchId(bRes.data[0].id);
        const { data: catData } = await supabase.from('categories').select('*');
        if (catData) { setCategories(catData); if (catData.length > 0) setSelectedCategoryId(catData[0].id); }
        await reloadBranchData(bRes.data[0].id);
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
      const { data: prodData } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('branch_id', bId);
      if (prodData) setProducts(prodData as Product[]);
    } catch (ex) { console.error(ex); }
  };

  // ── Handlers: orders ──────────────────────────────────────────────────────
  const handleBranchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedBranchId(val);
    setPendingCoverFile(null); setCoverPreview(null); setCoverError(null); setCoverSuccess(false);
    await reloadBranchData(val);
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setActionLoading(true);
    try {
      if (SANDBOX) {
        sandboxStore.setStatus(orderId, status as any);
        const sb = sandboxStore.getMerchantOrders();
        setOrders(sb.map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, customers: { full_name: o.customer_name } })) as any);
        return;
      }
      let notes = '';
      if (status === 'accepted')  notes = 'تم قبول طلبكم.';
      if (status === 'preparing') notes = 'جاري تجهيز طلبكم الآن.';
      const { error } = await orderService.updateOrderStatus(orderId, status, notes);
      if (error) alert(`خطأ: ${(error as any).message}`);
      else await reloadBranchData(selectedBranchId);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  // ── Handlers: catalog ────────────────────────────────────────────────────
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice || !selectedCategoryId) return;
    setActionLoading(true);
    try {
      const { data: newProduct, error } = await merchantService.upsertProduct({
        branch_id: selectedBranchId, category_id: selectedCategoryId,
        name: newProductName, price: Number(newProductPrice),
      });
      if (error) { alert(`Failed to add product: ${(error as any).message}`); return; }
      if (newProduct?.id && newProductImgFile) {
        const { url, error: upErr } = await storageService.uploadProductImage(newProduct.id, newProductImgFile);
        if (!upErr && url) await merchantService.addProductImage(newProduct.id, url);
      }
      setNewProductName(''); setNewProductPrice('');
      setNewProductImgFile(null); setNewProdImgPreview(null); setImgFormError(null);
      setIsAddingProduct(false);
      await reloadBranchData(selectedBranchId);
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!window.confirm('مسح هذا المنتج نهائياً؟')) return;
    setActionLoading(true);
    try {
      const { error } = await merchantService.deleteProduct(prodId);
      if (error) alert(`لا يمكن مسح المنتج. ${(error as any).message}`);
      else await reloadBranchData(selectedBranchId);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleQuickPriceUpdate = async (product: Product, newPrice: string) => {
    const val = Number(newPrice);
    if (isNaN(val) || val <= 0) return;
    setActionLoading(true);
    try {
      const { error } = await merchantService.upsertProduct({
        id: product.id, branch_id: selectedBranchId, category_id: product.category_id,
        name: product.name, price: val,
      });
      if (error) alert((error as any).message);
      else await reloadBranchData(selectedBranchId);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  // ── Handlers: product image (per-card upload) ────────────────────────────
  const triggerProductImageUpload = (productId: string) => {
    pendingProdIdRef.current = productId;
    prodImgInputRef.current?.click();
  };

  const handleProductImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const productId = pendingProdIdRef.current;
    e.target.value = '';
    if (!file || !productId) return;
    const err = validateImage(file);
    if (err) { setProdImgError(err); return; }
    setProdImgError(null);
    setUploadingProdId(productId);
    try {
      const { url, error: upErr } = await storageService.uploadProductImage(productId, file);
      if (upErr || !url) { setProdImgError('فشل رفع صورة الصنف. حاول مرة أخرى.'); return; }
      const { error: dbErr } = await merchantService.addProductImage(productId, url);
      if (dbErr) { setProdImgError('تم رفع الصورة لكن فشل الحفظ في قاعدة البيانات.'); return; }
      await reloadBranchData(selectedBranchId);
    } finally {
      setUploadingProdId(null);
      pendingProdIdRef.current = null;
    }
  };

  // ── Handlers: logo ───────────────────────────────────────────────────────
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateImage(file);
    if (err) { setLogoError(err); return; }
    setLogoError(null); setLogoSuccess(false);
    setPendingLogoFile(file);
    readAsPreview(file, setLogoPreview);
  };

  const handleLogoSave = async () => {
    if (!pendingLogoFile) return;
    setLogoUploading(true); setLogoError(null); setLogoSuccess(false);
    try {
      const { url, error: upErr } = await storageService.uploadMerchantLogo(merchantId, pendingLogoFile);
      if (upErr || !url) { setLogoError('فشل رفع الشعار. تحقق من اتصالك وحاول مرة أخرى.'); return; }
      const { error: dbErr } = await supabase.from('merchants').upsert({
        id: merchantId,
        business_name: merchantData?.business_name || branches[0]?.name || 'المتجر',
        logo_url: url,
      });
      if (dbErr) { setLogoError('تم رفع الشعار لكن فشل الحفظ.'); return; }
      setMerchantData(prev => ({
        id: merchantId,
        business_name: prev?.business_name || branches[0]?.name || 'المتجر',
        logo_url: url,
      }));
      setPendingLogoFile(null);
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 3000);
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Handlers: branch cover ───────────────────────────────────────────────
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateImage(file);
    if (err) { setCoverError(err); return; }
    setCoverError(null); setCoverSuccess(false);
    setPendingCoverFile(file);
    readAsPreview(file, setCoverPreview);
  };

  const handleCoverSave = async () => {
    if (!pendingCoverFile || !selectedBranchId) return;
    setCoverUploading(true); setCoverError(null); setCoverSuccess(false);
    try {
      const { url, error: upErr } = await storageService.uploadBranchCoverImage(merchantId, selectedBranchId, pendingCoverFile);
      if (upErr || !url) { setCoverError('فشل رفع صورة الغلاف. تحقق من اتصالك وحاول مرة أخرى.'); return; }
      const { error: dbErr } = await merchantService.updateBranchInfo(selectedBranchId, { cover_image_url: url });
      if (dbErr) { setCoverError('تم رفع الصورة لكن فشل الحفظ.'); return; }
      setBranches(prev => prev.map(b => b.id === selectedBranchId ? { ...b, cover_image_url: url } : b));
      setPendingCoverFile(null);
      setCoverSuccess(true);
      setTimeout(() => setCoverSuccess(false), 3000);
    } finally {
      setCoverUploading(false);
    }
  };

  // ── Computed ─────────────────────────────────────────────────────────────
  const activeOrdersList = orders.filter(o => ['pending', 'accepted', 'preparing', 'on_the_way'].includes(o.status));
  const archOrdersList   = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));
  const deliveredCount   = archOrdersList.filter(o => o.status === 'delivered').length;
  const avgBasket        = deliveredCount > 0
    ? archOrdersList.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total_amount - 10), 0) / deliveredCount
    : 0;
  const currentBranch = branches.find(b => b.id === selectedBranchId);

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
    profile:  'الملف التجاري',
  };

  // ── Cover image shown for currently selected branch ──────────────────────
  const activeCoverUrl = coverPreview || currentBranch?.cover_image_url || null;
  const activeLogoUrl  = logoPreview  || merchantData?.logo_url          || null;

  return (
    <div className="flex min-h-screen" id="merchant_portal_full">

      {/* ── Hidden file inputs (one per upload flow) ──────────────── */}
      <input ref={logoInputRef}    type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="sr-only" onChange={handleLogoFileChange} />
      <input ref={coverInputRef}   type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="sr-only" onChange={handleCoverFileChange} />
      <input ref={prodImgInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="sr-only" onChange={handleProductImageFileChange} />
      <input
        ref={formImgInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const err = validateImage(file);
          if (err) { setImgFormError(err); return; }
          setImgFormError(null);
          setNewProductImgFile(file);
          readAsPreview(file, setNewProdImgPreview);
        }}
      />

      {/* ── Enterprise Sidebar ──────────────────────────────────────── */}
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

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen overflow-y-auto p-6 md:p-8 space-y-6 md:ms-[280px]"
        id="merchant_main_content"
      >
        {/* ── Top bar: logout + language ─────────────────────────────── */}
        <div className="flex items-center justify-between" id="merchant_topbar">
          <Button variant="danger" size="sm" onClick={onLogout} id="merchant_logout_btn" leftIcon={<Icon name="logout" size={16} />}>
            تسجيل الخروج
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleLang} id="merchant_lang_btn" leftIcon={<Icon name="language" size={16} />}>
            {lang === 'ar' ? 'EN' : 'ع'}
          </Button>
        </div>

        {/* ── Mobile tab navigation (sidebar is desktop-only) ─────────── */}
        <div className="md:hidden grid grid-cols-4 gap-1.5" id="merchant_mobile_tabs">
          {SIDEBAR_SECTIONS[0].items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`merchant_mtab_${item.id}`}
                onClick={() => setActiveTab(item.id as MerchantTab)}
                className="flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-[var(--radius-lg)] text-label-sm font-medium transition-all cursor-pointer"
                style={{
                  background: isActive ? 'var(--color-secondary-container)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? 'var(--color-on-secondary-container)' : 'var(--color-on-surface-variant)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon name={item.icon} size={16} fill={isActive ? 1 : 0} />
                <span className="truncate w-full text-center" style={{ fontSize: '9px' }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap" id="merchant_branch_header_card">
          <div className="flex flex-col gap-1.5" id="merch_main_title">
            <h1 className="text-headline-lg-mobile font-bold text-[var(--color-on-surface)]">
              {tabLabels[activeTab]}
            </h1>
            <p className="text-body-md text-[var(--color-on-surface-variant)]">
              إدارة الطلبات والمنيو بالوقت الفعلي
            </p>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[200px]" id="select_field_wrapper">
            <label className="text-label-sm text-[var(--color-on-surface-variant)]">الفرع النشط</label>
            <select
              value={selectedBranchId || ''}
              onChange={handleBranchChange}
              className="h-11 px-4 rounded-[var(--radius)] text-label-md focus:outline-none cursor-pointer input-silver"
              id="branch_selector"
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        {/* ── KPI Area ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="merchant_kpi_area">

          {/* Revenue hero — col-8 */}
          <div
            className="lg:col-span-8 surface-z4 rounded-[var(--radius-sheet)] p-7 flex flex-col justify-between"
            id="merchant_revenue_hero"
            style={{ minHeight: '200px' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[var(--radius-row)] flex items-center justify-center"
                     style={{ background: 'rgba(158,212,66,0.12)', border: '1px solid rgba(158,212,66,0.25)' }}>
                  <Icon name="trending_up" size={18} fill={1} style={{ color: 'var(--color-neon)' }} />
                </div>
                <div>
                  <p className="text-label-sm font-semibold" style={{ color: 'var(--color-t3, #aab0b6)', textTransform: 'none' }}>الأرباح المتراكمة</p>
                  <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>الطور التجريبي · بدون عمولات</p>
                </div>
              </div>
              <div className="text-end">
                <p className="text-display-md font-bold leading-none" style={{ color: 'var(--color-lime-vb, #9ed442)', textShadow: '0 0 20px rgba(158,212,66,0.4)' }}>
                  {earnings.toFixed(0)}
                </p>
                <p className="text-label-sm mt-0.5" style={{ color: 'var(--color-t3, #aab0b6)', textTransform: 'none' }}>ريال سعودي</p>
              </div>
            </div>
            <div className="mt-6 space-y-3 border-t border-[rgba(255,255,255,0.06)] pt-5">
              {[
                { label: 'الطلبات المكتملة',  val: `${deliveredCount} طلب`,        pct: Math.min(100, deliveredCount * 10) },
                { label: 'متوسط قيمة السلة',  val: money(avgBasket),  pct: Math.min(100, (avgBasket / 80) * 100) },
                { label: 'رسوم المنصة',        val: 'مجاني للشركاء',                pct: 0 },
              ].map(({ label, val, pct }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-label-sm font-medium" style={{ color: 'var(--color-t2, #f2f4f6)', textTransform: 'none' }}>{val}</span>
                    <span className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>{label}</span>
                  </div>
                  <div className="h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    {pct > 0 && (
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-lime-vb, #9ed442)', opacity: 0.5 }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats cluster — col-4 */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-3 content-start">
            <StatCard label="طلبات نشطة"  value={activeOrdersList.length} icon={<Icon name="notifications_active" size={16} fill={1} />} accentColor="var(--color-primary-container)" className="text-sm" />
            <StatCard label="مكتملة"       value={deliveredCount}           icon={<Icon name="task_alt" size={16} fill={1} />}             accentColor="var(--color-tertiary-container)" className="text-sm" />
            <StatCard label="متوسط السلة"  value={`${avgBasket.toFixed(0)}`} icon={<Icon name="shopping_bag" size={16} fill={1} />}       accentColor="var(--color-secondary)" className="text-sm" />
            <StatCard label="الفرع"        value={branches.length}           icon={<Icon name="store" size={16} fill={1} />}               accentColor="var(--color-neon)" className="text-sm" />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: ACTIVE ORDERS                                        */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'incoming' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="merch_orders_feed_grid">

            {/* Active orders — col 8 */}
            <div className="lg:col-span-8 space-y-4" id="active_orders_list_wrapper">
              {activeOrdersList.length === 0 ? (
                <EmptyState icon="inbox" title="لا توجد طلبات نشطة" description="اطلب كعميل وستظهر هنا فوراً!" />
              ) : (
                <div className="space-y-4" id="active_orders_grid">
                  {activeOrdersList.map((ord) => {
                    const cfg = ORDER_STATUS_CFG[ord.status] || ORDER_STATUS_CFG.pending;
                    return (
                      <Card key={ord.id} variant="z3" radius="xl" padding="p-5" className="space-y-4" id={`merch_order_card_${ord.id}`}>
                        <div className="flex items-start justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
                          <div className="flex items-center gap-2">
                            <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                          </div>
                          <div className="text-end">
                            <p className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{ord.customers?.full_name || 'عميل'}</p>
                            <p className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none' }}>{ord.customers?.phone_number || ''}</p>
                          </div>
                        </div>
                        <div className="space-y-2" id="merch_order_card_body">
                          {ord.order_items?.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between" id={`merch_it_${idx}`}>
                              <span className="text-label-md" style={{ color: 'var(--color-primary-container)', textTransform: 'none' }}>{money(it.price * it.quantity)}</span>
                              <span className="text-label-md text-[var(--color-on-surface)]" style={{ direction: 'rtl' }}>
                                {it.quantity} × {it.product_variants?.products?.name || 'وجبة'} ({it.product_variants?.name || 'أساسي'})
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-[rgba(255,255,255,0.06)]">
                          <span className="text-headline-sm font-bold" style={{ color: 'var(--color-primary-container)' }}>{money(ord.total_amount - 10)}</span>
                          <span className="text-label-md text-[var(--color-on-surface-variant)]">صافي الفرع</span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end pt-1" id="merch_order_actions">
                          {ord.status === 'pending' && (
                            <Button variant="primary" size="sm" loading={actionLoading} onClick={() => handleUpdateStatus(ord.id, 'accepted')} leftIcon={<Icon name="check_circle" size={16} fill={1} />}>قبول الطلب</Button>
                          )}
                          {ord.status === 'accepted' && (
                            <Button variant="secondary" size="sm" loading={actionLoading} onClick={() => handleUpdateStatus(ord.id, 'preparing')} leftIcon={<Icon name="restaurant" size={16} fill={1} />}>بدء التحضير</Button>
                          )}
                          <span className="px-3 py-1.5 rounded-full text-label-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
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
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">الأرشيف ({archOrdersList.length})</h3>
              <Card variant="z3" radius="xl" padding="p-4" className="max-h-[500px] overflow-y-auto space-y-3" id="archived_orders_box">
                {archOrdersList.length === 0 ? (
                  <p className="text-label-md text-[var(--color-on-surface-variant)] text-center py-8" style={{ textTransform: 'none' }}>لا توجد طلبات سابقة.</p>
                ) : (
                  archOrdersList.map(o => {
                    const cfg = ORDER_STATUS_CFG[o.status] || ORDER_STATUS_CFG.delivered;
                    return (
                      <div key={o.id} className="p-3 rounded-[var(--radius-lg)] space-y-2 surface-z2" id={`arch_card_${o.id}`}>
                        <div className="flex items-center justify-between">
                          <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                          <span className="text-label-sm font-semibold" style={{ color: 'var(--color-primary-container)', textTransform: 'none' }}>{money(o.total_amount - 10)}</span>
                        </div>
                        <p className="text-label-md text-[var(--color-on-surface)] text-end" style={{ textTransform: 'none' }}>{o.customers?.full_name || 'عميل'}</p>
                        <p className="text-label-sm text-[var(--color-on-surface-variant)] text-end" style={{ textTransform: 'none', letterSpacing: 0 }}>#{o.id.slice(-6).toUpperCase()}</p>
                      </div>
                    );
                  })
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: CATALOG / MENU CRUD                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
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

            {/* Per-product image error (global, clears on next upload attempt) */}
            {prodImgError && (
              <p className="text-label-sm text-end" style={{ color: 'var(--color-error)', textTransform: 'none' }}>{prodImgError}</p>
            )}

            {/* Add product form */}
            {isAddingProduct && (
              <Card variant="z3" radius="xl" padding="p-6" className="max-w-lg mx-auto space-y-5" id="add_prod_form_wrapper">
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
                      label={`السعر (${cur})`}
                      type="number" step="0.1" placeholder="28.00"
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
                        className="flex-1 h-12 px-4 rounded-[var(--radius)] text-label-md focus:outline-none input-silver"
                        id="add_prod_cat_select"
                      >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Product image upload (optional) */}
                  <div className="space-y-2">
                    <label className="text-label-sm text-[var(--color-on-surface-variant)]">صورة الصنف (اختياري)</label>
                    <button
                      type="button"
                      onClick={() => formImgInputRef.current?.click()}
                      className="w-full h-28 rounded-[var(--radius)] overflow-hidden surface-z2 flex items-center justify-center relative cursor-pointer transition-opacity hover:opacity-90"
                      id="form_prod_img_picker"
                    >
                      {newProdImgPreview ? (
                        <img src={newProdImgPreview} alt="معاينة" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-[var(--color-on-surface-variant)]">
                          <Icon name="add_photo_alternate" size={28} />
                          <p className="text-label-sm" style={{ textTransform: 'none' }}>انقر لاختيار صورة</p>
                          <p className="text-label-sm" style={{ textTransform: 'none', color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>JPG · PNG · WebP · حتى 5 ميغابايت</p>
                        </div>
                      )}
                    </button>
                    {newProdImgPreview && (
                      <button
                        type="button"
                        onClick={() => { setNewProductImgFile(null); setNewProdImgPreview(null); }}
                        className="text-label-sm w-full text-center"
                        style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}
                      >
                        إزالة الصورة
                      </button>
                    )}
                    {imgFormError && (
                      <p className="text-label-sm" style={{ color: 'var(--color-error)', textTransform: 'none' }}>{imgFormError}</p>
                    )}
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <Button variant="ghost" size="sm" type="button" onClick={() => {
                      setIsAddingProduct(false);
                      setNewProductImgFile(null); setNewProdImgPreview(null); setImgFormError(null);
                    }}>إلغاء</Button>
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
                {products.map((product) => {
                  const imgUrl         = product.product_images?.[0]?.url ?? null;
                  const isUploading    = uploadingProdId === product.id;

                  return (
                    <Card key={product.id} variant="z3" radius="xl" padding="p-4" hover className="flex flex-col gap-3" id={`cat_item_${product.id}`}>

                      {/* Product image area with hover-upload overlay */}
                      <div
                        className="relative w-full overflow-hidden rounded-[var(--radius)]"
                        style={{ height: '120px' }}
                        id={`prod_img_area_${product.id}`}
                      >
                        {imgUrl ? (
                          <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full surface-z2 flex flex-col items-center justify-center gap-1">
                            <span style={{ fontSize: '28px' }}>🥪</span>
                            <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>لا توجد صورة</p>
                          </div>
                        )}

                        {/* Upload overlay (hover or loading) */}
                        <button
                          onClick={() => triggerProductImageUpload(product.id)}
                          disabled={isUploading}
                          className="absolute inset-0 flex items-center justify-center transition-opacity"
                          style={{
                            background: 'rgba(0,0,0,0.55)',
                            opacity: isUploading ? 1 : 0,
                          }}
                          onMouseEnter={(e) => { if (!isUploading) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                          onMouseLeave={(e) => { if (!isUploading) (e.currentTarget as HTMLButtonElement).style.opacity = '0'; }}
                          id={`prod_img_upload_btn_${product.id}`}
                        >
                          {isUploading ? (
                            <Loader size={20} />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-white">
                              <Icon name="camera_alt" size={20} />
                              <span className="text-label-sm" style={{ textTransform: 'none' }}>
                                {imgUrl ? 'تغيير الصورة' : 'رفع صورة'}
                              </span>
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Product name + ID */}
                      <div className="text-end">
                        <h5 className="text-label-md font-semibold text-[var(--color-on-surface)] truncate">{product.name}</h5>
                        <p className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none', letterSpacing: 0 }}>
                          #{product.id.slice(-6).toUpperCase()}
                        </p>
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
                          <span className="text-label-sm text-[var(--color-on-surface-variant)]">{cur}</span>
                          <input
                            type="number"
                            defaultValue={product.price}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickPriceUpdate(product, (e.target as HTMLInputElement).value); }}
                            onBlur={(e) => { handleQuickPriceUpdate(product, (e.target as HTMLInputElement).value); }}
                            className="w-20 h-9 text-center rounded-[var(--radius-row)] text-label-md font-bold input-silver"
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: WALLET / EARNINGS                                    */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'wallet' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="merchant_wallet_tab">
            <Card variant="z3" radius="xl" padding="p-6" className="flex flex-col justify-between gap-6" id="earnings_balance_box">
              <div className="text-end">
                <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-3">رصيد الأرباح القابل للسحب</p>
                <p className="text-display-md font-bold" style={{ color: 'var(--color-primary-container)' }}>
                  {earnings.toFixed(2)}
                  <span className="text-headline-sm font-normal text-[var(--color-on-surface-variant)] mr-2">{cur}</span>
                </p>
              </div>
              <div className="space-y-3" id="earnings_analytics_rows">
                {[
                  { label: 'الطلبات المكتملة',  val: `${deliveredCount} طلب` },
                  { label: 'متوسط قيمة السلة',  val: money(avgBasket) },
                  { label: 'رسوم المنصة',        val: 'مجاني للشركاء' },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-label-md text-[var(--color-on-surface)]" style={{ textTransform: 'none' }}>{val}</span>
                    <span className="text-label-md text-[var(--color-on-surface-variant)]">{label}</span>
                  </div>
                ))}
              </div>
              <Button variant="primary" size="lg" fullWidth onClick={() => alert('تم تسجيل طلب تحويل الأرباح للحساب البنكي 🟢')} id="payout_merch_trigger">
                سحب الأرباح الفورية
              </Button>
            </Card>
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-4" id="ledger_merch_faq">
              <div className="flex items-center gap-2.5 justify-end">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">إرشاد المحاسبة</h3>
                <Icon name="info" size={20} className="text-[var(--color-tertiary-container)]" fill={1} />
              </div>
              <div className="space-y-3">
                {[
                  `تحسب الأرباح بعد خصم رسوم التوصيل (${money(10)}) لصالح الكابتن.`,
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

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB: MERCHANT PROFILE — logo + branch cover               */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="merchant_profile_tab">

            {/* ── Merchant Logo ──────────────────────────────────── */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-5" id="merchant_logo_card">
              <div className="flex items-center justify-end gap-2">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">شعار المتجر</h3>
                <Icon name="storefront" size={20} fill={1} className="text-[var(--color-tertiary-container)]" />
              </div>

              {/* Logo preview */}
              <div className="flex justify-center">
                <div
                  className="relative overflow-hidden rounded-[var(--radius-sheet)] surface-z2 flex items-center justify-center"
                  style={{ width: '120px', height: '120px' }}
                  id="logo_preview_box"
                >
                  {activeLogoUrl ? (
                    <img src={activeLogoUrl} alt="شعار المتجر" className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="store" size={40} className="text-[var(--color-on-surface-variant)]" />
                  )}
                </div>
              </div>

              <UploadStatus error={logoError} success={logoSuccess} successMsg="تم حفظ الشعار بنجاح ✓" />

              {/* Select file */}
              <Button
                variant="secondary" size="md" fullWidth
                leftIcon={<Icon name="upload" size={18} />}
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                id="logo_upload_btn"
              >
                {activeLogoUrl ? 'تغيير الشعار' : 'رفع الشعار'}
              </Button>

              {/* Save — only when a new file is pending */}
              {pendingLogoFile && (
                <Button
                  variant="primary" size="md" fullWidth loading={logoUploading}
                  onClick={handleLogoSave}
                  id="logo_save_btn"
                >
                  {logoUploading ? 'جاري الرفع…' : 'حفظ الشعار'}
                </Button>
              )}

              <p className="text-label-sm text-center" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>
                JPG · PNG · WebP · حتى 2 ميغابايت
              </p>
            </Card>

            {/* ── Branch Cover Image ─────────────────────────────── */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-5" id="branch_cover_card">
              <div className="flex items-center justify-end gap-2">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                  صورة غلاف الفرع
                </h3>
                <Icon name="panorama" size={20} fill={1} className="text-[var(--color-tertiary-container)]" />
              </div>
              <p className="text-label-sm text-end" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>
                تظهر في شاشة المطعم كصورة بطولية للعميل
              </p>

              {/* Cover preview — 16:9 */}
              <div
                className="relative w-full overflow-hidden rounded-[var(--radius)] surface-z2 flex items-center justify-center"
                style={{ paddingTop: '56.25%' }}
                id="cover_preview_box"
              >
                <div className="absolute inset-0">
                  {activeCoverUrl ? (
                    <img src={activeCoverUrl} alt="غلاف الفرع" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Icon name="panorama" size={36} className="text-[var(--color-on-surface-variant)]" />
                      <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>لا توجد صورة غلاف</p>
                    </div>
                  )}
                </div>
              </div>

              <UploadStatus error={coverError} success={coverSuccess} successMsg="تم حفظ صورة الغلاف بنجاح ✓" />

              {/* Select file */}
              <Button
                variant="secondary" size="md" fullWidth
                leftIcon={<Icon name="upload" size={18} />}
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                id="cover_upload_btn"
              >
                {activeCoverUrl ? 'تغيير صورة الغلاف' : 'رفع صورة الغلاف'}
              </Button>

              {/* Save — only when a new file is pending */}
              {pendingCoverFile && (
                <Button
                  variant="primary" size="md" fullWidth loading={coverUploading}
                  onClick={handleCoverSave}
                  id="cover_save_btn"
                >
                  {coverUploading ? 'جاري الرفع…' : 'حفظ صورة الغلاف'}
                </Button>
              )}

              <p className="text-label-sm text-center" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>
                JPG · PNG · WebP · حتى 5 ميغابايت
              </p>
            </Card>
          </div>
        )}

      </main>
    </div>
  );
};
