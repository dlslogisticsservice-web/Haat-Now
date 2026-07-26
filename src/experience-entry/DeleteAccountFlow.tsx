// ─────────────────────────────────────────────────────────────────────────────
// Delete Account Flow (Phase 8I · Apple App Store compliance PREPARATION — UI ONLY).
//
// Apple guideline 5.1.1(v): an app that supports account creation must let users initiate
// account deletion from within the app. This screen prepares that flow: Settings → Privacy &
// Security → Delete Account, with a warning, a data-deletion explanation, a confirmation dialog,
// and a final confirmation.
//
// ARCHITECTURE ONLY — no backend is connected and NO DATA IS DELETED. The final action calls a
// stubbed handler that records intent locally and shows a "prepared, not connected" state. Wiring
// a real deletion endpoint (auth, cascade, grace period) is a later, backend phase. No persistence.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { ShieldAlert, Trash2, ChevronRight, X, AlertTriangle, Lock } from 'lucide-react';

type Step = 'idle' | 'confirm' | 'final' | 'prepared';

const DELETED_DATA = [
  { ar: 'ملفك الشخصي ورقم هاتفك', en: 'Your profile and phone number' },
  { ar: 'الطلبات والعناوين المحفوظة', en: 'Order history and saved addresses' },
  { ar: 'رصيد المحفظة ووسائل الدفع', en: 'Wallet balance and payment methods' },
  { ar: 'التفضيلات والإشعارات', en: 'Preferences and notifications' },
];

export const DeleteAccountFlow: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'en' }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [step, setStep] = useState<Step>('idle');
  const [ack, setAck] = useState(false);

  const surface: React.CSSProperties = { background: 'var(--color-surface-container,#12181410)', border: '1px solid var(--color-outline-variant,#2a322c)', borderRadius: 14 };
  const overlay: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(0,0,0,.55)' };

  return (
    <div id="privacy_security_screen" dir={dir} style={{ minHeight: 640, background: 'var(--color-background,#0a0f0c)', color: 'var(--color-on-surface,#e8f0ea)', padding: 16, position: 'relative', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Settings ▸ Privacy & Security header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-on-surface-variant,#9fb0a6)', marginBottom: 10 }}>
        <span>{L('الإعدادات', 'Settings')}</span><ChevronRight size={13} /><span style={{ fontWeight: 700, color: 'var(--color-on-surface,#e8f0ea)' }}>{L('الخصوصية والأمان', 'Privacy & Security')}</span>
      </div>

      <div style={{ ...surface, padding: 4, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px' }}>
          <Lock size={16} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{L('البيانات والخصوصية', 'Data & Privacy')}</span>
        </div>
      </div>

      {/* Delete Account row */}
      <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--color-on-surface-variant,#9fb0a6)', margin: '2px 4px 6px' }}>{L('منطقة الخطر', 'Danger zone')}</p>
      <button id="delete_account_row" onClick={() => { setAck(false); setStep('confirm'); }}
        style={{ ...surface, width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'start', borderColor: 'rgba(255,107,107,.4)' }}>
        <Trash2 size={17} style={{ color: '#ff6b6b' }} />
        <span style={{ display: 'grid', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#ff6b6b' }}>{L('حذف الحساب', 'Delete Account')}</span>
          <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant,#9fb0a6)' }}>{L('حذف حسابك وبياناتك نهائياً', 'Permanently delete your account and data')}</span>
        </span>
        <ChevronRight size={15} style={{ color: 'var(--color-on-surface-variant,#9fb0a6)' }} />
      </button>

      {/* STEP 1 — confirmation dialog: warning + data-deletion explanation */}
      {step === 'confirm' && (
        <div id="delete_account_dialog" style={overlay}>
          <div id="delete_confirm_step1" style={{ ...surface, maxWidth: 340, width: '100%', padding: 18, background: 'var(--color-surface-container-high,#161d18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ShieldAlert size={20} style={{ color: '#ff6b6b' }} />
              <span style={{ fontSize: 15, fontWeight: 800 }}>{L('حذف حسابك؟', 'Delete your account?')}</span>
              <button id="delete_cancel_btn" onClick={() => setStep('idle')} style={{ marginInlineStart: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant,#9fb0a6)' }}><X size={16} /></button>
            </div>
            <p id="delete_warning" style={{ fontSize: 12, lineHeight: 1.55, color: '#ffb4b4', margin: '0 0 10px' }}>
              {L('هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم حذف حسابك وكل بياناتك بشكل دائم.', 'This action is permanent and cannot be undone. Your account and all of your data will be permanently deleted.')}
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface,#e8f0ea)', margin: '0 0 6px' }}>{L('سيتم حذف ما يلي:', 'The following will be deleted:')}</p>
            <ul id="delete_explanation" style={{ margin: '0 0 12px', paddingInlineStart: 18, display: 'grid', gap: 4 }}>
              {DELETED_DATA.map((d, i) => <li key={i} style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant,#9fb0a6)' }}>{L(d.ar, d.en)}</li>)}
            </ul>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, cursor: 'pointer', marginBottom: 14 }}>
              <input id="delete_ack" type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ marginTop: 2 }} />
              <span>{L('أفهم أن هذا الإجراء لا يمكن التراجع عنه.', 'I understand this action cannot be undone.')}</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('idle')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--color-outline-variant,#2a322c)', background: 'transparent', color: 'var(--color-on-surface,#e8f0ea)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{L('إلغاء', 'Cancel')}</button>
              <button id="delete_continue_btn" disabled={!ack} onClick={() => setStep('final')}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: ack ? '#ff6b6b' : 'rgba(255,107,107,.35)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: ack ? 'pointer' : 'not-allowed' }}>{L('متابعة', 'Continue')}</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — final confirmation */}
      {step === 'final' && (
        <div id="delete_account_dialog" style={overlay}>
          <div id="delete_confirm_final" style={{ ...surface, maxWidth: 340, width: '100%', padding: 18, background: 'var(--color-surface-container-high,#161d18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={20} style={{ color: '#ff6b6b' }} />
              <span style={{ fontSize: 15, fontWeight: 800 }}>{L('التأكيد النهائي', 'Final confirmation')}</span>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--color-on-surface-variant,#9fb0a6)', margin: '0 0 14px' }}>
              {L('اضغط «حذف نهائي» لتأكيد حذف حسابك. لا يمكن استعادة الحساب بعد ذلك.', 'Tap “Delete permanently” to confirm. Your account cannot be recovered afterwards.')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('idle')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--color-outline-variant,#2a322c)', background: 'transparent', color: 'var(--color-on-surface,#e8f0ea)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{L('إلغاء', 'Cancel')}</button>
              <button id="delete_final_btn" onClick={() => setStep('prepared')}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#ff3b3b', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>{L('حذف نهائي', 'Delete permanently')}</button>
            </div>
          </div>
        </div>
      )}

      {/* PREPARED state — no backend connected, no data deleted (compliance preparation only) */}
      {step === 'prepared' && (
        <div id="delete_account_dialog" style={overlay}>
          <div id="delete_prepared" style={{ ...surface, maxWidth: 340, width: '100%', padding: 18, background: 'var(--color-surface-container-high,#161d18)', textAlign: 'center' }}>
            <Lock size={22} style={{ color: 'var(--color-primary-fixed,#a3f95b)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, fontWeight: 800, margin: '0 0 6px' }}>{L('تم تجهيز مسار الحذف', 'Deletion flow prepared')}</p>
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-on-surface-variant,#9fb0a6)', margin: '0 0 14px' }}>
              {L('الواجهة جاهزة للمراجعة. لم يتم ربط الخادم ولم تُحذف أي بيانات.', 'The UI is ready for review. No backend is connected and no data was deleted.')}
            </p>
            <button onClick={() => setStep('idle')} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary-fixed,#a3f95b)', color: '#05230f', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>{L('تم', 'Done')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteAccountFlow;
