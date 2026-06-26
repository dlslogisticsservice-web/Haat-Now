import React, { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, AlertTriangle, Info, AlertCircle, Wallet, Truck, Headset, Megaphone, ShieldCheck, Filter } from 'lucide-react';
import { notificationService } from '../../services/notification.service';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { EmptyState } from '../../components/ui/Primitives';
import { SkeletonList } from '../../components/ui/Skeleton';
import type { Notification } from '../../services/types';

const card = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

// Map the free-text `type`/`category` to a severity + icon for enterprise display.
const meta = (n: Notification): { Icon: typeof Bell; accent: string } => {
  const t = `${n.type || ''} ${(n as any).category || ''}`.toLowerCase();
  if (/error|fail|critical|fraud|breach/.test(t)) return { Icon: AlertCircle, accent: '#f87171' };
  if (/warn|delay|sla|pending/.test(t)) return { Icon: AlertTriangle, accent: '#fbbf24' };
  if (/finance|wallet|payout|refund|settle/.test(t)) return { Icon: Wallet, accent: '#9ed442' };
  if (/order|dispatch|driver|delivery/.test(t)) return { Icon: Truck, accent: '#60a5fa' };
  if (/support|ticket|care/.test(t)) return { Icon: Headset, accent: '#a78bfa' };
  if (/campaign|growth|coupon|promo/.test(t)) return { Icon: Megaphone, accent: '#fb923c' };
  if (/security|kyc|compliance/.test(t)) return { Icon: ShieldCheck, accent: '#34d399' };
  return { Icon: Info, accent: 'var(--color-on-surface-variant)' };
};

export const NotificationCenter: React.FC<{ adminId: string; lang: 'ar' | 'en'; onUnread?: (n: number) => void }> = ({ adminId, lang, onUnread }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    const { data } = await notificationService.getUserNotifications(adminId);
    setItems(data); setLoading(false);
    onUnread?.(data.filter(n => !n.is_read).length);
  }, [adminId, onUnread]);

  useEffect(() => {
    load();
    const unsub = notificationService.subscribe(adminId, load);
    return unsub;
  }, [adminId, load]);

  const markRead = async (id: string) => { await notificationService.markRead(id); load(); };
  const markAll = async () => { await notificationService.markAllRead(adminId); load(); };
  const remove = async (id: string) => { const { error } = await notificationService.remove(id); if (!error) load(); else markRead(id); };

  const shown = filter === 'unread' ? items.filter(n => !n.is_read) : items;
  const unread = items.filter(n => !n.is_read).length;
  const fmt = (d?: string) => d ? new Date(d).toLocaleString(L('ar', 'en'), { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <div id="notification_center" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <WorkspaceHeader Icon={Bell} title={L('مركز الإشعارات', 'Notification Center')} subtitle={L('إشعارات لحظية · الأولوية · التصنيف · القراءة', 'Realtime · Priority · Category · Read state')} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5"
              style={filter === f ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : { ...card }}>
              <Filter size={13} />{f === 'all' ? L('الكل', 'All') : `${L('غير مقروءة', 'Unread')}${unread ? ` (${unread})` : ''}`}
            </button>
          ))}
        </div>
        <button onClick={markAll} disabled={!unread} className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-40" style={card}>
          <CheckCheck size={15} />{L('تعليم الكل كمقروء', 'Mark all read')}
        </button>
      </div>

      {loading ? <SkeletonList rows={6} />
        : shown.length === 0 ? <EmptyState title={L('لا توجد إشعارات', 'No notifications')} />
        : (
          <div className="space-y-2">
            {shown.map(n => {
              const { Icon, accent } = meta(n);
              return (
                <div key={n.id} className="rounded-2xl p-3.5 flex items-start gap-3" style={{ ...card, opacity: n.is_read ? 0.7 : 1 }}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-container-high)' }}><Icon size={17} color={accent} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.is_read && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />}
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{n.message}</p>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{n.type} · {fmt(n.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.is_read && <button onClick={() => markRead(n.id)} title={L('تعليم كمقروء', 'Mark read')} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-container-high)]"><CheckCheck size={14} color="var(--color-on-surface-variant)" /></button>}
                    <button onClick={() => remove(n.id)} title={L('أرشفة', 'Archive')} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-container-high)]"><Trash2 size={14} color="var(--color-on-surface-variant)" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
};
