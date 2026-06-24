import React, { useEffect, useState } from 'react';
import { cxService } from '../../services/cx.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Primitives';

type CareTab = 'support' | 'moderation';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };

export const CustomerCareCenter: React.FC = () => {
  const [tab, setTab] = useState<CareTab>('support');
  return (
    <div id="customer_care" dir="rtl" className="space-y-4">
      <div className="flex gap-2">
        {([['support', 'الدعم وSLA'], ['moderation', 'مراجعة التقييمات']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{label}</button>
        ))}
      </div>
      {tab === 'support' && <SupportPanel />}
      {tab === 'moderation' && <ModerationPanel />}
    </div>
  );
};

const SupportPanel: React.FC = () => {
  const [sla, setSla] = useState<any>({});
  const [tickets, setTickets] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<string>('open');

  const load = async () => {
    const [s, { data: t }] = await Promise.all([cxService.slaStats(), cxService.allTickets(filter || undefined)]);
    setSla(s); setTickets(t);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  const openTicket = async (id: string) => {
    setOpen(open === id ? null : id);
    if (open !== id) { const { data } = await cxService.ticketMessages(id, true); setMsgs(data); }
  };
  const reply = async (id: string, internal: boolean) => {
    if (!note.trim()) return;
    await cxService.addTicketMessage(id, note.trim(), internal); setNote('');
    const { data } = await cxService.ticketMessages(id, true); setMsgs(data); await load();
  };
  const setStatus = async (id: string, status: string) => { await cxService.updateTicketStatus(id, status); await load(); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[['مفتوحة', sla.open, 'var(--color-error)'], ['قيد المعالجة', sla.in_progress], ['محلولة', sla.resolved, '#4ade80'], ['تجاوز SLA', sla.sla_breached, 'var(--color-error)'], ['متوسط الحل (س)', sla.avg_resolution_hours]].map(([l, v, c], i) => (
          <Card key={i} className="p-3 text-center"><p className="text-headline-sm font-bold" style={c ? { color: c as string } : {}}>{v ?? 0}</p><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{l as string}</p></Card>
        ))}
      </div>
      <div className="flex gap-2">
        {['open', 'in_progress', 'resolved', ''].map(s => (
          <button key={s} onClick={() => setFilter(s)} className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer" style={filter === s ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{s || 'الكل'}</button>
        ))}
      </div>
      {tickets.length === 0 ? <EmptyState title="لا توجد تذاكر" /> : tickets.map(t => (
        <Card key={t.id} className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold">{t.subject} <Badge variant="secondary">{t.type}</Badge></p>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(t.created_at).toLocaleString('ar')}{t.sla_due_at && new Date(t.sla_due_at) < new Date() && t.status !== 'resolved' ? ' · ⚠️ تجاوز SLA' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={t.status === 'resolved' || t.status === 'closed' ? 'success' : t.status === 'open' ? 'error' : 'secondary'}>{t.status}</Badge>
              <Button size="sm" variant="secondary" onClick={() => openTicket(t.id)}>{open === t.id ? 'إغلاق' : 'فتح'}</Button>
            </div>
          </div>
          {open === t.id && (
            <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {msgs.map(m => (
                  <div key={m.id} className="text-sm" style={{ color: m.is_internal ? 'var(--color-tertiary)' : 'var(--color-on-surface)' }}>
                    <b>{m.sender_type}{m.is_internal ? ' (ملاحظة داخلية)' : ''}:</b> {m.message_text}
                  </div>
                ))}
              </div>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="اكتب ردًا أو ملاحظة..." className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface} />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => reply(t.id, false)}>رد للعميل</Button>
                <Button size="sm" variant="secondary" onClick={() => reply(t.id, true)}>ملاحظة داخلية</Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus(t.id, 'in_progress')}>قيد المعالجة</Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus(t.id, 'resolved')}>حل</Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

const ModerationPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const load = async () => { const { data } = await cxService.moderationQueue(); setList(data); };
  useEffect(() => { load(); }, []);
  const act = async (id: string, status: 'approved' | 'hidden') => { await cxService.moderateReview(id, status); await load(); };
  if (list.length === 0) return <EmptyState title="لا توجد تقييمات بحاجة لمراجعة" />;
  return (
    <div className="space-y-2">
      {list.map(r => (
        <Card key={r.id} className="p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm">{'⭐'.repeat(r.rating)} · {r.target_type}{r.is_reported ? ' · 🚩 مُبلّغ عنه' : ''}</p>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{r.comment ?? '—'}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => act(r.id, 'approved')}>اعتماد</Button>
            <Button size="sm" variant="secondary" onClick={() => act(r.id, 'hidden')}>إخفاء</Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
