import React, { useEffect, useState } from 'react';
import { cxService } from '../../services/cx.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Primitives';
import { Star, Flag, Headset } from 'lucide-react';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { useAppConfig } from '../../contexts/AppConfigContext';

type CareTab = 'support' | 'moderation' | 'search';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };

export const CustomerCareCenter: React.FC = () => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState<CareTab>('support');
  return (
    <div id="customer_care" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <WorkspaceHeader Icon={Headset} title={L('رعاية العملاء', 'Customer Care')} subtitle={L('التذاكر · SLA · مراجعة التقييمات · تحليلات البحث', 'Tickets · SLA · Review moderation · Search analytics')} />
      <div className="flex gap-2">
        {([['support', L('الدعم وSLA', 'Support & SLA')], ['moderation', L('مراجعة التقييمات', 'Review moderation')], ['search', L('تحليلات البحث', 'Search analytics')]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{label}</button>
        ))}
      </div>
      {tab === 'support' && <SupportPanel L={L} />}
      {tab === 'moderation' && <ModerationPanel L={L} />}
      {tab === 'search' && <SearchAnalyticsPanel L={L} />}
    </div>
  );
};

type Lf = (ar: string, en: string) => string;

const SearchAnalyticsPanel: React.FC<{ L: Lf }> = ({ L }) => {
  const [stats, setStats] = useState<{ top_terms: any[]; zero_result: any[] }>({ top_terms: [], zero_result: [] });
  useEffect(() => { cxService.searchTermStats().then(setStats); }, []);
  const col = (title: string, rows: any[], emptyTitle: string, accent?: string) => (
    <Card className="p-4">
      <p className="font-bold mb-2">{title}</p>
      {rows.length === 0 ? <EmptyState title={emptyTitle} /> : rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <span style={accent ? { color: accent } : {}}>{r.term}</span>
          <Badge variant="secondary">{r.searches} {L('بحث', 'searches')}</Badge>
        </div>
      ))}
    </Card>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {col(L('الأكثر بحثًا', 'Top searches'), stats.top_terms, L('لا بيانات بحث بعد', 'No search data yet'))}
      {col(L('بحث بلا نتائج', 'Zero-result searches'), stats.zero_result, L('لا توجد عمليات بحث فاشلة', 'No failed searches'), 'var(--color-error)')}
    </div>
  );
};

const SupportPanel: React.FC<{ L: Lf }> = ({ L }) => {
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
  const filterLabel = (s: string) => ({ open: L('مفتوحة', 'Open'), in_progress: L('قيد المعالجة', 'In progress'), resolved: L('محلولة', 'Resolved') } as Record<string, string>)[s] || L('الكل', 'All');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[[L('مفتوحة', 'Open'), sla.open, 'var(--color-error)'], [L('قيد المعالجة', 'In progress'), sla.in_progress], [L('محلولة', 'Resolved'), sla.resolved, '#4ade80'], [L('تجاوز SLA', 'SLA breached'), sla.sla_breached, 'var(--color-error)'], [L('متوسط الحل (س)', 'Avg resolution (h)'), sla.avg_resolution_hours]].map(([l, v, c], i) => (
          <Card key={i} className="p-3 text-center"><p className="text-headline-sm font-bold" style={c ? { color: c as string } : {}}>{v ?? 0}</p><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{l as string}</p></Card>
        ))}
      </div>
      <div className="flex gap-2">
        {['open', 'in_progress', 'resolved', ''].map(s => (
          <button key={s} onClick={() => setFilter(s)} className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer" style={filter === s ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{filterLabel(s)}</button>
        ))}
      </div>
      {tickets.length === 0 ? <EmptyState title={L('لا توجد تذاكر', 'No tickets')} /> : tickets.map(t => (
        <Card key={t.id} className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold">{t.subject} <Badge variant="secondary">{t.type}</Badge></p>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(t.created_at).toLocaleString(L('ar', 'en'))}{t.sla_due_at && new Date(t.sla_due_at) < new Date() && t.status !== 'resolved' ? ` · ${L('تجاوز SLA', 'SLA breached')}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={t.status === 'resolved' || t.status === 'closed' ? 'success' : t.status === 'open' ? 'error' : 'secondary'}>{t.status}</Badge>
              <Button size="sm" variant="secondary" onClick={() => openTicket(t.id)}>{open === t.id ? L('إغلاق', 'Close') : L('فتح', 'Open')}</Button>
            </div>
          </div>
          {open === t.id && (
            <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {msgs.map(m => (
                  <div key={m.id} className="text-sm" style={{ color: m.is_internal ? 'var(--color-tertiary)' : 'var(--color-on-surface)' }}>
                    <b>{m.sender_type}{m.is_internal ? ` (${L('ملاحظة داخلية', 'internal note')})` : ''}:</b> {m.message_text}
                  </div>
                ))}
              </div>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder={L('اكتب ردًا أو ملاحظة...', 'Write a reply or note...')} className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface} />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => reply(t.id, false)}>{L('رد للعميل', 'Reply to customer')}</Button>
                <Button size="sm" variant="secondary" onClick={() => reply(t.id, true)}>{L('ملاحظة داخلية', 'Internal note')}</Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus(t.id, 'in_progress')}>{L('قيد المعالجة', 'In progress')}</Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus(t.id, 'resolved')}>{L('حل', 'Resolve')}</Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

const ModerationPanel: React.FC<{ L: Lf }> = ({ L }) => {
  const [list, setList] = useState<any[]>([]);
  const load = async () => { const { data } = await cxService.moderationQueue(); setList(data); };
  useEffect(() => { load(); }, []);
  const act = async (id: string, status: 'approved' | 'hidden') => { await cxService.moderateReview(id, status); await load(); };
  if (list.length === 0) return <EmptyState title={L('لا توجد تقييمات بحاجة لمراجعة', 'No reviews to moderate')} />;
  return (
    <div className="space-y-2">
      {list.map(r => (
        <Card key={r.id} className="p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm flex items-center gap-1 flex-wrap">
              <span className="inline-flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={13} fill="#fbbf24" color="#fbbf24" />)}</span>
              · {r.target_type}{r.is_reported && <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--color-error)' }}><Flag size={12} /> {L('مُبلّغ عنه', 'Reported')}</span>}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{r.comment ?? '—'}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => act(r.id, 'approved')}>{L('اعتماد', 'Approve')}</Button>
            <Button size="sm" variant="secondary" onClick={() => act(r.id, 'hidden')}>{L('إخفاء', 'Hide')}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
