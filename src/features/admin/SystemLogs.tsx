import React, { useEffect, useState, useCallback } from 'react';
import { ScrollText, RefreshCw, ShieldAlert } from 'lucide-react';
import { auditRepository } from '../../repositories/audit.repository';
import { adminService, AuditLogRow } from '../../services/admin.service';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { AdminDataTable, Column } from '../../components/admin/AdminDataTable';

const card = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };
const sevColor = (s?: string) => /error|critical/.test(s || '') ? '#f87171' : /warn/.test(s || '') ? '#fbbf24' : '#9ed442';

export const SystemLogs: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await adminService.auditLogs({ limit: 200 });
    setRows(data); setLoading(false);
    setDenied(!!error && /permission|denied|42501/i.test(JSON.stringify(error)));
  }, []);

  useEffect(() => {
    load();
    const ch = auditRepository.subscribeInserts(() => load());
    return () => { auditRepository.unsubscribe(ch); };
  }, [load]);

  const fmt = (d: string) => new Date(d).toLocaleString(L('ar', 'en'), { dateStyle: 'medium', timeStyle: 'medium' });

  const columns: Column<AuditLogRow>[] = [
    { key: 'time', header: L('الوقت', 'Time'), sortable: true, sortValue: r => r.created_at, csv: r => r.created_at, render: r => <span className="whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{fmt(r.created_at)}</span> },
    { key: 'action', header: L('الإجراء', 'Action'), sortable: true, sortValue: r => r.action, csv: r => r.action, render: r => <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor(r.severity) }} />{r.action}</span> },
    { key: 'table', header: L('الجدول', 'Table'), sortable: true, sortValue: r => r.table_name, csv: r => r.table_name, render: r => <span style={{ color: 'var(--color-on-surface-variant)' }}>{r.table_name}</span> },
    { key: 'record', header: L('السجلّ', 'Record'), csv: r => r.record_id ?? '', render: r => <span className="font-mono text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{r.record_id ? String(r.record_id).slice(0, 8) : '—'}</span> },
  ];

  return (
    <div id="system_logs" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <WorkspaceHeader Icon={ScrollText} title={L('سجلّات النظام', 'System Logs')} subtitle={L('سجلّ التدقيق · عرض لحظي · بحث متقدّم', 'Audit trail · Realtime viewer · Advanced search')}
        actions={<button onClick={load} aria-label={L('تحديث', 'Refresh')} className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer" style={card}><RefreshCw size={15} color="var(--color-on-surface-variant)" /></button>} />

      {denied ? (
        <div className="rounded-2xl p-6 flex items-center gap-3" style={card}>
          <ShieldAlert size={22} color="#fbbf24" />
          <div><p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('سجلّ التدقيق غير مُفعّل بعد', 'Audit trail not yet enabled')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L('سيُفعّل تلقائيًا بعد تطبيق ترحيل قاعدة البيانات.', 'Activates automatically once the database migration is applied.')}</p></div>
        </div>
      ) : (
        <AdminDataTable
          columns={columns} rows={rows} loading={loading} rowKey={r => r.id} lang={lang}
          search={r => `${r.action} ${r.table_name}`} searchPlaceholder={L('ابحث بالإجراء أو الجدول…', 'Search by action or table…')}
          exportName="audit_logs" emptyTitle={L('لا توجد سجلّات', 'No logs')} pageSize={15}
        />
      )}
    </div>
  );
};
