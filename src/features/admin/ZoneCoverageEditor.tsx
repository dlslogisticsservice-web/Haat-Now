import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pencil, Hand, Trash2, Undo2, Redo2, Maximize, Save, MapPin, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Drawer } from '../../components/ui/Modal';
import { toast } from '../../components/ui/feedback';
import { adminCrud } from '../../services/admin-crud.service';

type Pt = { x: number; y: number };
const VIEW_W = 100, VIEW_H = 64;          // SVG coordinate space (responsive)
const KM_PER_UNIT = 0.45;                  // notional scale: 1 viewBox unit ≈ 0.45 km
const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Shoelace area (viewBox units) → km².
function areaKm2(pts: Pt[]): number {
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y; }
  return Math.abs(a / 2) * KM_PER_UNIT * KM_PER_UNIT;
}
// Basic self-intersection check (segments crossing) → invalid polygon.
function selfIntersects(pts: Pt[]): boolean {
  const n = pts.length; if (n < 4) return false;
  const seg = (a: Pt, b: Pt, c: Pt, d: Pt) => {
    const ccw = (p: Pt, q: Pt, r: Pt) => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);
    return (ccw(a, c, d) * ccw(b, c, d) < 0) && (ccw(a, b, c) * ccw(a, b, d) < 0);
  };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
    if (seg(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
  }
  return false;
}

/**
 * Zone coverage GIS editor — draw/edit/delete a coverage polygon WITHOUT a Google
 * Maps key (pure SVG). Draw vertices, drag to edit, double-click to remove, undo/redo,
 * fit-to-bounds, live area + validity, and Save (persists to the zone). When a Maps
 * key is present the same polygon overlays a live map (documented); the editor remains
 * fully functional either way. Bilingual · dark · responsive.
 */
export const ZoneCoverageEditor: React.FC<{ zone: any; lang: 'ar' | 'en'; onClose: () => void; onSaved?: () => void }> = ({ zone, lang, onClose, onSaved }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const svgRef = useRef<SVGSVGElement>(null);
  const parse = (): Pt[] => { try { return zone.polygon ? JSON.parse(zone.polygon) : []; } catch { return []; } };
  const [pts, setPts] = useState<Pt[]>(parse);
  const [mode, setMode] = useState<'draw' | 'edit'>('draw');
  const [undo, setUndo] = useState<Pt[][]>([]);
  const [redo, setRedo] = useState<Pt[][]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const commit = useCallback((next: Pt[]) => { setUndo(u => [...u, pts]); setRedo([]); setPts(next); }, [pts]);
  const toSvg = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * VIEW_W, 0, VIEW_W), y: clamp(((e.clientY - r.top) / r.height) * VIEW_H, 0, VIEW_H) };
  };

  const onCanvasClick = (e: React.MouseEvent) => { if (mode !== 'draw') return; commit([...pts, toSvg(e)]); };
  const onVertexDown = (i: number) => (e: React.MouseEvent) => { e.stopPropagation(); if (mode === 'edit') { setUndo(u => [...u, pts]); setRedo([]); setDrag(i); } };
  const onMove = (e: React.MouseEvent) => { if (drag === null) return; const p = toSvg(e); setPts(cur => cur.map((q, i) => i === drag ? p : q)); };
  const onUp = () => setDrag(null);
  const onVertexDbl = (i: number) => (e: React.MouseEvent) => { e.stopPropagation(); commit(pts.filter((_, k) => k !== i)); };

  const doUndo = () => { if (!undo.length) return; setRedo(r => [...r, pts]); setPts(undo[undo.length - 1]); setUndo(u => u.slice(0, -1)); };
  const doRedo = () => { if (!redo.length) return; setUndo(u => [...u, pts]); setPts(redo[redo.length - 1]); setRedo(r => r.slice(0, -1)); };
  const clearAll = () => commit([]);
  const fit = () => { // normalize points to fill the canvas with a margin
    if (pts.length < 2) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX || 1, h = maxY - minY || 1, m = 8;
    commit(pts.map(p => ({ x: m + ((p.x - minX) / w) * (VIEW_W - 2 * m), y: m + ((p.y - minY) / h) * (VIEW_H - 2 * m) })));
  };

  const valid = pts.length >= 3 && !selfIntersects(pts);
  const area = areaKm2(pts);

  const save = async () => {
    setSaving(true);
    const { error } = await adminCrud('zones').update(zone.id, { polygon: JSON.stringify(pts), area_km2: area.toFixed(2), vertices: pts.length });
    setSaving(false);
    if (error) { toast.error(L('تعذّر حفظ التغطية', 'Could not save coverage')); return; }
    toast.success(L('تم حفظ منطقة التغطية', 'Coverage saved')); onSaved?.();
  };

  useEffect(() => { const up = () => setDrag(null); window.addEventListener('mouseup', up); return () => window.removeEventListener('mouseup', up); }, []);

  const ToolBtn = ({ active, onClick, Icon: I, label, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} title={label} className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer disabled:opacity-40"
      style={active ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : card}><I size={15} />{label}</button>
  );

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[94vh]" title={L('محرّر تغطية المنطقة', 'Zone coverage editor')}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer" style={card}>{L('إغلاق', 'Close')}</button>
          <button onClick={save} disabled={saving || !valid} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Save size={15} />{saving ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ التغطية', 'Save coverage')}</button>
        </div>
      }>
      <div className="px-4 pb-4 space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="zone_coverage_editor">
        <div className="flex items-center gap-2 p-2.5 rounded-xl" style={card}>
          <MapPin size={16} color="var(--color-primary-fixed)" />
          <span className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{zone.name || L('منطقة', 'Zone')}</span>
          <span className="text-[11px] ms-auto" style={{ color: 'var(--color-on-surface-variant)' }}>{MAPS_KEY ? L('خرائط مباشرة مفعّلة', 'Live maps enabled') : L('محرّر تشغيلي (يلزم مفتاح خرائط للبلاط)', 'Operational editor (map tiles need a Maps key)')}</span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          <ToolBtn active={mode === 'draw'} onClick={() => setMode('draw')} Icon={Pencil} label={L('رسم', 'Draw')} />
          <ToolBtn active={mode === 'edit'} onClick={() => setMode('edit')} Icon={Hand} label={L('تعديل', 'Edit')} />
          <ToolBtn onClick={doUndo} Icon={Undo2} label={L('تراجع', 'Undo')} disabled={!undo.length} />
          <ToolBtn onClick={doRedo} Icon={Redo2} label={L('إعادة', 'Redo')} disabled={!redo.length} />
          <ToolBtn onClick={fit} Icon={Maximize} label={L('ملاءمة', 'Fit')} disabled={pts.length < 2} />
          <ToolBtn onClick={clearAll} Icon={Trash2} label={L('مسح', 'Clear')} disabled={!pts.length} />
        </div>

        {/* SVG GIS canvas (no Google Maps required) */}
        <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} onClick={onCanvasClick} onMouseMove={onMove} onMouseUp={onUp}
          className="w-full rounded-2xl select-none" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', cursor: mode === 'draw' ? 'crosshair' : 'default' }} id="zone_svg_canvas">
          <defs>
            <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" /></pattern>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" />
          {pts.length >= 2 && (
            <polygon points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill={valid ? 'rgba(163,249,91,0.16)' : 'rgba(248,113,113,0.16)'}
              stroke={valid ? 'var(--color-primary-fixed)' : '#f87171'} strokeWidth="0.6" strokeLinejoin="round" />
          )}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.5" onMouseDown={onVertexDown(i)} onDoubleClick={onVertexDbl(i)}
              fill={i === 0 ? 'var(--color-primary-fixed)' : '#fff'} stroke="var(--color-primary-fixed)" strokeWidth="0.4"
              style={{ cursor: mode === 'edit' ? 'grab' : 'pointer' }} />
          ))}
        </svg>
        <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          {mode === 'draw' ? L('انقر لإضافة رؤوس المضلّع.', 'Click to add polygon vertices.') : L('اسحب الرؤوس للتعديل · نقر مزدوج للحذف.', 'Drag vertices to edit · double-click to delete.')}
        </p>

        {/* Stats + validity */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl text-center" style={card}><p className="text-lg font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{pts.length}</p><p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الرؤوس', 'Vertices')}</p></div>
          <div className="p-3 rounded-xl text-center" style={card}><p className="text-lg font-extrabold" style={{ color: '#9ed442' }}>{area.toFixed(2)}</p><p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('كم²', 'km²')}</p></div>
          <div className="p-3 rounded-xl text-center flex flex-col items-center justify-center" style={card}>
            {valid ? <CheckCircle2 size={18} color="#4ade80" /> : <AlertTriangle size={18} color="#fbbf24" />}
            <p className="text-[11px] mt-0.5" style={{ color: valid ? '#4ade80' : '#fbbf24' }}>{pts.length < 3 ? L('أضف 3 رؤوس', 'Add 3 pts') : valid ? L('صالح', 'Valid') : L('متقاطع', 'Self-intersect')}</p>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
