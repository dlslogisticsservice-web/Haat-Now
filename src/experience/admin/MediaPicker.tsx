import { useRef, useState } from 'react';
import { MediaRef, MediaKind } from '../experienceTypes';
import { assetsService, AssetCategory } from '../assets.service';

const KINDS: { k: MediaKind; label: string }[] = [
  { k: 'icon', label: 'أيقونة' },
  { k: 'image', label: 'صورة' },
  { k: 'lottie', label: 'Lottie' },
  { k: 'video', label: 'فيديو' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'white', fontSize: 12, outline: 'none',
};

// Reusable editor for a single MediaRef. Supports icon name, pasted CDN URL,
// and direct upload to Supabase Storage (via assetsService).
export function MediaPicker({ value, onChange, category }: { value: MediaRef; onChange: (m: MediaRef) => void; category: AssetCategory }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const item = await assetsService.upload(file, category);
      onChange({ ...value, url: item.url });
    } catch (e) { setErr(e instanceof Error ? e.message : 'فشل الرفع'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {KINDS.map(({ k, label }) => (
          <button key={k} onClick={() => onChange({ ...value, kind: k })}
            style={{ flex: 1, height: 28, borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: value.kind === k ? 'var(--color-primary-fixed)' : 'rgba(255,255,255,0.04)',
              color: value.kind === k ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>
            {label}
          </button>
        ))}
      </div>

      {value.kind === 'icon' ? (
        <input style={inputStyle} value={value.icon || ''} placeholder="اسم Material Symbol (مثل two_wheeler)" onChange={e => onChange({ ...value, icon: e.target.value })} />
      ) : (
        <>
          <input style={inputStyle} value={value.url || ''} placeholder="رابط CDN" onChange={e => onChange({ ...value, url: e.target.value })} />
          {value.kind === 'video' && (
            <input style={inputStyle} value={value.poster || ''} placeholder="صورة الـ Poster (رابط)" onChange={e => onChange({ ...value, poster: e.target.value })} />
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              style={{ height: 28, padding: '0 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(163,249,91,0.1)', border: '1px solid rgba(163,249,91,0.25)', color: 'var(--color-primary-fixed)' }}>
              {busy ? 'جارٍ الرفع…' : 'رفع ملف'}
            </button>
            <input ref={fileRef} type="file" hidden
              accept={value.kind === 'lottie' ? 'application/json' : value.kind === 'video' ? 'video/mp4,video/webm' : 'image/*'}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
          </div>
        </>
      )}
      {err && <p style={{ fontSize: 10, color: 'var(--color-error)' }}>{err}</p>}
    </div>
  );
}
