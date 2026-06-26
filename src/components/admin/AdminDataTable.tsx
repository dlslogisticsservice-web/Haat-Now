import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonTable } from '../ui/Skeleton';
import { EmptyState } from '../ui/Primitives';

// ── ONE shared enterprise admin table ────────────────────────────────────────
// Sorting · client search · pagination · sticky header · CSV export · loading
// skeleton · empty / no-results states. Column-config driven, generic, memoized.

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  csv?: (row: T) => string | number;
  sortable?: boolean;
  align?: 'start' | 'end' | 'center';
  width?: string;
}

export interface AdminDataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  lang?: 'ar' | 'en';
  emptyTitle?: string;
  toolbar?: React.ReactNode;
  exportName?: string;
  onRowClick?: (row: T) => void;
}

const card = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

function downloadCsv<T>(name: string, columns: Column<T>[], rows: T[]) {
  const head = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const body = rows.map(r => columns.map(c => {
    const v = c.csv ? c.csv(r) : c.sortValue ? c.sortValue(r) : '';
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function AdminDataTable<T>({
  columns, rows, rowKey, loading, search, searchPlaceholder, pageSize = 12,
  lang = 'ar', emptyTitle, toolbar, exportName, onRowClick,
}: AdminDataTableProps<T>) {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search || !q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter(r => search(r).toLowerCase().includes(needle));
  }, [rows, q, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a), bv = col.sortValue!(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(() => sorted.slice(safePage * pageSize, safePage * pageSize + pageSize), [sorted, safePage, pageSize]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const alignCls = (a?: string) => (a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start');

  return (
    <div className="space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Toolbar */}
      {(search || toolbar || exportName) && (
        <div className="flex items-center gap-2 flex-wrap">
          {search && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[180px]" style={card}>
              <Search size={15} color="var(--color-on-surface-variant)" />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder || L('بحث…', 'Search…')}
                className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--color-on-surface)' }} aria-label={L('بحث', 'Search')} />
            </div>
          )}
          {toolbar}
          {exportName && (
            <button onClick={() => downloadCsv(exportName, columns, sorted)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer" style={card} aria-label={L('تصدير CSV', 'Export CSV')}>
              <Download size={15} />{L('تصدير', 'Export')}
            </button>
          )}
        </div>
      )}

      {loading ? <SkeletonTable rows={Math.min(pageSize, 8)} cols={columns.length} />
        : sorted.length === 0 ? <EmptyState title={emptyTitle || (q ? L('لا نتائج', 'No results') : L('لا توجد بيانات', 'No data'))} />
        : (
          <div className="rounded-2xl overflow-hidden" style={card}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'var(--color-surface-container-high)' }} className="sticky top-0 z-10">
                    {columns.map(c => (
                      <th key={c.key} style={{ width: c.width }}
                        className={`${alignCls(c.align)} px-3 py-2.5 text-[11px] font-bold whitespace-nowrap ${c.sortable ? 'cursor-pointer select-none' : ''}`}
                        onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                        aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {c.header}
                          {c.sortable && sortKey === c.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(r => (
                    <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                      className={`transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                      style={{ borderTop: '1px solid var(--color-outline-variant)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container-high)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      {columns.map(c => (
                        <td key={c.key} className={`${alignCls(c.align)} px-3 py-2.5`} style={{ color: 'var(--color-on-surface)' }}>
                          {c.render ? c.render(r) : c.sortValue ? c.sortValue(r) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
                <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {L(`${sorted.length} سجل`, `${sorted.length} rows`)} · {L(`صفحة ${safePage + 1}/${pageCount}`, `Page ${safePage + 1}/${pageCount}`)}
                </span>
                <div className="flex gap-1">
                  <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label={L('السابق', 'Previous')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40" style={{ background: 'var(--color-surface-container-high)' }}>
                    {lang === 'ar' ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                  </button>
                  <button disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label={L('التالي', 'Next')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40" style={{ background: 'var(--color-surface-container-high)' }}>
                    {lang === 'ar' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
