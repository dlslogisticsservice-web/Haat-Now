import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { growthService, Affiliate, Influencer, AudienceSegment, MessageCampaign, LoyaltyTier } from '../../services/growth.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Primitives';

type GTab = 'cashback' | 'affiliates' | 'influencers' | 'segments' | 'campaigns' | 'tiers';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const money = (n: number) => Number(n || 0).toFixed(2);
const TABS: { id: GTab; label: string }[] = [
  { id: 'cashback', label: 'الكاش باك' }, { id: 'affiliates', label: 'المسوّقون' }, { id: 'influencers', label: 'المؤثرون' },
  { id: 'segments', label: 'الشرائح' }, { id: 'campaigns', label: 'الحملات' }, { id: 'tiers', label: 'مستويات الولاء' },
];
const inp = 'px-2 py-1.5 rounded-lg text-sm w-full';

export const GrowthCenter: React.FC = () => {
  const [tab, setTab] = useState<GTab>('cashback');
  return (
    <div id="growth_center" dir="rtl" className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === t.id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{t.label}</button>
        ))}
      </div>
      {tab === 'cashback' && <CashbackPanel />}
      {tab === 'affiliates' && <AffiliatesPanel />}
      {tab === 'influencers' && <InfluencersPanel />}
      {tab === 'segments' && <SegmentsPanel />}
      {tab === 'campaigns' && <CampaignsPanel />}
      {tab === 'tiers' && <TiersPanel />}
    </div>
  );
};

const CashbackPanel: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', type: 'percent', rate: '', min_order: '', max_cashback: '' });
  const load = async () => { const { data } = await growthService.cashbackCampaigns(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name || !f.rate) return toast.error('أدخل الاسم والنسبة.');
    const { error } = await growthService.createCashbackCampaign({ name: f.name, type: f.type, rate: Number(f.rate), min_order: Number(f.min_order || 0), max_cashback: f.max_cashback ? Number(f.max_cashback) : null });
    if (error) return toast.error(error.message);
    setF({ name: '', type: 'percent', rate: '', min_order: '', max_cashback: '' }); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 gap-2">
        <input placeholder="اسم الحملة" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={`col-span-2 ${inp}`} style={surface} />
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className={inp} style={surface}><option value="percent">نسبة %</option><option value="flat">مبلغ ثابت</option></select>
        <input placeholder="القيمة" type="number" value={f.rate} onChange={e => setF({ ...f, rate: e.target.value })} className={inp} style={surface} />
        <input placeholder="حد أدنى للطلب" type="number" value={f.min_order} onChange={e => setF({ ...f, min_order: e.target.value })} className={inp} style={surface} />
        <input placeholder="حد أقصى للكاش باك" type="number" value={f.max_cashback} onChange={e => setF({ ...f, max_cashback: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2" onClick={create}>إنشاء حملة كاش باك</Button>
      </Card>
      {list.length === 0 ? <EmptyState title="لا توجد حملات" /> : list.map(c => (
        <Card key={c.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{c.name} · {c.type === 'percent' ? `${c.rate}%` : money(c.rate)} {c.max_cashback ? `(حد ${money(c.max_cashback)})` : ''}</span>
          <button onClick={async () => { await growthService.toggleCashbackCampaign(c.id, !c.is_active); load(); }} className="px-2 py-1 rounded-lg text-xs font-bold cursor-pointer" style={{ background: c.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: c.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{c.is_active ? 'نشطة' : 'متوقفة'}</button>
        </Card>
      ))}
    </div>
  );
};

const AffiliatesPanel: React.FC = () => {
  const [list, setList] = useState<Affiliate[]>([]);
  const [f, setF] = useState({ name: '', commission: '', reward: '' });
  const load = async () => { const { data } = await growthService.affiliates(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return toast.error('أدخل الاسم.');
    const { error } = await growthService.createAffiliate(f.name, Number(f.commission || 0), Number(f.reward || 10));
    if (error) return toast.error(error.message); setF({ name: '', commission: '', reward: '' }); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-3 gap-2">
        <input placeholder="اسم المسوّق" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inp} style={surface} />
        <input placeholder="عمولة %" type="number" value={f.commission} onChange={e => setF({ ...f, commission: e.target.value })} className={inp} style={surface} />
        <input placeholder="مكافأة الإحالة" type="number" value={f.reward} onChange={e => setF({ ...f, reward: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-3" onClick={create}>إضافة مسوّق</Button>
      </Card>
      {list.map(a => (
        <Card key={a.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{a.name} · كود {(a as any).referral_codes?.code} · {a.total_referred} إحالة · {money(a.total_earned)}</span>
          <Badge variant={a.status === 'active' ? 'success' : 'error'}>{a.status}</Badge>
        </Card>
      ))}
    </div>
  );
};

const InfluencersPanel: React.FC = () => {
  const [list, setList] = useState<Influencer[]>([]);
  const [f, setF] = useState({ name: '', handle: '', platform: 'instagram', reach: '', commission: '', reward: '' });
  const load = async () => { const { data } = await growthService.influencers(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return toast.error('أدخل الاسم.');
    const { error } = await growthService.createInfluencer(f.name, f.handle, f.platform, Number(f.reach || 0), Number(f.commission || 0), Number(f.reward || 10));
    if (error) return toast.error(error.message); setF({ name: '', handle: '', platform: 'instagram', reach: '', commission: '', reward: '' }); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-3 gap-2">
        <input placeholder="الاسم" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inp} style={surface} />
        <input placeholder="@الحساب" value={f.handle} onChange={e => setF({ ...f, handle: e.target.value })} className={inp} style={surface} />
        <select value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })} className={inp} style={surface}><option>instagram</option><option>tiktok</option><option>snapchat</option><option>x</option></select>
        <input placeholder="عدد المتابعين" type="number" value={f.reach} onChange={e => setF({ ...f, reach: e.target.value })} className={inp} style={surface} />
        <input placeholder="عمولة %" type="number" value={f.commission} onChange={e => setF({ ...f, commission: e.target.value })} className={inp} style={surface} />
        <input placeholder="مكافأة" type="number" value={f.reward} onChange={e => setF({ ...f, reward: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-3" onClick={create}>إضافة مؤثر</Button>
      </Card>
      {list.map(i => (
        <Card key={i.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{i.name} · {i.handle} ({i.platform}) · {i.reach} متابع · كود {(i as any).referral_codes?.code} · {money(i.total_earned)}</span>
          <Badge variant={i.status === 'active' ? 'success' : 'error'}>{i.status}</Badge>
        </Card>
      ))}
    </div>
  );
};

const SegmentsPanel: React.FC = () => {
  const [list, setList] = useState<AudienceSegment[]>([]);
  const [name, setName] = useState('');
  const [minOrders, setMinOrders] = useState('');
  const [estimate, setEstimate] = useState<number | null>(null);
  const load = async () => { const { data } = await growthService.segments(); setList(data); };
  useEffect(() => { load(); }, []);
  const def = () => ({ min_orders: Number(minOrders || 0) });
  const doEstimate = async () => setEstimate(await growthService.estimateSegment(def()));
  const create = async () => {
    if (!name) return toast.error('أدخل الاسم.');
    const { error } = await growthService.createSegment(name, def());
    if (error) return toast.error(error.message); setName(''); setMinOrders(''); setEstimate(null); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 gap-2">
        <input placeholder="اسم الشريحة" value={name} onChange={e => setName(e.target.value)} className={inp} style={surface} />
        <input placeholder="حد أدنى للطلبات" type="number" value={minOrders} onChange={e => setMinOrders(e.target.value)} className={inp} style={surface} />
        <Button size="sm" variant="secondary" onClick={doEstimate}>تقدير الحجم{estimate !== null ? `: ${estimate}` : ''}</Button>
        <Button size="sm" onClick={create}>حفظ الشريحة</Button>
      </Card>
      {list.map(s => (
        <Card key={s.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{s.name} · {JSON.stringify(s.definition)}</span>
          <Badge variant="secondary">{s.estimated_size} عميل</Badge>
        </Card>
      ))}
    </div>
  );
};

const CampaignsPanel: React.FC = () => {
  const [list, setList] = useState<MessageCampaign[]>([]);
  const [segs, setSegs] = useState<AudienceSegment[]>([]);
  const [f, setF] = useState({ name: '', channel: 'push', segment_id: '', body: '' });
  const load = async () => { const [{ data: c }, { data: s }] = await Promise.all([growthService.campaigns(), growthService.segments()]); setList(c); setSegs(s); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return toast.error('أدخل الاسم.');
    const { error } = await growthService.createCampaign({ name: f.name, channel: f.channel, segment_id: f.segment_id || null, body: f.body });
    if (error) return toast.error(error.message); setF({ name: '', channel: 'push', segment_id: '', body: '' }); await load();
  };
  const send = async (id: string) => { const { recipients, error } = await growthService.sendCampaign(id); if (error) return toast.error(error.message); toast.error(`تم الإرسال إلى ${recipients} مستلم.`); await load(); };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 gap-2">
        <input placeholder="اسم الحملة" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inp} style={surface} />
        <select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })} className={inp} style={surface}><option value="push">إشعار</option><option value="sms">رسالة SMS</option><option value="email">بريد</option></select>
        <select value={f.segment_id} onChange={e => setF({ ...f, segment_id: e.target.value })} className={inp} style={surface}><option value="">كل العملاء</option>{segs.map(s => <option key={s.id} value={s.id}>{s.name} ({s.estimated_size})</option>)}</select>
        <input placeholder="نص الرسالة" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2" onClick={create}>إنشاء حملة</Button>
      </Card>
      {list.map(c => (
        <Card key={c.id} className="p-3 flex items-center justify-between gap-2">
          <span className="text-sm">{c.name} · {c.channel} · {(c as any).audience_segments?.name ?? 'كل العملاء'} {c.status === 'sent' ? `· ${c.recipient_count} مستلم` : ''}</span>
          {c.status === 'sent' ? <Badge variant="success">مُرسلة</Badge> : <Button size="sm" onClick={() => send(c.id)}>إرسال</Button>}
        </Card>
      ))}
      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>ملاحظة: التسليم الفعلي عبر FCM/SMS/البريد يتطلب ربط مزوّد خدمة.</p>
    </div>
  );
};

const TiersPanel: React.FC = () => {
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  useEffect(() => { growthService.tiers().then(r => setTiers(r.data)); }, []);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tiers.map(t => (
        <Card key={t.id} className="p-4">
          <p className="font-bold">{t.name} <Badge variant="secondary">مستوى {t.level}</Badge></p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>من {t.min_points} نقطة · مضاعف نقاط ×{t.points_multiplier}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{JSON.stringify(t.perks)}</p>
        </Card>
      ))}
    </div>
  );
};
