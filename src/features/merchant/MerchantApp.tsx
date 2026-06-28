import React, { useEffect, useState, useRef } from 'react';
import { toast, confirmDialog } from '../../components/ui/feedback';
import { accountService } from '../../services/account.service';
import { supabase } from '../../lib/supabase';
import { merchantService } from '../../services/merchant.service';
import { orderService } from '../../services/order.service';
import { storageService } from '../../services/storage.service';
import { Icon } from '../../components/ui/Icon';
import { sandboxStore, SbProduct } from '../../services/sandboxStore';
import { inventoryService } from '../../services/inventory.service';
import { analyticsService } from '../../services/analytics.service';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EnterpriseSidebar, SidebarSection } from '../../components/ui/EnterpriseSidebar';
import { Loader, EmptyState, Divider } from '../../components/ui/Primitives';
import { StoreManagement } from './StoreManagement';
import { KitchenQueue } from './KitchenQueue';
import { MerchantWalletCenter } from './MerchantWalletCenter';
import { MerchantReports } from './MerchantReports';
import { NotificationCenter } from '../admin/NotificationCenter';

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

type MerchantTab = 'incoming' | 'kitchen' | 'catalog' | 'inventory' | 'store' | 'wallet' | 'walletcenter' | 'notifications' | 'profile';

const NAV: { id: MerchantTab; ar: string; en: string; icon: string }[] = [
  { id: 'incoming',  ar: 'الطلبات النشطة', en: 'Active Orders',    icon: 'notifications_active' },
  { id: 'kitchen',   ar: 'شاشة المطبخ',    en: 'Kitchen',          icon: 'restaurant' },
  { id: 'catalog',   ar: 'المنيو والأسعار', en: 'Menu & Prices',   icon: 'restaurant_menu' },
  { id: 'inventory', ar: 'المخزون',         en: 'Inventory',        icon: 'inventory_2' },
  { id: 'store',     ar: 'إدارة المتجر',    en: 'Store',            icon: 'tune' },
  { id: 'wallet',    ar: 'تقارير الأرباح',  en: 'Earnings',         icon: 'payments' },
  { id: 'walletcenter', ar: 'المحفظة',      en: 'Wallet',           icon: 'account_balance_wallet' },
  { id: 'notifications', ar: 'الإشعارات',   en: 'Notifications',    icon: 'notifications' },
  { id: 'profile',   ar: 'الملف التجاري',   en: 'Business Profile', icon: 'store' },
];

const ORDER_STATUS_CFG: Record<string, { labelAr: string; labelEn: string; variant: 'warning' | 'secondary' | 'primary' | 'success' | 'error' | 'neutral' }> = {
  pending:    { labelAr: 'انتظار',    labelEn: 'Pending',    variant: 'warning' },
  accepted:   { labelAr: 'مقبول',     labelEn: 'Accepted',   variant: 'secondary' },
  preparing:  { labelAr: 'يُحضَّر',   labelEn: 'Preparing',  variant: 'secondary' },
  on_the_way: { labelAr: 'في الطريق', labelEn: 'On the way', variant: 'primary' },
  delivered:  { labelAr: 'مكتمل',     labelEn: 'Completed',  variant: 'success' },
  cancelled:  { labelAr: 'ملغي',      labelEn: 'Cancelled',  variant: 'error' },
};

// ── Image validation ───────────────────────────────────────────────────────
const ALLOWED_IMG_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImage(file: File, D: (ar: string, en: string) => string): string | null {
  if (!ALLOWED_IMG_TYPES.includes(file.type)) return D('يُسمح فقط بصور JPG أو PNG أو WebP', 'Only JPG, PNG or WebP images are allowed');
  if (file.size > MAX_IMG_BYTES) return D('حجم الصورة يتجاوز الحد المسموح به (5 ميغابايت)', 'Image exceeds the maximum size (5 MB)');
  return null;
}

function readAsPreview(file: File, setFn: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => setFn(e.target?.result as string);
  reader.readAsDataURL(file);
}

// ── Shared inline status chip ──────────────────────────────────────────────
function UploadStatus({ error, success, successMsg = 'تم الحفظ بنجاح' }: { error: string | null; success: boolean; successMsg?: string }) {
  if (error)   return <p className="text-label-sm text-end" style={{ color: 'var(--color-error)', textTransform: 'none' }}>{error}</p>;
  if (success) return <p className="text-label-sm text-end" style={{ color: 'var(--color-neon)', textTransform: 'none' }}>{successMsg}</p>;
  return null;
}

interface MerchantAppProps { merchantId: string; onLogout: () => void }

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export const MerchantApp = ({ merchantId, onLogout }: MerchantAppProps) => {
  const { country, lang, toggleLang, price: money } = useAppConfig();
  const cur = country.currency.symbolAr;
  const D = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const sidebarSections = [{ items: NAV.map(n => ({ id: n.id, label: D(n.ar, n.en), icon: n.icon })) }];

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
  const [inventory,          setInventory]          = useState<SbProduct[]>([]);
  const [stockHistoryFor,    setStockHistoryFor]    = useState<string | null>(null);
  const [historyRows,        setHistoryRows]        = useState<{ id: string; delta: number; reason: string | null }[]>([]);
  const [merchantStats,      setMerchantStats]      = useState({ orders: 0, delivered: 0, revenue: 0, avgOrder: 0 });

  // Real inventory product → SbProduct-shaped row the inventory render expects.
  const mapInvRow = (p: { id: string; name: string; price: number; stock?: number; low_stock_threshold?: number; is_active?: boolean }): SbProduct => ({
    id: p.id, merchant_id: merchantId, name: p.name, price: p.price,
    stock: p.stock ?? 0, low_threshold: p.low_stock_threshold ?? 5, category: '', active: p.is_active ?? true,
  });
  const refreshInventory = async () => {
    if (SANDBOX) { setInventory(sandboxStore.getProducts(merchantId)); return; }
    if (!selectedBranchId) return;
    const { data } = await inventoryService.getInventory(selectedBranchId);
    setInventory((data || []).map(mapInvRow));
  };
  const handleAdjustStock = async (productId: string, delta: number) => {
    if (SANDBOX) {
      const p = sandboxStore.adjustStock(productId, delta, delta > 0 ? 'إضافة يدوية' : 'خصم يدوي');
      // Out-of-stock workflow: a product with 0 stock is auto-removed from ordering.
      if (p) sandboxStore.setProductActive(productId, p.stock > 0);
    } else {
      await inventoryService.adjustStock(productId, delta, delta > 0 ? 'إضافة يدوية' : 'خصم يدوي');
    }
    await refreshInventory();
  };
  const openHistory = async (productId: string) => {
    if (stockHistoryFor === productId) { setStockHistoryFor(null); return; }
    setStockHistoryFor(productId);
    if (SANDBOX) { setHistoryRows(sandboxStore.getStockHistory(productId)); return; }
    const { data } = await inventoryService.getStockHistory(productId);
    setHistoryRows((data || []).map(m => ({ id: m.id, delta: m.delta, reason: m.reason })));
  };

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
        setProducts(sandboxStore.getProducts(merchantId).map(p => ({ id: p.id, name: p.name, price: p.price, product_images: [] })) as any);
        setInventory(sandboxStore.getProducts(merchantId));
        setMerchantStats(sandboxStore.getMerchantAnalytics());
        const sbOrders = sandboxStore.getMerchantOrders();
        setOrders(sbOrders.map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, created_at: o.created_at, order_items: o.items?.map((it) => ({ quantity: it.qty })), customers: { full_name: o.customer_name } })) as any);
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
      // Inventory (C1) + merchant analytics (H2) from real services.
      const { data: invData } = await inventoryService.getInventory(bId);
      setInventory((invData || []).map(mapInvRow));
      const { data: mStats } = await analyticsService.getMerchantAnalytics(bId);
      if (mStats) setMerchantStats(mStats);
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
        setOrders(sb.map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, created_at: o.created_at, order_items: o.items?.map((it) => ({ quantity: it.qty })), customers: { full_name: o.customer_name } })) as any);
        return;
      }
      let notes = '';
      if (status === 'accepted')  notes = 'تم قبول طلبكم.';
      if (status === 'preparing') notes = 'جاري تجهيز طلبكم الآن.';
      const { error } = await orderService.updateOrderStatus(orderId, status, notes);
      if (error) toast.error(`${D('خطأ','Error')}: ${(error as any).message}`);
      else await reloadBranchData(selectedBranchId);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  // Merchant rejects an order — failure workflow (cancels + notifies the customer).
  const handleRejectOrder = async (orderId: string) => {
    if (!(await confirmDialog({ title: D('رفض الطلب', 'Reject order'), message: D('سيتم رفض هذا الطلب وإشعار العميل. لا يمكن التراجع.', 'This order will be rejected and the customer notified. This cannot be undone.'), danger: true, confirmText: D('رفض', 'Reject') }))) return;
    setActionLoading(true);
    try {
      if (SANDBOX) {
        sandboxStore.failOrder(orderId, 'merchant_rejected', 'merchant');
        const sb = sandboxStore.getMerchantOrders();
        setOrders(sb.map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, created_at: o.created_at, order_items: o.items?.map((it) => ({ quantity: it.qty })), customers: { full_name: o.customer_name } })) as any);
      } else {
        const { error } = await orderService.updateOrderStatus(orderId, 'cancelled', 'تم رفض الطلب من المتجر.');
        if (error) { toast.error(`${D('خطأ', 'Error')}: ${(error as any).message}`); return; }
        await reloadBranchData(selectedBranchId);
      }
      toast.success(D('تم رفض الطلب', 'Order rejected'));
    } catch (e) { console.error(e); } finally { setActionLoading(false); }
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
      if (error) { toast.error(`Failed to add product: ${(error as any).message}`); return; }
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
    if (!(await confirmDialog({ message: D('مسح هذا المنتج نهائياً؟', 'Delete this product permanently?'), danger: true }))) return;
    setActionLoading(true);
    try {
      const { error } = await merchantService.deleteProduct(prodId);
      if (error) toast.error(`${D('لا يمكن مسح المنتج.','Could not delete the product.')} ${(error as any).message}`);
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
      if (error) toast.error((error as any).message);
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
    const err = validateImage(file, D);
    if (err) { setProdImgError(err); return; }
    setProdImgError(null);
    setUploadingProdId(productId);
    try {
      const { url, error: upErr } = await storageService.uploadProductImage(productId, file);
      if (upErr || !url) { setProdImgError(D('فشل رفع صورة الصنف. حاول مرة أخرى.','Failed to upload the product image. Try again.')); return; }
      const { error: dbErr } = await merchantService.addProductImage(productId, url);
      if (dbErr) { setProdImgError(D('تم رفع الصورة لكن فشل الحفظ في قاعدة البيانات.','Image uploaded but saving to the database failed.')); return; }
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
    const err = validateImage(file, D);
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
      if (upErr || !url) { setLogoError(D('فشل رفع الشعار. تحقق من اتصالك وحاول مرة أخرى.','Failed to upload the logo. Check your connection and try again.')); return; }
      const { error: dbErr } = await supabase.from('merchants').upsert({
        id: merchantId,
        business_name: merchantData?.business_name || branches[0]?.name || D('المتجر','Store'),
        logo_url: url,
      });
      if (dbErr) { setLogoError(D('تم رفع الشعار لكن فشل الحفظ.','Logo uploaded but saving failed.')); return; }
      setMerchantData(prev => ({
        id: merchantId,
        business_name: prev?.business_name || branches[0]?.name || D('المتجر','Store'),
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
    const err = validateImage(file, D);
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
      if (upErr || !url) { setCoverError(D('فشل رفع صورة الغلاف. تحقق من اتصالك وحاول مرة أخرى.','Failed to upload the cover image. Check your connection and try again.')); return; }
      const { error: dbErr } = await merchantService.updateBranchInfo(selectedBranchId, { cover_image_url: url });
      if (dbErr) { setCoverError(D('تم رفع الصورة لكن فشل الحفظ.','Image uploaded but saving failed.')); return; }
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
        <p className="text-body-md text-[var(--color-on-surface-variant)]">{D('جاري تحميل بيانات الفرع...','Loading branch data…')}</p>
      </div>
    );
  }

  const tabLabels: Record<MerchantTab, string> = {
    incoming:  `${D('الطلبات النشطة', 'Active Orders')}${activeOrdersList.length > 0 ? ` (${activeOrdersList.length})` : ''}`,
    kitchen:   D('شاشة المطبخ', 'Kitchen display'),
    catalog:   D('المنيو والأسعار', 'Menu & Prices'),
    inventory: D('إدارة المخزون', 'Inventory'),
    store:     D('إدارة المتجر', 'Store management'),
    wallet:    D('تقارير الأرباح', 'Earnings'),
    walletcenter: D('المحفظة', 'Wallet center'),
    notifications: D('الإشعارات', 'Notifications'),
    profile:   D('الملف التجاري', 'Business Profile'),
  };

  // ── Cover image shown for currently selected branch ──────────────────────
  const activeCoverUrl = coverPreview || currentBranch?.cover_image_url || null;
  const activeLogoUrl  = logoPreview  || merchantData?.logo_url          || null;

  return (
    <div className="flex min-h-screen" id="merchant_portal_full" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

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
          const err = validateImage(file, D);
          if (err) { setImgFormError(err); return; }
          setImgFormError(null);
          setNewProductImgFile(file);
          readAsPreview(file, setNewProdImgPreview);
        }}
      />

      {/* ── Enterprise Sidebar ──────────────────────────────────────── */}
      <EnterpriseSidebar
        sections={sidebarSections.map(s => ({
          ...s,
          items: s.items.map(item => ({
            ...item,
            badge: item.id === 'incoming' && activeOrdersList.length > 0 ? activeOrdersList.length : undefined,
          })),
        }))}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as MerchantTab)}
        brandName="HAAT NOW"
        brandSubtitle={D('بوابة التاجر','Merchant Portal')}
        userInfo={{ name: branches[0]?.name || D('الفرع','Branch'), role: D('شريك تجاري','Business Partner') }}
      />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen overflow-y-auto px-6 pb-6 md:px-8 md:pb-8 space-y-6 md:ms-[280px]"
        style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}
        id="merchant_main_content"
      >
        {/* ── Top bar: logout + language ─────────────────────────────── */}
        <div className="flex items-center justify-between" id="merchant_topbar">
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={onLogout} id="merchant_logout_btn" leftIcon={<Icon name="logout" size={16} />}>
              {D('تسجيل الخروج','Sign out')}
            </Button>
            <button id="merchant_delete_account" onClick={async () => {
              if (!(await confirmDialog({ title: D('حذف الحساب','Delete account'), message: D('سيتم حذف حسابك وبياناتك نهائيًا. لا يمكن التراجع.','Your account and data will be permanently deleted. This cannot be undone.'), danger: true, confirmText: D('تأكيد الحذف','Confirm delete') }))) return;
              const { error } = await accountService.deleteMyAccount();
              if (error) { toast.error(D('تعذّر حذف الحساب','Could not delete the account')); return; }
              toast.success(D('تم حذف حسابك','Your account was deleted')); onLogout();
            }} className="text-xs font-semibold cursor-pointer" style={{ color: '#f87171' }}>{D('حذف الحساب','Delete account')}</button>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleLang} id="merchant_lang_btn" leftIcon={<Icon name="language" size={16} />}>
            {lang === 'ar' ? 'EN' : 'ع'}
          </Button>
        </div>

        {/* ── Mobile tab navigation (sidebar is desktop-only) ─────────── */}
        <div className="md:hidden grid grid-cols-4 gap-1.5" id="merchant_mobile_tabs">
          {sidebarSections[0].items.map((item) => {
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
              {D('إدارة الطلبات والمنيو بالوقت الفعلي','Manage orders and menu in real time')}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[200px]" id="select_field_wrapper">
            <label className="text-label-sm text-[var(--color-on-surface-variant)]">{D('الفرع النشط','Active branch')}</label>
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
                  <p className="text-label-sm font-semibold" style={{ color: 'var(--color-t3, #aab0b6)', textTransform: 'none' }}>{D('الأرباح المتراكمة','Accumulated earnings')}</p>
                  <p className="text-label-sm" style={{ color: 'var(--color-t4, #6e747a)', textTransform: 'none' }}>{D('الطور التجريبي · بدون عمولات','Trial phase · no commissions')}</p>
                </div>
              </div>
              <div className="text-end">
                <p className="text-display-md font-bold leading-none" style={{ color: 'var(--color-lime-vb, #9ed442)', textShadow: '0 0 20px rgba(158,212,66,0.4)' }}>
                  {earnings.toFixed(0)}
                </p>
                <p className="text-label-sm mt-0.5" style={{ color: 'var(--color-t3, #aab0b6)', textTransform: 'none' }}>{cur}</p>
              </div>
            </div>
            <div className="mt-6 space-y-3 border-t border-[rgba(255,255,255,0.06)] pt-5">
              {[
                { label: D('الطلبات المكتملة','Completed orders'),  val: `${deliveredCount} ${D('طلب','orders')}`,        pct: Math.min(100, deliveredCount * 10) },
                { label: D('متوسط قيمة السلة','Avg basket value'),  val: money(avgBasket),  pct: Math.min(100, (avgBasket / 80) * 100) },
                { label: D('رسوم المنصة','Platform fees'),        val: D('مجاني للشركاء','Free for partners'),                pct: 0 },
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
            <StatCard label={D('طلبات نشطة','Active orders')}  value={activeOrdersList.length} icon={<Icon name="notifications_active" size={16} fill={1} />} accentColor="var(--color-primary-container)" className="text-sm" />
            <StatCard label={D('مكتملة','Completed')}       value={deliveredCount}           icon={<Icon name="task_alt" size={16} fill={1} />}             accentColor="var(--color-tertiary-container)" className="text-sm" />
            <StatCard label={D('متوسط السلة','Avg basket')}  value={`${avgBasket.toFixed(0)}`} icon={<Icon name="shopping_bag" size={16} fill={1} />}       accentColor="var(--color-secondary)" className="text-sm" />
            <StatCard label={D('الفرع','Branch')}        value={branches.length}           icon={<Icon name="store" size={16} fill={1} />}               accentColor="var(--color-neon)" className="text-sm" />
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
                <EmptyState icon="inbox" title={D('لا توجد طلبات نشطة','No active orders')} description={D('اطلب كعميل وستظهر هنا فوراً!','Place an order as a customer and it will appear here instantly!')} />
              ) : (
                <div className="space-y-4" id="active_orders_grid">
                  {activeOrdersList.map((ord) => {
                    const cfg = ORDER_STATUS_CFG[ord.status] || ORDER_STATUS_CFG.pending;
                    return (
                      <Card key={ord.id} variant="z3" radius="xl" padding="p-5" className="space-y-4" id={`merch_order_card_${ord.id}`}>
                        <div className="flex items-start justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
                          <div className="flex items-center gap-2">
                            <Badge variant={cfg.variant} dot>{D(cfg.labelAr, cfg.labelEn)}</Badge>
                          </div>
                          <div className="text-end">
                            <p className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{ord.customers?.full_name || D('عميل','Customer')}</p>
                            <p className="text-label-sm text-[var(--color-on-surface-variant)]" style={{ textTransform: 'none' }}>{ord.customers?.phone_number || ''}</p>
                          </div>
                        </div>
                        <div className="space-y-2" id="merch_order_card_body">
                          {ord.order_items?.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between" id={`merch_it_${idx}`}>
                              <span className="text-label-md" style={{ color: 'var(--color-primary-container)', textTransform: 'none' }}>{money(it.price * it.quantity)}</span>
                              <span className="text-label-md text-[var(--color-on-surface)]" style={{ direction: 'rtl' }}>
                                {it.quantity} × {it.product_variants?.products?.name || D('وجبة','Meal')} ({it.product_variants?.name || D('أساسي','Standard')})
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-[rgba(255,255,255,0.06)]">
                          <span className="text-headline-sm font-bold" style={{ color: 'var(--color-primary-container)' }}>{money(ord.total_amount - 10)}</span>
                          <span className="text-label-md text-[var(--color-on-surface-variant)]">{D('صافي الفرع','Branch net')}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end pt-1" id="merch_order_actions">
                          {ord.status === 'pending' && (
                            <Button variant="primary" size="sm" loading={actionLoading} onClick={() => handleUpdateStatus(ord.id, 'accepted')} leftIcon={<Icon name="check_circle" size={16} fill={1} />}>{D('قبول الطلب','Accept order')}</Button>
                          )}
                          {ord.status === 'pending' && (
                            <Button variant="danger" size="sm" loading={actionLoading} onClick={() => handleRejectOrder(ord.id)} id="merch_reject_btn" leftIcon={<Icon name="cancel" size={16} fill={1} />}>{D('رفض الطلب','Reject order')}</Button>
                          )}
                          {ord.status === 'accepted' && (
                            <Button variant="secondary" size="sm" loading={actionLoading} onClick={() => handleUpdateStatus(ord.id, 'preparing')} leftIcon={<Icon name="restaurant" size={16} fill={1} />}>{D('بدء التحضير','Start preparing')}</Button>
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
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('الأرشيف','Archive')} ({archOrdersList.length})</h3>
              <Card variant="z3" radius="xl" padding="p-4" className="max-h-[500px] overflow-y-auto space-y-3" id="archived_orders_box">
                {archOrdersList.length === 0 ? (
                  <p className="text-label-md text-[var(--color-on-surface-variant)] text-center py-8" style={{ textTransform: 'none' }}>{D('لا توجد طلبات سابقة.','No past orders.')}</p>
                ) : (
                  archOrdersList.map(o => {
                    const cfg = ORDER_STATUS_CFG[o.status] || ORDER_STATUS_CFG.delivered;
                    return (
                      <div key={o.id} className="p-3 rounded-[var(--radius-lg)] space-y-2 surface-z2" id={`arch_card_${o.id}`}>
                        <div className="flex items-center justify-between">
                          <Badge variant={cfg.variant} dot>{D(cfg.labelAr, cfg.labelEn)}</Badge>
                          <span className="text-label-sm font-semibold" style={{ color: 'var(--color-primary-container)', textTransform: 'none' }}>{money(o.total_amount - 10)}</span>
                        </div>
                        <p className="text-label-md text-[var(--color-on-surface)] text-end" style={{ textTransform: 'none' }}>{o.customers?.full_name || D('عميل','Customer')}</p>
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
                {D('إضافة صنف جديد','Add new item')}
              </Button>
              <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                {D('قائمة المنيو','Menu list')} ({products.length} {D('صنف','items')})
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
                  {D('بيانات الصنف الجديد','New item details')}
                </h4>
                <form onSubmit={handleAddProductSubmit} className="space-y-4" id="add_prod_form">
                  <Input
                    label={D('اسم الصنف','Item name')}
                    placeholder={D('مثال: شاورما عربي دبل جبن','e.g. Arabic shawarma double cheese')}
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    required
                    id="add_prod_name_input"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label={`${D('السعر','Price')} (${cur})`}
                      type="number" step="0.1" placeholder="28.00"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      required
                      id="add_prod_price_input"
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-label-sm text-[var(--color-on-surface-variant)]">{D('القسم','Category')}</label>
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
                    <label className="text-label-sm text-[var(--color-on-surface-variant)]">{D('صورة الصنف (اختياري)','Item image (optional)')}</label>
                    <button
                      type="button"
                      onClick={() => formImgInputRef.current?.click()}
                      className="w-full h-28 rounded-[var(--radius)] overflow-hidden surface-z2 flex items-center justify-center relative cursor-pointer transition-opacity hover:opacity-90"
                      id="form_prod_img_picker"
                    >
                      {newProdImgPreview ? (
                        <img src={newProdImgPreview} alt={D('معاينة','Preview')} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-[var(--color-on-surface-variant)]">
                          <Icon name="add_photo_alternate" size={28} />
                          <p className="text-label-sm" style={{ textTransform: 'none' }}>{D('انقر لاختيار صورة','Click to choose an image')}</p>
                          <p className="text-label-sm" style={{ textTransform: 'none', color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>{D('JPG · PNG · WebP · حتى 5 ميغابايت','JPG · PNG · WebP · up to 5 MB')}</p>
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
                        {D('إزالة الصورة','Remove image')}
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
                    }}>{D('إلغاء','Cancel')}</Button>
                    <Button variant="primary" size="sm" type="submit" loading={actionLoading}>{D('حفظ الصنف','Save item')}</Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Products grid */}
            {products.length === 0 ? (
              <EmptyState icon="restaurant_menu" title={D('قائمة الأصناف فارغة','Menu is empty')} description={D('أضف أول صنف من القائمة أعلاه','Add your first item from the bar above')} />
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
                            <Icon name="restaurant" size={28} className="text-[var(--color-on-surface-variant)]" />
                            <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>{D('لا توجد صورة','No image')}</p>
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
                                {imgUrl ? D('تغيير الصورة','Change image') : D('رفع صورة','Upload image')}
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
                          <span style={{ textTransform: 'none' }}>{D('حذف','Delete')}</span>
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
        {/* ══════════════════════ INVENTORY ══════════════════════ */}
        {activeTab === 'inventory' && (() => {
          const stats = SANDBOX ? sandboxStore.getInventoryStats(merchantId) : {
            total: inventory.length,
            low: inventory.filter(p => p.stock > 0 && p.stock <= p.low_threshold).length,
            out: inventory.filter(p => p.stock === 0).length,
            units: inventory.reduce((s, p) => s + p.stock, 0),
          };
          return (
          <div id="merchant_inventory_tab" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: D('إجمالي المنتجات','Total products'), val: stats.total, color: 'var(--color-primary-container)' },
                { label: D('إجمالي الوحدات','Total units'), val: stats.units, color: 'var(--color-primary-container)' },
                { label: D('مخزون منخفض','Low stock'), val: stats.low, color: '#fbbf24' },
                { label: D('نفد المخزون','Out of stock'), val: stats.out, color: '#f87171' },
              ].map(s => (
                <Card key={s.label} variant="z2" radius="xl" padding="p-4">
                  <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-1">{s.label}</p>
                  <p className="text-headline-md font-bold" style={{ color: s.color }}>{s.val}</p>
                </Card>
              ))}
            </div>
            <Card variant="z2" radius="xl" padding="p-0" className="overflow-hidden">
              {inventory.map(p => {
                const state = p.stock === 0 ? 'out' : p.stock <= p.low_threshold ? 'low' : 'ok';
                const badge = state === 'out' ? { t: D('نفد','Out'), c: '#f87171' } : state === 'low' ? { t: D('منخفض','Low'), c: '#fbbf24' } : { t: D('متوفر','In stock'), c: '#4ade80' };
                return (
                  <div key={p.id} className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{p.name}</p>
                        <p className="text-label-sm text-[var(--color-on-surface-variant)]">{p.price} {cur} · {p.category}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold shrink-0" style={{ background: `${badge.c}22`, color: badge.c }}>{badge.t}</span>
                    </div>
                    {(!p.active || p.stock === 0) && (
                      <p className="text-xs mt-2" style={{ color: '#f87171' }}>{D('متوقف عن الطلب — أعد التزويد لإتاحته','Disabled from ordering — restock to re-enable')}</p>
                    )}
                    <div className="flex items-center justify-between gap-3 mt-3">
                      <div className="flex items-center gap-2">
                        <button id={`stock_minus_${p.id}`} onClick={() => handleAdjustStock(p.id, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '18px' }}>−</button>
                        <span className="font-bold text-white w-12 text-center" style={{ fontSize: '17px' }}>{p.stock}</span>
                        <button id={`stock_plus_${p.id}`} onClick={() => handleAdjustStock(p.id, +1)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(163,249,91,0.12)', color: 'var(--color-primary-fixed)', fontSize: '18px' }}>+</button>
                        <button onClick={() => handleAdjustStock(p.id, +10)} className="px-2.5 h-8 rounded-lg cursor-pointer text-xs font-semibold" style={{ background: 'rgba(163,249,91,0.08)', color: 'var(--color-primary-fixed)' }}>+10</button>
                      </div>
                      <button onClick={() => openHistory(p.id)} className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {stockHistoryFor === p.id ? D('إخفاء السجل','Hide log') : D('السجل','Log')}
                      </button>
                    </div>
                    {stockHistoryFor === p.id && (
                      <div className="mt-3 space-y-1.5 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        {historyRows.slice(0, 6).map(m => (
                          <div key={m.id} className="flex justify-between text-xs">
                            <span style={{ color: 'var(--color-on-surface-variant)' }}>{m.reason}</span>
                            <span style={{ color: m.delta >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{m.delta >= 0 ? '+' : ''}{m.delta}</span>
                          </div>
                        ))}
                        {historyRows.length === 0 && <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{D('لا يوجد سجل بعد.','No log yet.')}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              {inventory.length === 0 && <p className="p-6 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{D('لا توجد منتجات في المخزون.','No products in inventory.')}</p>}
            </Card>
          </div>
          );
        })()}

        {/* ══════════════════════ KITCHEN DISPLAY ══════════════════════ */}
        {activeTab === 'kitchen' && <KitchenQueue orders={orders} branchId={selectedBranchId} lang={lang} onAdvance={handleUpdateStatus} actionLoading={actionLoading} />}

        {/* ══════════════════════ WALLET CENTER (real wallet.service) ══════════════════════ */}
        {activeTab === 'walletcenter' && <MerchantWalletCenter merchantId={merchantId} lang={lang} />}

        {/* ══════════════════════ NOTIFICATIONS (reuse generic center) ══════════════════════ */}
        {activeTab === 'notifications' && <NotificationCenter adminId={merchantId} lang={lang} />}

        {/* ══════════════════════ STORE MANAGEMENT ══════════════════════ */}
        {activeTab === 'store' && selectedBranchId && <StoreManagement branchId={selectedBranchId} lang={lang} />}

        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'wallet' && (
          <div className="space-y-4" id="merchant_wallet_tab">
            <MerchantReports orders={orders as any} lang={lang} cur={cur} money={money} />
            {(() => {
              const a = merchantStats;
              const cards = [
                { label: D('إجمالي الطلبات','Total orders'), val: a.orders },
                { label: D('طلبات مكتملة','Completed orders'), val: a.delivered },
                { label: D('صافي الإيراد','Net revenue'), val: `${a.revenue} ${cur}` },
                { label: D('متوسط الطلب','Avg order'), val: `${a.avgOrder} ${cur}` },
              ];
              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" id="merchant_analytics_row">
                  {cards.map(c => (
                    <Card key={c.label} variant="z2" radius="xl" padding="p-4">
                      <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-1">{c.label}</p>
                      <p className="text-title-lg font-bold" style={{ color: 'var(--color-primary-container)' }}>{c.val}</p>
                    </Card>
                  ))}
                </div>
              );
            })()}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card variant="z3" radius="xl" padding="p-6" className="flex flex-col justify-between gap-6" id="earnings_balance_box">
              <div className="text-end">
                <p className="text-label-sm text-[var(--color-on-surface-variant)] mb-3">{D('رصيد الأرباح القابل للسحب','Withdrawable earnings balance')}</p>
                <p className="text-display-md font-bold" style={{ color: 'var(--color-primary-container)' }}>
                  {earnings.toFixed(2)}
                  <span className="text-headline-sm font-normal text-[var(--color-on-surface-variant)] mr-2">{cur}</span>
                </p>
              </div>
              <div className="space-y-3" id="earnings_analytics_rows">
                {[
                  { label: D('الطلبات المكتملة','Completed orders'),  val: `${deliveredCount} ${D('طلب','orders')}` },
                  { label: D('متوسط قيمة السلة','Avg basket value'),  val: money(avgBasket) },
                  { label: D('رسوم المنصة','Platform fees'),        val: D('مجاني للشركاء','Free for partners') },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-label-md text-[var(--color-on-surface)]" style={{ textTransform: 'none' }}>{val}</span>
                    <span className="text-label-md text-[var(--color-on-surface-variant)]">{label}</span>
                  </div>
                ))}
              </div>
              <Button variant="primary" size="lg" fullWidth onClick={() => toast.success(D('تم تسجيل طلب تحويل الأرباح للحساب البنكي','Earnings transfer to your bank account has been requested'))} id="payout_merch_trigger">
                {D('سحب الأرباح الفورية','Instant withdrawal')}
              </Button>
            </Card>
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-4" id="ledger_merch_faq">
              <div className="flex items-center gap-2.5 justify-end">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('إرشاد المحاسبة','Accounting guide')}</h3>
                <Icon name="info" size={20} className="text-[var(--color-tertiary-container)]" fill={1} />
              </div>
              <div className="space-y-3">
                {[
                  `${D('تحسب الأرباح بعد خصم رسوم التوصيل','Earnings are calculated after deducting the delivery fee')} (${money(10)}) ${D('لصالح الكابتن.','for the captain.')}`,
                  D('بمجرد اكتمال التوصيل، تتحول الأموال تلقائياً للحساب البنكي المسجل.','Once delivery completes, funds transfer automatically to the registered bank account.'),
                  D('لا تُحصَّل أي عمولات إضافية خلال الطور التجريبي الحالي.','No additional commissions are charged during the current trial phase.'),
                ].map((text, i) => (
                  <div key={i} className="flex gap-3 items-start justify-end">
                    <p className="text-body-md text-[var(--color-on-surface-variant)] text-end leading-relaxed" style={{ direction: 'rtl' }}>{text}</p>
                    <Icon name="check_circle" size={16} fill={1} className="text-[var(--color-tertiary-container)] shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
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
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">{D('شعار المتجر','Store logo')}</h3>
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
                    <img src={activeLogoUrl} alt={D('شعار المتجر','Store logo')} className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="store" size={40} className="text-[var(--color-on-surface-variant)]" />
                  )}
                </div>
              </div>

              <UploadStatus error={logoError} success={logoSuccess} successMsg={D('تم حفظ الشعار بنجاح','Logo saved successfully')} />

              {/* Select file */}
              <Button
                variant="secondary" size="md" fullWidth
                leftIcon={<Icon name="upload" size={18} />}
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                id="logo_upload_btn"
              >
                {activeLogoUrl ? D('تغيير الشعار','Change logo') : D('رفع الشعار','Upload logo')}
              </Button>

              {/* Save — only when a new file is pending */}
              {pendingLogoFile && (
                <Button
                  variant="primary" size="md" fullWidth loading={logoUploading}
                  onClick={handleLogoSave}
                  id="logo_save_btn"
                >
                  {logoUploading ? D('جاري الرفع…','Uploading…') : D('حفظ الشعار','Save logo')}
                </Button>
              )}

              <p className="text-label-sm text-center" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>
                {D('JPG · PNG · WebP · حتى 2 ميغابايت','JPG · PNG · WebP · up to 2 MB')}
              </p>
            </Card>

            {/* ── Branch Cover Image ─────────────────────────────── */}
            <Card variant="z3" radius="xl" padding="p-6" className="space-y-5" id="branch_cover_card">
              <div className="flex items-center justify-end gap-2">
                <h3 className="text-headline-sm font-semibold text-[var(--color-on-surface)]">
                  {D('صورة غلاف الفرع','Branch cover image')}
                </h3>
                <Icon name="panorama" size={20} fill={1} className="text-[var(--color-tertiary-container)]" />
              </div>
              <p className="text-label-sm text-end" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>
                {D('تظهر في شاشة المطعم كصورة بطولية للعميل','Shown on the store screen as a hero image for the customer')}
              </p>

              {/* Cover preview — 16:9 */}
              <div
                className="relative w-full overflow-hidden rounded-[var(--radius)] surface-z2 flex items-center justify-center"
                style={{ paddingTop: '56.25%' }}
                id="cover_preview_box"
              >
                <div className="absolute inset-0">
                  {activeCoverUrl ? (
                    <img src={activeCoverUrl} alt={D('غلاف الفرع','Branch cover')} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Icon name="panorama" size={36} className="text-[var(--color-on-surface-variant)]" />
                      <p className="text-label-sm" style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none' }}>{D('لا توجد صورة غلاف','No cover image')}</p>
                    </div>
                  )}
                </div>
              </div>

              <UploadStatus error={coverError} success={coverSuccess} successMsg={D('تم حفظ صورة الغلاف بنجاح','Cover image saved successfully')} />

              {/* Select file */}
              <Button
                variant="secondary" size="md" fullWidth
                leftIcon={<Icon name="upload" size={18} />}
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                id="cover_upload_btn"
              >
                {activeCoverUrl ? D('تغيير صورة الغلاف','Change cover image') : D('رفع صورة الغلاف','Upload cover image')}
              </Button>

              {/* Save — only when a new file is pending */}
              {pendingCoverFile && (
                <Button
                  variant="primary" size="md" fullWidth loading={coverUploading}
                  onClick={handleCoverSave}
                  id="cover_save_btn"
                >
                  {coverUploading ? D('جاري الرفع…','Uploading…') : D('حفظ صورة الغلاف','Save cover image')}
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
