import React, { useEffect, useState } from 'react';
import { Truck, UserRound, Wrench, FileText, Clock } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox, StatusBadge } from '../../../components/admin/EnterpriseUI';
import { WsHeader, WsRow, WsTabBar, wsCard, wsFmt, type WsTab } from './shell';
import { adminCrud } from '../../../services/admin-crud.service';

const TABS: WsTab[] = [
  { k: 'overview', ar: 'نظرة عامة', en: 'Overview', Icon: Truck },
  { k: 'driver', ar: 'السائق', en: 'Driver', Icon: UserRound },
  { k: 'maintenance', ar: 'الصيانة', en: 'Maintenance', Icon: Wrench },
  { k: 'documents', ar: 'المستندات', en: 'Documents', Icon: FileText },
  { k: 'timeline', ar: 'النشاط', en: 'Timeline', Icon: Clock },
];

/** Vehicle workspace — real vehicle + assigned driver. Reuses the shared shell. */
export const VehicleWorkspace: React.FC<{ vehicle: any; lang: 'ar' | 'en'; onClose: () => void }> = ({ vehicle, lang, onClose }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('overview');
  const [driver, setDriver] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    if (vehicle.driver_id) adminCrud('drivers').list().then(r => { if (alive) setDriver(r.data.find((d: any) => d.id === vehicle.driver_id) || null); }).catch(() => {});
    return () => { alive = false; };
  }, [vehicle.driver_id]);

  const statusKind = vehicle.status === 'active' ? 'success' : vehicle.status === 'maintenance' ? 'warning' : 'inactive';

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]" title={L('ملف المركبة', 'Vehicle workspace')}
      footer={<button onClick={onClose} className="w-full h-11 rounded-xl text-sm font-bold cursor-pointer" style={wsCard}>{L('إغلاق', 'Close')}</button>}>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="vehicle_workspace">
        <WsHeader Icon={Truck} title={vehicle.plate || L('بدون لوحة', 'No plate')} subtitle={vehicle.vehicle_type}
          badge={<StatusBadge kind={statusKind as any} label={vehicle.status || '—'} />} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('النوع', 'Type')} value={vehicle.vehicle_type || '—'} Icon={Truck} />
          <MetricCard label={L('الحالة', 'Status')} value={vehicle.status || '—'} />
          <MetricCard label={L('انتهاء التأمين', 'Insurance')} value={vehicle.insurance_expiry || '—'} accent="#fbbf24" />
          <MetricCard label={L('انتهاء الرخصة', 'License')} value={vehicle.license_expiry || '—'} accent="#fb923c" />
        </div>
        <WsTabBar tabs={TABS} active={tab} onChange={setTab} lang={lang} />
        {tab === 'overview' && (
          <div className="space-y-2">
            <WsRow label={L('اللوحة', 'Plate')} value={vehicle.plate} />
            <WsRow label={L('النوع', 'Type')} value={vehicle.vehicle_type} />
            <WsRow label={L('الحالة', 'Status')} value={vehicle.status} />
            <WsRow label={L('السائق المعيّن', 'Assigned driver')} value={driver ? driver.full_name : L('غير معيّن', 'None')} />
            <WsRow label={L('أُضيفت', 'Created')} value={wsFmt(lang, vehicle.created_at)} />
          </div>
        )}
        {tab === 'driver' && (
          driver ? <div className="space-y-2">
            <WsRow label={L('الاسم', 'Name')} value={driver.full_name} />
            <WsRow label={L('الجوال', 'Phone')} value={driver.phone_number} />
            <WsRow label={L('متصل', 'Online')} value={driver.is_online ? L('نعم', 'Yes') : L('لا', 'No')} />
          </div> : <EmptyStateBox Icon={UserRound} title={L('لا يوجد سائق معيّن', 'No assigned driver')} description={L('عيّن سائقًا من صفحة المركبات.', 'Assign a driver from the Vehicles page.')} />
        )}
        {tab === 'maintenance' && <EmptyStateBox Icon={Wrench} title={L('لا توجد سجلات صيانة', 'No maintenance records')} description={L('سجل الصيانة سيظهر هنا عند توفّر جدول الصيانة.', 'Maintenance history appears here once the maintenance log is enabled.')} />}
        {tab === 'documents' && (
          <div className="space-y-2">
            <WsRow label={L('انتهاء التأمين', 'Insurance expiry')} value={vehicle.insurance_expiry} />
            <WsRow label={L('انتهاء الرخصة', 'License expiry')} value={vehicle.license_expiry} />
          </div>
        )}
        {tab === 'timeline' && (
          vehicle.created_at ? <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={wsCard}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-primary-fixed)' }} />
              <span className="text-sm flex-1" style={{ color: 'var(--color-on-surface)' }}>{L('أُضيفت المركبة', 'Vehicle added')}</span>
              <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{wsFmt(lang, vehicle.created_at)}</span>
            </div>
          </div> : <EmptyStateBox Icon={Clock} title={L('لا يوجد نشاط', 'No activity')} />
        )}
      </div>
    </Drawer>
  );
};
