// ─────────────────────────────────────────────────────────────────────────────
// Experience Assets — Supabase Storage upload + CDN URL generation.
// Real path: uploads to the `experience-assets` bucket and returns a public CDN
// URL. Sandbox path: small images become data URLs (demo); large files (lottie
// JSON / video) require a pasted URL.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';

// Demo mode is decided by the BUILD, never by whether a client object happens to exist:
// `|| !supabase` meant a production deploy with missing env vars silently served demo
// data. (main.tsx blocks that boot today, so this is closing the trap, not a live bug.)
import { IS_SANDBOX as SANDBOX } from '../config/runtime';
export const ASSET_BUCKET = 'experience-assets';
const INDEX_KEY = 'haat_sb_experience_assets_v1';

export type AssetCategory = 'logo' | 'splash' | 'onboarding' | 'login' | 'lottie' | 'video' | 'image';

export interface AssetItem {
  id: string;
  name: string;
  url: string;
  category: AssetCategory;
  contentType: string;
  size: number;
  created_at: string;
}

// ── Brand Asset slots (Phase 0.3) — the BRAND domain only (independent of Theme Presets). ──
// Each slot maps to a tenant brand field; uploads reuse assetsService.upload (the ONE pipeline).
export interface BrandSlot { key: string; ar: string; en: string; field: string; category: AssetCategory }
export const BRAND_SLOTS: BrandSlot[] = [
  { key: 'logo', ar: 'الشعار', en: 'Logo', field: 'logo_url', category: 'logo' },
  { key: 'svg', ar: 'شعار SVG', en: 'SVG', field: 'svg_url', category: 'image' },
  { key: 'png', ar: 'شعار PNG', en: 'PNG', field: 'png_url', category: 'image' },
  { key: 'favicon', ar: 'أيقونة الموقع', en: 'Favicon', field: 'favicon_url', category: 'image' },
  { key: 'app_icon', ar: 'أيقونة التطبيق', en: 'App Icon', field: 'app_icon_url', category: 'image' },
  { key: 'splash', ar: 'شاشة البداية', en: 'Splash', field: 'splash_url', category: 'splash' },
  { key: 'invoice_logo', ar: 'شعار الفاتورة', en: 'Invoice Logo', field: 'invoice_logo_url', category: 'image' },
  { key: 'email_header', ar: 'ترويسة البريد', en: 'Email Header', field: 'email_header_url', category: 'image' },
  { key: 'social_banner', ar: 'بانر اجتماعي', en: 'Social Banner', field: 'social_banner_url', category: 'image' },
  { key: 'brand_image', ar: 'صورة العلامة', en: 'Brand Image', field: 'brand_image_url', category: 'image' },
];

const readIndex = (): AssetItem[] => { try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); } catch { return []; } };
const writeIndex = (a: AssetItem[]) => { try { localStorage.setItem(INDEX_KEY, JSON.stringify(a)); } catch { /* ignore */ } };

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = reject;
  r.readAsDataURL(file);
});

export const assetsService = {
  isSandbox: SANDBOX,

  async list(category?: AssetCategory): Promise<AssetItem[]> {
    if (SANDBOX) {
      const all = readIndex();
      return category ? all.filter(a => a.category === category) : all;
    }
    try {
      const { data } = await supabase.storage.from(ASSET_BUCKET).list(category ? `${category}` : '', { sortBy: { column: 'created_at', order: 'desc' }, limit: 100 });
      return (data || []).map(o => ({
        id: o.id || o.name,
        name: o.name,
        url: this.publicUrl(`${category ? category + '/' : ''}${o.name}`),
        category: (category || 'image') as AssetCategory,
        contentType: (o.metadata?.mimetype as string) || '',
        size: (o.metadata?.size as number) || 0,
        created_at: o.created_at || new Date().toISOString(),
      }));
    } catch { return []; }
  },

  publicUrl(path: string): string {
    if (SANDBOX) return path;
    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  /** Upload a file and return its CDN URL. Sandbox: data URL for small images. */
  async upload(file: File, category: AssetCategory): Promise<AssetItem> {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${category}/${Date.now()}_${safe}`;
    if (SANDBOX) {
      const isImage = file.type.startsWith('image/');
      if (!isImage || file.size > 600_000) {
        throw new Error('في وضع التجربة ارفع صورة صغيرة فقط أو الصق رابط CDN مباشرة للأصول الكبيرة (Lottie/فيديو).');
      }
      const url = await fileToDataUrl(file);
      const item: AssetItem = { id: path, name: file.name, url, category, contentType: file.type, size: file.size, created_at: new Date().toISOString() };
      const all = readIndex(); all.unshift(item); writeIndex(all.slice(0, 60));
      return item;
    }
    const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
    if (error) throw error;
    return { id: path, name: file.name, url: this.publicUrl(path), category, contentType: file.type, size: file.size, created_at: new Date().toISOString() };
  },

  /** Register an externally-hosted asset (pasted CDN URL). */
  async registerUrl(url: string, name: string, category: AssetCategory): Promise<AssetItem> {
    const item: AssetItem = { id: `url-${Date.now()}`, name, url, category, contentType: '', size: 0, created_at: new Date().toISOString() };
    if (SANDBOX) { const all = readIndex(); all.unshift(item); writeIndex(all.slice(0, 60)); }
    return item;
  },

  async remove(item: AssetItem): Promise<void> {
    if (SANDBOX || item.id.startsWith('url-')) {
      writeIndex(readIndex().filter(a => a.id !== item.id));
      return;
    }
    try { await supabase.storage.from(ASSET_BUCKET).remove([item.id]); } catch { /* ignore */ }
  },
};
