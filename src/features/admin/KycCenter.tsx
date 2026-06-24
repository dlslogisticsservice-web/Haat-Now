import React, { useEffect, useState } from 'react';
import { onboardingService, EntityType, KycQueueItem, DocRow, HistoryRow } from '../../services/onboarding.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';

const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const docLabel: Record<string, string> = {
  commercial_registration: 'سجل تجاري', tax_certificate: 'شهادة ضريبية', business_license: 'رخصة نشاط',
  owner_id: 'هوية المالك', driver_license: 'رخصة قيادة', national_id: 'الهوية الوطنية',
  vehicle_registration: 'استمارة المركبة', insurance: 'تأمين', other: 'أخرى',
};
const statusBadge = (s: string) => s === 'approved' ? 'success' : s === 'rejected' || s === 'banned' || s === 'suspended' ? 'error' : 'secondary';

/** Admin KYC / Compliance Center — review queue, documents, approve/reject/suspend/ban + audit. */
export const KycCenter: React.FC = () => {
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({ merchant: {}, driver: {} });
  const [queue, setQueue] = useState<KycQueueItem[]>([]);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<KycQueueItem | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: q }] = await Promise.all([
      onboardingService.complianceStats(),
      onboardingService.kycQueue(tab),
    ]);
    setStats(s); setQueue(q); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'suspended', 'banned'];

  return (
    <div id="kyc_center" dir="rtl" className="space-y-4">
      {/* Compliance dashboard */}
      <div className="grid grid-cols-2 gap-3">
        {(['merchant', 'driver'] as EntityType[]).map(et => (
          <Card key={et} className="p-4">
            <p className="font-bold mb-2">{et === 'merchant' ? 'التجار' : 'المندوبون'}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <span key={s} className="text-xs px-2 py-1 rounded-lg" style={surface}>
                  {s}: <b>{stats[et]?.[s] ?? 0}</b>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Queue tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => { setTab(s); setOpen(null); }}
            className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === s ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>
            {s === 'pending' ? 'قيد المراجعة' : s === 'approved' ? 'مقبول' : 'مرفوض'}
          </button>
        ))}
      </div>

      {loading ? <div className="py-10 flex justify-center"><Loader size={28} /></div>
        : queue.length === 0 ? <EmptyState title="لا توجد طلبات" />
        : queue.map(item => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold">{item.entity_name} <Badge variant="secondary">{item.entity_type === 'merchant' ? 'تاجر' : 'مندوب'}</Badge></p>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  قُدّم: {new Date(item.submitted_at).toLocaleString('ar')}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setOpen(open?.id === item.id ? null : item)}>
                {open?.id === item.id ? 'إغلاق' : 'مراجعة'}
              </Button>
            </div>
            {open?.id === item.id && <ReviewPanel item={item} onDone={load} />}
          </Card>
        ))}
    </div>
  );
};

const ReviewPanel: React.FC<{ item: KycQueueItem; onDone: () => void }> = ({ item, onDone }) => {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: d }, { data: h }] = await Promise.all([
      onboardingService.documents(item.entity_type, item.entity_id),
      onboardingService.history(item.entity_type, item.entity_id),
    ]);
    setDocs(d); setHistory(h);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [item.id]);

  const viewDoc = async (path: string) => {
    const { url, error } = await onboardingService.signedDocUrl(path);
    if (error || !url) return alert('تعذر فتح المستند.');
    window.open(url, '_blank');
  };
  const reviewDoc = async (docId: string, status: 'approved' | 'rejected') => {
    setBusy(true); await onboardingService.reviewDocument(item.entity_type, docId, status); setBusy(false); await load();
  };
  const decide = async (decision: 'approved' | 'rejected') => {
    const notes = decision === 'rejected' ? (prompt('سبب الرفض:') ?? undefined) : undefined;
    setBusy(true); const { error } = await onboardingService.reviewKyc(item.entity_type, item.entity_id, decision, notes);
    setBusy(false); if (error) return alert(error.message); onDone();
  };
  const act = async (fn: () => Promise<{ error: any }>) => {
    setBusy(true); const { error } = await fn(); setBusy(false); if (error) return alert(error.message); onDone();
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div>
        <p className="text-sm font-semibold mb-1">المستندات ({docs.length})</p>
        {docs.length === 0 ? <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>لم تُرفع مستندات.</p>
          : docs.map(d => (
            <div key={d.id} className="flex items-center justify-between text-sm py-1">
              <span>{docLabel[d.doc_type] ?? d.doc_type} <Badge variant={statusBadge(d.status)}>{d.status}</Badge></span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => viewDoc(d.file_path)}>عرض</Button>
                {d.status === 'pending' && <>
                  <Button size="sm" loading={busy} onClick={() => reviewDoc(d.id, 'approved')}>قبول</Button>
                  <Button size="sm" variant="secondary" onClick={() => reviewDoc(d.id, 'rejected')}>رفض</Button>
                </>}
              </div>
            </div>
          ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {item.status === 'pending' && <>
          <Button size="sm" loading={busy} onClick={() => decide('approved')}>قبول الطلب (KYC)</Button>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => decide('rejected')}>رفض الطلب</Button>
        </>}
        <Button size="sm" variant="secondary" loading={busy} onClick={() => act(() => onboardingService.suspend(item.entity_type, item.entity_id, prompt('سبب التعليق:') ?? 'تعليق إداري'))}>تعليق</Button>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => act(() => onboardingService.liftSuspension(item.entity_type, item.entity_id))}>رفع التعليق</Button>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => act(() => onboardingService.ban(item.entity_type, item.entity_id, prompt('سبب الحظر:') ?? 'حظر إداري'))}>حظر</Button>
      </div>

      <div>
        <p className="text-sm font-semibold mb-1">سجل القرارات</p>
        {history.map((h, i) => (
          <p key={i} className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            {new Date(h.created_at).toLocaleString('ar')} · {h.action}: {h.from_status ?? '—'} → {h.to_status}{h.reason ? ` (${h.reason})` : ''}
          </p>
        ))}
      </div>
    </div>
  );
};
