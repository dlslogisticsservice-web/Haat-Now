import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cxService } from '../../services/cx.service';

type Target = { type: 'merchant' | 'driver' | 'product'; id: string; label: string };

const StarRow: React.FC<{ value: number; onChange: (n: number) => void; done: boolean }> = ({ value, onChange, done }) => (
  <div className="flex gap-1.5">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} disabled={done} onClick={() => onChange(n)} style={{ background: 'none', border: 'none', cursor: done ? 'default' : 'pointer', padding: 0 }}>
        <Star size={24} strokeWidth={1.6} color={value >= n ? '#fbbf24' : 'rgba(255,255,255,0.25)'} fill={value >= n ? '#fbbf24' : 'none'} />
      </button>
    ))}
  </div>
);

/** Separate ratings for merchant, driver, and each product on a delivered order. */
export const MultiTargetReview: React.FC<{ orderId: string; customerId: string; branchId: string; driverId: string | null }> = ({ orderId, branchId, driverId }) => {
  const [targets, setTargets] = useState<Target[]>([]);
  const [state, setState] = useState<Record<string, { rating: number; comment: string; done: boolean; skipped: boolean }>>({});

  useEffect(() => {
    (async () => {
      const list: Target[] = [];
      // merchant (resolve from branch)
      const { data: branch } = await supabase.from('merchant_branches').select('merchant_id, name, merchants(business_name)').eq('id', branchId).maybeSingle();
      if (branch?.merchant_id) list.push({ type: 'merchant', id: branch.merchant_id, label: (branch as any).merchants?.business_name ?? branch.name ?? 'المتجر' });
      // driver
      if (driverId) {
        const { data: drv } = await supabase.from('drivers').select('full_name').eq('id', driverId).maybeSingle();
        list.push({ type: 'driver', id: driverId, label: drv?.full_name ?? 'المندوب' });
      }
      // products on the order (distinct)
      const { data: items } = await supabase.from('order_items')
        .select('variant_id, product_variants(product_id, products(id, name))').eq('order_id', orderId);
      const seen = new Set<string>();
      (items || []).forEach((it: any) => {
        const p = it.product_variants?.products;
        if (p && !seen.has(p.id)) { seen.add(p.id); list.push({ type: 'product', id: p.id, label: p.name }); }
      });
      setTargets(list);
      // mark already-submitted reviews
      const init: Record<string, any> = {};
      for (const tg of list) {
        const { data: existing } = await supabase.from('reviews').select('rating, comment').eq('order_id', orderId).eq('target_type', tg.type).eq('target_id', tg.id).maybeSingle();
        init[tg.type + tg.id] = existing ? { rating: existing.rating, comment: existing.comment ?? '', done: true, skipped: false } : { rating: 0, comment: '', done: false, skipped: false };
      }
      setState(init);
    })();
  }, [orderId, branchId, driverId]);

  const key = (t: Target) => t.type + t.id;
  const set = (t: Target, patch: any) => setState(s => ({ ...s, [key(t)]: { ...s[key(t)], ...patch } }));
  const submit = async (t: Target) => {
    const st = state[key(t)];
    if (!st || st.rating < 1) return;
    const { error } = await cxService.submitReview(orderId, t.type, t.id, st.rating, st.comment.trim() || undefined);
    if (error) return alert(error.message);
    set(t, { done: true });
  };

  if (targets.length === 0) return null;
  const heading: Record<string, string> = { merchant: 'قيّم المتجر', driver: 'قيّم المندوب', product: 'قيّم المنتج' };

  return (
    <div className="glass rounded-2xl p-5 mt-4 space-y-4" id="multi_review">
      <h3 style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>قيّم تجربتك</h3>
      {targets.map(t => {
        const st = state[key(t)] || { rating: 0, comment: '', done: false, skipped: false };
        return (
          <div key={key(t)} className="pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{heading[t.type]}: {t.label}</span>
              {st.done ? <span style={{ color: '#9ed442', fontSize: 12 }}>شكرًا ✓</span>
                : st.skipped ? <span style={{ color: 'var(--color-on-surface-variant)', fontSize: 12 }}>تم التخطّي</span>
                : <button onClick={() => set(t, { skipped: true })} style={{ background: 'none', border: 'none', color: 'var(--color-on-surface-variant)', fontSize: 12, cursor: 'pointer' }}>تخطّي</button>}
            </div>
            {!st.done && !st.skipped && (
              <>
                <StarRow value={st.rating} onChange={n => set(t, { rating: n })} done={false} />
                <textarea value={st.comment} onChange={e => set(t, { comment: e.target.value })} rows={2} placeholder="تعليق (اختياري)"
                  className="w-full mt-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: 13, resize: 'none' }} />
                <button onClick={() => submit(t)} disabled={st.rating < 1}
                  className="mt-2 px-4 h-9 rounded-xl cursor-pointer" style={{ background: st.rating < 1 ? 'rgba(163,249,91,0.25)' : 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: 13, fontWeight: 700, opacity: st.rating < 1 ? 0.6 : 1 }}>
                  إرسال
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
