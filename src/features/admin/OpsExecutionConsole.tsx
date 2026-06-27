import React, { useEffect, useState, useCallback } from 'react';
import { Send, UserX, Pause, Play, LogIn, LogOut, History, RefreshCw, Zap } from 'lucide-react';
import { SectionHeader, EmptyStateBox } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { adminCrud } from '../../services/admin-crud.service';
import { opsExecution } from '../../services/ops-execution.service';
import { useAppConfig } from '../../contexts/AppConfigContext';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };
const input: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' };

const ACTION_LABEL: Record<string, [string, string]> = {
  order_reassigned: ['أُعيد تعيين الطلب', 'Order reassigned'],
  order_unassigned: ['أُلغي تعيين الطلب', 'Order unassigned'],
  driver_paused: ['أُوقف المندوب', 'Driver paused'],
  driver_resumed: ['استؤنف المندوب', 'Driver resumed'],
  shift_started: ['بدأت الوردية', 'Shift started'],
  shift_closed: ['أُغلقت الوردية', 'Shift closed'],
};

/**
 * Operations execution console — manual assignment, driver pause/resume, and shift
 * check-in/out. Every action PERSISTS via opsExecution (real Supabase / sandbox-safe)
 * and appends to the operations timeline. Admin-only (RBAC via table RLS). RTL/LTR · dark.
 */
export const OpsExecutionConsole: React.FC = () => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [orderId, setOrderId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRefs = useCallback(async () => {
    const [o, d] = await Promise.all([adminCrud('orders').list(), adminCrud('drivers').list()]);
    setOrders(o.data); setDrivers(d.data);
  }, []);
  const loadTimeline = useCallback(async () => setTimeline(await opsExecution.recentEvents(25)), []);
  useEffect(() => { loadRefs(); loadTimeline(); }, [loadRefs, loadTimeline]);

  const run = async (fn: () => Promise<{ error: any }>, okAr: string, okEn: string) => {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) { toast.error(L('تعذّر تنفيذ العملية', 'Operation failed')); return; }
    toast.success(L(okAr, okEn)); loadTimeline();
  };

  const fmt = (d?: string) => d ? new Date(d).toLocaleString(L('ar', 'en'), { dateStyle: 'short', timeStyle: 'short' }) : '';
  const driverName = (id: string) => drivers.find(d => d.id === id)?.full_name || (id ? String(id).slice(0, 8) : '—');
  const need = (cond: boolean, ar: string, en: string) => { if (!cond) { toast.error(L(ar, en)); return false; } return true; };

  return (
    <div className="space-y-4" id="ops_execution_console" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <SectionHeader title={L('كونسول التنفيذ', 'Execution Console')}
        action={<button onClick={() => { loadRefs(); loadTimeline(); }} className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer" style={card}><RefreshCw size={14} />{L('تحديث', 'Refresh')}</button>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order assignment */}
        <div className="rounded-2xl p-4 space-y-3" style={card}>
          <p className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><Send size={15} color="var(--color-primary-fixed)" />{L('تعيين الطلب', 'Order assignment')}</p>
          <select value={orderId} onChange={e => setOrderId(e.target.value)} className="w-full h-10 rounded-xl px-3 text-sm" style={input}>
            <option value="">{L('— اختر طلبًا —', '— Select order —')}</option>
            {orders.map(o => <option key={o.id} value={o.id}>#{String(o.id).slice(0, 8)} · {o.status || '—'}</option>)}
          </select>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full h-10 rounded-xl px-3 text-sm" style={input}>
            <option value="">{L('— اختر مندوبًا —', '— Select driver —')}</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name || String(d.id).slice(0, 8)}</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => need(!!orderId && !!driverId, 'اختر الطلب والمندوب', 'Pick an order and a driver') && run(() => opsExecution.reassignOrder(orderId, driverId), 'تم إعادة التعيين', 'Reassigned')}
              className="flex-1 h-10 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{L('إعادة تعيين', 'Reassign')}</button>
            <button disabled={busy} onClick={() => need(!!orderId, 'اختر طلبًا', 'Pick an order') && run(() => opsExecution.unassignOrder(orderId), 'تم إلغاء التعيين', 'Unassigned')}
              className="flex-1 h-10 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5" style={card}><UserX size={14} />{L('إلغاء التعيين', 'Unassign')}</button>
          </div>
        </div>

        {/* Driver control */}
        <div className="rounded-2xl p-4 space-y-3" style={card}>
          <p className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><Zap size={15} color="#fbbf24" />{L('التحكم بالمندوب', 'Driver control')}</p>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full h-10 rounded-xl px-3 text-sm" style={input}>
            <option value="">{L('— اختر مندوبًا —', '— Select driver —')}</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name || String(d.id).slice(0, 8)}</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => need(!!driverId, 'اختر مندوبًا', 'Pick a driver') && run(() => opsExecution.pauseDriver(driverId), 'تم إيقاف المندوب', 'Driver paused')}
              className="flex-1 h-10 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5" style={card}><Pause size={14} />{L('إيقاف', 'Pause')}</button>
            <button disabled={busy} onClick={() => need(!!driverId, 'اختر مندوبًا', 'Pick a driver') && run(() => opsExecution.resumeDriver(driverId), 'تم استئناف المندوب', 'Driver resumed')}
              className="flex-1 h-10 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}><Play size={14} />{L('استئناف', 'Resume')}</button>
          </div>
        </div>

        {/* Shift / attendance */}
        <div className="rounded-2xl p-4 space-y-3" style={card}>
          <p className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><History size={15} color="#60a5fa" />{L('الورديات والحضور', 'Shifts & attendance')}</p>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full h-10 rounded-xl px-3 text-sm" style={input}>
            <option value="">{L('— اختر مندوبًا —', '— Select driver —')}</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name || String(d.id).slice(0, 8)}</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => need(!!driverId, 'اختر مندوبًا', 'Pick a driver') && run(() => opsExecution.startShift(driverId), 'بدأت الوردية', 'Shift started')}
              className="flex-1 h-10 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5" style={card}><LogIn size={14} />{L('تسجيل حضور', 'Check in')}</button>
            <button disabled={busy} onClick={() => need(!!driverId, 'اختر مندوبًا', 'Pick a driver') && run(() => opsExecution.endShift(driverId), 'أُغلقت الوردية', 'Shift closed')}
              className="flex-1 h-10 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5" style={card}><LogOut size={14} />{L('تسجيل انصراف', 'Check out')}</button>
          </div>
        </div>
      </div>

      {/* Operations Timeline */}
      <div className="rounded-2xl p-4" style={card}>
        <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><History size={15} color="var(--color-primary-fixed)" />{L('سجل العمليات', 'Operations Timeline')}</p>
        {timeline.length === 0 ? <EmptyStateBox Icon={History} title={L('لا توجد عمليات بعد', 'No operations yet')} description={L('كل إجراء تنفيذي يُسجَّل هنا.', 'Every execution action is logged here.')} />
          : <div className="space-y-2">{timeline.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--color-surface-container-high)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-primary-fixed)' }} />
                <span className="text-sm flex-1 min-w-0" style={{ color: 'var(--color-on-surface)' }}>
                  {L(ACTION_LABEL[ev.action]?.[0] || ev.action, ACTION_LABEL[ev.action]?.[1] || ev.action)}
                  {ev.entity_type === 'driver' && ev.entity_id ? ` · ${driverName(ev.entity_id)}` : ev.entity_id ? ` · #${String(ev.entity_id).slice(0, 8)}` : ''}
                </span>
                <span className="text-[11px] shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>{fmt(ev.created_at)}</span>
              </div>))}</div>}
      </div>
    </div>
  );
};
