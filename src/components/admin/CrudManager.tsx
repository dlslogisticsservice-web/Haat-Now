import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Download, ArrowUpDown, RefreshCw, CheckSquare, Square, AlertTriangle, type LucideIcon } from 'lucide-react';
import { WorkspaceHeader, ActionButton, EmptyStateBox, MetricCard } from './EnterpriseUI';
import { Drawer } from '../ui/Modal';
import { toast, confirmDialog } from '../ui/feedback';
import { SkeletonList } from '../ui/Skeleton';
import { adminCrud, type CrudRow } from '../../services/admin-crud.service';

export interface CrudField {
  key: string;
  ar: string; en: string;
  type?: 'text' | 'number';
  required?: boolean;
  placeholder?: string;
}

export interface CrudManagerProps {
  table: string;
  Icon: LucideIcon;
  titleAr: string; titleEn: string;
  subtitleAr?: string; subtitleEn?: string;
  fields: CrudField[];      // form fields + table columns
  searchKeys?: string[];    // keys to match against the search box (defaults to all text fields)
  lang: 'ar' | 'en';
  pageSize?: number;
}

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };
const input: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' };

/**
 * Reusable admin CRUD workspace — Create/Read/Update/Delete + Search/Sort/
 * Pagination/Export(CSV)/Bulk-delete over any real Supabase table (sandbox-safe).
 * Reuses the Notification Center Drawer pattern. Bilingual · dark · responsive.
 */
export function CrudManager({ table, Icon, titleAr, titleEn, subtitleAr, subtitleEn, fields, searchKeys, lang, pageSize = 10 }: CrudManagerProps) {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const svc = useMemo(() => adminCrud(table), [table]);
  const sKeys = searchKeys && searchKeys.length ? searchKeys : fields.filter(f => (f.type || 'text') === 'text').map(f => f.key);

  const [rows, setRows] = useState<CrudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<string>(fields[0]?.key || 'id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // drawer / form
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrudRow | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await svc.list();
    if (error) setError(L('تعذّر تحميل البيانات', 'Failed to load data'));
    setRows(data); setLoading(false); setSelected(new Set());
  }, [svc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = rows;
    if (needle) r = r.filter(row => sKeys.some(k => String(row[k] ?? '').toLowerCase().includes(needle)));
    r = [...r].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const na = typeof av === 'number', nb = typeof bv === 'number';
      let cmp = na && nb ? (av as number) - (bv as number) : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [rows, q, sKeys, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const openCreate = () => { setEditing(null); setForm({}); setOpen(true); };
  const openEdit = (row: CrudRow) => { setEditing(row); setForm({ ...row }); setOpen(true); };

  const save = async () => {
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) { toast.error(L('أكمل الحقول المطلوبة', 'Fill the required fields')); return; }
    }
    const payload: Record<string, any> = {};
    fields.forEach(f => {
      let v = form[f.key];
      if (v === '' || v === undefined) return;
      if (f.type === 'number') v = Number(v);
      payload[f.key] = v;
    });
    setSaving(true);
    const res = editing?.id ? await svc.update(editing.id, payload) : await svc.create(payload);
    setSaving(false);
    if ((res as any).error) { toast.error(L('تعذّر الحفظ', 'Could not save')); return; }
    toast.success(editing ? L('تم التحديث', 'Updated') : L('تم الإنشاء', 'Created'));
    setOpen(false); load();
  };

  const remove = async (row: CrudRow) => {
    const ok = await confirmDialog({ title: L('حذف', 'Delete'), message: L('هل تريد حذف هذا العنصر نهائيًا؟', 'Permanently delete this item?'), danger: true, confirmText: L('حذف', 'Delete') });
    if (!ok) return;
    const { error } = await svc.remove(row.id!);
    if (error) { toast.error(L('تعذّر الحذف', 'Could not delete')); return; }
    toast.success(L('تم الحذف', 'Deleted')); load();
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const ok = await confirmDialog({ title: L('حذف متعدد', 'Bulk delete'), message: L(`حذف ${ids.length} عنصر؟`, `Delete ${ids.length} items?`), danger: true, confirmText: L('حذف', 'Delete') });
    if (!ok) return;
    for (const id of ids) await svc.remove(id);
    toast.success(L('تم الحذف', 'Deleted')); load();
  };

  const exportCsv = () => {
    const head = ['id', ...fields.map(f => f.key)];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(','), ...filtered.map(r => head.map(h => esc(r[h])).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${table}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(L('تم تصدير CSV', 'CSV exported'));
  };

  const toggleSel = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = pageRows.length > 0 && pageRows.every(r => selected.has(r.id!));
  const toggleAll = () => setSelected(s => { const n = new Set(s); allOnPage ? pageRows.forEach(r => n.delete(r.id!)) : pageRows.forEach(r => n.add(r.id!)); return n; });

  return (
    <div id={`crud_${table}`} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <WorkspaceHeader Icon={Icon} title={L(titleAr, titleEn)} subtitle={subtitleAr ? L(subtitleAr, subtitleEn || '') : undefined}
        actions={<ActionButton Icon={Plus} onClick={openCreate}>{L('إضافة', 'Add')}</ActionButton>} />

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label={L('الإجمالي', 'Total')} value={rows.length} Icon={Icon} />
        <MetricCard label={L('المعروضة', 'Filtered')} value={filtered.length} />
        <MetricCard label={L('المحددة', 'Selected')} value={selected.size} accent="#fb923c" />
      </div>

      {/* Toolbar: search · sort · export · refresh · bulk */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3" color="var(--color-on-surface-variant)" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder={L('بحث…', 'Search…')}
            className="w-full h-10 rounded-xl ps-9 pe-3 text-sm" style={input} id={`crud_${table}_search`} />
        </div>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="h-10 rounded-xl px-3 text-sm font-semibold" style={input} aria-label="sort field">
          {fields.map(f => <option key={f.key} value={f.key}>{L(f.ar, f.en)}</option>)}
        </select>
        <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} title={L('عكس الترتيب', 'Toggle order')} className="h-10 w-10 rounded-xl flex items-center justify-center cursor-pointer" style={card}><ArrowUpDown size={15} color="var(--color-on-surface)" /></button>
        <button onClick={exportCsv} title={L('تصدير', 'Export')} className="h-10 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer" style={card}><Download size={15} color="var(--color-on-surface)" />{L('تصدير', 'Export')}</button>
        <button onClick={load} title={L('تحديث', 'Refresh')} className="h-10 w-10 rounded-xl flex items-center justify-center cursor-pointer" style={card}><RefreshCw size={15} color="var(--color-on-surface)" /></button>
        {selected.size > 0 && (
          <button onClick={bulkDelete} className="h-10 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
            <Trash2 size={15} />{L(`حذف (${selected.size})`, `Delete (${selected.size})`)}
          </button>
        )}
      </div>

      {/* List */}
      {loading ? <SkeletonList rows={6} />
        : error ? (
          <div className="rounded-2xl p-6 flex items-center justify-center gap-3" style={{ ...card, color: '#f87171' }}>
            <AlertTriangle size={18} />{error}
            <button onClick={load} className="px-3 py-1.5 rounded-lg text-sm font-bold cursor-pointer" style={card}>{L('إعادة المحاولة', 'Retry')}</button>
          </div>
        )
        : filtered.length === 0 ? (
          <EmptyStateBox Icon={Icon} title={q ? L('لا نتائج', 'No results') : L('لا توجد عناصر بعد', 'No items yet')}
            description={q ? L('جرّب كلمة بحث مختلفة.', 'Try a different search term.') : L('ابدأ بإضافة أول عنصر.', 'Start by adding the first item.')}
            action={!q ? <ActionButton Icon={Plus} onClick={openCreate}>{L('إضافة', 'Add')}</ActionButton> : undefined} />
        ) : (
          <div className="rounded-2xl overflow-hidden" style={card}>
            {/* header row */}
            <div className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ borderBottom: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              <button onClick={toggleAll} className="cursor-pointer">{allOnPage ? <CheckSquare size={16} color="var(--color-primary-fixed)" /> : <Square size={16} />}</button>
              {fields.map(f => <span key={f.key} className="flex-1 min-w-0">{L(f.ar, f.en)}</span>)}
              <span className="w-16 text-end">{L('إجراءات', 'Actions')}</span>
            </div>
            {pageRows.map(row => (
              <div key={row.id} id={`crud_row_${row.id}`} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                <button onClick={() => toggleSel(row.id!)} className="cursor-pointer shrink-0">{selected.has(row.id!) ? <CheckSquare size={16} color="var(--color-primary-fixed)" /> : <Square size={16} color="var(--color-on-surface-variant)" />}</button>
                {fields.map(f => <span key={f.key} className="flex-1 min-w-0 truncate text-sm" style={{ color: 'var(--color-on-surface)' }}>{String(row[f.key] ?? '—')}</span>)}
                <span className="w-16 flex items-center justify-end gap-1 shrink-0">
                  <button onClick={() => openEdit(row)} title={L('تعديل', 'Edit')} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-container-high)]"><Pencil size={14} color="var(--color-on-surface-variant)" /></button>
                  <button onClick={() => remove(row)} title={L('حذف', 'Delete')} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-container-high)]"><Trash2 size={14} color="#f87171" /></button>
                </span>
              </div>
            ))}
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span>{L(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-lg font-bold cursor-pointer disabled:opacity-40" style={card}>{L('السابق', 'Prev')}</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded-lg font-bold cursor-pointer disabled:opacity-40" style={card}>{L('التالي', 'Next')}</button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Create / Edit Drawer */}
      <Drawer open={open} onClose={() => setOpen(false)} title={editing ? L('تعديل', 'Edit') : L('إضافة', 'Add new')}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer" style={card}>{L('إلغاء', 'Cancel')}</button>
            <button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{saving ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button>
          </div>
        }>
        <div className="px-4 pb-4 space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L(f.ar, f.en)}{f.required && <span style={{ color: '#f87171' }}> *</span>}</label>
              <input type={f.type === 'number' ? 'number' : 'text'} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder || ''} className="w-full h-11 rounded-xl px-3 text-sm" style={input} id={`crud_${table}_field_${f.key}`} />
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
