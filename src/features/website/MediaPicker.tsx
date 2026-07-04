import React, { useEffect, useRef, useState } from 'react';
import { X, UploadCloud, LinkIcon, ImageOff } from 'lucide-react';
import { assetsService, type AssetItem, type AssetCategory } from '../../experience/assets.service';

// Media Library picker — reuses the EXISTING assets.service (the ONE media library). No new media system:
// lists existing media, uploads via assetsService.upload, and registers a pasted URL via assetsService.registerUrl.
export const MediaPicker: React.FC<{ open: boolean; kind?: 'image' | 'video'; onPick: (url: string) => void; onClose: () => void; lang: 'ar' | 'en' }> = ({ open, kind = 'image', onPick, onClose, lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [items, setItems] = useState<AssetItem[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const category: AssetCategory = kind === 'video' ? 'video' : 'image';

  const reload = () => { assetsService.list().then(a => setItems(a)); };
  useEffect(() => { if (open) { reload(); setErr(''); setUrl(''); } }, [open]);
  if (!open) return null;

  const pick = (u: string) => { onPick(u); onClose(); };
  const onFile = async (f?: File) => {
    if (!f) return; setBusy(true); setErr('');
    try { const item = await assetsService.upload(f, category); reload(); pick(item.url); }
    catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(false); }
  };
  const addUrl = async () => {
    if (!url.trim()) return; setBusy(true); setErr('');
    try { const item = await assetsService.registerUrl(url.trim(), url.split('/').pop() || 'asset', category); reload(); pick(item.url); }
    catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={onClose}>
      <div id="media_picker" onClick={e => e.stopPropagation()} dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{ width: 'min(720px, 96vw)', maxHeight: '86vh', overflow: 'auto', background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 18, padding: 18 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('مكتبة الوسائط', 'Media Library')} · {kind === 'video' ? L('فيديو', 'Video') : L('صورة', 'Image')}</p>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant)' }}><X size={18} /></button>
        </div>

        {/* Add media (upload from disk into the library, or register a CDN URL) */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input ref={fileRef} type="file" accept={kind === 'video' ? 'video/*' : 'image/*'} style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} id="media_upload_btn" className="inline-flex items-center gap-1.5 cursor-pointer" style={btn(true)}><UploadCloud size={14} />{L('رفع', 'Upload')}</button>
          <span className="flex-1 flex items-center gap-1.5 min-w-[220px]" style={{ ...btn(false), padding: '2px 8px' }}>
            <LinkIcon size={13} style={{ color: 'var(--color-on-surface-variant)' }} />
            <input id="media_url_input" value={url} onChange={e => setUrl(e.target.value)} placeholder={L('الصق رابط CDN…', 'Paste a CDN URL…')} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-on-surface)', fontSize: 13, height: 30 }} />
            <button onClick={addUrl} disabled={busy || !url.trim()} id="media_addurl_btn" className="cursor-pointer text-[12px] font-bold" style={{ color: 'var(--color-primary-fixed)', background: 'transparent', border: 'none' }}>{L('إضافة', 'Add')}</button>
          </span>
        </div>
        {err && <p className="text-[12px] mb-2" style={{ color: '#f87171' }}>{err}</p>}

        {/* Existing library */}
        {items.length === 0
          ? <div className="flex flex-col items-center justify-center py-10 text-center" style={{ color: 'var(--color-on-surface-variant)' }}><ImageOff size={26} /><p className="text-[13px] mt-2">{L('لا توجد وسائط بعد — ارفع أو الصق رابطًا.', 'No media yet — upload or paste a URL.')}</p></div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              {items.map(a => (
                <button key={a.id} onClick={() => pick(a.url)} className="cursor-pointer text-start" style={{ background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', borderRadius: 12, overflow: 'hidden', padding: 0 }}>
                  {a.category === 'video'
                    ? <div style={{ aspectRatio: '4/3', background: '#000', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11 }}>▶ video</div>
                    : <img src={a.url} alt={a.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />}
                  <span className="block text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{a.name}</span>
                </button>
              ))}
            </div>}
      </div>
    </div>
  );
};

const btn = (primary: boolean): React.CSSProperties => ({ padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: primary ? 'none' : '1px solid var(--color-outline-variant)', background: primary ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: primary ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface)' });
