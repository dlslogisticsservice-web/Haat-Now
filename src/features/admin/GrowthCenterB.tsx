import React, { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { growthbService } from '../../services/growthb.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader, EmptyState } from '../../components/ui/Primitives';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { Target } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';

type GTab = 'coupons' | 'loyalty' | 'promotions' | 'banners' | 'campaigns' | 'segments' | 'retention' | 'analytics';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const inp = 'px-2 py-1.5 rounded-lg text-sm w-full';
const money = (n: number) => Number(n || 0).toFixed(2);
const COLORS = ['#9ed442', '#4ade80', '#fbbf24', '#fb923c', '#f87171', '#a78bfa'];
const TABS: { id: GTab; ar: string; en: string }[] = [
  { id: 'coupons', ar: 'الكوبونات', en: 'Coupons' }, { id: 'loyalty', ar: 'الولاء', en: 'Loyalty' }, { id: 'promotions', ar: 'العروض', en: 'Promotions' },
  { id: 'banners', ar: 'البانرات', en: 'Banners' }, { id: 'campaigns', ar: 'الحملات', en: 'Campaigns' }, { id: 'segments', ar: 'الشرائح', en: 'Segments' },
  { id: 'retention', ar: 'الاحتفاظ', en: 'Retention' }, { id: 'analytics', ar: 'التحليلات', en: 'Analytics' },
];

export const GrowthCenterB: React.FC = () => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState<GTab>('analytics');
  return (
    <div id="growth_center_b" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <WorkspaceHeader Icon={Target} title={L('إدارة النمو', 'Growth Management')} subtitle={L('الكوبونات · الولاء · العروض · البانرات · الشرائح · التحليلات', 'Coupons · Loyalty · Promotions · Banners · Segments · Analytics')} />
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === t.id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{L(t.ar, t.en)}</button>
        ))}
      </div>
      {tab === 'coupons' && <CouponsPanel />}
      {tab === 'loyalty' && <LoyaltyPanel />}
      {tab === 'promotions' && <PromotionsPanel />}
      {tab === 'banners' && <BannersPanel />}
      {tab === 'campaigns' && <CampaignsPanel />}
      {tab === 'segments' && <SegmentsPanel />}
      {tab === 'retention' && <RetentionPanel />}
      {tab === 'analytics' && <AnalyticsPanel />}
    </div>
  );
};

const CouponsPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [reds, setReds] = useState<any[]>([]);
  const [f, setF] = useState<any>({ code: '', discount_type: 'percent', discount_percent: '', discount_value: '', min_order_amount: '', max_discount: '', first_order_only: false, new_customer_only: false, per_customer_limit: '', country_code: '', start_date: '', end_date: '' });
  const load = async () => { const [{ data }, { data: r }] = await Promise.all([growthbService.listCoupons(), growthbService.couponRedemptions()]); setList(data); setReds(r); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.code) return alert('أدخل الكود.');
    const payload: any = { code: f.code.toUpperCase(), discount_type: f.discount_type, is_active: true,
      min_order_amount: Number(f.min_order_amount || 0), per_customer_limit: Number(f.per_customer_limit || 0),
      first_order_only: f.first_order_only, new_customer_only: f.new_customer_only,
      max_discount: f.max_discount ? Number(f.max_discount) : null, country_code: f.country_code || null,
      start_date: f.start_date || null, end_date: f.end_date || null };
    if (f.discount_type === 'percent') payload.discount_percent = Number(f.discount_percent || 0);
    else payload.discount_value = Number(f.discount_value || 0);
    const { error } = await growthbService.createCoupon(payload);
    if (error) return alert(error.message);
    setF({ ...f, code: '', discount_percent: '', discount_value: '' }); await load();
  };
  const redCount = (id: string) => reds.filter(r => r.coupon_id === id).length;
  const chartData = list.map(c => ({ code: c.code, redemptions: redCount(c.id) })).filter(d => d.redemptions > 0).slice(0, 8);

  return (
    <div className="space-y-4">
      <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input placeholder="الكود" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} className={`col-span-2 ${inp}`} style={surface} />
        <select value={f.discount_type} onChange={e => setF({ ...f, discount_type: e.target.value })} className={inp} style={surface}>
          <option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option><option value="free_delivery">توصيل مجاني</option><option value="wallet_credit">رصيد محفظة</option>
        </select>
        {f.discount_type === 'percent'
          ? <input placeholder="النسبة %" type="number" value={f.discount_percent} onChange={e => setF({ ...f, discount_percent: e.target.value })} className={inp} style={surface} />
          : <input placeholder="القيمة" type="number" value={f.discount_value} onChange={e => setF({ ...f, discount_value: e.target.value })} className={inp} style={surface} />}
        <input placeholder="حد أدنى للطلب" type="number" value={f.min_order_amount} onChange={e => setF({ ...f, min_order_amount: e.target.value })} className={inp} style={surface} />
        <input placeholder="حد أقصى للخصم" type="number" value={f.max_discount} onChange={e => setF({ ...f, max_discount: e.target.value })} className={inp} style={surface} />
        <input placeholder="حد لكل عميل" type="number" value={f.per_customer_limit} onChange={e => setF({ ...f, per_customer_limit: e.target.value })} className={inp} style={surface} />
        <input placeholder="الدولة (EG/SA)" value={f.country_code} onChange={e => setF({ ...f, country_code: e.target.value })} className={inp} style={surface} />
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.first_order_only} onChange={e => setF({ ...f, first_order_only: e.target.checked })} /> أول طلب فقط</label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.new_customer_only} onChange={e => setF({ ...f, new_customer_only: e.target.checked })} /> عملاء جدد</label>
        <input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className={inp} style={surface} />
        <input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2 sm:col-span-4" onClick={create}>إنشاء كوبون</Button>
      </Card>

      {chartData.length > 0 && (
        <Card className="p-4">
          <p className="font-bold text-sm mb-2">الاستخدام حسب الكوبون</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}><XAxis dataKey="code" tick={{ fontSize: 11, fill: '#aab0b6' }} /><YAxis tick={{ fontSize: 11, fill: '#aab0b6' }} allowDecimals={false} /><Tooltip /><Bar dataKey="redemptions" fill="#9ed442" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {list.map(c => (
        <Card key={c.id} className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm">{c.code} · {c.discount_type === 'percent' ? `${c.discount_percent}%` : c.discount_type === 'free_delivery' ? 'توصيل مجاني' : money(c.discount_value)} · حد {money(c.min_order_amount)} · {redCount(c.id)} استخدام{c.first_order_only ? ' · أول طلب' : ''}</span>
          <div className="flex gap-2">
            <button onClick={async () => { await growthbService.toggleCoupon(c.id, !c.is_active); load(); }} className="px-2 py-1 rounded-lg text-xs font-bold cursor-pointer" style={{ background: c.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: c.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{c.is_active ? 'نشط' : 'موقوف'}</button>
            <Button size="sm" variant="secondary" onClick={async () => { if (confirm('حذف الكوبون؟')) { await growthbService.deleteCoupon(c.id); load(); } }}>حذف</Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

const LoyaltyPanel: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [f, setF] = useState({ name: '', reward_type: 'wallet_credit', points_cost: '', value: '' });
  const load = async () => {
    const [{ data: r }, { data: t }, { data: rw }, a] = await Promise.all([growthbService.loyaltyRules(), growthbService.tiers(), growthbService.allRewards(), growthbService.analytics()]);
    setRules(r); setTiers(t); setRewards(rw); setAnalytics(a);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name || !f.points_cost) return alert('أدخل الاسم والنقاط.');
    const { error } = await growthbService.createReward({ name: f.name, reward_type: f.reward_type, points_cost: Number(f.points_cost), value: Number(f.value || 0), is_active: true });
    if (error) return alert(error.message); setF({ name: '', reward_type: 'wallet_credit', points_cost: '', value: '' }); await load();
  };
  return (
    <div className="space-y-4">
      <Card className="p-3"><span className="text-sm">نقاط قائمة بالنظام: <b>{analytics.loyalty_points_outstanding ?? 0}</b></span></Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4"><p className="font-bold mb-2">قواعد الكسب</p>{rules.map(r => <p key={r.id} className="text-sm py-0.5">{r.event_type}: {r.fixed_points > 0 ? `${r.fixed_points} نقطة` : `${r.points_per_currency} لكل ريال`}</p>)}</Card>
        <Card className="p-4"><p className="font-bold mb-2">المستويات</p>{tiers.map(t => <p key={t.id} className="text-sm py-0.5">{t.name} · من {t.min_points} نقطة · ×{t.points_multiplier}</p>)}</Card>
      </div>
      <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input placeholder="اسم المكافأة" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={`col-span-2 ${inp}`} style={surface} />
        <select value={f.reward_type} onChange={e => setF({ ...f, reward_type: e.target.value })} className={inp} style={surface}><option value="wallet_credit">رصيد</option><option value="discount">خصم</option><option value="free_delivery">توصيل مجاني</option></select>
        <input placeholder="تكلفة النقاط" type="number" value={f.points_cost} onChange={e => setF({ ...f, points_cost: e.target.value })} className={inp} style={surface} />
        <input placeholder="القيمة" type="number" value={f.value} onChange={e => setF({ ...f, value: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2 sm:col-span-4" onClick={create}>إضافة مكافأة</Button>
      </Card>
      {rewards.map(r => (
        <Card key={r.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{r.name} · {r.points_cost} نقطة · {r.reward_type}</span>
          <button onClick={async () => { await growthbService.toggleReward(r.id, !r.is_active); load(); }} className="px-2 py-1 rounded-lg text-xs font-bold cursor-pointer" style={{ background: r.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: r.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{r.is_active ? 'نشط' : 'موقوف'}</button>
        </Card>
      ))}
    </div>
  );
};

const PromotionsPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', type: 'flash_sale', discount_value: '', start_at: '', end_at: '', hour_start: '', hour_end: '' });
  const load = async () => { const { data } = await growthbService.listPromotions(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return alert('أدخل الاسم.');
    const { error } = await growthbService.createPromotion({ name: f.name, type: f.type, discount_value: f.discount_value ? Number(f.discount_value) : null, start_at: f.start_at || null, end_at: f.end_at || null, hour_start: f.hour_start ? Number(f.hour_start) : null, hour_end: f.hour_end ? Number(f.hour_end) : null, is_active: true });
    if (error) return alert(error.message); setF({ name: '', type: 'flash_sale', discount_value: '', start_at: '', end_at: '', hour_start: '', hour_end: '' }); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input placeholder="اسم العرض" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={`col-span-2 ${inp}`} style={surface} />
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className={inp} style={surface}><option value="flash_sale">تخفيض سريع</option><option value="happy_hour">ساعة سعيدة</option><option value="buy_x_get_y">اشترِ X واحصل Y</option><option value="free_delivery">توصيل مجاني</option><option value="percentage">نسبة خصم</option></select>
        <input placeholder="قيمة الخصم" type="number" value={f.discount_value} onChange={e => setF({ ...f, discount_value: e.target.value })} className={inp} style={surface} />
        <input type="datetime-local" value={f.start_at} onChange={e => setF({ ...f, start_at: e.target.value })} className={inp} style={surface} />
        <input type="datetime-local" value={f.end_at} onChange={e => setF({ ...f, end_at: e.target.value })} className={inp} style={surface} />
        <input placeholder="ساعة البدء (0-23)" type="number" value={f.hour_start} onChange={e => setF({ ...f, hour_start: e.target.value })} className={inp} style={surface} />
        <input placeholder="ساعة الانتهاء" type="number" value={f.hour_end} onChange={e => setF({ ...f, hour_end: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2 sm:col-span-4" onClick={create}>إنشاء عرض</Button>
      </Card>
      {list.map(p => (
        <Card key={p.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{p.name} · {p.type}{p.discount_value ? ` · ${money(p.discount_value)}` : ''}{p.hour_start != null ? ` · ${p.hour_start}-${p.hour_end}h` : ''}</span>
          <button onClick={async () => { await growthbService.togglePromotion(p.id, !p.is_active); load(); }} className="px-2 py-1 rounded-lg text-xs font-bold cursor-pointer" style={{ background: p.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: p.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{p.is_active ? 'نشط' : 'موقوف'}</button>
        </Card>
      ))}
    </div>
  );
};

const BannersPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ title: '', image_url: '', link_url: '', placement: 'home', priority: '', start_date: '', end_date: '', target_country: '' });
  const load = async () => { const { data } = await growthbService.listBanners(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.title || !f.image_url) return alert('أدخل العنوان ورابط الصورة.');
    const { error } = await growthbService.createBanner({ title: f.title, image_url: f.image_url, link_url: f.link_url || null, placement: f.placement, priority: Number(f.priority || 0), start_date: f.start_date || null, end_date: f.end_date || null, target_country: f.target_country || null, is_active: true });
    if (error) return alert(error.message); setF({ title: '', image_url: '', link_url: '', placement: 'home', priority: '', start_date: '', end_date: '', target_country: '' }); await load();
  };
  const ctr = (b: any) => b.impressions > 0 ? `${((b.clicks / b.impressions) * 100).toFixed(1)}%` : '—';
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <input placeholder="العنوان" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className={inp} style={surface} />
        <input placeholder="رابط الصورة" value={f.image_url} onChange={e => setF({ ...f, image_url: e.target.value })} className={`col-span-2 ${inp}`} style={surface} />
        <input placeholder="رابط الوجهة" value={f.link_url} onChange={e => setF({ ...f, link_url: e.target.value })} className={inp} style={surface} />
        <select value={f.placement} onChange={e => setF({ ...f, placement: e.target.value })} className={inp} style={surface}><option value="home">الرئيسية</option><option value="restaurant">المتجر</option><option value="checkout">الدفع</option><option value="wallet">المحفظة</option></select>
        <input placeholder="الأولوية" type="number" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })} className={inp} style={surface} />
        <input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className={inp} style={surface} />
        <input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} className={inp} style={surface} />
        <input placeholder="الدولة" value={f.target_country} onChange={e => setF({ ...f, target_country: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2 sm:col-span-3" onClick={create}>إضافة بانر</Button>
      </Card>
      {list.map(b => (
        <Card key={b.id} className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm">{b.title} · {b.placement} · أولوية {b.priority ?? 0} · {b.impressions ?? 0} ظهور / {b.clicks ?? 0} نقرة · CTR {ctr(b)}</span>
          <button onClick={async () => { await growthbService.toggleBanner(b.id, !b.is_active); load(); }} className="px-2 py-1 rounded-lg text-xs font-bold cursor-pointer" style={{ background: b.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: b.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{b.is_active ? 'نشط' : 'موقوف'}</button>
        </Card>
      ))}
    </div>
  );
};

const CampaignsPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { growthbService.listCampaigns().then(r => setList(r.data)); }, []);
  if (list.length === 0) return <EmptyState title="لا توجد حملات" description="تُنشأ من مركز النمو (E4)" />;
  return <div className="space-y-2">{list.map(c => (
    <Card key={c.id} className="p-3 flex items-center justify-between">
      <span className="text-sm">{c.name} · {c.channel}{c.status === 'sent' ? ` · ${c.recipient_count} مستلم` : ''}</span>
      <Badge variant={c.status === 'sent' ? 'success' : 'secondary'}>{c.status}</Badge>
    </Card>
  ))}</div>;
};

const SegmentsPanel: React.FC = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const load = async () => setCounts(await growthbService.segmentCounts());
  useEffect(() => { load(); }, []);
  const recompute = async () => { setBusy(true); const { rows } = await growthbService.recomputeSegments(); setBusy(false); alert(`تمت إعادة تصنيف ${rows} عميل.`); await load(); };
  const labels: Record<string, string> = { new: 'جديد', active: 'نشط', vip: 'مميّز', inactive: 'خامل', at_risk: 'معرّض للخطر', lost: 'مفقود' };
  const data = Object.entries(counts).map(([k, v]) => ({ name: labels[k] || k, value: v }));
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-bold">توزيع الشرائح</h3><Button size="sm" loading={busy} onClick={recompute}>إعادة التصنيف الآن</Button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          {data.length === 0 ? <EmptyState title="لا بيانات" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4 space-y-1">
          {['new', 'active', 'vip', 'inactive', 'at_risk', 'lost'].map(s => (
            <div key={s} className="flex justify-between text-sm py-1 border-b last:border-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <span>{labels[s]}</span><Badge variant="secondary">{counts[s] ?? 0}</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

const RetentionPanel: React.FC = () => {
  const [d, setD] = useState<any>(null);
  useEffect(() => { growthbService.retentionTargets().then(setD); }, []);
  if (!d) return <div className="py-10 flex justify-center"><Loader size={28} /></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[['خامل', d.inactive], ['معرّض للخطر', d.at_risk], ['مفقود', d.lost]].map(([l, v]) => (
          <Card key={l as string} className="p-4 text-center"><p className="text-headline-sm font-bold" style={{ color: 'var(--color-error)' }}>{v ?? 0}</p><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{l as string}</p></Card>
        ))}
      </div>
      <Card className="p-4">
        <p className="font-bold mb-2">إجراءات الاحتفاظ الموصى بها</p>
        {(d.recommendations || []).map((r: any, i: number) => (
          <div key={i} className="text-sm py-1.5 border-b last:border-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <b>{r.segment}</b> → عرض: <span style={{ color: 'var(--color-lime-vb, #9ed442)' }}>{r.offer}</span> <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>({r.reason})</span>
          </div>
        ))}
      </Card>
    </div>
  );
};

const AnalyticsPanel: React.FC = () => {
  const [a, setA] = useState<any>(null);
  useEffect(() => { growthbService.analytics().then(setA); }, []);
  if (!a) return <div className="py-10 flex justify-center"><Loader size={28} /></div>;
  const cards = [
    ['استخدام الكوبونات', a.coupon_redemptions], ['إجمالي الخصم', money(a.coupon_discount_total)],
    ['حملات مُرسلة', a.campaigns_sent], ['مستلمو الحملات', a.campaign_recipients],
    ['نقاط ولاء قائمة', a.loyalty_points_outstanding], ['إحالات', a.referrals_total],
    ['معدل تكرار الشراء', `${Math.round((a.repeat_purchase_rate || 0) * 100)}%`], ['متوسط القيمة الدائمة LTV', money(a.avg_ltv)],
  ];
  const seg = Object.entries(a.segments || {}).map(([k, v]) => ({ name: k, value: v as number }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(([l, v]) => <Card key={l as string} className="p-3 text-center"><p className="text-headline-sm font-bold">{v as any}</p><p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{l as string}</p></Card>)}
      </div>
      {seg.length > 0 && (
        <Card className="p-4">
          <p className="font-bold text-sm mb-2">توزيع الشرائح</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seg}><XAxis dataKey="name" tick={{ fontSize: 11, fill: '#aab0b6' }} /><YAxis tick={{ fontSize: 11, fill: '#aab0b6' }} allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#9ed442" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>CAC: placeholder (يتطلب ربط تكاليف التسويق).</p>
    </div>
  );
};
