// ─────────────────────────────────────────────────────────────────────────────
// Live App Boot Simulator (Phase 8J).
//
// ▶ Simulate App Launch — NOT a preview. It executes the REAL runtime boot sequence
// (Splash → Intro → Welcome → Auth Landing → Home) by mounting each screen THROUGH the Runtime
// Registry / Adapter (getRuntime('customer').getScreen(id).load()) — the same lazy factories the
// live app uses. Each stage plays for a beat, then advances, with a progress rail. No fake
// transitions, no duplicated screens.
// ─────────────────────────────────────────────────────────────────────────────
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, X, Loader2 } from 'lucide-react';
import { getRuntime } from '../../../runtime/registry';
import { DEMO_CONTENT_ENABLED } from '../../../config/runtime';
import type { RuntimeContext } from '../../../runtime/RuntimeAdapter';
import '../../../runtime/adapters/customer.adapter';

const SEQUENCE: { id: string; label: string; ms: number }[] = [
  { id: 'splash', label: 'Splash', ms: 1600 },
  { id: 'intro', label: 'Intro', ms: 1500 },
  { id: 'welcome', label: 'Welcome', ms: 1500 },
  { id: 'landing', label: 'Auth', ms: 1500 },
  { id: 'home', label: 'Home', ms: 2000 },
];

const DEMO_IDENTITY = { id: '11111111-0000-0000-0000-000000000001', phone: '+201000000001', role: 'customer' };

export const BootSimulator: React.FC<{ lang: 'ar' | 'en'; onClose: () => void; width?: number; height?: number }> = ({ lang, onClose, width = 320, height = 680 }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctx: RuntimeContext = useMemo(() => ({ identity: DEMO_CONTENT_ENABLED ? DEMO_IDENTITY : null, locale: lang, country: 'SA', sandbox: DEMO_CONTENT_ENABLED }), [lang]);
  const adapter = getRuntime('customer');
  const stage = SEQUENCE[idx];
  const screenDef = adapter?.getScreen(stage.id);
  const canMount = !!screenDef && (!(screenDef.requires?.includes('identity')) || !!ctx.identity);

  const Lazy = useMemo(
    () => (canMount && screenDef ? React.lazy(async () => ({ default: await screenDef.load() })) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage.id, canMount],
  );

  useEffect(() => {
    if (!playing) return;
    timer.current = setTimeout(() => setIdx(i => (i + 1 < SEQUENCE.length ? i + 1 : i)), stage.ms);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [idx, playing, stage.ms]);

  const atEnd = idx >= SEQUENCE.length - 1;

  return (
    <div id="boot_simulator" style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.72)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        {/* progress rail */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} id="boot_progress">
          {SEQUENCE.map((s, i) => (
            <span key={s.id} data-stage={s.id} data-active={i === idx ? '1' : '0'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: i <= idx ? 'var(--color-primary-fixed,#a3f95b)' : 'rgba(255,255,255,.5)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: i <= idx ? 'var(--color-primary-fixed,#a3f95b)' : 'rgba(255,255,255,.25)' }} />
              {s.label}{i < SEQUENCE.length - 1 && <span style={{ opacity: .4 }}>→</span>}
            </span>
          ))}
        </div>
        {/* real runtime screen in a phone frame */}
        <div style={{ width, height, borderRadius: 30, overflow: 'hidden', border: '10px solid #05070a', background: '#05070a', boxShadow: '0 30px 90px -30px rgba(0,0,0,.9)', position: 'relative' }} id="boot_stage" data-stage={stage.id}>
          <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
            {Lazy ? (
              <Suspense fallback={<div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><Loader2 className="animate-spin" size={26} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} /></div>}>
                <Lazy ctx={ctx} />
              </Suspense>
            ) : <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{L('لا يمكن تشغيل هذه المرحلة', 'Stage unavailable')}</div>}
          </div>
        </div>
        {/* controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="boot_playpause" onClick={() => setPlaying(p => !p)} style={btn}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? L('إيقاف', 'Pause') : L('تشغيل', 'Play')}</button>
          <button id="boot_restart" onClick={() => { setIdx(0); setPlaying(true); }} style={btn}><RotateCcw size={14} />{L('إعادة', 'Restart')}</button>
          <button id="boot_close" onClick={onClose} style={{ ...btn, background: 'var(--color-primary-fixed,#a3f95b)', color: '#05230f', border: 'none' }}><X size={14} />{L('إغلاق', 'Close')}</button>
        </div>
        {atEnd && <span style={{ fontSize: 11, color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 700 }} id="boot_done">{L('اكتمل التشغيل — Home', 'Boot complete — Home reached')}</span>}
      </div>
    </div>
  );
};

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' };

export default BootSimulator;
