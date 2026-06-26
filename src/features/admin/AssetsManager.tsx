import { useEffect, useRef, useState } from 'react';
import { assetsService, AssetItem, AssetCategory } from '../../experience/assets.service';

const ACCENT = 'var(--color-primary-fixed)';
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 };
const CATS: AssetCategory[] = ['logo', 'splash', 'onboarding', 'login', 'lottie', 'video', 'image'];

import { useAppConfig } from '../../contexts/AppConfigContext';

export function AssetsManager() {
  const { lang } = useAppConfig();
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [cat, setCat] = useState<AssetCategory>('logo');
  const [items, setItems] = useState<AssetItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => { setItems(await assetsService.list(cat)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat]);

  const upload = async (f: File) => {
    setBusy(true); setErr(null);
    try { await assetsService.upload(f, cat); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : L('فشل الرفع','Upload failed')); }
    finally { setBusy(false); }
  };
  const remove = async (it: AssetItem) => { await assetsService.remove(it); await load(); };
  const copy = (url: string) => { try { navigator.clipboard.writeText(url); } catch { /* ignore */ } };

  return (
    <div id="assets_manager" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: cat === c ? ACCENT : 'rgba(255,255,255,0.04)', color: cat === c ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{c}</button>
          ))}
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: ACCENT, border: 'none', color: 'var(--color-on-primary-fixed)' }}>
          {busy ? L('جارٍ الرفع…','Uploading…') : `${L('رفع إلى','Upload to')} ${cat}`}
        </button>
        <input ref={fileRef} type="file" hidden accept={cat === 'lottie' ? 'application/json' : cat === 'video' ? 'video/mp4,video/webm' : 'image/*'} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
      </div>

      {err && <div style={{ ...card, color: 'var(--color-error)', fontSize: 12 }}>{err}</div>}
      {assetsService.isSandbox && <div style={{ ...card, fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('وضع التجربة: تُحفظ الصور الصغيرة محلياً. للأصول الكبيرة (Lottie/فيديو) استخدم رابط CDN. عند التشغيل الحقيقي تُرفع إلى Supabase Storage وتُولَّد روابط CDN تلقائياً.','Sandbox: small images are stored locally. For large assets (Lottie/video) use a CDN URL. In production they upload to Supabase Storage with auto-generated CDN links.')}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        {items.length === 0 && <p style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{L('لا توجد أصول في','No assets in')} «{cat}».</p>}
        {items.map(it => (
          <div key={it.id} style={{ ...card, padding: 8 }}>
            <div style={{ height: 72, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              {it.category === 'video' ? <video src={it.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : it.category === 'lottie' ? <span style={{ fontSize: 11, color: ACCENT }}>Lottie JSON</span>
                : <img src={it.url} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            </div>
            <p style={{ fontSize: 10, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</p>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button onClick={() => copy(it.url)} style={miniBtn}>{L('نسخ الرابط','Copy link')}</button>
              <button onClick={() => remove(it)} style={{ ...miniBtn, color: 'var(--color-error)' }}>{L('حذف','Delete')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = { flex: 1, padding: '4px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' };
