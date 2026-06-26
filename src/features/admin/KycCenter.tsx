import React, { useEffect, useState } from 'react';
import { toast, inputDialog } from '../../components/ui/feedback';
import { onboardingService, EntityType, KycQueueItem, DocRow, HistoryRow } from '../../services/onboarding.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';
import { useAppConfig } from '../../contexts/AppConfigContext';

type Lf = (ar: string, en: string) => string;
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const docLabel: Record<string, { ar: string; en: string }> = {
  commercial_registration: { ar: 'سجل تجاري', en: 'Commercial registration' }, tax_certificate: { ar: 'شهادة ضريبية', en: 'Tax certificate' },
  business_license: { ar: 'رخصة نشاط', en: 'Business license' }, owner_id: { ar: 'هوية المالك', en: 'Owner ID' },
  driver_license: { ar: 'رخصة قيادة', en: 'Driver license' }, national_id: { ar: 'الهوية الوطنية', en: 'National ID' },
  vehicle_registration: { ar: 'استمارة المركبة', en: 'Vehicle registration' }, insurance: { ar: 'تأمين', en: 'Insurance' }, other: { ar: 'أخرى', en: 'Other' },
};
const statusBadge = (s: string) => s === 'approved' ? 'success' : s === 'rejected' || s === 'banned' || s === 'suspended' ? 'error' : 'secondary';

/** Admin KYC / Compliance Center — review queue, documents, approve/reject/suspend/ban + audit. */
export const KycCenter: React.FC = () => {
  const { lang } = useAppConfig();
  const L: Lf = (ar, en) => (lang === 'ar' ? ar : en);
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
    <div id="kyc_center" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      {/* Compliance dashboard */}
      <div className="grid grid-cols-2 gap-3">
        {(['merchant', 'driver'] as EntityType[]).map(et => (
          <Card key={et} className="p-4">
            <p className="font-bold mb-2">{et === 'merchant' ? L('التجار', 'Merchants') : L('المندوبون', 'Drivers')}</p>
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
            {s === 'pending' ? L('قيد المراجعة', 'Under review') : s === 'approved' ? L('مقبول', 'Approved') : L('مرفوض', 'Rejected')}
          </button>
        ))}
      </div>

      {loading ? <div className="py-10 flex justify-center"><Loader size={28} /></div>
        : queue.length === 0 ? <EmptyState title={L('لا توجد طلبات', 'No requests')} />
        : queue.map(item => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold">{item.entity_name} <Badge variant="secondary">{item.entity_type === 'merchant' ? L('تاجر', 'Merchant') : L('مندوب', 'Driver')}</Badge></p>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {L('قُدّم', 'Submitted')}: {new Date(item.submitted_at).toLocaleString(L('ar', 'en'))}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setOpen(open?.id === item.id ? null : item)}>
                {open?.id === item.id ? L('إغلاق', 'Close') : L('مراجعة', 'Review')}
              </Button>
            </div>
            {open?.id === item.id && <ReviewPanel item={item} onDone={load} L={L} />}
          </Card>
        ))}
    </div>
  );
};

const ReviewPanel: React.FC<{ item: KycQueueItem; onDone: () => void; L: Lf }> = ({ item, onDone, L }) => {
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
    if (error || !url) return toast.error(L('تعذر فتح المستند.', 'Could not open the document.'));
    window.open(url, '_blank');
  };
  const reviewDoc = async (docId: string, status: 'approved' | 'rejected') => {
    setBusy(true); await onboardingService.reviewDocument(item.entity_type, docId, status); setBusy(false); await load();
  };
  const decide = async (decision: 'approved' | 'rejected') => {
    const notes = decision === 'rejected' ? ((await inputDialog({ title: L('سبب الرفض', 'Rejection reason'), placeholder: L('اكتب السبب…', 'Enter the reason…') })) ?? undefined) : undefined;
    setBusy(true); const { error } = await onboardingService.reviewKyc(item.entity_type, item.entity_id, decision, notes);
    setBusy(false); if (error) return toast.error(error.message); onDone();
  };
  const act = async (fn: () => Promise<{ error: any }>) => {
    setBusy(true); const { error } = await fn(); setBusy(false); if (error) return toast.error(error.message); onDone();
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div>
        <p className="text-sm font-semibold mb-1">{L('المستندات', 'Documents')} ({docs.length})</p>
        {docs.length === 0 ? <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لم تُرفع مستندات.', 'No documents uploaded.')}</p>
          : docs.map(d => (
            <div key={d.id} className="flex items-center justify-between text-sm py-1">
              <span>{docLabel[d.doc_type] ? L(docLabel[d.doc_type].ar, docLabel[d.doc_type].en) : d.doc_type} <Badge variant={statusBadge(d.status)}>{d.status}</Badge></span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => viewDoc(d.file_path)}>{L('عرض', 'View')}</Button>
                {d.status === 'pending' && <>
                  <Button size="sm" loading={busy} onClick={() => reviewDoc(d.id, 'approved')}>{L('قبول', 'Approve')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => reviewDoc(d.id, 'rejected')}>{L('رفض', 'Reject')}</Button>
                </>}
              </div>
            </div>
          ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {item.status === 'pending' && <>
          <Button size="sm" loading={busy} onClick={() => decide('approved')}>{L('قبول الطلب (KYC)', 'Approve (KYC)')}</Button>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => decide('rejected')}>{L('رفض الطلب', 'Reject request')}</Button>
        </>}
        <Button size="sm" variant="secondary" loading={busy} onClick={async () => { const reason = (await inputDialog({ title: L('سبب التعليق', 'Suspension reason'), placeholder: L('اكتب السبب…', 'Enter the reason…') })) ?? L('تعليق إداري', 'Administrative suspension'); act(() => onboardingService.suspend(item.entity_type, item.entity_id, reason)); }}>{L('تعليق', 'Suspend')}</Button>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => act(() => onboardingService.liftSuspension(item.entity_type, item.entity_id))}>{L('رفع التعليق', 'Lift suspension')}</Button>
        <Button size="sm" variant="secondary" loading={busy} onClick={async () => { const reason = (await inputDialog({ title: L('سبب الحظر', 'Ban reason'), placeholder: L('اكتب السبب…', 'Enter the reason…') })) ?? L('حظر إداري', 'Administrative ban'); act(() => onboardingService.ban(item.entity_type, item.entity_id, reason)); }}>{L('حظر', 'Ban')}</Button>
      </div>

      <div>
        <p className="text-sm font-semibold mb-1">{L('سجل القرارات', 'Decision log')}</p>
        {history.map((h, i) => (
          <p key={i} className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            {new Date(h.created_at).toLocaleString(L('ar', 'en'))} · {h.action}: {h.from_status ?? '—'} → {h.to_status}{h.reason ? ` (${h.reason})` : ''}
          </p>
        ))}
      </div>
    </div>
  );
};
