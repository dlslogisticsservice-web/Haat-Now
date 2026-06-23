import React, { useState, useRef } from 'react';
import { authService } from '../../services/auth.service';
import {
  RefreshCw, ChevronLeft, CheckCircle2, AlertCircle,
  ChevronDown, Smartphone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GOOGLE_LOGO = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDbupKZkEB-5NrKOCMTxGgYZHrReUAdgg-BvQGyYALDpBHdLIlTIw_BDQl0pm1tgugDEDWPmLCr6oLrK2gFJj3gLCtWwTXehYGzwV6__C73Bc24EKFFUhUPpLkOu8TVwLu7rRwflBQ1gh6LbqkeZAM-m_eIiY2AqxwG1GRuZAkpOHYYgC7JprOYcLsKIahr54pbgN8shms5WwaJ7YPVH3LeYys8MggBrciMyeWdSnZI9ThpbkYRboqcCdfoS21q96ynnYlxxmRiHhs';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; phone_number: string; role: string }) => void;
}

export const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpDigits,   setOtpDigits]   = useState(['', '', '', '', '', '']);
  const [step,        setStep]        = useState<'phone' | 'otp'>('phone');
  const [loading,     setLoading]     = useState(false);
  const [message,     setMessage]     = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);

  // Derived — business logic callers use this string
  const otpToken = otpDigits.join('');

  // ── Business logic unchanged ──────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setLoading(true);
    setMessage(null);
    const { error } = await authService.sendOtp(phoneNumber);
    setLoading(false);
    if (error) {
      setMessage({ text: t('auth.sendError'), type: 'error' });
    } else {
      setMessage({ text: t('auth.otpSent'), type: 'success' });
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
      setMessage({ text: t('auth.invalidCode'), type: 'error' });
    } else if (data.user) {
      onLoginSuccess({
        id: data.user.id,
        phone_number: data.user.phone_number,
        role: data.user.role,
      });
    }
  };

  // ── OTP digit management ──────────────────────────────────
  const handleOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const next = [...otpDigits];
      next[index - 1] = '';
      setOtpDigits(next);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    pasted.split('').forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setOtpDigits(next);
    const firstEmpty = next.findIndex(d => d === '');
    const focusIdx = firstEmpty === -1 ? 5 : firstEmpty;
    setTimeout(() => otpRefs.current[focusIdx]?.focus(), 0);
  };

  const resetOtp = () => {
    setOtpDigits(['', '', '', '', '', '']);
    setStep('phone');
    setMessage(null);
  };

  return (
    <div
      id="login_screen_container"
      className="metallic-bg min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ paddingLeft: '24px', paddingRight: '24px' }}
    >
      {/* ── Atmospheric orbs ──────────────────────────────── */}
      <div
        className="fixed rounded-full pointer-events-none animate-neon-pulse"
        style={{ top: '-10%', right: '-10%', width: '500px', height: '500px', background: 'rgba(161,214,103,0.1)', filter: 'blur(120px)' }}
      />
      <div
        className="fixed rounded-full pointer-events-none animate-neon-pulse"
        style={{ bottom: '-10%', left: '-10%', width: '400px', height: '400px', background: 'rgba(255,255,255,0.05)', filter: 'blur(100px)' }}
      />
      <div
        className="fixed rounded-full pointer-events-none"
        style={{ top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '300px', background: 'radial-gradient(ellipse, rgba(163,249,91,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      {/* ── Main content ──────────────────────────────────── */}
      <main
        className="flex-grow flex flex-col items-center justify-center relative z-10 w-full"
        style={{ paddingTop: '32px', paddingBottom: '32px' }}
      >

        {/* Brand identity */}
        <div className="mb-8 text-center animate-fade-in-up">
          <h1
            dir="ltr"
            className="text-display-lg tracking-tighter font-bold"
            style={{ letterSpacing: '-0.04em', fontWeight: 800, lineHeight: 1 }}
          >
            <span style={{
              background: 'linear-gradient(180deg, #e8e9eb 0%, #b1b2b4 50%, #7d7f83 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>HAAT</span>
            {' '}
            <span style={{ display: 'inline-block', filter: 'drop-shadow(0 0 20px rgba(158,212,66,0.55)) drop-shadow(0 0 60px rgba(158,212,66,0.25))' }}>
              <span style={{
                background: 'linear-gradient(180deg, #c4e562 0%, #9ed442 50%, #7fb822 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>NOW</span>
            </span>
          </h1>
          <p
            className="mt-3"
            style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', letterSpacing: '0.14em', opacity: 0.75 }}
          >
            {t('auth.tagline')}
          </p>
        </div>

        {/* Login card */}
        <div
          id="login_card"
          className="w-full glass glass-shine animate-fade-in-up"
          style={{
            maxWidth: '440px',
            padding: '32px',
            gap: '28px',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '28px',
            animationDelay: '0.08s',
          }}
        >

          {/* Card header */}
          <div className="text-center">
            <h2
              className="font-bold"
              style={{
                color: 'var(--color-primary-fixed)',
                fontSize: '20px',
                letterSpacing: '-0.015em',
                textShadow: '0 0 24px rgba(163,249,91,0.35)',
              }}
            >
              {step === 'phone' ? t('auth.signIn') : t('auth.confirmCode')}
            </h2>
            <p
              className="mt-2"
              style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.55 }}
            >
              {step === 'phone'
                ? t('auth.enterPhone')
                : `${t('auth.codeSentTo')} ${phoneNumber}`}
            </p>
          </div>

          {/* Feedback message */}
          {message && (
            <div
              id="login_feedback"
              className="px-4 py-3 rounded-xl flex items-center gap-2.5"
              style={{
                background: message.type === 'error' ? 'rgba(255,180,171,0.08)' : 'rgba(163,249,91,0.08)',
                border: `1px solid ${message.type === 'error' ? 'rgba(255,180,171,0.22)' : 'rgba(163,249,91,0.22)'}`,
                color: message.type === 'error' ? 'var(--color-error)' : 'var(--color-secondary)',
                fontSize: '14px',
              }}
            >
              {message.type === 'error'
                ? <AlertCircle  size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                : <CheckCircle2 size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              }
              <span>{message.text}</span>
            </div>
          )}

          {/* ── PHONE STEP ─────────────────────────────────── */}
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} id="phone_form">

              {/* Phone cluster */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em',
                    textTransform: 'uppercase', color: 'var(--color-on-surface-variant)',
                    paddingRight: '4px',
                  }}
                >
                  {t('auth.phoneLabel')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>

                  {/* Country selector */}
                  <div className="relative" style={{ flexShrink: 0 }}>
                    <select
                      id="country_select"
                      className="appearance-none h-14 px-4 transition-colors cursor-pointer input-silver"
                      style={{ width: '128px', borderRadius: '16px', paddingRight: '36px' }}
                    >
                      <option value="EG">🇪🇬 +20</option>
                      <option value="SA">🇸🇦 +966</option>
                      <option value="AE">🇦🇪 +971</option>
                      <option value="KW">🇰🇼 +965</option>
                    </select>
                    <ChevronDown
                      size={15}
                      className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: '12px', color: 'var(--color-on-surface-variant)' }}
                    />
                  </div>

                  {/* Phone number input */}
                  <input
                    type="tel"
                    placeholder="000 000 000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    id="phone_input"
                    className="flex-grow h-14 px-4 transition-all input-silver"
                    style={{ borderRadius: '16px', direction: 'ltr' }}
                  />
                </div>
              </div>

              {/* Primary CTA */}
              <button
                type="submit"
                disabled={loading}
                id="send_otp_btn"
                className="w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] neon-glow disabled:opacity-60"
                style={{
                  background: 'var(--color-primary-fixed)',
                  color: 'var(--color-on-primary-fixed)',
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              >
                {loading
                  ? <RefreshCw size={20} className="animate-spin" strokeWidth={2} />
                  : (
                    <>
                      <span>{t('auth.sendCode')}</span>
                      <ChevronLeft size={20} strokeWidth={2.5} />
                    </>
                  )
                }
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 py-1">
                <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', letterSpacing: '0.06em' }}>
                  {t('auth.orContinueWith')}
                </span>
                <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.09)' }} />
              </div>

              {/* Social logins */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="h-12 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 social-btn"
                  style={{ color: 'var(--color-on-surface)', fontSize: '14px', fontWeight: 500 }}
                >
                  <Smartphone size={18} strokeWidth={1.75} color="var(--color-on-surface-variant)" />
                  <span>Apple</span>
                </button>
                <button
                  type="button"
                  className="h-12 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 social-btn"
                  style={{ color: 'var(--color-on-surface)', fontSize: '14px', fontWeight: 500 }}
                >
                  <img src={GOOGLE_LOGO} alt="G" className="w-5 h-5 grayscale" style={{ flexShrink: 0 }} />
                  <span>Google</span>
                </button>
              </div>
            </form>

          ) : (

            /* ── OTP STEP ─────────────────────────────────── */
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} id="otp_form">

              {/* 6 individual digit boxes */}
              <div>
                <label
                  style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em',
                    textTransform: 'uppercase', display: 'block', marginBottom: '14px',
                    color: 'var(--color-on-surface-variant)', paddingRight: '4px',
                  }}
                >
                  {t('auth.otpTitle')}
                </label>
                <div className="flex gap-2.5 justify-center" dir="ltr" id="otp_boxes">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { otpRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpDigit(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      className="input-silver otp-digit text-center font-bold"
                      id={`otp_digit_${idx}`}
                      style={{
                        width: '46px',
                        height: '58px',
                        borderRadius: '14px',
                        fontSize: '24px',
                        letterSpacing: 0,
                        color: digit ? 'var(--color-primary-fixed)' : '#f2f4f6',
                        boxShadow: digit
                          ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 14px rgba(163,249,91,0.18), 0 2px 8px rgba(0,0,0,0.3)'
                          : undefined,
                        transition: 'all 150ms ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Sandbox hint */}
              {import.meta.env.VITE_AUTH_MODE === 'sandbox' && (
                <p
                  id="sandbox_hint"
                  className="text-center"
                  style={{ fontSize: '12px', color: 'var(--color-secondary)' }}
                >
                  {t('auth.sandboxHint')}
                </p>
              )}

              {/* Back + resend row */}
              <div className="flex items-center justify-between" style={{ fontSize: '13px' }}>
                <button
                  type="button"
                  onClick={resetOtp}
                  className="hover:underline cursor-pointer"
                  style={{ color: 'var(--color-secondary)', background: 'none', border: 'none', padding: 0 }}
                  id="back_to_phone"
                >
                  {t('auth.changeNumber')}
                </button>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>
                  {t('auth.noCode')}
                </span>
              </div>

              {/* Primary CTA */}
              <button
                type="submit"
                disabled={loading || otpToken.length < 6}
                id="verify_otp_btn"
                className="w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] neon-glow disabled:opacity-60"
                style={{
                  background: 'var(--color-primary-fixed)',
                  color: 'var(--color-on-primary-fixed)',
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              >
                {loading
                  ? <RefreshCw size={20} className="animate-spin" strokeWidth={2} />
                  : (
                    <>
                      <span>{t('auth.verify')}</span>
                      <ChevronLeft size={20} strokeWidth={2.5} />
                    </>
                  )
                }
              </button>
            </form>
          )}

        </div>

        {/* Legal footer */}
        <p
          className="text-center leading-relaxed animate-fade-in-up"
          style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '28px', animationDelay: '0.18s' }}
        >
          {t('auth.terms1')}{' '}
          <span className="cursor-pointer hover:underline" style={{ color: 'var(--color-secondary)' }}>{t('auth.termsLink')}</span>
          {' '}{t('auth.and2')}{' '}
          <span className="cursor-pointer hover:underline" style={{ color: 'var(--color-secondary)' }}>{t('auth.privacyLink')}</span>
        </p>
      </main>

      {/* Bottom vignette */}
      <div
        className="fixed bottom-0 w-full pointer-events-none"
        style={{ right: 0, height: '33.333vh', opacity: 0.18 }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(161,214,103,0.2) 0%, transparent 100%)' }}
        />
      </div>
    </div>
  );
};
