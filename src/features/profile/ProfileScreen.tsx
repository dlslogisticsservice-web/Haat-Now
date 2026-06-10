import React from 'react';

interface ProfileScreenProps {
  session: { id: string; phone_number: string; role: string };
  onLogout: () => void;
}

export const ProfileScreen = ({ session, onLogout }: ProfileScreenProps) => {
  return (
    <div className="min-h-screen metallic-bg" style={{ paddingBottom: '128px' }} dir="rtl">

      {/* Atmospheric orb */}
      <div
        className="fixed top-20 left-10 w-64 h-64 rounded-full animate-neon-pulse pointer-events-none"
        style={{ background: 'var(--color-primary-fixed)', filter: 'blur(80px)', opacity: 0.12, zIndex: 0 }}
      />

      {/* Sticky header */}
      <header
        className="sticky z-40 flex items-center justify-between px-4 h-16"
        style={{ top: '36px', background: 'rgba(17,20,23,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="material-symbols-outlined cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-on-surface-variant)' }}>settings</span>
        <h1 className="font-bold" style={{ color: 'var(--color-primary-fixed)', fontSize: '18px', textTransform: 'none', letterSpacing: 0 }}>
          حسابي
        </h1>
        <span className="material-symbols-outlined cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-on-surface-variant)' }}>notifications</span>
      </header>

      <main className="relative z-10 px-4 py-6 space-y-5">

        {/* Avatar + user info */}
        <div className="glass-panel rounded-xl p-6 flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 neon-glow-primary"
            style={{ background: 'rgba(163,249,91,0.1)', border: '2px solid rgba(163,249,91,0.3)' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '40px', color: 'var(--color-primary-fixed)', fontVariationSettings: "'FILL' 1" }}
            >account_circle</span>
          </div>
          <div className="flex-1 text-right">
            <p className="font-bold" style={{ color: 'white', fontSize: '18px', textTransform: 'none', letterSpacing: 0 }}>
              عميل هات ناو
            </p>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', marginTop: '4px', direction: 'ltr', textAlign: 'right' }}>
              {session.phone_number}
            </p>
            <div
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full mt-2"
              style={{ background: 'rgba(163,249,91,0.1)', border: '1px solid rgba(163,249,91,0.2)' }}
            >
              <span className="material-symbols-outlined"
                    style={{ fontSize: '14px', color: 'var(--color-primary-fixed)', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              <span style={{ color: 'var(--color-primary-fixed)', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>عضو بلاتيني</span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: 'receipt_long', label: 'الطلبات', value: '24' },
            { icon: 'favorite',     label: 'المفضلة', value: '8'  },
            { icon: 'stars',        label: 'النقاط',  value: '2,450' },
          ].map(({ icon, label, value }) => (
            <div key={label} className="glass-panel rounded-xl p-4 flex flex-col items-center gap-2">
              <span
                className="material-symbols-outlined"
                style={{ color: 'var(--color-primary-fixed)', fontSize: '24px', fontVariationSettings: "'FILL' 1" }}
              >{icon}</span>
              <span className="font-bold" style={{ color: 'white', fontSize: '18px' }}>{value}</span>
              <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Account settings */}
        <section>
          <h2 className="font-bold mb-3 text-right"
              style={{ color: 'white', fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}>
            إعدادات الحساب
          </h2>
          <div className="glass-panel rounded-xl overflow-hidden">
            {[
              { icon: 'location_on',           label: 'عناوين التوصيل',      badge: null    },
              { icon: 'account_balance_wallet', label: 'طرق الدفع',          badge: null    },
              { icon: 'notifications',         label: 'الإشعارات',           badge: '3'     },
              { icon: 'language',              label: 'اللغة',               badge: 'عربي'  },
              { icon: 'privacy_tip',           label: 'الخصوصية والأمان',    badge: null    },
              { icon: 'help',                  label: 'المساعدة والدعم',     badge: null    },
            ].map(({ icon, label, badge }, idx, arr) => (
              <button
                key={label}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors cursor-pointer"
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div className="flex items-center gap-2">
                  {badge && (
                    <span
                      className="px-2 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(163,249,91,0.15)', color: 'var(--color-primary-fixed)', fontSize: '11px' }}
                    >{badge}</span>
                  )}
                  <span className="material-symbols-outlined"
                        style={{ fontSize: '20px', color: 'var(--color-on-surface-variant)' }}>chevron_left</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'white', fontSize: '15px', textTransform: 'none', letterSpacing: 0 }}>{label}</span>
                  <span
                    className="material-symbols-outlined"
                    style={{ color: 'var(--color-primary-fixed)', fontSize: '22px', fontVariationSettings: "'FILL' 1" }}
                  >{icon}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* App version */}
        <p className="text-center" style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>
          HAAT NOW v1.0.0 ·{' '}
          <span style={{ color: 'var(--color-primary-fixed)' }}>Luminous Precision</span>
        </p>

        {/* Sign out */}
        <button
          onClick={onLogout}
          className="w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'rgba(186,26,26,0.15)', border: '1px solid rgba(186,26,26,0.3)', color: 'var(--color-error)', fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
          تسجيل الخروج
        </button>

      </main>
    </div>
  );
};
