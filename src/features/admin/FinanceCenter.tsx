import React, { useEffect, useState } from 'react';
import { financeService, RevenueDashboard, SettlementRun, MerchantSettlement, DriverSettlement } from '../../services/finance.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';

type FinTab = 'revenue' | 'settlements' | 'compensation' | 'refunds' | 'exports';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const money = (n: number) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TABS: { id: FinTab; label: string }[] = [
  { id: 'revenue', label: 'الإيرادات' }, { id: 'settlements', label: 'التسويات' },
  { id: 'compensation', label: 'التعويضات' }, { id: 'refunds', label: 'الاستردادات' }, { id: 'exports', label: 'التصدير المحاسبي' },
];

export const FinanceCenter: React.FC = () => {
  const [tab, setTab] = useState<FinTab>('revenue');
  return (
    <div id="finance_center" dir="rtl" className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === t.id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{t.label}</button>
        ))}
      </div>
      {tab === 'revenue' && <RevenuePanel />}
      {tab === 'settlements' && <SettlementsPanel />}
      {tab === 'compensation' && <CompensationPanel />}
      {tab === 'refunds' && <RefundsPanel />}
      {tab === 'exports' && <ExportsPanel />}
    </div>
  );
};

const RevenuePanel: React.FC = () => {
  const [d, setD] = useState<RevenueDashboard | null>(null);
  useEffect(() => { financeService.revenueDashboard().then(r => setD(r.data)); }, []);
  if (!d) return <div className="py-10 flex justify-center"><Loader size={28} /></div>;
  const cards = [
    ['إيرادات المنصة (عمولات)', d.platform_revenue], ['إجمالي العمولات', d.commission_total],
    ['مستحق للتجار', d.merchant_payable], ['مستحق للمندوبين', d.driver_payable],
    ['النقد لدى المنصة', d.platform_cash], ['عدد الطلبات المحتسبة', d.order_count],
  ] as const;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cards.map(([label, val]) => (
        <Card key={label} className="p-4">
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
          <p className="text-headline-sm font-bold mt-1">{label.includes('عدد') ? val : money(val as number)}</p>
        </Card>
      ))}
    </div>
  );
};

const SettlementsPanel: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today.slice(0, 8) + '01');
  const [end, setEnd] = useState(today);
  const [runs, setRuns] = useState<SettlementRun[]>([]);
  const [pendingM, setPendingM] = useState<MerchantSettlement[]>([]);
  const [pendingD, setPendingD] = useState<DriverSettlement[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: r }, { data: m }, { data: dd }] = await Promise.all([
      financeService.settlementRuns(), financeService.merchantSettlements('pending'), financeService.driverSettlements('pending'),
    ]);
    setRuns(r); setPendingM(m); setPendingD(dd);
  };
  useEffect(() => { load(); }, []);

  const gen = async (kind: 'merchant' | 'driver') => {
    setBusy(true);
    const { error } = kind === 'merchant'
      ? await financeService.generateMerchantSettlement(start, end)
      : await financeService.generateDriverSettlement(start, end);
    setBusy(false);
    if (error) return alert(error.message);
    await load();
  };
  const payM = async (id: string) => { await financeService.payMerchantSettlement(id); await load(); };
  const payD = async (id: string) => { await financeService.payDriverSettlement(id); await load(); };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <label className="text-xs">من<input type="date" value={start} onChange={e => setStart(e.target.value)} className="block mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} /></label>
        <label className="text-xs">إلى<input type="date" value={end} onChange={e => setEnd(e.target.value)} className="block mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} /></label>
        <Button size="sm" loading={busy} onClick={() => gen('merchant')}>تسوية التجار</Button>
        <Button size="sm" loading={busy} onClick={() => gen('driver')}>تسوية المندوبين</Button>
      </Card>

      <div>
        <h4 className="font-bold mb-2">مستحقات التجار المعلّقة ({pendingM.length})</h4>
        {pendingM.length === 0 ? <EmptyState title="لا توجد" /> : pendingM.map(m => (
          <Card key={m.id} className="p-3 flex items-center justify-between mb-2">
            <span className="text-sm">{m.merchants?.business_name ?? m.merchant_id.slice(0, 8)} · صافي {money(m.net_payable)} (عمولة {money(m.total_commission)})</span>
            <Button size="sm" onClick={() => payM(m.id)}>دفع</Button>
          </Card>
        ))}
      </div>
      <div>
        <h4 className="font-bold mb-2">مستحقات المندوبين المعلّقة ({pendingD.length})</h4>
        {pendingD.length === 0 ? <EmptyState title="لا توجد" /> : pendingD.map(d => (
          <Card key={d.id} className="p-3 flex items-center justify-between mb-2">
            <span className="text-sm">{d.drivers?.full_name ?? d.driver_id.slice(0, 8)} · صافي {money(d.net_payable)} (حوافز {money(d.total_incentives)} / خصومات {money(d.total_penalties)})</span>
            <Button size="sm" onClick={() => payD(d.id)}>دفع</Button>
          </Card>
        ))}
      </div>
      <div>
        <h4 className="font-bold mb-2">سجل دورات التسوية</h4>
        {runs.map(r => (
          <Card key={r.id} className="p-3 flex items-center justify-between mb-2">
            <span className="text-sm">{r.run_type === 'merchant' ? 'تجار' : 'مندوبون'} · {r.period_start} → {r.period_end} · {r.entity_count} جهة · {money(r.total_amount)}</span>
            <Badge variant={r.status === 'paid' ? 'success' : 'secondary'}>{r.status}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
};

const CompensationPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ entity_type: 'customer', entity_id: '', amount: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await financeService.listCompensations(); setList(data); };
  useEffect(() => { load(); }, []);
  const issue = async () => {
    if (!f.entity_id || !f.amount) return alert('أدخل المعرّف والمبلغ.');
    setBusy(true);
    const { error } = await financeService.issueCompensation(f.entity_type as any, f.entity_id, Number(f.amount), f.reason);
    setBusy(false);
    if (error) return alert(error.message);
    setF({ entity_type: 'customer', entity_id: '', amount: '', reason: '' }); await load();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <p className="font-bold">إصدار تعويض</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={f.entity_type} onChange={e => setF({ ...f, entity_type: e.target.value })} className="px-2 py-1.5 rounded-lg text-sm" style={surface}>
            <option value="customer">عميل</option><option value="merchant">تاجر</option><option value="driver">مندوب</option>
          </select>
          <input placeholder="المبلغ" type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className="px-2 py-1.5 rounded-lg text-sm" style={surface} />
          <input placeholder="معرّف الجهة (UUID)" value={f.entity_id} onChange={e => setF({ ...f, entity_id: e.target.value })} className="col-span-2 px-2 py-1.5 rounded-lg text-sm" style={surface} />
          <input placeholder="السبب" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} className="col-span-2 px-2 py-1.5 rounded-lg text-sm" style={surface} />
        </div>
        <Button size="sm" loading={busy} onClick={issue}>إصدار</Button>
      </Card>
      {list.map(c => (
        <Card key={c.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{c.entity_type} · {money(c.amount)} · {c.reason ?? '—'}</span>
          <Badge variant="secondary">{c.status}</Badge>
        </Card>
      ))}
    </div>
  );
};

const RefundsPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { financeService.listRefunds().then(r => setList(r.data)); }, []);
  if (list.length === 0) return <EmptyState title="لا توجد استردادات" />;
  return <div className="space-y-2">{list.map(r => (
    <Card key={r.id} className="p-3 flex items-center justify-between">
      <span className="text-sm">#{r.order_id?.slice(0, 8)} · {money(r.amount)} {r.currency} · {r.reason ?? '—'}</span>
      <Badge variant={r.status === 'refunded' ? 'success' : r.status === 'failed' ? 'error' : 'secondary'}>{r.status}</Badge>
    </Card>
  ))}</div>;
};

const ExportsPanel: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today.slice(0, 8) + '01');
  const [end, setEnd] = useState(today);
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await financeService.listExports(); setList(data); };
  useEffect(() => { load(); }, []);
  const gen = async (type: 'revenue' | 'commission' | 'settlement' | 'ledger') => {
    setBusy(true); const { error } = await financeService.generateExport(type, start, end); setBusy(false);
    if (error) return alert(error.message); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 flex flex-wrap items-end gap-2">
        <label className="text-xs">من<input type="date" value={start} onChange={e => setStart(e.target.value)} className="block mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} /></label>
        <label className="text-xs">إلى<input type="date" value={end} onChange={e => setEnd(e.target.value)} className="block mt-1 px-2 py-1.5 rounded-lg text-sm" style={surface} /></label>
        {(['revenue', 'commission', 'settlement', 'ledger'] as const).map(tp => (
          <Button key={tp} size="sm" variant="secondary" loading={busy} onClick={() => gen(tp)}>{tp}</Button>
        ))}
      </Card>
      {list.map(e => (
        <Card key={e.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{e.export_type} · {e.period_start} → {e.period_end} · {e.row_count} سطر · {money(e.total_amount)}</span>
          <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(e.generated_at).toLocaleDateString('ar')}</span>
        </Card>
      ))}
    </div>
  );
};
