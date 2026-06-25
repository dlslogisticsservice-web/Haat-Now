import React, { useEffect, useState, useCallback } from 'react';
import { ScrollText, Search, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminService, AuditLogRow } from '../../services/admin.service';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { EmptyState, Loader } from '../../components/ui/Primitives';

const card = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };
const sevColor = (s?: string) => /error|critical/.test(s || '') ? '#f87171' : /warn/.test(s || '') ? '#fbbf24' : '#9ed442';

export const SystemLogs: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await adminService.auditLogs({ search: search.trim() || undefined, limit: 150 });
    setRows(data); setLoading(false);
    setDenied(!!error && /permission|denied|42501/i.test(JSON.stringify(error)));
  }, [search]);

  useEffect(() => {
    load();
    const ch = supabase.channel('audit:live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const fmt = (d: string) => new Date(d).toLocaleString(L('ar', 'en'), { dateStyle: 'medium', timeStyle: 'medium' });

  return (
    <div id="system_logs" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <WorkspaceHeader Icon={ScrollText} title={L('سجلّات النظام', 'System Logs')} subtitle={L('سجلّ التدقيق · عرض لحظي · بحث متقدّم', 'Audit trail · Realtime viewer · Advanced search')} />
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={card}>
          <Search size={15} color="var(--color-on-surface-variant)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('ابحث بالإجراء أو الجدول…', 'Search by action or table…')} className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--color-on-surface)' }} />
        </div>
        <button onClick={load} className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer" style={card}><RefreshCw size={16} color="var(--color-on-surface-variant)" /></button>
      </div>

      {loading ? <div className="py-12 flex justify-center"><Loader size={28} /></div>
        : denied ? (
          <div className="rounded-2xl p-6 flex items-center gap-3" style={card}>
            <ShieldAlert size={22} color="#fbbf24" />
            <div><p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('سجلّ التدقيق غير مُفعّل بعد', 'Audit trail not yet enabled')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L('سيُفعّل تلقائيًا بعد تطبيق ترحيل قاعدة البيانات.', 'Activates automatically once the database migration is applied.')}</p></div>
          </div>
        ) : rows.length === 0 ? <EmptyState title={L('لا توجد سجلّات', 'No logs')} />
        : (
          <div className="rounded-2xl overflow-hidden" style={card}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: 'var(--color-surface-container-high)' }}>
                {[L('الوقت', 'Time'), L('الإجراء', 'Action'), L('الجدول', 'Table'), L('السجلّ', 'Record')].map(h => (
                  <th key={h} className="text-start px-3 py-2 text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>{fmt(r.created_at)}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor(r.severity) }} /><span style={{ color: 'var(--color-on-surface)' }}>{r.action}</span></span></td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>{r.table_name}</td>
                    <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{r.record_id ? String(r.record_id).slice(0, 8) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};
