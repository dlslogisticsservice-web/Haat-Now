import React, { useEffect, useState } from 'react';
import { Store, Power, Clock, Coffee, Plane, Zap, Save, MapPin, Banknote, Timer } from 'lucide-react';
import { toast } from '../../components/ui/feedback';
import {
  merchantSettingsService, StoreSettings, StoreStatus, DAY_KEYS, DayKey, DEFAULT_STORE_SETTINGS,
} from '../../services/merchant-settings.service';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: 16 };
const input = 'w-full h-10 px-3 rounded-xl text-sm';
const inputStyle = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' } as React.CSSProperties;

const STATUS_CFG: Record<StoreStatus, { ar: string; en: string; color: string; Icon: typeof Power }> = {
  open: { ar: 'مفتوح', en: 'Open', color: '#4ade80', Icon: Power },
  busy: { ar: 'مشغول', en: 'Busy', color: '#fbbf24', Icon: Coffee },
  closed: { ar: 'مغلق', en: 'Closed', color: '#f87171', Icon: Power },
};
const DAY_LABEL: Record<DayKey, [string, string]> = {
  sun: ['الأحد', 'Sun'], mon: ['الإثنين', 'Mon'], tue: ['الثلاثاء', 'Tue'], wed: ['الأربعاء', 'Wed'],
  thu: ['الخميس', 'Thu'], fri: ['الجمعة', 'Fri'], sat: ['السبت', 'Sat'],
};

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className="w-11 h-6 rounded-full relative cursor-pointer transition-colors shrink-0"
    style={{ background: on ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)' }}>
    <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', insetInlineStart: on ? '22px' : '2px' }} />
  </button>
);

export const StoreManagement: React.FC<{ branchId: string; lang: 'ar' | 'en' }> = ({ branchId, lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [s, setS] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { merchantSettingsService.get(branchId).then(v => { setS(v); setLoading(false); }); }, [branchId]);

  const patch = (p: Partial<StoreSettings>) => setS(prev => ({ ...prev, ...p }));
  const patchDay = (d: DayKey, p: Partial<StoreSettings['hours'][DayKey]>) =>
    setS(prev => ({ ...prev, hours: { ...prev.hours, [d]: { ...prev.hours[d], ...p } } }));

  const save = async () => {
    setBusy(true);
    await merchantSettingsService.save(branchId, s);
    setBusy(false);
    toast.success(L('تم حفظ إعدادات المتجر', 'Store settings saved'));
  };

  if (loading) return <div className="py-12 flex justify-center"><span className="animate-pulse" style={{ ...card, width: 200, height: 24 }} /></div>;

  const accepting = merchantSettingsService.isAcceptingOrders(s);
  const prep = merchantSettingsService.effectivePrepTime(s);

  return (
    <div id="store_management" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      {/* Live status banner */}
      <div style={card} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Store size={18} color="var(--color-primary-fixed)" />
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('إدارة المتجر', 'Store management')}</p>
            <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الحالة التشغيلية وساعات العمل', 'Operating status & working hours')}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{ background: `${accepting ? '#4ade80' : '#f87171'}22`, color: accepting ? '#4ade80' : '#f87171' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accepting ? '#4ade80' : '#f87171' }} />
          {accepting ? L('يستقبل الطلبات الآن', 'Accepting orders now') : L('لا يستقبل الطلبات', 'Not accepting orders')}
        </span>
      </div>

      {/* Status segmented */}
      <div style={card} className="space-y-3">
        <p className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('حالة المتجر', 'Store status')}</p>
        <div className="grid grid-cols-3 gap-2">
          {(['open', 'busy', 'closed'] as StoreStatus[]).map(st => {
            const cfg = STATUS_CFG[st]; const on = s.status === st;
            return (
              <button key={st} onClick={() => patch({ status: st })} aria-pressed={on}
                className="flex flex-col items-center gap-1 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all"
                style={on ? { background: `${cfg.color}22`, border: `1px solid ${cfg.color}`, color: cfg.color } : { ...inputStyle }}>
                <cfg.Icon size={18} />{L(cfg.ar, cfg.en)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Operational toggles + numbers */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div style={card} className="space-y-3">
          {[
            { Icon: Plane, label: L('وضع الإجازة', 'Vacation mode'), hint: L('إغلاق المتجر مؤقتًا', 'Temporarily close the store'), on: s.vacationMode, set: (v: boolean) => patch({ vacationMode: v }) },
            { Icon: Zap, label: L('القبول التلقائي', 'Auto-accept'), hint: L('قبول الطلبات الجديدة تلقائيًا', 'Auto-accept new orders'), on: s.autoAccept, set: (v: boolean) => patch({ autoAccept: v }) },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <row.Icon size={16} color="var(--color-on-surface-variant)" />
                <div className="min-w-0"><p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{row.label}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{row.hint}</p></div>
              </div>
              <Toggle on={row.on} onChange={row.set} label={row.label} />
            </div>
          ))}
        </div>
        <div style={card} className="grid grid-cols-2 gap-3">
          {[
            { Icon: Banknote, label: L('الحد الأدنى للطلب', 'Min order'), value: s.minOrder, set: (v: number) => patch({ minOrder: v }) },
            { Icon: Timer, label: L('وقت التحضير (د)', 'Prep time (min)'), value: s.prepTimeMinutes, set: (v: number) => patch({ prepTimeMinutes: v }) },
            { Icon: Coffee, label: L('إضافة وقت الانشغال (د)', 'Busy extra (min)'), value: s.busyExtraMinutes, set: (v: number) => patch({ busyExtraMinutes: v }) },
            { Icon: MapPin, label: L('نطاق التوصيل (كم)', 'Radius (km)'), value: s.deliveryRadiusKm, set: (v: number) => patch({ deliveryRadiusKm: v }) },
          ].map(f => (
            <label key={f.label} className="text-xs">
              <span className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--color-on-surface-variant)' }}><f.Icon size={12} />{f.label}</span>
              <input type="number" min={0} value={f.value} onChange={e => f.set(Number(e.target.value))} className={input} style={inputStyle} aria-label={f.label} />
            </label>
          ))}
        </div>
      </div>

      {/* Working hours */}
      <div style={card} className="space-y-2">
        <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}><Clock size={13} />{L('ساعات العمل', 'Working hours')}</p>
        {DAY_KEYS.map(d => {
          const h = s.hours[d];
          return (
            <div key={d} className="flex items-center gap-2 flex-wrap">
              <span className="w-12 text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>{L(DAY_LABEL[d][0], DAY_LABEL[d][1])}</span>
              <input type="time" value={h.open} disabled={h.closed} onChange={e => patchDay(d, { open: e.target.value })} className="h-9 px-2 rounded-lg text-xs" style={{ ...inputStyle, opacity: h.closed ? 0.4 : 1 }} aria-label={`${L(DAY_LABEL[d][0], DAY_LABEL[d][1])} ${L('فتح', 'open')}`} />
              <span style={{ color: 'var(--color-on-surface-variant)' }}>—</span>
              <input type="time" value={h.close} disabled={h.closed} onChange={e => patchDay(d, { close: e.target.value })} className="h-9 px-2 rounded-lg text-xs" style={{ ...inputStyle, opacity: h.closed ? 0.4 : 1 }} aria-label={`${L(DAY_LABEL[d][0], DAY_LABEL[d][1])} ${L('إغلاق', 'close')}`} />
              <button onClick={() => patchDay(d, { closed: !h.closed })} aria-pressed={h.closed}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer ms-auto"
                style={h.closed ? { background: '#f8717122', color: '#f87171' } : { ...inputStyle }}>
                {h.closed ? L('مغلق', 'Closed') : L('مفتوح', 'Open')}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('وقت التحضير الفعلي', 'Effective prep time')}: <b>{prep} {L('د', 'min')}</b></p>
        <button onClick={save} disabled={busy} id="store_save_btn"
          className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>
          <Save size={16} />{busy ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ الإعدادات', 'Save settings')}
        </button>
      </div>
    </div>
  );
};
