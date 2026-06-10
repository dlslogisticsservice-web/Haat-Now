import React, { useState } from 'react';
import { authService } from '../../services/auth.service';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; phone_number: string; role: string }) => void;
}

const GOOGLE_LOGO = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDbupKZkEB-5NrKOCMTxGgYZHrReUAdgg-BvQGyYALDpBHdLIlTIw_BDQl0pm1tgugDEDWPmLCr6oLrK2gFJj3gLCtWwTXehYGzwV6__C73Bc24EKFFUhUPpLkOu8TVwLu7rRwflBQ1gh6LbqkeZAM-m_eIiY2AqxwG1GRuZAkpOHYYgC7JprOYcLsKIahr54pbgN8shms5WwaJ7YPVH3LeYys8MggBrciMyeWdSnZI9ThpbkYRboqcCdfoS21q96ynnYlxxmRiHhs';

export const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpToken, setOtpToken]       = useState('');
  const [step, setStep]               = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading]         = useState(false);
  const [message, setMessage]         = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // ── Business logic unchanged ──────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setLoading(true);
    setMessage(null);
    const { error } = await authService.sendOtp(phoneNumber);
    setLoading(false);
    if (error) {
      setMessage({ text: `خطأ في إرسال الرمز: ${error.message || 'يرجى التحقق من رقم الهاتف'}`, type: 'error' });
    } else {
      setMessage({ text: 'تم إرسال رمز التحقق لجوالك بنجاح.', type: 'success' });
      setStep('otp');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken) return;
    setLoading(true);
    setMessage(null);
    const { data, error } = await authService.verifyOtp(phoneNumber, otpToken);
    setLoading(false);
    if (error) {
      setMessage({ text: `الرمز المدخل غير صحيح: ${error.message}`, type: 'error' });
    } else if (data.user) {
      onLoginSuccess({
        id: data.user.id,
        phone_number: data.user.phone_number,
        role: data.user.role,
      });
    }
  };

  return (
    <div
      id="login_screen_container"
      className="metallic-bg min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ paddingLeft: '24px', paddingRight: '24px' }}
    >
      {/* ── Atmospheric orbs — Stitch exact: bg-secondary/10 and bg-primary/5 ── */}
      <div
        className="fixed rounded-full pointer-events-none animate-neon-pulse"
        style={{
          top: '-10%', right: '-10%',
          width: '500px', height: '500px',
          background: 'rgba(161,214,103,0.1)',
          filter: 'blur(120px)',
        }}
      />
      <div
        className="fixed rounded-full pointer-events-none animate-neon-pulse"
        style={{
          bottom: '-10%', left: '-10%',
          width: '400px', height: '400px',
          background: 'rgba(255,255,255,0.05)',
          filter: 'blur(100px)',
        }}
      />

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex-grow flex flex-col items-center justify-center relative z-10 w-full" style={{ paddingTop: '32px', paddingBottom: '32px' }}>

        {/* Brand identity */}
        <div className="mb-section-gap text-center">
          <h1
            className="text-display-lg tracking-tighter font-bold"
            style={{ color: 'var(--color-primary)' }}
          >
            HAAT NOW
          </h1>
          <p
            className="text-body-md mt-2"
            style={{ color: 'var(--color-on-surface-variant)', opacity: 0.8, textTransform: 'none', letterSpacing: 0 }}
          >
            فخامة الخدمة بين يديك
          </p>
        </div>

        {/* Login card */}
        <div
          id="login_card"
          className="w-full glass-panel rounded-xl flex flex-col"
          style={{ maxWidth: '440px', padding: '32px', gap: '32px', display: 'flex', flexDirection: 'column' }}
        >

          {/* Card header */}
          <div className="text-center">
            <h2
              className="text-headline-sm font-semibold"
              style={{ color: 'var(--color-primary)', textTransform: 'none', letterSpacing: 0 }}
            >
              {step === 'phone' ? 'تسجيل الدخول' : 'تأكيد الرمز'}
            </h2>
            <p
              className="mt-2"
              style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}
            >
              {step === 'phone' ? 'أدخل رقم هاتفك للمتابعة' : `أُرسل رمز إلى ${phoneNumber}`}
            </p>
          </div>

          {/* Feedback message */}
          {message && (
            <div
              id="login_feedback"
              className="px-4 py-3 rounded-lg flex items-center gap-2"
              style={{
                background: message.type === 'error' ? 'rgba(255,180,171,0.08)' : 'rgba(163,249,91,0.08)',
                border: `1px solid ${message.type === 'error' ? 'rgba(255,180,171,0.2)' : 'rgba(163,249,91,0.2)'}`,
                color: message.type === 'error' ? 'var(--color-error)' : 'var(--color-secondary)',
                fontSize: '14px',
              }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
              >
                {message.type === 'error' ? 'error' : 'check_circle'}
              </span>
              <span style={{ textTransform: 'none', letterSpacing: 0 }}>{message.text}</span>
            </div>
          )}

          {/* ── PHONE STEP ─────────────────────────────────── */}
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} id="phone_form">

              {/* Phone cluster */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, paddingLeft: '4px', paddingRight: '4px' }}
                >
                  رقم الهاتف
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>

                  {/* Country selector */}
                  <div className="relative" style={{ flexShrink: 0 }}>
                    <select
                      id="country_select"
                      className="appearance-none rounded-lg h-14 px-4 text-body-md focus:outline-none transition-colors cursor-pointer"
                      style={{
                        width: '128px',
                        background: 'var(--color-surface-container)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--color-on-surface)',
                        paddingRight: '40px',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-secondary)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                      <option value="EG">🇪🇬 +20</option>
                      <option value="SA">🇸🇦 +966</option>
                      <option value="AE">🇦🇪 +971</option>
                      <option value="KW">🇰🇼 +965</option>
                    </select>
                    <span
                      className="material-symbols-outlined absolute top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ right: '12px', fontSize: '18px', color: 'var(--color-on-surface-variant)' }}
                    >expand_more</span>
                  </div>

                  {/* Phone number input */}
                  <input
                    type="tel"
                    placeholder="000 000 000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    id="phone_input"
                    className="flex-grow rounded-lg h-14 px-4 text-body-md focus:outline-none transition-all"
                    style={{
                      background: 'var(--color-surface-container)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--color-on-surface)',
                      direction: 'ltr',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-secondary)';
                      e.currentTarget.style.boxShadow = '0 0 0 1px rgba(161,214,103,0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  />
                </div>
              </div>

              {/* CTA button */}
              <button
                type="submit"
                disabled={loading}
                id="send_otp_btn"
                className="w-full h-14 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] neon-glow-primary disabled:opacity-60"
                style={{
                  background: 'var(--color-secondary)',
                  color: 'var(--color-on-secondary)',
                  fontSize: '20px',
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin-slow" style={{ fontSize: '20px' }}>refresh</span>
                ) : (
                  <>
                    إرسال رمز التحقق
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                  أو المتابعة عبر
                </span>
                <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>

              {/* Social logins */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className="h-14 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95 group hover:opacity-90"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-on-surface)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                >
                  <span
                    className="material-symbols-outlined group-hover:scale-110 transition-transform"
                    style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1", color: 'var(--color-on-surface)' }}
                  >apps</span>
                  <span>Apple</span>
                </button>
                <button
                  type="button"
                  className="h-14 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95 group hover:opacity-90"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-on-surface)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                >
                  <img
                    src={GOOGLE_LOGO}
                    alt="Google"
                    className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all"
                  />
                  <span>Google</span>
                </button>
              </div>
            </form>
          ) : (
            /* ── OTP STEP ─────────────────────────────────── */
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} id="otp_form">

              {/* 6-digit OTP boxes */}
              <div>
                <label
                  style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, display: 'block', marginBottom: '8px', paddingRight: '4px' }}
                >
                  رمز التحقق
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  id="otp_input"
                  className="w-full h-14 rounded-lg text-center text-body-lg font-bold tracking-[0.5em] focus:outline-none transition-all"
                  style={{
                    background: 'var(--color-surface-container)',
                    border: message?.type === 'error' ? '1px solid var(--color-error)' : '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--color-on-surface)',
                    direction: 'ltr',
                  }}
                  onFocus={(e) => {
                    if (message?.type !== 'error') {
                      e.currentTarget.style.borderColor = 'var(--color-secondary)';
                      e.currentTarget.style.boxShadow = '0 0 0 1px rgba(161,214,103,0.2)';
                    }
                  }}
                  onBlur={(e) => {
                    if (message?.type !== 'error') {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.boxShadow = '';
                    }
                  }}
                />
              </div>

              {/* Sandbox hint */}
              {(import.meta.env.VITE_AUTH_MODE === 'sandbox' || import.meta.env.MODE === 'development') && (
                <p
                  id="sandbox_hint"
                  className="text-center"
                  style={{ fontSize: '12px', color: 'var(--color-secondary)', textTransform: 'none', letterSpacing: 0 }}
                >
                  ✨ وضع التجربة: أدخل أي رمز من 6 أرقام
                </p>
              )}

              {/* Back + resend row */}
              <div className="flex items-center justify-between" style={{ fontSize: '14px' }}>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setMessage(null); setOtpToken(''); }}
                  className="hover:underline cursor-pointer"
                  style={{ color: 'var(--color-secondary)', textTransform: 'none', letterSpacing: 0 }}
                  id="back_to_phone"
                >
                  تغيير رقم الهاتف
                </button>
                <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                  لم يصلك الرمز؟
                </span>
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={loading || otpToken.length < 6}
                id="verify_otp_btn"
                className="w-full h-14 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] neon-glow-primary disabled:opacity-60"
                style={{
                  background: 'var(--color-secondary)',
                  color: 'var(--color-on-secondary)',
                  fontSize: '18px',
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin-slow" style={{ fontSize: '20px' }}>refresh</span>
                ) : (
                  <>
                    تأكيد تسجيل الدخول
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Legal footer — outside card, Stitch: mt-stack-lg = 32px */}
        <p
          className="text-center leading-relaxed"
          style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, marginTop: '32px' }}
        >
          من خلال الاستمرار، فإنك توافق على{' '}
          <span className="cursor-pointer hover:underline" style={{ color: 'var(--color-secondary)' }}>شروط الخدمة</span>
          {' '}و{' '}
          <span className="cursor-pointer hover:underline" style={{ color: 'var(--color-secondary)' }}>سياسة الخصوصية</span>
        </p>
      </main>

      {/* ── Bottom vignette — Stitch exact: gradient + metallic texture mix-blend-overlay ── */}
      <div
        className="fixed bottom-0 w-full pointer-events-none"
        style={{ right: 0, height: '33.333vh', opacity: 0.2 }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(161,214,103,0.2) 0%, transparent 100%)' }}
        />
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuB8p5BTe4f12yyFZiaRHYvJtnQAlkYHlS-lOQGZDtVcBNbZXdeZOSLdxZImEgIfZufrf0-3S17Q95_hFqs9dVDNYVr3PrxjlD_LI8w8h9fmAvcWeV0FwgZEF4U0CJBzc8JAv60WCGQUIrC1MHkHrLhoM31QP7UpfGn4zhdBiZkryDrOnjiHCRFOcGmUtC0Z1Ef1pKUBX34K8MKYFlDHFGg1d4XnVmlFIV9QluVSqsvmgRIOSilnyZJuk8id0QR5oMaFGkMjCsRZ19j0"
          alt=""
          className="w-full h-full object-cover"
          style={{ mixBlendMode: 'overlay' }}
        />
      </div>
    </div>
  );
};
