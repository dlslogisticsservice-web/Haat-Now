import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react';
import { cxService } from '../../services/cx.service';
import { growthbService } from '../../services/growthb.service';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';

type DTab = 'search' | 'favorites' | 'rewards' | 'support';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };

/** Customer discovery + favorites + support hub. */
export const DiscoverScreen: React.FC<{ customerId: string; onOpenBranch?: (branchId: string) => void }> = ({ customerId, onOpenBranch }) => {
  const { t } = useTranslation();
  const { lang } = useAppConfig();
  const [tab, setTab] = useState<DTab>('search');
  const tabs: [DTab, string][] = [['search', t('discover.tabSearch')], ['favorites', t('discover.tabFavorites')], ['rewards', t('discover.tabRewards')], ['support', t('discover.tabSupport')]];
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen px-5 py-6 space-y-4" id="discover_screen" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}>
      <div className="flex gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{label}</button>
        ))}
      </div>
      {tab === 'search' && <SearchTab customerId={customerId} onOpenBranch={onOpenBranch} />}
      {tab === 'favorites' && <FavoritesTab customerId={customerId} onOpenBranch={onOpenBranch} />}
      {tab === 'rewards' && <RewardsTab customerId={customerId} />}
      {tab === 'support' && <SupportTab customerId={customerId} />}
    </div>
  );
};

const SearchTab: React.FC<{ customerId: string; onOpenBranch?: (id: string) => void }> = ({ customerId, onOpenBranch }) => {
  const { t } = useTranslation();
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
          placeholder={t('discover.searchPlaceholder')} className="flex-1 px-3 py-2.5 rounded-xl text-sm" style={surface} />
        <Button loading={busy} onClick={run}>{t('discover.searchBtn')}</Button>
      </div>

      {res ? (
        res.total === 0 ? <EmptyState title={t('discover.noResults')} description={t('discover.tryAnother')} /> : (
          <div className="space-y-3">
            {res.merchants.length > 0 && <div><p className="font-bold text-sm mb-1">{t('discover.stores')}</p>{res.merchants.map(m => (
              <Card key={m.id} className="p-3 mb-2 cursor-pointer" onClick={() => onOpenBranch?.(m.id)}><span className="text-sm font-semibold">{m.name}</span></Card>))}</div>}
            {res.products.length > 0 && <div><p className="font-bold text-sm mb-1">{t('discover.products')}</p>{res.products.map(p => (
              <Card key={p.id} className="p-3 mb-2 flex items-center justify-between cursor-pointer" onClick={() => onOpenBranch?.(p.branch_id)}>
                <span className="text-sm">{p.name} · {Number(p.price).toFixed(2)} <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>· {p.branch_name}</span></span>
              </Card>))}</div>}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {recent.length > 0 && <div><p className="font-bold text-sm mb-1">{t('discover.recentlyOrdered')}</p><div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map(p => <Card key={p.product_id} className="p-3 min-w-[140px] cursor-pointer" onClick={() => onOpenBranch?.(p.branch_id)}><p className="text-sm font-semibold">{p.name}</p><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{Number(p.price).toFixed(2)}</p></Card>)}</div></div>}
          <div><p className="font-bold text-sm mb-1">{t('discover.mostOrdered')}</p>{trending.length === 0 ? <EmptyState title={t('discover.noDataYet')} /> : trending.map(p => (
            <Card key={p.product_id} className="p-3 mb-2 flex items-center justify-between cursor-pointer" onClick={() => onOpenBranch?.(p.branch_id)}>
              <span className="text-sm">{p.name} · {Number(p.price).toFixed(2)}</span><Badge variant="secondary">{p.order_count} {t('discover.orderUnit')}</Badge></Card>))}</div>
        </div>
      )}
    </div>
  );
};

const FavoritesTab: React.FC<{ customerId: string; onOpenBranch?: (id: string) => void }> = ({ customerId, onOpenBranch }) => {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const { data } = await cxService.favoriteBranches(customerId); setBranches(data); setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [customerId]);
  const remove = async (branchId: string) => { await cxService.toggleFavoriteBranch(customerId, branchId); await load(); };
  if (loading) return <div className="py-10 flex justify-center"><Loader size={28} /></div>;
  if (branches.length === 0) return <EmptyState icon="favorite" title={t('discover.noFavorites')} description={t('discover.noFavoritesSub')} />;
  return (
    <div className="space-y-2">
      {branches.map(f => (
        <Card key={f.id} className="p-3 flex items-center justify-between">
          <span className="text-sm font-semibold cursor-pointer" onClick={() => onOpenBranch?.(f.branch_id)}>{f.merchant_branches?.name ?? t('discover.store')}</span>
          <Button size="sm" variant="secondary" onClick={() => remove(f.branch_id)}>{t('discover.remove')}</Button>
        </Card>
      ))}
    </div>
  );
};

const RewardsTab: React.FC<{ customerId: string }> = ({ customerId }) => {
  const { t } = useTranslation();
  const { country } = useAppConfig();
  const cur = country.currency.symbolAr;
  const [points, setPoints] = useState(0);
  const [tier, setTier] = useState<any>(null);
  const [segment, setSegment] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true);
    const [p, tr, { data: s }, { data: rw }, { data: pr }] = await Promise.all([
      growthbService.myPoints(customerId), growthbService.myTier(customerId), growthbService.mySegment(customerId),
      growthbService.rewards(), growthbService.activePromotions(),
    ]);
    setPoints(p); setTier(tr); setSegment(s); setRewards(rw); setPromos(pr); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [customerId]);
  const redeem = async (rewardId: string, cost: number) => {
    if (points < cost) return toast.error(t('discover.insufficientPoints'));
    setBusy(true); const { data, error } = await growthbService.redeemReward(customerId, rewardId); setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(data?.reward === 'wallet_credit' ? t('discover.redeemedWallet', { value: data.value, cur }) : t('discover.redeemedActivated'));
    await load();
  };
  if (loading) return <div className="py-10 flex justify-center"><Loader size={28} /></div>;
  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <div><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{t('discover.myPoints')}</p><p className="text-headline-sm font-bold" style={{ color: 'var(--color-lime-vb, #9ed442)' }}>{points}</p></div>
        <div className="text-center"><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{t('discover.level')}</p><Badge variant="success">{tier?.name ?? 'Bronze'}</Badge></div>
        {segment && <div className="text-center"><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{t('discover.statusLabel')}</p><Badge variant="secondary">{segment.segment}</Badge></div>}
      </Card>
      <div>
        <p className="font-bold text-sm mb-2">{t('discover.availableRewards')}</p>
        {rewards.length === 0 ? <EmptyState title={t('discover.noRewards')} /> : rewards.map(r => (
          <Card key={r.id} className="p-3 flex items-center justify-between mb-2">
            <span className="text-sm">{r.name} · {r.points_cost} {t('discover.pointUnit')}</span>
            <Button size="sm" loading={busy} disabled={points < r.points_cost} onClick={() => redeem(r.id, r.points_cost)}>{t('discover.redeem')}</Button>
          </Card>
        ))}
      </div>
      {promos.length > 0 && (
        <div>
          <p className="font-bold text-sm mb-2">{t('discover.activePromos')}</p>
          {promos.map(p => <Card key={p.id} className="p-3 mb-2"><span className="text-sm inline-flex items-center gap-1.5"><Flame size={14} color="#fb923c" /> {p.name} · {p.type}</span></Card>)}
        </div>
      )}
    </div>
  );
};

const SupportTab: React.FC<{ customerId: string }> = ({ customerId }) => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<any[]>([]);
  const [f, setF] = useState({ subject: '', type: 'general', message: '' });
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await cxService.myTickets(customerId); setTickets(data); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [customerId]);
  const create = async () => {
    if (!f.subject || !f.message) return toast.error(t('discover.enterSubjectMessage'));
    setBusy(true);
    const { error } = await cxService.createTicket(f.subject, f.type as any, f.message);
    setBusy(false);
    if (error) return toast.error(error.message);
    setF({ subject: '', type: 'general', message: '' }); await load();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <p className="font-bold">{t('discover.newTicket')}</p>
        <input placeholder={t('discover.subjectPlaceholder')} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface} />
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface}>
          <option value="general">{t('discover.typeGeneral')}</option><option value="dispute">{t('discover.typeDispute')}</option><option value="refund">{t('discover.typeRefund')}</option><option value="inquiry">{t('discover.typeInquiry')}</option>
        </select>
        <textarea placeholder={t('discover.explainProblem')} rows={3} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} className="w-full px-2 py-1.5 rounded-lg text-sm" style={surface} />
        <Button size="sm" loading={busy} onClick={create}>{t('discover.sendTicket')}</Button>
      </Card>
      {tickets.map(ticket => (
        <Card key={ticket.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{ticket.subject} <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>({ticket.type})</span></span>
          <Badge variant={ticket.status === 'resolved' || ticket.status === 'closed' ? 'success' : ticket.status === 'open' ? 'error' : 'secondary'}>{ticket.status}</Badge>
        </Card>
      ))}
    </div>
  );
};
