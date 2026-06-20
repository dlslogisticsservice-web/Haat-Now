import React, { useState, useEffect, useRef } from 'react';
import { customerService, AddressWithZone, ZoneHierarchy } from '../../services/customer.service';
import { storageService } from '../../services/storage.service';
import {
  ChevronRight, ChevronLeft, LogOut, Bell, BellRing, User, MapPin, MapPinned,
  MapPinOff, Loader2, UserCircle2, Camera, Crown, PenLine, AlertCircle,
  CheckCircle2, Save, Settings, Trash2, Pencil, Wallet, Globe, Shield, Headphones,
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
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return 'يُسمح فقط بصور JPG أو PNG أو WebP';
  if (file.size > MAX_AVATAR_BYTES) return 'حجم الصورة يتجاوز الحد المسموح به (2 ميغابايت)';
  return null;
}

const SETTINGS_INFO: Record<SettingsPage, { Icon: LucideIcon; title: string; subtitle: string; hint: string }> = {
  payment:       { Icon: Wallet,      title: 'طرق الدفع',         subtitle: 'إدارة البطاقات وطرق الدفع المحفوظة',           hint: 'ستتوفر قريباً. يمكنك إضافة بطاقتك عند إتمام الطلب.' },
  notifications: { Icon: BellRing,   title: 'الإشعارات',          subtitle: 'تخصيص تنبيهات الطلبات والعروض والأخبار',        hint: 'ستتوفر قريباً. ستتلقى إشعارات حالة الطلب تلقائياً.' },
  language:      { Icon: Globe,      title: 'اللغة والمنطقة',      subtitle: 'اختيار لغة التطبيق وإعدادات المنطقة الزمنية',   hint: 'ستتوفر قريباً. اللغة الحالية: العربية.' },
  privacy:       { Icon: Shield,     title: 'الخصوصية والأمان',   subtitle: 'إدارة بياناتك وإعدادات أمان الحساب',            hint: 'ستتوفر قريباً. بياناتك محمية ومشفرة وآمنة.' },
  support:       { Icon: Headphones, title: 'المساعدة والدعم',    subtitle: 'تواصل مع فريق دعم هات ناو',                      hint: 'ستتوفر قريباً. للتواصل: support@hatnow.com' },
};

const LBL: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-on-surface-variant)',
  display: 'block', marginBottom: '5px',
};

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
    if (err) { setProfileError(err); return; }
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
        if (upErr || !url) { setProfileError('فشل رفع الصورة. تحقق من اتصالك وحاول مرة أخرى.'); return; }
        newAvatarUrl = url;
      }
      const payload: Record<string, string | null> = { full_name: editName.trim() || null, email: editEmail.trim() || null };
      if (newAvatarUrl !== savedAvatarUrl) payload.avatar_url = newAvatarUrl;
      const { error } = await customerService.updateProfile(session.id, payload);
      if (error) { setProfileError('فشل الحفظ. تحقق من اتصالك وحاول مرة أخرى.'); return; }
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

  const resetAddrForm  = () => { setFormLabel(''); setFormLine(''); setFormCountryId(''); setFormCityId(''); setFormZoneId(''); setAddrError(null); };
  const openAddForm    = () => { resetAddrForm(); setEditingAddrId(null); setShowAddForm(true); };
  const cancelAddrForm = () => { setShowAddForm(false); setEditingAddrId(null); resetAddrForm(); };

  const openEditForm = (addr: AddressWithZone) => {
    setFormLabel(addr.label || ''); setFormLine(addr.address_line || '');
    setFormCountryId(addr.zones?.cities?.countries?.id || '');
    setFormCityId(addr.zones?.cities?.id || '');
    setFormZoneId(addr.zone_id);
    setAddrError(null); setEditingAddrId(addr.id); setShowAddForm(false);
  };

  const handleAddrSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLine.trim()) { setAddrError('يرجى إدخال تفاصيل العنوان'); return; }
    if (!formZoneId)       { setAddrError('يرجى اختيار الحي أو المنطقة'); return; }
    setAddrSaving(true); setAddrError(null);
    try {
      const payload = { label: formLabel.trim() || 'عنواني', address_line: formLine.trim(), zone_id: formZoneId };
      if (editingAddrId) {
        const { error } = await customerService.updateAddress(editingAddrId, payload);
        if (error) { setAddrError('فشل تعديل العنوان. حاول مرة أخرى.'); return; }
      } else {
        const { error } = await customerService.createAddress(session.id, payload);
        if (error) { setAddrError('فشل حفظ العنوان. حاول مرة أخرى.'); return; }
      }
      await loadAddresses(); cancelAddrForm();
    } finally { setAddrSaving(false); }
  };

  const handleAddrDelete = async (addrId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العنوان؟')) return;
    const { error } = await customerService.deleteAddress(addrId);
    if (error) { alert('فشل حذف العنوان.'); return; }
    setAddresses(prev => prev.filter(a => a.id !== addrId));
  };

  const handleSetDefault = async (addrId: string) => {
    const { error } = await customerService.setDefaultAddress(session.id, addrId);
    if (error) { alert('فشل تحديد العنوان الافتراضي.'); return; }
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === addrId })));
  };

  const switchTab    = (tab: ProfileTab) => { setActiveTab(tab); setSettingsPage(null); };
  const displayAvatarUrl = avatarPreview || savedAvatarUrl;
  const inSettingsPage   = settingsPage !== null;

  const SETTINGS_ITEMS = [
    { Icon: MapPin,      label: 'عناوين التوصيل', action: () => switchTab('addresses')           },
    { Icon: Wallet,      label: 'طرق الدفع',       action: () => setSettingsPage('payment')       },
    { Icon: Bell,        label: 'الإشعارات',        action: () => setSettingsPage('notifications') },
    { Icon: Globe,       label: 'اللغة والمنطقة',   action: () => setSettingsPage('language')      },
    { Icon: Shield,      label: 'الخصوصية والأمان', action: () => setSettingsPage('privacy')       },
    { Icon: Headphones,  label: 'المساعدة والدعم',  action: () => setSettingsPage('support')       },
  ];

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(104px + env(safe-area-inset-bottom, 0px))' }} dir="rtl">

      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="sr-only" onChange={handleAvatarFileChange} />

      <div className="fixed pointer-events-none" style={{ top: '-5%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(163,249,91,0.10)', filter: 'blur(140px)', zIndex: 0 }} />
      <div className="fixed pointer-events-none" style={{ bottom: '15%', right: '-8%', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(163,249,91,0.06)', filter: 'blur(110px)', zIndex: 0 }} />

      {/* ── Header ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 glass-strong flex items-center justify-between px-4"
        style={{ height: '56px' }}
      >
        {inSettingsPage ? (
          <button
            onClick={() => setSettingsPage(null)}
            className="flex items-center gap-1 cursor-pointer"
            style={{ background: 'none', border: 'none', color: 'var(--color-primary-fixed)', fontSize: '14px', fontWeight: 500, padding: '8px 0' }}
          >
            <ChevronRight size={18} strokeWidth={2} />
            رجوع
          </button>
        ) : (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 cursor-pointer"
            style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '13px', padding: '8px 0' }}
          >
            <LogOut size={17} strokeWidth={2} />
            خروج
          </button>
        )}

        <h1 className="gradient-text font-bold" style={{ fontSize: '16px', letterSpacing: '-0.01em', textShadow: '0 0 20px rgba(163,249,91,0.25)' }}>
          {inSettingsPage && settingsPage ? SETTINGS_INFO[settingsPage].title : 'حسابي'}
        </h1>

        <Bell size={22} color="var(--color-on-surface-variant)" strokeWidth={1.5} style={{ opacity: 0.6 }} />
      </header>

      {/* ── Tab strip ─────────────────────────────────────── */}
      {!inSettingsPage && (
        <div
          className="sticky z-30 glass-strong flex"
          style={{ top: '56px' }}
        >
          {(['info', 'addresses'] as const).map(tab => {
            const isActive = activeTab === tab;
            const label    = tab === 'info' ? 'الملف الشخصي' : 'عناوين التوصيل';
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
        {inSettingsPage && settingsPage && (() => {
          const PageIcon = SETTINGS_INFO[settingsPage].Icon;
          return (
            <div className="settings-placeholder animate-fade-in">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(163,249,91,0.07)', border: '1px solid rgba(163,249,91,0.15)' }}
              >
                <PageIcon size={30} color="var(--color-primary-fixed)" strokeWidth={1.5} />
              </div>

              <div>
                <h2 style={{ color: 'white', fontSize: '17px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '4px' }}>
                  {SETTINGS_INFO[settingsPage].title}
                </h2>
                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', lineHeight: 1.55 }}>
                  {SETTINGS_INFO[settingsPage].subtitle}
                </p>
              </div>

              <div className="w-full max-w-xs rounded-xl px-4 py-3.5" style={{ background: 'rgba(163,249,91,0.04)', border: '1px solid rgba(163,249,91,0.1)' }}>
                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', lineHeight: 1.65 }}>
                  {SETTINGS_INFO[settingsPage].hint}
                </p>
              </div>

              <button
                onClick={() => setSettingsPage(null)}
                className="flex items-center gap-1.5 px-5 h-11 rounded-xl cursor-pointer"
                style={{ background: 'rgba(163,249,91,0.09)', border: '1px solid rgba(163,249,91,0.18)', color: 'var(--color-primary-fixed)', fontSize: '14px', fontWeight: 600 }}
              >
                <ChevronRight size={17} strokeWidth={2} />
                العودة
              </button>
            </div>
          );
        })()}

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
                        {savedName || 'بدون اسم'}
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
                      { label: 'الطلبات', value: '0' },
                      { label: 'المفضلة', value: '0' },
                      { label: 'النقاط',  value: '٢٬٤٥٠' },
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
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>البيانات الشخصية</span>
                  </div>

                  <div className="px-4 py-4 space-y-3.5">
                    <div className="field-group">
                      <label style={LBL}>الاسم الكامل</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="أدخل اسمك الكامل" className="profile-input" />
                    </div>
                    <div className="field-group">
                      <label style={LBL}>البريد الإلكتروني</label>
                      <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="your@email.com" dir="ltr" className="profile-input" />
                    </div>
                    <div className="field-group">
                      <label style={LBL}>رقم الجوال</label>
                      <div style={READ_ROW}>
                        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-on-surface-variant)', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.06em' }}>READ ONLY</span>
                        <p dir="ltr" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>{session.phone_number}</p>
                      </div>
                    </div>
                    {savedCreatedAt && (
                      <div className="field-group">
                        <label style={LBL}>عضو منذ</label>
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
                    <span>تم حفظ البيانات بنجاح</span>
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
                    {profileSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
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
                    <span className="gradient-text font-bold" style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>الإعدادات</span>
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
                    تسجيل الخروج
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
                    إضافة عنوان جديد
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
                        {editingAddrId ? 'تعديل العنوان' : 'عنوان جديد'}
                      </h4>
                    </div>

                    {hasHierarchy ? (
                      <>
                        <div className="field-group">
                          <label style={LBL}>الدولة</label>
                          <div className="select-wrapper">
                            <select value={formCountryId} onChange={e => { setFormCountryId(e.target.value); setFormCityId(''); setFormZoneId(''); }} className="profile-select" required>
                              <option value="">اختر الدولة</option>
                              {allCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        </div>
                        {formCountryId && (
                          <div className="field-group">
                            <label style={LBL}>المدينة</label>
                            <div className="select-wrapper">
                              <select value={formCityId} onChange={e => { setFormCityId(e.target.value); setFormZoneId(''); }} className="profile-select" required>
                                <option value="">اختر المدينة</option>
                                {citiesForCountry(formCountryId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                        {formCityId && (
                          <div className="field-group">
                            <label style={LBL}>الحي / المنطقة</label>
                            <div className="select-wrapper">
                              <select value={formZoneId} onChange={e => setFormZoneId(e.target.value)} className="profile-select" required>
                                <option value="">اختر الحي</option>
                                {availableZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="field-group">
                        <label style={LBL}>الحي / المنطقة</label>
                        <div className="select-wrapper">
                          <select value={formZoneId} onChange={e => setFormZoneId(e.target.value)} className="profile-select" required>
                            <option value="">اختر الحي</option>
                            {zonesData.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="field-group">
                      <label style={LBL}>العنوان التفصيلي</label>
                      <input type="text" placeholder="مثال: شارع الأمير محمد، بناية 12" value={formLine} onChange={e => setFormLine(e.target.value)} className="profile-input" required />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {['المنزل', 'العمل', 'موقع آخر'].map(l => (
                        <button
                          key={l} type="button" onClick={() => setFormLabel(formLabel === l ? '' : l)}
                          className="px-3 py-1.5 rounded-full cursor-pointer transition-all"
                          style={{
                            background: formLabel === l ? 'rgba(163,249,91,0.12)' : 'rgba(255,255,255,0.04)',
                            border: formLabel === l ? '1px solid rgba(163,249,91,0.35)' : '1px solid rgba(255,255,255,0.07)',
                            color: formLabel === l ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)',
                            fontSize: '12px', fontWeight: formLabel === l ? 600 : 400,
                          }}
                        >{l}</button>
                      ))}
                    </div>

                    {addrError && (
                      <div className="status-banner status-banner--error">
                        <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                        <span>{addrError}</span>
                      </div>
                    )}

                    <div className="flex gap-2.5">
                      <button type="button" onClick={cancelAddrForm} className="flex-1 h-11 rounded-xl cursor-pointer font-medium" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>إلغاء</button>
                      <button type="submit" disabled={addrSaving} className="flex-1 h-11 rounded-xl font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: addrSaving ? 'rgba(163,249,91,0.5)' : 'var(--color-primary-fixed)', color: '#0c2000', fontSize: '13px', fontWeight: 700, border: 'none' }}>
                        {addrSaving
                          ? <><Loader2 size={15} strokeWidth={2.5} className="animate-spin" />حفظ</>
                          : (editingAddrId ? 'حفظ التعديل' : 'إضافة العنوان')
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
                      <p style={{ color: 'white', fontSize: '15px', fontWeight: 600, marginBottom: '4px', letterSpacing: '-0.01em' }}>لم تُضف أي عناوين بعد</p>
                      <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', lineHeight: 1.6 }}>أضف عنوانك الأول لتسريع عملية الطلب والتوصيل</p>
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
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(163,249,91,0.1)', color: 'var(--color-primary-fixed)', border: '1px solid rgba(163,249,91,0.2)', fontSize: '11px' }}>افتراضي</span>
                              ) : (
                                <button onClick={() => handleSetDefault(addr.id)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', color: 'var(--color-on-surface-variant)', fontSize: '10px', padding: '2px 8px', cursor: 'pointer' }}>تعيين افتراضي</button>
                              )}
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: addr.is_default ? 'rgba(163,249,91,0.1)' : 'rgba(255,255,255,0.04)' }}>
                                <MapPin size={14} color={addr.is_default ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)'} strokeWidth={2} />
                              </div>
                              <p style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{addr.label || 'عنوان'}</p>
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
