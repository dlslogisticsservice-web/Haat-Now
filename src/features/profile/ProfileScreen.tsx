import React, { useState, useEffect, useRef } from 'react';
import { toast, confirmDialog } from '../../components/ui/feedback';
import { customerService, AddressWithZone, ZoneHierarchy } from '../../services/customer.service';
import { storageService } from '../../services/storage.service';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { useTranslation } from 'react-i18next';
import { COUNTRIES } from '../../config/countries';
import {
  ChevronRight, ChevronLeft, LogOut, Bell, BellRing, User, MapPin, MapPinned,
  MapPinOff, Loader2, UserCircle2, Camera, Crown, PenLine, AlertCircle,
  CheckCircle2, Save, Settings, Trash2, Pencil, Wallet, Globe, Shield, Headphones,
  CreditCard, Plus, Banknote, Star, X as XIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ProfileTab   = 'info' | 'addresses';
type SettingsPage = 'payment' | 'notifications' | 'language' | 'privacy' | 'support';

function uniqueById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
}

function formatJoinDate(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }); }
  catch { return '—'; }
}

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function validateAvatar(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return 'profile.avatarTypeError';
  if (file.size > MAX_AVATAR_BYTES) return 'profile.avatarSizeError';
  return null;
}

const SETTINGS_INFO: Record<SettingsPage, { Icon: LucideIcon; title: string; subtitle: string; hint: string }> = {
  payment:       { Icon: Wallet,      title: 'settings.paymentTitle', subtitle: 'settings.paymentSub', hint: 'settings.paymentSoon' },
  notifications: { Icon: BellRing,   title: 'settings.notifTitle', subtitle: 'settings.notifSub', hint: 'settings.notifSoon' },
  language:      { Icon: Globe,      title: 'settings.langTitle', subtitle: 'settings.langSub', hint: 'settings.langSoon' },
  privacy:       { Icon: Shield,     title: 'settings.privacyTitle', subtitle: 'settings.privacySub', hint: 'settings.privacySoon' },
  support:       { Icon: Headphones, title: 'settings.supportTitle', subtitle: 'settings.supportSub', hint: 'settings.supportSoon' },
};

const LBL: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-on-surface-variant)',
  display: 'block', marginBottom: '5px',
};

// ─── Notification preferences (local, persisted) ───────────────────────────
const NOTIF_KEY = 'haat_notif_prefs';
type NotifPrefs = { orders: boolean; offers: boolean; news: boolean };
const DEFAULT_NOTIF: NotifPrefs = { orders: true, offers: true, news: false };
function loadNotifPrefs(): NotifPrefs {
  try { return { ...DEFAULT_NOTIF, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}') }; }
  catch { return DEFAULT_NOTIF; }
}

// ─── Payment methods (TASK B — local CRUD, persisted) ──────────────────────
type PMType = 'cod' | 'visa' | 'mastercard' | 'mada' | 'wallet';
interface PayMethod { id: string; type: PMType; label: string; last4?: string; isDefault: boolean }
const PM_KEY = 'haat_payment_methods';
const seedPM = (): PayMethod[] => [
  { id: 'cod', type: 'cod', label: 'profile.codOnDelivery', isDefault: true },
  { id: 'wallet', type: 'wallet', label: 'profile.haatWallet', isDefault: false },
];
function loadPM(): PayMethod[] {
  try { const v = JSON.parse(localStorage.getItem(PM_KEY) || 'null'); return Array.isArray(v) && v.length ? v : seedPM(); }
  catch { return seedPM(); }
}
function savePM(list: PayMethod[]) { try { localStorage.setItem(PM_KEY, JSON.stringify(list)); } catch { /* ignore */ } }
const PM_META: Record<PMType, { label: string; Icon: typeof CreditCard }> = {
  cod:        { label: 'profile.cashOnDelivery', Icon: Banknote },
  visa:       { label: 'Visa', Icon: CreditCard },
  mastercard: { label: 'Mastercard', Icon: CreditCard },
  mada:       { label: 'مدى', Icon: CreditCard },
  wallet:     { label: 'profile.haatWallet', Icon: Wallet },
};

const ACCENT = 'var(--color-primary-fixed)';
const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.85rem', padding: '14px' };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{
      width: '44px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
      background: on ? 'rgba(163,249,91,0.85)' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 180ms', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: '3px', insetInlineStart: on ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: on ? '#0a0a0a' : '#fff', transition: 'inset-inline-start 180ms' }} />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 2px' }}>
      <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

// Functional settings detail (replaces the old "coming soon" placeholder).
function SettingsDetail({ page, onBack }: { page: SettingsPage; onBack: () => void }) {
  const { Icon, title, subtitle } = SETTINGS_INFO[page];
  const { lang, setLang, country, setCountry } = useAppConfig();
  const { t } = useTranslation();
  const [notif, setNotif] = useState<NotifPrefs>(loadNotifPrefs);
  const saveNotif = (patch: Partial<NotifPrefs>) => {
    const next = { ...notif, ...patch };
    setNotif(next);
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const T = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const tt = (k: string) => (k && k.includes('.') ? t(k) : k);

  // ── Payment methods CRUD (TASK B) ──
  const [pms, setPms] = useState<PayMethod[]>(loadPM);
  const [pmAdding, setPmAdding] = useState<PMType | null>(null);
  const [pmLast4, setPmLast4] = useState('');
  const [pmConfirmDel, setPmConfirmDel] = useState<string | null>(null);
  const commitPM = (list: PayMethod[]) => { setPms(list); savePM(list); };
  const isCard = (t: PMType) => t === 'visa' || t === 'mastercard' || t === 'mada';
  const addPM = (type: PMType) => {
    if (isCard(type) && pmLast4.length !== 4) return;
    const id = `${type}-${Date.now()}`;
    const label = isCard(type) ? `${tt(PM_META[type].label)} •••• ${pmLast4}` : tt(PM_META[type].label);
    commitPM([...pms, { id, type, label, last4: pmLast4 || undefined, isDefault: pms.length === 0 }]);
    setPmAdding(null); setPmLast4('');
  };
  const setDefaultPM = (id: string) => commitPM(pms.map(p => ({ ...p, isDefault: p.id === id })));
  const deletePM = (id: string) => {
    const next = pms.filter(p => p.id !== id);
    if (next.length && !next.some(p => p.isDefault)) next[0].isDefault = true;
    commitPM(next); setPmConfirmDel(null);
  };
  // Edit (TASK B): name, last-4, default flag
  const [pmEditing, setPmEditing] = useState<string | null>(null);
  const [pmEditName, setPmEditName] = useState('');
  const [pmEditLast4, setPmEditLast4] = useState('');
  const [pmEditDefault, setPmEditDefault] = useState(false);
  const startEdit = (pm: PayMethod) => {
    setPmEditing(pm.id);
    setPmEditName(pm.label.replace(/\s*•••• \d{4}\s*$/, ''));
    setPmEditLast4(pm.last4 || '');
    setPmEditDefault(pm.isDefault);
    setPmAdding(null);
  };
  const saveEdit = () => {
    if (!pmEditing) return;
    let next = pms.map(p => {
      if (p.id !== pmEditing) return p;
      const name = pmEditName.trim() || tt(PM_META[p.type].label);
      const last4 = isCard(p.type) ? (pmEditLast4 || p.last4 || '0000') : undefined;
      return { ...p, last4, label: isCard(p.type) ? `${name} •••• ${last4}` : name };
    });
    if (pmEditDefault) next = next.map(p => ({ ...p, isDefault: p.id === pmEditing }));
    if (next.length && !next.some(p => p.isDefault)) next[0].isDefault = true;
    commitPM(next); setPmEditing(null);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(163,249,91,0.07)', border: '1px solid rgba(163,249,91,0.15)', flexShrink: 0 }}>
          <Icon size={24} color={ACCENT} strokeWidth={1.6} />
        </div>
        <div>
          <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 700, marginBottom: '2px' }}>{t(title)}</h2>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', lineHeight: 1.45 }}>{t(subtitle)}</p>
        </div>
      </div>

      {/* ── LANGUAGE & REGION ── */}
      {page === 'language' && (
        <>
          <div style={cardStyle}>
            <span style={LBL}>{T('لغة التطبيق', 'App language')}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['ar', 'en'] as const).map(l => (
                <button key={l} id={`set_lang_${l}`} onClick={() => setLang(l)} style={{
                  flex: 1, height: '42px', borderRadius: '0.7rem', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
                  background: lang === l ? 'rgba(163,249,91,0.12)' : 'rgba(255,255,255,0.03)',
                  border: lang === l ? '1px solid rgba(163,249,91,0.4)' : '1px solid rgba(255,255,255,0.07)',
                  color: lang === l ? ACCENT : 'white',
                }}>{l === 'ar' ? T('العربية','Arabic') : 'English'}</button>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            <span style={LBL}>{T('الدولة والعملة', 'Country & currency')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.values(COUNTRIES).map(c => (
                <button key={c.code} id={`set_country_${c.code}`} onClick={() => setCountry(c.code, { manual: true })} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', height: '44px', padding: '0 12px', borderRadius: '0.7rem', cursor: 'pointer',
                  background: country.code === c.code ? 'rgba(163,249,91,0.1)' : 'rgba(255,255,255,0.03)',
                  border: country.code === c.code ? '1px solid rgba(163,249,91,0.35)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                  <span style={{ fontSize: '18px' }}>{c.flag}</span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, textAlign: 'start' }}>{lang === 'ar' ? c.nameAr : c.nameEn}</span>
                  <span style={{ marginInlineStart: 'auto', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>{lang === 'ar' ? c.currency.symbolAr : c.currency.symbolEn}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── NOTIFICATIONS ── */}
      {page === 'notifications' && (
        <div style={cardStyle}>
          <Row label={T('تحديثات الطلبات', 'Order updates')}><Toggle on={notif.orders} onClick={() => saveNotif({ orders: !notif.orders })} /></Row>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          <Row label={T('العروض والخصومات', 'Offers & discounts')}><Toggle on={notif.offers} onClick={() => saveNotif({ offers: !notif.offers })} /></Row>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          <Row label={T('الأخبار والجديد', 'News & updates')}><Toggle on={notif.news} onClick={() => saveNotif({ news: !notif.news })} /></Row>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px', lineHeight: 1.5, marginTop: '8px' }}>
            {T('تُحفظ تفضيلاتك على هذا الجهاز وتُطبَّق على إشعارات حالة الطلب.', 'Preferences are saved on this device and applied to order-status alerts.')}
          </p>
        </div>
      )}

      {/* ── PAYMENT METHODS ── */}
      {page === 'payment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pms.length === 0 && (
            <div style={cardStyle}><p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', textAlign: 'center' }}>{T('لا توجد طرق دفع. أضف واحدة أدناه.', 'No payment methods. Add one below.')}</p></div>
          )}
          {pms.map(pm => {
            const M = PM_META[pm.type];
            return (
              <div key={pm.id} style={cardStyle} className="flex items-center justify-between" id={`pm_${pm.id}`}>
                <div className="flex items-center gap-3">
                  <M.Icon size={20} color={ACCENT} strokeWidth={1.8} />
                  <div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{tt(pm.label)}</p>
                    {pm.isDefault && <span style={{ fontSize: '10px', color: ACCENT, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Star size={10} fill={ACCENT} strokeWidth={0} /> {T('افتراضي', 'Default')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!pm.isDefault && <button onClick={() => setDefaultPM(pm.id)} className="cursor-pointer" style={{ fontSize: '11px', color: ACCENT, background: 'rgba(163,249,91,0.08)', border: '1px solid rgba(163,249,91,0.2)', borderRadius: '8px', padding: '4px 8px' }}>{T('تعيين افتراضي', 'Set default')}</button>}
                  {pm.type !== 'cod' && <button onClick={() => startEdit(pm)} aria-label="edit" id={`pm_edit_${pm.id}`} className="cursor-pointer" style={{ background: 'none', border: 'none', color: ACCENT, padding: '4px' }}><Pencil size={15} /></button>}
                  {pm.type !== 'cod' && <button onClick={() => setPmConfirmDel(pm.id)} aria-label="delete" className="cursor-pointer" style={{ background: 'none', border: 'none', color: '#f87171', padding: '4px' }}><Trash2 size={16} /></button>}
                </div>
              </div>
            );
          })}

          {pmEditing && (
            <div style={cardStyle} id="pm_edit_panel">
              <span style={LBL}>{T('تعديل طريقة الدفع', 'Edit payment method')}</span>
              <input value={pmEditName} onChange={e => setPmEditName(e.target.value)} placeholder={T('الاسم', 'Card name')}
                className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }} />
              {pms.find(p => p.id === pmEditing && isCard(p.type)) && (
                <input value={pmEditLast4} onChange={e => setPmEditLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder={T('آخر 4 أرقام', 'Last 4 digits')} dir="ltr"
                  className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }} />
              )}
              <label className="flex items-center justify-between" style={{ padding: '6px 2px', marginBottom: '8px' }}>
                <span style={{ color: 'white', fontSize: '14px' }}>{T('تعيين كافتراضي', 'Set as default')}</span>
                <Toggle on={pmEditDefault} onClick={() => setPmEditDefault(v => !v)} />
              </label>
              <div className="flex gap-2">
                <button id="pm_edit_save" onClick={saveEdit} className="flex-1 cursor-pointer" style={{ height: '42px', borderRadius: '0.7rem', background: ACCENT, color: 'var(--color-on-primary-fixed)', fontWeight: 700, border: 'none' }}>{T('حفظ', 'Save')}</button>
                <button onClick={() => setPmEditing(null)} className="cursor-pointer" style={{ width: '42px', height: '42px', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}><XIcon size={16} /></button>
              </div>
            </div>
          )}

          {!pmEditing && (!pmAdding ? (
            <div className="grid grid-cols-2 gap-2">
              {(['visa', 'mastercard', 'mada', 'wallet'] as PMType[]).map(t => (
                <button key={t} onClick={() => { setPmAdding(t); setPmLast4(''); }} id={`pm_add_${t}`} className="cursor-pointer flex items-center justify-center gap-1.5" style={{ height: '42px', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px', fontWeight: 600 }}>
                  <Plus size={14} color={ACCENT} /> {tt(PM_META[t].label)}
                </button>
              ))}
            </div>
          ) : (
            <div style={cardStyle}>
              <span style={LBL}>{T('إضافة', 'Add')} {tt(PM_META[pmAdding].label)}</span>
              {isCard(pmAdding) && (
                <input value={pmLast4} onChange={e => setPmLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder={T('آخر 4 أرقام', 'Last 4 digits')} dir="ltr"
                  className="w-full h-11 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }} />
              )}
              <div className="flex gap-2">
                <button id="pm_save_btn" onClick={() => addPM(pmAdding)} disabled={isCard(pmAdding) && pmLast4.length !== 4} className="flex-1 cursor-pointer" style={{ height: '42px', borderRadius: '0.7rem', background: ACCENT, color: 'var(--color-on-primary-fixed)', fontWeight: 700, opacity: isCard(pmAdding) && pmLast4.length !== 4 ? 0.5 : 1 }}>{T('حفظ', 'Save')}</button>
                <button onClick={() => { setPmAdding(null); setPmLast4(''); }} className="cursor-pointer" style={{ width: '42px', height: '42px', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}><XIcon size={16} /></button>
              </div>
            </div>
          ))}

          {pmConfirmDel && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setPmConfirmDel(null); }}>
              <div className="glass-strong rounded-2xl p-5 w-full max-w-xs animate-fade-in" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <p style={{ color: 'white', fontSize: '15px', fontWeight: 600, textAlign: 'center', marginBottom: '14px' }}>{T('حذف طريقة الدفع؟', 'Delete this payment method?')}</p>
                <div className="flex gap-2">
                  <button id="pm_del_confirm" onClick={() => deletePM(pmConfirmDel)} className="flex-1 cursor-pointer" style={{ height: '42px', borderRadius: '0.7rem', background: '#f87171', color: '#0a0a0a', fontWeight: 700, border: 'none' }}>{T('حذف', 'Delete')}</button>
                  <button onClick={() => setPmConfirmDel(null)} className="flex-1 cursor-pointer" style={{ height: '42px', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.06)', color: 'white', border: 'none' }}>{T('إلغاء', 'Cancel')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PRIVACY & SECURITY ── */}
      {page === 'privacy' && (
        <div style={cardStyle}>
          {[
            T('بياناتك مشفّرة ومحمية وتُستخدم فقط لتنفيذ طلباتك.', 'Your data is encrypted and used only to fulfil your orders.'),
            T('لا نشارك رقم هاتفك أو عنوانك مع أطراف خارجية للتسويق.', 'We never share your phone or address with third parties for marketing.'),
            T('يمكنك طلب حذف حسابك وبياناتك في أي وقت.', 'You can request deletion of your account and data at any time.'),
          ].map(line => (
            <div key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 2px' }}>
              <Shield size={16} color={ACCENT} strokeWidth={1.8} style={{ marginTop: '2px', flexShrink: 0 }} />
              <span style={{ color: 'white', fontSize: '13px', lineHeight: 1.55 }}>{line}</span>
            </div>
          ))}
          <a href="mailto:support@hatnow.com?subject=Account%20deletion%20request" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px', marginTop: '8px',
            borderRadius: '0.7rem', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff8a8a', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
          }}>
            <Trash2 size={16} strokeWidth={2} />{T('طلب حذف الحساب', 'Request account deletion')}
          </a>
        </div>
      )}

      {/* ── SUPPORT ── */}
      {page === 'support' && (
        <div style={cardStyle}>
          {[
            { Icon: Headphones, label: T('البريد الإلكتروني', 'Email'), val: 'support@hatnow.com', href: 'mailto:support@hatnow.com' },
            { Icon: Bell, label: T('واتساب', 'WhatsApp'), val: '+20 100 000 0000', href: 'https://wa.me/201000000000' },
          ].map(({ Icon: RowIcon, label, val, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 2px', textDecoration: 'none' }}>
              <RowIcon size={18} color={ACCENT} strokeWidth={1.8} />
              <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>{label}</span>
              <span dir="ltr" style={{ marginInlineStart: 'auto', color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>{val}</span>
            </a>
          ))}
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px', lineHeight: 1.55, marginTop: '6px' }}>
            {T('فريق الدعم متاح يومياً من 9 صباحاً حتى 12 منتصف الليل.', 'Support is available daily, 9 AM – 12 midnight.')}
          </p>
        </div>
      )}

      <button onClick={onBack} className="flex items-center gap-1.5 px-5 h-11 rounded-xl cursor-pointer" style={{ alignSelf: 'flex-start', background: 'rgba(163,249,91,0.09)', border: '1px solid rgba(163,249,91,0.18)', color: ACCENT, fontSize: '14px', fontWeight: 600 }}>
        <ChevronRight size={17} strokeWidth={2} />{T('العودة','Back')}
      </button>
    </div>
  );
}

const READ_ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  height: '44px', padding: '0 14px', borderRadius: '0.75rem',
  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
};

interface ProfileScreenProps {
  session: { id: string; phone_number: string; role: string };
  onLogout: () => void;
}

export const ProfileScreen = ({ session, onLogout }: ProfileScreenProps) => {

  const { lang } = useAppConfig();
  const { t } = useTranslation();
  const T = (ar, en) => (lang === 'ar' ? ar : en);
  const [activeTab,    setActiveTab]    = useState<ProfileTab>('info');
  const [settingsPage, setSettingsPage] = useState<SettingsPage | null>(null);

  const [profileLoading, setProfileLoading] = useState(true);
  const [editName,       setEditName]       = useState('');
  const [editEmail,      setEditEmail]      = useState('');
  const [savedName,      setSavedName]      = useState('');
  const [savedEmail,     setSavedEmail]     = useState('');
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(null);
  const [savedCreatedAt, setSavedCreatedAt] = useState<string | null>(null);
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileError,   setProfileError]   = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreview,     setAvatarPreview]     = useState<string | null>(null);
  const [avatarUploading,   setAvatarUploading]   = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [addresses,     setAddresses]     = useState<AddressWithZone[]>([]);
  const [addrLoading,   setAddrLoading]   = useState(false);
  const [zonesData,     setZonesData]     = useState<ZoneHierarchy[]>([]);
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrSaving,    setAddrSaving]    = useState(false);
  const [addrError,     setAddrError]     = useState<string | null>(null);

  const [formLabel,     setFormLabel]     = useState('');
  const [formLine,      setFormLine]      = useState('');
  const [formCountryId, setFormCountryId] = useState('');
  const [formCityId,    setFormCityId]    = useState('');
  const [formZoneId,    setFormZoneId]    = useState('');
  const [formLabelType, setFormLabelType] = useState<'home' | 'work' | 'custom'>('custom');
  const [formNotes,     setFormNotes]     = useState('');

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => {
    if (activeTab === 'addresses' && addresses.length === 0 && !addrLoading) loadAddresses();
  }, [activeTab]);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const { data } = await customerService.getProfile(session.id);
      if (data) {
        setEditName(data.full_name || '');  setEditEmail(data.email || '');
        setSavedName(data.full_name || ''); setSavedEmail(data.email || '');
        setSavedAvatarUrl(data.avatar_url || null);
        setSavedCreatedAt(data.created_at || null);
      }
    } finally { setProfileLoading(false); }
  };

  const loadAddresses = async () => {
    setAddrLoading(true);
    try {
      const [{ data: addrData }, { data: zonesRaw }] = await Promise.all([
        customerService.getAddresses(session.id),
        customerService.getZonesWithHierarchy(),
      ]);
      if (addrData) setAddresses(addrData);
      if (zonesRaw) setZonesData(zonesRaw);
    } finally { setAddrLoading(false); }
  };

  const isDirty = editName !== savedName || editEmail !== savedEmail;

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const err = validateAvatar(file);
    if (err) { setProfileError(t(err)); return; }
    setProfileError(null); setPendingAvatarFile(file);
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!isDirty && !pendingAvatarFile) return;
    setProfileSaving(true); setProfileError(null); setProfileSuccess(false);
    try {
      let newAvatarUrl = savedAvatarUrl;
      if (pendingAvatarFile) {
        setAvatarUploading(true);
        const { url, error: upErr } = await storageService.uploadAvatar(session.id, pendingAvatarFile);
        setAvatarUploading(false);
        if (upErr || !url) { setProfileError(T('فشل رفع الصورة. تحقق من اتصالك وحاول مرة أخرى.','Image upload failed. Check your connection and try again.')); return; }
        newAvatarUrl = url;
      }
      const payload: Record<string, string | null> = { full_name: editName.trim() || null, email: editEmail.trim() || null };
      if (newAvatarUrl !== savedAvatarUrl) payload.avatar_url = newAvatarUrl;
      const { error } = await customerService.updateProfile(session.id, payload);
      if (error) { setProfileError(T('فشل الحفظ. تحقق من اتصالك وحاول مرة أخرى.','Save failed. Check your connection and try again.')); return; }
      setSavedName(editName.trim()); setSavedEmail(editEmail.trim());
      if (newAvatarUrl !== savedAvatarUrl) setSavedAvatarUrl(newAvatarUrl);
      setPendingAvatarFile(null); setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } finally { setProfileSaving(false); }
  };

  const allCountries = uniqueById(zonesData.flatMap(z => (z.cities?.countries ? [z.cities.countries] : [])));
  const hasHierarchy = allCountries.length > 0;
  const citiesForCountry = (cId: string) => uniqueById(
    zonesData.filter(z => z.cities?.countries?.id === cId).flatMap(z => z.cities ? [{ id: z.cities.id, name: z.cities.name }] : [])
  );
  const zonesForCity   = (cId: string) => zonesData.filter(z => z.city_id === cId);
  const availableZones = formCityId ? zonesForCity(formCityId) : hasHierarchy ? [] : zonesData;

  const resetAddrForm  = () => { setFormLabel(''); setFormLine(''); setFormCountryId(''); setFormCityId(''); setFormZoneId(''); setFormLabelType('custom'); setFormNotes(''); setAddrError(null); };
  const openAddForm    = () => { resetAddrForm(); setEditingAddrId(null); setShowAddForm(true); };
  const cancelAddrForm = () => { setShowAddForm(false); setEditingAddrId(null); resetAddrForm(); };

  const openEditForm = (addr: AddressWithZone) => {
    setFormLabel(addr.label || ''); setFormLine(addr.address_line || '');
    setFormCountryId(addr.zones?.cities?.countries?.id || '');
    setFormCityId(addr.zones?.cities?.id || '');
    setFormZoneId(addr.zone_id);
    setFormLabelType(addr.label_type || 'custom'); setFormNotes(addr.notes || '');
    setAddrError(null); setEditingAddrId(addr.id); setShowAddForm(false);
  };

  const handleAddrSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLine.trim()) { setAddrError(T('يرجى إدخال تفاصيل العنوان','Please enter the address details')); return; }
    if (!formZoneId)       { setAddrError(T('يرجى اختيار الحي أو المنطقة','Please choose a district or area')); return; }
    setAddrSaving(true); setAddrError(null);
    try {
      const typeLabel = formLabelType === 'home' ? T('المنزل', 'Home') : formLabelType === 'work' ? T('العمل', 'Work') : (formLabel.trim() || T('عنواني', 'My address'));
      const payload = { label: typeLabel, label_type: formLabelType, address_line: formLine.trim(), zone_id: formZoneId, notes: formNotes.trim() || null };
      if (editingAddrId) {
        const { error } = await customerService.updateAddress(editingAddrId, payload);
        if (error) { setAddrError(T('فشل تعديل العنوان. حاول مرة أخرى.','Failed to edit the address. Please try again.')); return; }
      } else {
        const { error } = await customerService.createAddress(session.id, payload);
        if (error) { setAddrError(T('فشل حفظ العنوان. حاول مرة أخرى.','Failed to save the address. Please try again.')); return; }
      }
      await loadAddresses(); cancelAddrForm();
    } finally { setAddrSaving(false); }
  };

  const handleAddrDelete = async (addrId: string) => {
    if (!(await confirmDialog({ message: T('هل أنت متأكد من حذف هذا العنوان؟', 'Are you sure you want to delete this address?'), danger: true }))) return;
    const { error } = await customerService.deleteAddress(addrId);
    if (error) { toast.error(T('فشل حذف العنوان.','Failed to delete the address.')); return; }
    setAddresses(prev => prev.filter(a => a.id !== addrId));
  };

  const handleSetDefault = async (addrId: string) => {
    const { error } = await customerService.setDefaultAddress(session.id, addrId);
    if (error) { toast.error(T('فشل تحديد العنوان الافتراضي.','Failed to set the default address.')); return; }
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === addrId })));
  };

  const switchTab    = (tab: ProfileTab) => { setActiveTab(tab); setSettingsPage(null); };
  const displayAvatarUrl = avatarPreview || savedAvatarUrl;
  const inSettingsPage   = settingsPage !== null;

  const SETTINGS_ITEMS = [
    { Icon: MapPin,      label: T('عناوين التوصيل','Addresses'), action: () => switchTab('addresses')           },
    { Icon: Wallet,      label: T('طرق الدفع','Payment methods'), action: () => setSettingsPage('payment')       },
    { Icon: Bell,        label: T('الإشعارات','Notifications'), action: () => setSettingsPage('notifications') },
    { Icon: Globe,       label: T('اللغة والمنطقة','Language & region'), action: () => setSettingsPage('language')      },
    { Icon: Shield,      label: T('الخصوصية والأمان','Privacy & security'), action: () => setSettingsPage('privacy')       },
    { Icon: Headphones,  label: T('المساعدة والدعم','Help & support'), action: () => setSettingsPage('support')       },
  ];

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'var(--bottom-safe-space)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="sr-only" onChange={handleAvatarFileChange} />

      <div className="fixed pointer-events-none" style={{ top: '-5%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(163,249,91,0.10)', filter: 'blur(140px)', zIndex: 0 }} />
      <div className="fixed pointer-events-none" style={{ bottom: '15%', right: '-8%', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(163,249,91,0.06)', filter: 'blur(110px)', zIndex: 0 }} />

      {/* ── Header ──────────────────────────────────────────── */}
      <header
        className="app-header-safe sticky top-0 z-40 glass-strong flex items-center justify-between px-4"
        style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))' }}
      >
        {inSettingsPage ? (
          <button
            onClick={() => setSettingsPage(null)}
            className="flex items-center gap-1 cursor-pointer"
            style={{ background: 'none', border: 'none', color: 'var(--color-primary-fixed)', fontSize: '14px', fontWeight: 500, padding: '8px 0' }}
          >
            <ChevronRight size={18} strokeWidth={2} />
            {T('رجوع','Back')}
          </button>
        ) : (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 cursor-pointer"
            style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '13px', padding: '8px 0' }}
          >
            <LogOut size={17} strokeWidth={2} />
            {T('خروج','Sign out')}
          </button>
        )}

        <h1 className="gradient-text font-bold" style={{ fontSize: '16px', letterSpacing: '-0.01em', textShadow: '0 0 20px rgba(163,249,91,0.25)' }}>
          {inSettingsPage && settingsPage ? t(SETTINGS_INFO[settingsPage].title) : t('profile.title')}
        </h1>

        <Bell size={22} color="var(--color-on-surface-variant)" strokeWidth={1.5} style={{ opacity: 0.6 }} />
      </header>

      {/* ── Tab strip ─────────────────────────────────────── */}
      {!inSettingsPage && (
        <div
          className="sticky z-30 glass-strong flex"
          style={{ top: 'calc(56px + env(safe-area-inset-top, 0px))' }}
        >
          {(['info', 'addresses'] as const).map(tab => {
            const isActive = activeTab === tab;
            const label    = tab === 'info' ? T('الملف الشخصي','Profile') : T('عناوين التوصيل','Addresses');
            const TabIcon  = tab === 'info' ? User : MapPin;
            return (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  background: 'none', border: 'none',
                  padding: '10px 0',
                  color: isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)',
                  fontSize: '13px', fontWeight: isActive ? 600 : 400,
                  borderBottom: isActive ? '2px solid var(--color-primary-fixed)' : '2px solid transparent',
                  transition: 'all 180ms',
                }}
              >
                <TabIcon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
                {label}
              </button>
            );
          })}
        </div>
      )}

      <main className="relative z-10 px-4 pt-4 pb-2 max-w-lg mx-auto space-y-3">

        {/* ══════════════════════════════════════════════════
            SETTINGS SUB-PAGE
        ══════════════════════════════════════════════════ */}
        {inSettingsPage && settingsPage && (
          <SettingsDetail page={settingsPage} onBack={() => setSettingsPage(null)} />
        )}

        {/* ══════════════════════════════════════════════════
            TAB: PROFILE INFO
        ══════════════════════════════════════════════════ */}
        {activeTab === 'info' && !inSettingsPage && (
          <>
            {profileLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} color="var(--color-primary-fixed)" strokeWidth={2} className="animate-spin" />
              </div>
            ) : (
              <>
                {/* ── HERO CARD — avatar + identity + tier only ── */}
                <div
                  className="glass-shine rounded-2xl relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
                    borderTop: '1px solid rgba(255,255,255,0.14)',
                    borderLeft: '1px solid rgba(255,255,255,0.07)',
                    borderRight: '1px solid rgba(255,255,255,0.07)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(163,249,91,0.06)',
                  }}
                >
                  {/* Inner specular */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)' }} />
                  {/* Lime glow accent top-right */}
                  <div className="pointer-events-none absolute" style={{ top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(163,249,91,0.12)', filter: 'blur(50px)' }} />
                  <div className="relative flex items-center gap-4 px-5 py-5">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-[84px] h-[84px] rounded-full overflow-hidden flex items-center justify-center"
                        style={{ background: 'rgba(163,249,91,0.07)', border: '2px solid rgba(163,249,91,0.45)', boxShadow: '0 0 0 4px rgba(163,249,91,0.06), 0 0 24px rgba(163,249,91,0.22)' }}
                      >
                        {displayAvatarUrl ? (
                          <img src={displayAvatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span style={{
                            fontSize: '30px', fontWeight: 900,
                            color: 'var(--color-primary-fixed)',
                            letterSpacing: '-0.02em', lineHeight: 1,
                            textShadow: '0 0 24px rgba(163,249,91,0.60)',
                            userSelect: 'none',
                          }}>
                            {(savedName || session.phone_number || 'م').charAt(0)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="absolute -bottom-0.5 -end-0.5 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                        style={{ background: 'var(--color-primary-fixed)', border: '2px solid #0b0e11', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                      >
                        {avatarUploading
                          ? <Loader2 size={12} color="#0c2000" strokeWidth={2.5} className="animate-spin" />
                          : <Camera size={12} color="#0c2000" strokeWidth={2.5} />
                        }
                      </button>
                    </div>
                    {/* Identity */}
                    <div className="flex-1 text-right">
                      <h2 style={{ color: 'white', fontSize: '17px', fontWeight: 700, letterSpacing: '-0.015em', marginBottom: '2px' }}>
                        {savedName || T('بدون اسم','No name')}
                      </h2>
                      <p dir="ltr" style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', marginBottom: '8px', letterSpacing: '0.01em' }}>
                        {session.phone_number}
                      </p>
                      <div className="premium-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(163,249,91,0.12)', border: '1px solid rgba(163,249,91,0.3)' }}>
                        <Crown size={11} color="var(--color-primary-fixed)" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 4px rgba(163,249,91,0.6))' }} />
                        <span style={{ color: 'var(--color-primary-fixed)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>Platinum Member</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── STATS ROW — separated from hero ── */}
                <div
                  className="glass-shine rounded-xl"
                  style={{
                    background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  <div className="grid grid-cols-3">
                    {[
                      { label: T('الطلبات','Orders'), value: '0' },
                      { label: T('المفضلة','Favorites'), value: '0' },
                      { label: T('النقاط','Points'),  value: '٢٬٤٥٠' },
                    ].map(({ label, value }, idx) => (
                      <div
                        key={label}
                        className="flex flex-col items-center justify-center py-4 gap-1"
                        style={{ borderRight: idx < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                      >
                        <span style={{
                          color: idx === 2 ? 'var(--color-primary-fixed)' : 'white',
                          fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em',
                          textShadow: idx === 2 ? '0 0 14px rgba(163,249,91,0.4)' : 'none',
                        }}>{value}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── LOYALTY PROGRESS — dedicated card ── */}
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    borderLeft: '1px solid rgba(255,255,255,0.05)',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(163,249,91,0.08)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1.5">
                      <Crown size={12} color="var(--color-primary-fixed)" strokeWidth={2} />
                      <span style={{ color: 'var(--color-primary-fixed)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>Platinum</span>
                    </div>
                    <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px' }}>٢٬٤٥٠ / ٥٬٠٠٠ نقطة للترقية التالية</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: '49%', background: 'linear-gradient(90deg, #a3f95b 0%, #88dc41 100%)', boxShadow: '0 0 12px rgba(163,249,91,0.55)', transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }}
                    />
                  </div>
                </div>

                {/* ── EDIT FORM ── */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    boxShadow: '0 8px 22px rgba(0,0,0,0.4)',
                  }}
                >
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <PenLine size={15} color="var(--color-primary-fixed)" strokeWidth={2} />
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{T('البيانات الشخصية','Personal information')}</span>
                  </div>

                  <div className="px-4 py-4 space-y-3.5">
                    <div className="field-group">
                      <label style={LBL}>{T('الاسم الكامل','Full name')}</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder={T('أدخل اسمك الكامل','Enter your full name')} className="profile-input" />
                    </div>
                    <div className="field-group">
                      <label style={LBL}>{T('البريد الإلكتروني','Email')}</label>
                      <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="your@email.com" dir="ltr" className="profile-input" />
                    </div>
                    <div className="field-group">
                      <label style={LBL}>{T('رقم الجوال','Phone number')}</label>
                      <div style={READ_ROW}>
                        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-on-surface-variant)', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.06em' }}>READ ONLY</span>
                        <p dir="ltr" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>{session.phone_number}</p>
                      </div>
                    </div>
                    {savedCreatedAt && (
                      <div className="field-group">
                        <label style={LBL}>{T('عضو منذ','Member since')}</label>
                        <div style={{ ...READ_ROW, justifyContent: 'flex-end' }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{formatJoinDate(savedCreatedAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status messages */}
                {profileError && (
                  <div className="status-banner status-banner--error">
                    <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span>{profileError}</span>
                  </div>
                )}
                {profileSuccess && (
                  <div className="status-banner status-banner--success">
                    <CheckCircle2 size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span>{T('تم حفظ البيانات بنجاح','Your details were saved')}</span>
                  </div>
                )}

                {/* Save button */}
                {(isDirty || pendingAvatarFile) && (
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] neon-glow-primary"
                    style={{ background: profileSaving ? 'rgba(163,249,91,0.5)' : 'var(--color-primary-fixed)', color: '#0c2000', fontSize: '14px', fontWeight: 700, border: 'none' }}
                  >
                    {profileSaving
                      ? <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
                      : <Save size={18} strokeWidth={2} />
                    }
                    {profileSaving ? T('جاري الحفظ...','Saving…') : T('حفظ التغييرات','Save changes')}
                  </button>
                )}

                {/* ── SETTINGS LIST ── */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    boxShadow: '0 8px 22px rgba(0,0,0,0.4)',
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="gradient-text font-bold" style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{T('الإعدادات','Settings')}</span>
                    <Settings size={16} color="var(--color-on-surface-variant)" strokeWidth={1.5} style={{ opacity: 0.4 }} />
                  </div>

                  {SETTINGS_ITEMS.map(({ Icon: ItemIcon, label, action }, idx, arr) => (
                    <button
                      key={label}
                      onClick={action}
                      className="w-full flex items-center justify-between px-4 cursor-pointer transition-all hover:bg-white/[0.03] active:bg-white/[0.06]"
                      style={{ background: 'transparent', border: 'none', borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', height: '52px' }}
                    >
                      <ChevronLeft size={16} color="rgba(255,255,255,0.25)" strokeWidth={2} />
                      <div className="flex items-center gap-3">
                        <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: '14px', fontWeight: 500 }}>{label}</span>
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(163,249,91,0.08)', border: '1px solid rgba(163,249,91,0.16)' }}
                        >
                          <ItemIcon size={17} color="var(--color-primary-fixed)" strokeWidth={1.75} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Sign out + version */}
                <div>
                  <button
                    onClick={onLogout}
                    className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: 'rgba(186,26,26,0.07)', border: '1px solid rgba(186,26,26,0.18)', color: 'var(--color-error)', fontSize: '14px', fontWeight: 600 }}
                  >
                    <LogOut size={18} strokeWidth={2} />
                    {T('تسجيل الخروج','Sign out')}
                  </button>
                  <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.14)', fontSize: '10px', letterSpacing: '0.05em' }}>
                    HAAT NOW v2.0 &middot; Luminous Precision
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: ADDRESSES
        ══════════════════════════════════════════════════ */}
        {activeTab === 'addresses' && !inSettingsPage && (
          <>
            {addrLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} color="var(--color-primary-fixed)" strokeWidth={2} className="animate-spin" />
              </div>
            ) : (
              <>
                {/* Add trigger */}
                {!showAddForm && !editingAddrId && (
                  <button
                    onClick={openAddForm}
                    className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: 'rgba(163,249,91,0.06)', border: '1.5px dashed rgba(163,249,91,0.25)', color: 'var(--color-primary-fixed)', fontSize: '13px', fontWeight: 600 }}
                  >
                    <MapPin size={17} strokeWidth={2} />
                    {T('إضافة عنوان جديد','Add a new address')}
                  </button>
                )}

                {/* Add / Edit form */}
                {(showAddForm || editingAddrId) && (
                  <form onSubmit={handleAddrSave} className="glass glass-shine rounded-xl p-4 space-y-3.5 animate-slide-up" style={{ border: '1px solid rgba(163,249,91,0.2)' }}>
                    <div className="flex items-center gap-2">
                      {editingAddrId
                        ? <MapPinned size={16} color="var(--color-primary-fixed)" strokeWidth={2} />
                        : <MapPin    size={16} color="var(--color-primary-fixed)" strokeWidth={2} />
                      }
                      <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                        {editingAddrId ? T('تعديل العنوان','Edit address') : T('عنوان جديد','New address')}
                      </h4>
                    </div>

                    {hasHierarchy ? (
                      <>
                        <div className="field-group">
                          <label style={LBL}>{T('الدولة','Country')}</label>
                          <div className="select-wrapper">
                            <select value={formCountryId} onChange={e => { setFormCountryId(e.target.value); setFormCityId(''); setFormZoneId(''); }} className="profile-select" required>
                              <option value="">{T("اختر الدولة","Select country")}</option>
                              {allCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        </div>
                        {formCountryId && (
                          <div className="field-group">
                            <label style={LBL}>{T('المدينة','City')}</label>
                            <div className="select-wrapper">
                              <select value={formCityId} onChange={e => { setFormCityId(e.target.value); setFormZoneId(''); }} className="profile-select" required>
                                <option value="">{T("اختر المدينة","Select city")}</option>
                                {citiesForCountry(formCountryId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                        {formCityId && (
                          <div className="field-group">
                            <label style={LBL}>{T('الحي / المنطقة','District / area')}</label>
                            <div className="select-wrapper">
                              <select value={formZoneId} onChange={e => setFormZoneId(e.target.value)} className="profile-select" required>
                                <option value="">{T("اختر الحي","Select district")}</option>
                                {availableZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="field-group">
                        <label style={LBL}>{T('الحي / المنطقة','District / area')}</label>
                        <div className="select-wrapper">
                          <select value={formZoneId} onChange={e => setFormZoneId(e.target.value)} className="profile-select" required>
                            <option value="">{T("اختر الحي","Select district")}</option>
                            {zonesData.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="field-group">
                      <label style={LBL}>{T('العنوان التفصيلي','Address details')}</label>
                      <input type="text" placeholder={T('مثال: شارع الأمير محمد، بناية 12','e.g. Prince Mohammed St, Building 12')} value={formLine} onChange={e => setFormLine(e.target.value)} className="profile-input" required />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {(['home', 'work', 'custom'] as const).map(lt => {
                        const active = formLabelType === lt;
                        return (
                          <button
                            key={lt} type="button" onClick={() => setFormLabelType(lt)}
                            className="px-3 py-1.5 rounded-full cursor-pointer transition-all"
                            style={{
                              background: active ? 'rgba(163,249,91,0.12)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid rgba(163,249,91,0.35)' : '1px solid rgba(255,255,255,0.07)',
                              color: active ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)',
                              fontSize: '12px', fontWeight: active ? 600 : 400,
                            }}
                          >{lt === 'home' ? T('المنزل','Home') : lt === 'work' ? T('العمل','Work') : T('موقع آخر','Other')}</button>
                        );
                      })}
                    </div>

                    {formLabelType === 'custom' && (
                      <div className="field-group">
                        <label style={LBL}>{T('اسم العنوان','Label')}</label>
                        <input type="text" placeholder={T('مثال: منزل العائلة','e.g. Family home')} value={formLabel} onChange={e => setFormLabel(e.target.value)} className="profile-input" />
                      </div>
                    )}

                    <div className="field-group">
                      <label style={LBL}>{T('ملاحظات للمندوب (اختياري)','Notes for the driver (optional)')}</label>
                      <input type="text" placeholder={T('مثال: الدور الثاني، بجوار المصعد','e.g. 2nd floor, next to the elevator')} value={formNotes} onChange={e => setFormNotes(e.target.value)} className="profile-input" />
                    </div>

                    {addrError && (
                      <div className="status-banner status-banner--error">
                        <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                        <span>{addrError}</span>
                      </div>
                    )}

                    <div className="flex gap-2.5">
                      <button type="button" onClick={cancelAddrForm} className="flex-1 h-11 rounded-xl cursor-pointer font-medium" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>{T('إلغاء','Cancel')}</button>
                      <button type="submit" disabled={addrSaving} className="flex-1 h-11 rounded-xl font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: addrSaving ? 'rgba(163,249,91,0.5)' : 'var(--color-primary-fixed)', color: '#0c2000', fontSize: '13px', fontWeight: 700, border: 'none' }}>
                        {addrSaving
                          ? <><Loader2 size={15} strokeWidth={2.5} className="animate-spin" />{T('حفظ','Save')}</>
                          : (editingAddrId ? T('حفظ التعديل','Save changes') : T('إضافة العنوان','Add address'))
                        }
                      </button>
                    </div>
                  </form>
                )}

                {/* Empty state */}
                {addresses.length === 0 && !showAddForm && !editingAddrId && (
                  <div className="glass rounded-xl p-5 flex flex-col items-center gap-2.5 text-center" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <MapPinOff size={26} color="var(--color-on-surface-variant)" strokeWidth={1.5} style={{ opacity: 0.25 }} />
                    </div>
                    <div>
                      <p style={{ color: 'white', fontSize: '15px', fontWeight: 600, marginBottom: '4px', letterSpacing: '-0.01em' }}>{T('لم تُضف أي عناوين بعد','No addresses added yet')}</p>
                      <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', lineHeight: 1.6 }}>{T('أضف عنوانك الأول لتسريع عملية الطلب والتوصيل','Add your first address to speed up ordering and delivery')}</p>
                    </div>
                  </div>
                )}

                {/* Address list */}
                {addresses.length > 0 && (
                  <div className="space-y-2.5">
                    {addresses.map(addr => {
                      if (editingAddrId === addr.id) return null;
                      const zoneLine = [addr.zones?.name, addr.zones?.cities?.name, addr.zones?.cities?.countries?.name].filter(Boolean).join(' · ');
                      return (
                        <div
                          key={addr.id}
                          className="glass glass-hover rounded-xl overflow-hidden"
                          style={{ border: addr.is_default ? '1px solid rgba(163,249,91,0.35)' : '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <div className="flex items-center justify-between px-4 pt-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => handleAddrDelete(addr.id)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-red-500/10" style={{ background: 'transparent', border: 'none' }}>
                                <Trash2 size={16} color="var(--color-error)" strokeWidth={2} />
                              </button>
                              <button onClick={() => openEditForm(addr)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-white/5" style={{ background: 'transparent', border: 'none' }}>
                                <Pencil size={16} color="var(--color-on-surface-variant)" strokeWidth={2} />
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {addr.is_default ? (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(163,249,91,0.1)', color: 'var(--color-primary-fixed)', border: '1px solid rgba(163,249,91,0.2)', fontSize: '11px' }}>{T('افتراضي','Default')}</span>
                              ) : (
                                <button onClick={() => handleSetDefault(addr.id)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', color: 'var(--color-on-surface-variant)', fontSize: '10px', padding: '2px 8px', cursor: 'pointer' }}>{T('تعيين افتراضي','Set default')}</button>
                              )}
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: addr.is_default ? 'rgba(163,249,91,0.1)' : 'rgba(255,255,255,0.04)' }}>
                                <MapPin size={14} color={addr.is_default ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)'} strokeWidth={2} />
                              </div>
                              <p style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{addr.label || T('عنوان','Address')}</p>
                            </div>
                          </div>

                          <div className="px-4 pt-2.5 pb-3 text-right">
                            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', lineHeight: 1.55 }}>{addr.address_line}</p>
                            {zoneLine && <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px', marginTop: '2px', opacity: 0.5 }}>{zoneLine}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

      </main>
    </div>
  );
};
