import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/feedback';
import { growthService, Affiliate, Influencer, AudienceSegment, MessageCampaign, LoyaltyTier } from '../../services/growth.service';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Primitives';
import { useAppConfig } from '../../contexts/AppConfigContext';

type GTab = 'cashback' | 'affiliates' | 'influencers' | 'segments' | 'campaigns' | 'tiers';
const surface = { background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' };
const money = (n: number) => Number(n || 0).toFixed(2);
const TABS: { id: GTab; ar: string; en: string }[] = [
  { id: 'cashback', ar: 'الكاش باك', en: 'Cashback' }, { id: 'affiliates', ar: 'المسوّقون', en: 'Affiliates' }, { id: 'influencers', ar: 'المؤثرون', en: 'Influencers' },
  { id: 'segments', ar: 'الشرائح', en: 'Segments' }, { id: 'campaigns', ar: 'الحملات', en: 'Campaigns' }, { id: 'tiers', ar: 'مستويات الولاء', en: 'Loyalty tiers' },
];
const inp = 'px-2 py-1.5 rounded-lg text-sm w-full';

export const GrowthCenter: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState<GTab>('cashback');
  return (
    <div id="growth_center" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={tab === t.id ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : surface}>{L(t.ar, t.en)}</button>
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
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', type: 'percent', rate: '', min_order: '', max_cashback: '' });
  const load = async () => { const { data } = await growthService.cashbackCampaigns(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name || !f.rate) return toast.error(L('أدخل الاسم والنسبة.','Enter the name and rate.'));
    const { error } = await growthService.createCashbackCampaign({ name: f.name, type: f.type, rate: Number(f.rate), min_order: Number(f.min_order || 0), max_cashback: f.max_cashback ? Number(f.max_cashback) : null });
    if (error) return toast.error(error.message);
    setF({ name: '', type: 'percent', rate: '', min_order: '', max_cashback: '' }); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 gap-2">
        <input placeholder={L('اسم الحملة','Campaign name')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={`col-span-2 ${inp}`} style={surface} />
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className={inp} style={surface}><option value="percent">{L('نسبة %','Percent %')}</option><option value="flat">{L('مبلغ ثابت','Fixed amount')}</option></select>
        <input placeholder={L('القيمة','Value')} type="number" value={f.rate} onChange={e => setF({ ...f, rate: e.target.value })} className={inp} style={surface} />
        <input placeholder={L('حد أدنى للطلب','Min order')} type="number" value={f.min_order} onChange={e => setF({ ...f, min_order: e.target.value })} className={inp} style={surface} />
        <input placeholder={L('حد أقصى للكاش باك','Max cashback')} type="number" value={f.max_cashback} onChange={e => setF({ ...f, max_cashback: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2" onClick={create}>{L('إنشاء حملة كاش باك','Create cashback campaign')}</Button>
      </Card>
      {list.length === 0 ? <EmptyState title={L('لا توجد حملات','No campaigns')} /> : list.map(c => (
        <Card key={c.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{c.name} · {c.type === 'percent' ? `${c.rate}%` : money(c.rate)} {c.max_cashback ? `(${L('حد','max')} ${money(c.max_cashback)})` : ''}</span>
          <button onClick={async () => { await growthService.toggleCashbackCampaign(c.id, !c.is_active); load(); }} className="px-2 py-1 rounded-lg text-xs font-bold cursor-pointer" style={{ background: c.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: c.is_active ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{c.is_active ? L('نشطة','Active') : L('متوقفة','Paused')}</button>
        </Card>
      ))}
    </div>
  );
};

const AffiliatesPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [list, setList] = useState<Affiliate[]>([]);
  const [f, setF] = useState({ name: '', commission: '', reward: '' });
  const load = async () => { const { data } = await growthService.affiliates(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return toast.error(L('أدخل الاسم.','Enter the name.'));
    const { error } = await growthService.createAffiliate(f.name, Number(f.commission || 0), Number(f.reward || 10));
    if (error) return toast.error(error.message); setF({ name: '', commission: '', reward: '' }); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-3 gap-2">
        <input placeholder={L('اسم المسوّق','Affiliate name')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inp} style={surface} />
        <input placeholder={L('عمولة %','Commission %')} type="number" value={f.commission} onChange={e => setF({ ...f, commission: e.target.value })} className={inp} style={surface} />
        <input placeholder={L('مكافأة الإحالة','Referral reward')} type="number" value={f.reward} onChange={e => setF({ ...f, reward: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-3" onClick={create}>{L('إضافة مسوّق','Add affiliate')}</Button>
      </Card>
      {list.map(a => (
        <Card key={a.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{a.name} · {L('كود','code')} {(a as any).referral_codes?.code} · {a.total_referred} {L('إحالة','referrals')} · {money(a.total_earned)}</span>
          <Badge variant={a.status === 'active' ? 'success' : 'error'}>{a.status}</Badge>
        </Card>
      ))}
    </div>
  );
};

const InfluencersPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [list, setList] = useState<Influencer[]>([]);
  const [f, setF] = useState({ name: '', handle: '', platform: 'instagram', reach: '', commission: '', reward: '' });
  const load = async () => { const { data } = await growthService.influencers(); setList(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return toast.error(L('أدخل الاسم.','Enter the name.'));
    const { error } = await growthService.createInfluencer(f.name, f.handle, f.platform, Number(f.reach || 0), Number(f.commission || 0), Number(f.reward || 10));
    if (error) return toast.error(error.message); setF({ name: '', handle: '', platform: 'instagram', reach: '', commission: '', reward: '' }); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-3 gap-2">
        <input placeholder={L('الاسم','Name')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inp} style={surface} />
        <input placeholder={L('@الحساب','@handle')} value={f.handle} onChange={e => setF({ ...f, handle: e.target.value })} className={inp} style={surface} />
        <select value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })} className={inp} style={surface}><option>instagram</option><option>tiktok</option><option>snapchat</option><option>x</option></select>
        <input placeholder={L('عدد المتابعين','Followers')} type="number" value={f.reach} onChange={e => setF({ ...f, reach: e.target.value })} className={inp} style={surface} />
        <input placeholder={L('عمولة %','Commission %')} type="number" value={f.commission} onChange={e => setF({ ...f, commission: e.target.value })} className={inp} style={surface} />
        <input placeholder={L('مكافأة','Reward')} type="number" value={f.reward} onChange={e => setF({ ...f, reward: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-3" onClick={create}>{L('إضافة مؤثر','Add influencer')}</Button>
      </Card>
      {list.map(i => (
        <Card key={i.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{i.name} · {i.handle} ({i.platform}) · {i.reach} {L('متابع','followers')} · {L('كود','code')} {(i as any).referral_codes?.code} · {money(i.total_earned)}</span>
          <Badge variant={i.status === 'active' ? 'success' : 'error'}>{i.status}</Badge>
        </Card>
      ))}
    </div>
  );
};

const SegmentsPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [list, setList] = useState<AudienceSegment[]>([]);
  const [name, setName] = useState('');
  const [minOrders, setMinOrders] = useState('');
  const [estimate, setEstimate] = useState<number | null>(null);
  const load = async () => { const { data } = await growthService.segments(); setList(data); };
  useEffect(() => { load(); }, []);
  const def = () => ({ min_orders: Number(minOrders || 0) });
  const doEstimate = async () => setEstimate(await growthService.estimateSegment(def()));
  const create = async () => {
    if (!name) return toast.error(L('أدخل الاسم.','Enter the name.'));
    const { error } = await growthService.createSegment(name, def());
    if (error) return toast.error(error.message); setName(''); setMinOrders(''); setEstimate(null); await load();
  };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 gap-2">
        <input placeholder={L('اسم الشريحة','Segment name')} value={name} onChange={e => setName(e.target.value)} className={inp} style={surface} />
        <input placeholder={L('حد أدنى للطلبات','Min orders')} type="number" value={minOrders} onChange={e => setMinOrders(e.target.value)} className={inp} style={surface} />
        <Button size="sm" variant="secondary" onClick={doEstimate}>{L('تقدير الحجم','Estimate size')}{estimate !== null ? `: ${estimate}` : ''}</Button>
        <Button size="sm" onClick={create}>{L('حفظ الشريحة','Save segment')}</Button>
      </Card>
      {list.map(s => (
        <Card key={s.id} className="p-3 flex items-center justify-between">
          <span className="text-sm">{s.name} · {JSON.stringify(s.definition)}</span>
          <Badge variant="secondary">{s.estimated_size} {L('عميل','customers')}</Badge>
        </Card>
      ))}
    </div>
  );
};

const CampaignsPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [list, setList] = useState<MessageCampaign[]>([]);
  const [segs, setSegs] = useState<AudienceSegment[]>([]);
  const [f, setF] = useState({ name: '', channel: 'push', segment_id: '', body: '' });
  const load = async () => { const [{ data: c }, { data: s }] = await Promise.all([growthService.campaigns(), growthService.segments()]); setList(c); setSegs(s); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!f.name) return toast.error(L('أدخل الاسم.','Enter the name.'));
    const { error } = await growthService.createCampaign({ name: f.name, channel: f.channel, segment_id: f.segment_id || null, body: f.body });
    if (error) return toast.error(error.message); setF({ name: '', channel: 'push', segment_id: '', body: '' }); await load();
  };
  const send = async (id: string) => { const { recipients, error } = await growthService.sendCampaign(id); if (error) return toast.error(error.message); toast.success(`${L('تم الإرسال إلى','Sent to')} ${recipients} ${L('مستلم.','recipients.')}`); await load(); };
  return (
    <div className="space-y-3">
      <Card className="p-4 grid grid-cols-2 gap-2">
        <input placeholder={L('اسم الحملة','Campaign name')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inp} style={surface} />
        <select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })} className={inp} style={surface}><option value="push">{L('إشعار','Push')}</option><option value="sms">{L('رسالة SMS','SMS')}</option><option value="email">{L('بريد','Email')}</option></select>
        <select value={f.segment_id} onChange={e => setF({ ...f, segment_id: e.target.value })} className={inp} style={surface}><option value="">{L('كل العملاء','All customers')}</option>{segs.map(s => <option key={s.id} value={s.id}>{s.name} ({s.estimated_size})</option>)}</select>
        <input placeholder={L('نص الرسالة','Message body')} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} className={inp} style={surface} />
        <Button size="sm" className="col-span-2" onClick={create}>{L('إنشاء حملة','Create campaign')}</Button>
      </Card>
      {list.map(c => (
        <Card key={c.id} className="p-3 flex items-center justify-between gap-2">
          <span className="text-sm">{c.name} · {c.channel} · {(c as any).audience_segments?.name ?? L('كل العملاء','All customers')} {c.status === 'sent' ? `· ${c.recipient_count} ${L('مستلم','recipients')}` : ''}</span>
          {c.status === 'sent' ? <Badge variant="success">{L('مُرسلة','Sent')}</Badge> : <Button size="sm" onClick={() => send(c.id)}>{L('إرسال','Send')}</Button>}
        </Card>
      ))}
      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{L('ملاحظة: التسليم الفعلي عبر FCM/SMS/البريد يتطلب ربط مزوّد خدمة.','Note: actual delivery via FCM/SMS/email requires a provider integration.')}</p>
    </div>
  );
};

const TiersPanel: React.FC = () => {
  const { lang } = useAppConfig(); const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  useEffect(() => { growthService.tiers().then(r => setTiers(r.data)); }, []);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tiers.map(t => (
        <Card key={t.id} className="p-4">
          <p className="font-bold">{t.name} <Badge variant="secondary">{L('مستوى','Level')} {t.level}</Badge></p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('من','From')} {t.min_points} {L('نقطة','pts')} · {L('مضاعف نقاط','points multiplier')} ×{t.points_multiplier}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{JSON.stringify(t.perks)}</p>
        </Card>
      ))}
    </div>
  );
};
