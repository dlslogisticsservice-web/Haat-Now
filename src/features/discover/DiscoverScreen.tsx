import React, { useEffect, useState } from 'react';
import { cxService } from '../../services/cx.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';

type DTab = 'search' | 'favorites' | 'support';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };

/** Customer discovery + favorites + support hub. */
export const DiscoverScreen: React.FC<{ customerId: string; onOpenBranch?: (branchId: string) => void }> = ({ customerId, onOpenBranch }) => {
  const [tab, setTab] = useState<DTab>('search');
  return (
    <div dir="rtl" className="min-h-screen px-5 py-6 space-y-4" id="discover_screen" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}>
      <div className="flex gap-2">
        {([['search', 'بحث واكتشاف'], ['favorites', 'المفضّلة'], ['support', 'الدعم']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{label}</button>
        ))}
      </div>
      {tab === 'search' && <SearchTab customerId={customerId} onOpenBranch={onOpenBranch} />}
      {tab === 'favorites' && <FavoritesTab customerId={customerId} onOpenBranch={onOpenBranch} />}
      {tab === 'support' && <SupportTab customerId={customerId} />}
    </div>
  );
};

const SearchTab: React.FC<{ customerId: string; onOpenBranch?: (id: string) => void }> = ({ customerId, onOpenBranch }) => {
  const [term, setTerm] = useState('');
  const [res, setRes] = useState<{ products: any[]; merchants: any[]; total: number } | null>(null);
  const [trending, setTrending] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { cxService.trending(8).then(setTrending); cxService.recentlyOrdered(customerId, 8).then(setRecent); }, [customerId]);
  const run = async () => {
    if (term.trim().length < 2) return;
    setBusy(true); setRes(await cxService.search(term.trim())); setBusy(false);
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="ابحث عن منتج أو متجر..." className="flex-1 px-3 py-2.5 rounded-xl text-sm" style={surface} />
        <Button loading={busy} onClick={run}>بحث</Button>
      </div>

      {res ? (
        res.total === 0 ? <EmptyState title="لا نتائج" description="جرّب كلمة أخرى" /> : (
          <div className="space-y-3">
            {res.merchants.length > 0 && <div><p className="font-bold text-sm mb-1">المتاجر</p>{res.merchants.map(m => (
              <Card key={m.id} className="p-3 mb-2 cursor-pointer" onClick={() => onOpenBranch?.(m.id)}><span className="text-sm font-semibold">{m.name}</span></Card>))}</div>}
            {res.products.length > 0 && <div><p className="font-bold text-sm mb-1">المنتجات</p>{res.products.map(p => (
              <Card key={p.id} className="p-3 mb-2 flex items-center justify-between cursor-pointer" onClick={() => onOpenBranch?.(p.branch_id)}>
                <span className="text-sm">{p.name} · {Number(p.price).toFixed(2)} <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>· {p.branch_name}</span></span>
              </Card>))}</div>}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {recent.length > 0 && <div><p className="font-bold text-sm mb-1">طلبتها مؤخرًا</p><div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map(p => <Card key={p.product_id} className="p-3 min-w-[140px] cursor-pointer" onClick={() => onOpenBranch?.(p.branch_id)}><p className="text-sm font-semibold">{p.name}</p><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{Number(p.price).toFixed(2)}</p></Card>)}</div></div>}
          <div><p className="font-bold text-sm mb-1">الأكثر طلبًا</p>{trending.length === 0 ? <EmptyState title="لا بيانات بعد" /> : trending.map(p => (
            <Card key={p.product_id} className="p-3 mb-2 flex items-center justify-between cursor-pointer" onClick={() => onOpenBranch?.(p.branch_id)}>
              <span className="text-sm">{p.name} · {Number(p.price).toFixed(2)}</span><Badge variant="secondary">{p.order_count} طلب</Badge></Card>))}</div>
        </div>
      )}
    </div>
  );
};

const FavoritesTab: React.FC<{ customerId: string; onOpenBranch?: (id: string) => void }> = ({ customerId, onOpenBranch }) => {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const { data } = await cxService.favoriteBranches(customerId); setBranches(data); setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [customerId]);
  const remove = async (branchId: string) => { await cxService.toggleFavoriteBranch(customerId, branchId); await load(); };
  if (loading) return <div className="py-10 flex justify-center"><Loader size={28} /></div>;
  if (branches.length === 0) return <EmptyState icon="favorite" title="لا متاجر مفضّلة" description="أضف متاجرك المفضّلة لتجدها هنا" />;
  return (
    <div className="space-y-2">
      {branches.map(f => (
        <Card key={f.id} className="p-3 flex items-center justify-between">
          <span className="text-sm font-semibold cursor-pointer" onClick={() => onOpenBranch?.(f.branch_id)}>{f.merchant_branches?.name ?? 'متجر'}</span>
          <Button size="sm" variant="secondary" onClick={() => remove(f.branch_id)}>إزالة</Button>
        </Card>
      ))}
    </div>
  );
};

const SupportTab: React.FC<{ customerId: string }> = ({ customerId }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [f, setF] = useState({ subject: '', type: 'general', message: '' });
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await cxService.myTickets(customerId); setTickets(data); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [customerId]);
  const create = async () => {
    if (!f.subject || !f.message) return alert('أدخل الموضوع والرسالة.');
    setBusy(true);
    const { error } = await cxService.createTicket(f.subject, f.type as any, f.message);
    setBusy(false);
    if (error) return alert(error.message);
    setF({ subject: '', type: 'general', message: '' }); await load();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <p className="font-bold">تذكرة دعم جديدة</p>
        <input placeholder="الموضوع" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface} />
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface}>
          <option value="general">استفسار عام</option><option value="dispute">نزاع على طلب</option><option value="refund">طلب استرداد</option><option value="inquiry">استفسار</option>
        </select>
        <textarea placeholder="اشرح مشكلتك..." rows={3} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface} />
        <Button size="sm" loading={busy} onClick={create}>إرسال التذكرة</Button>
      </Card>
      {tickets.map(t => (
        <Card key={t.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{t.subject} <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>({t.type})</span></span>
          <Badge variant={t.status === 'resolved' || t.status === 'closed' ? 'success' : t.status === 'open' ? 'error' : 'secondary'}>{t.status}</Badge>
        </Card>
      ))}
    </div>
  );
};
