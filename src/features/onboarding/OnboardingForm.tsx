import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { supabase } from '../../lib/supabase';
import { onboardingService, EntityType, AccountStatus } from '../../services/onboarding.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader } from '../../components/ui/Primitives';

const DOC_TYPES: Record<EntityType, { key: string; label: string }[]> = {
  merchant: [
    { key: 'commercial_registration', label: 'السجل التجاري' },
    { key: 'tax_certificate', label: 'الشهادة الضريبية' },
    { key: 'business_license', label: 'رخصة النشاط' },
  ],
  driver: [
    { key: 'driver_license', label: 'رخصة القيادة' },
    { key: 'national_id', label: 'الهوية الوطنية' },
    { key: 'vehicle_registration', label: 'استمارة المركبة' },
  ],
};
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const statusVariant = (s: AccountStatus) => s === 'approved' ? 'success' : (s === 'rejected' || s === 'suspended' || s === 'banned') ? 'error' : 'secondary';
const statusLabel: Record<AccountStatus, string> = {
  pending: 'قيد المراجعة', under_review: 'تحت التدقيق', approved: 'مقبول', rejected: 'مرفوض', suspended: 'موقوف', banned: 'محظور',
};

/** Applicant self-registration + document upload + live status, for merchant|driver. */
export const OnboardingForm: React.FC<{ entityType: EntityType }> = ({ entityType }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<Record<string, string>>({}); // docType -> file name uploaded

  const refresh = async (uid: string) => {
    const { id } = await onboardingService.myEntityId(entityType, uid);
    setEntityId(id);
    if (id) { const { status, reason } = await onboardingService.myStatus(entityType, id); setStatus(status); setReason(reason); }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null; setUserId(uid);
      if (uid) await refresh(uid);
      setLoading(false);
    })();
  }, [entityType]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setBusy(true);
    const res = entityType === 'merchant'
      ? await onboardingService.submitMerchant({ business_name: form.name || '', contact_email: form.email || '', contact_phone: form.phone || '', tax_number: form.tax, commercial_registration_number: form.cr, business_type: form.btype, address: form.address })
      : await onboardingService.submitDriver({ full_name: form.name || '', phone: form.phone || '', national_id_number: form.nid, license_number: form.license, license_expiry: form.expiry || undefined, vehicle_plate: form.plate });
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    if (userId) await refresh(userId);
  };

  const upload = async (docType: string, file: File | undefined) => {
    if (!file || !userId || !entityId) return;
    setBusy(true);
    const { path, error } = await onboardingService.uploadDocument(userId, entityType, docType, file);
    if (error || !path) { setBusy(false); return toast.error('فشل رفع الملف.'); }
    const rec = entityType === 'merchant'
      ? await onboardingService.recordMerchantDocument(entityId, docType, path, file.name)
      : await onboardingService.recordDriverDocument(entityId, docType, path, file.name);
    setBusy(false);
    if (rec.error) return toast.error(rec.error.message);
    setDocs(p => ({ ...p, [docType]: file.name }));
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader size={32} /></div>;

  const fields = entityType === 'merchant'
    ? [['name', 'اسم النشاط التجاري'], ['email', 'البريد الإلكتروني'], ['phone', 'رقم الجوال'], ['btype', 'نوع النشاط'], ['cr', 'رقم السجل التجاري'], ['tax', 'الرقم الضريبي'], ['address', 'العنوان']]
    : [['name', 'الاسم الكامل'], ['phone', 'رقم الجوال'], ['nid', 'رقم الهوية الوطنية'], ['license', 'رقم رخصة القيادة'], ['expiry', 'تاريخ انتهاء الرخصة'], ['plate', 'لوحة المركبة']];

  return (
    <div dir="rtl" className="min-h-screen px-6 py-8 max-w-lg mx-auto space-y-4" id="onboarding_form">
      <h2 className="text-headline-sm font-bold text-[var(--color-on-surface)]">
        {entityType === 'merchant' ? 'تسجيل تاجر جديد' : 'تسجيل مندوب جديد'}
      </h2>

      {/* Already applied → status + documents */}
      {entityId && status ? (
        <>
          <Card className="p-4 flex items-center justify-between">
            <span className="font-bold">حالة الطلب</span>
            <Badge variant={statusVariant(status)}>{statusLabel[status]}</Badge>
          </Card>
          {reason && <p className="text-sm" style={{ color: 'var(--color-error)' }}>السبب: {reason}</p>}
          {(status === 'pending' || status === 'rejected') && (
            <Card className="p-4 space-y-3">
              <p className="font-bold">المستندات المطلوبة</p>
              {DOC_TYPES[entityType].map(d => (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{d.label} {docs[d.key] && <Badge variant="success">تم الرفع</Badge>}</span>
                  <label className="text-xs cursor-pointer px-3 py-1.5 rounded-lg" style={surface}>
                    {docs[d.key] ? 'استبدال' : 'رفع ملف'}
                    <input type="file" className="hidden" accept="image/*,application/pdf"
                      onChange={e => upload(d.key, e.target.files?.[0])} disabled={busy} />
                  </label>
                </div>
              ))}
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                سيتم مراجعة طلبك من قبل فريق الامتثال بعد رفع المستندات.
              </p>
            </Card>
          )}
        </>
      ) : (
        /* New application form */
        <Card className="p-4 space-y-3">
          {fields.map(([k, label]) => (
            <label key={k} className="block text-sm">
              <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
              <input value={form[k] ?? ''} onChange={e => set(k, e.target.value)}
                type={k === 'expiry' ? 'date' : 'text'}
                className="w-full mt-1 px-3 py-2 rounded-xl text-sm" style={surface} />
            </label>
          ))}
          <Button loading={busy} onClick={submit} disabled={!form.name || !form.phone}>إرسال الطلب</Button>
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            بعد الإرسال يمكنك رفع المستندات المطلوبة.
          </p>
        </Card>
      )}
    </div>
  );
};
