// ─────────────────────────────────────────────────────────────────────────────
// Email template system — 12 production templates, Arabic + English, RTL-aware,
// responsive, dark-mode compatible (via the shared layout). Data-driven + pure, so
// every template is unit-testable and rendered identically wherever it runs.
//
// NOTE on auth emails: login_otp / email_verification / password_reset are SENT by
// Supabase Auth (GoTrue) via the configured SMTP (Resend). These renderers provide the
// canonical HTML to paste into the Supabase Auth email templates — they do NOT change
// authentication behavior. The remaining templates are sent via this platform.
// ─────────────────────────────────────────────────────────────────────────────
import type { EmailTemplateId, Locale, RenderedEmail } from './types';
import { renderLayout, renderText, esc, type LayoutBlocks } from './layout';

export type TemplateData = Record<string, string | number | undefined | null>;

const s = (d: TemplateData, k: string, fallback = ''): string => {
  const v = d[k];
  return v === undefined || v === null ? fallback : esc(String(v));
};

interface TemplateDef {
  subject: Record<Locale, (d: TemplateData) => string>;
  blocks: Record<Locale, (d: TemplateData) => LayoutBlocks>;
}

// Helper to build both-locale defs with less repetition.
const def = (
  subjAr: (d: TemplateData) => string, subjEn: (d: TemplateData) => string,
  arB: (d: TemplateData) => LayoutBlocks, enB: (d: TemplateData) => LayoutBlocks,
): TemplateDef => ({ subject: { ar: subjAr, en: subjEn }, blocks: { ar: arB, en: enB } });

export const TEMPLATES: Record<EmailTemplateId, TemplateDef> = {
  welcome: def(
    () => 'مرحبًا بك في هات الآن',
    () => 'Welcome to HAAT NOW',
    d => ({ heading: `أهلًا ${s(d, 'name', 'بك')} 👋`, lines: ['يسعدنا انضمامك إلى هات الآن — توصيل محلي سريع للطعام والبقالة والمزيد.', 'ابدأ أول طلب لك الآن واستمتع بتجربة فاخرة وسريعة.'], cta: d.url ? { label: 'ابدأ الآن', url: String(d.url) } : null }),
    d => ({ heading: `Welcome, ${s(d, 'name', 'there')} 👋`, lines: ['Thanks for joining HAAT NOW — fast local delivery for food, groceries and more.', 'Place your first order and enjoy a premium, fast experience.'], cta: d.url ? { label: 'Get started', url: String(d.url) } : null }),
  ),
  login_otp: def(
    () => 'رمز الدخول إلى هات الآن',
    () => 'Your HAAT NOW sign-in code',
    d => ({ heading: 'رمز تسجيل الدخول', lines: ['استخدم الرمز التالي لإكمال تسجيل الدخول. صالح لبضع دقائق فقط.'], highlight: s(d, 'otp', '------'), footnote: 'إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.' }),
    d => ({ heading: 'Your sign-in code', lines: ['Use the code below to finish signing in. It is valid for a few minutes only.'], highlight: s(d, 'otp', '------'), footnote: 'If you did not request this code, you can ignore this email.' }),
  ),
  email_verification: def(
    () => 'تأكيد بريدك الإلكتروني',
    () => 'Verify your email',
    d => ({ heading: 'تأكيد البريد الإلكتروني', lines: ['اضغط الزر أدناه لتأكيد عنوان بريدك الإلكتروني وتفعيل حسابك.'], cta: d.url ? { label: 'تأكيد البريد', url: String(d.url) } : null, footnote: 'إذا لم تنشئ حسابًا، تجاهل هذه الرسالة.' }),
    d => ({ heading: 'Verify your email', lines: ['Tap the button below to verify your email address and activate your account.'], cta: d.url ? { label: 'Verify email', url: String(d.url) } : null, footnote: 'If you did not create an account, you can ignore this email.' }),
  ),
  password_reset: def(
    () => 'إعادة تعيين كلمة المرور',
    () => 'Reset your password',
    d => ({ heading: 'إعادة تعيين كلمة المرور', lines: ['تلقّينا طلبًا لإعادة تعيين كلمة المرور. اضغط الزر أدناه للمتابعة.'], cta: d.url ? { label: 'إعادة التعيين', url: String(d.url) } : null, footnote: 'إذا لم تطلب ذلك، فحسابك آمن ويمكنك تجاهل الرسالة.' }),
    d => ({ heading: 'Reset your password', lines: ['We received a request to reset your password. Tap the button below to continue.'], cta: d.url ? { label: 'Reset password', url: String(d.url) } : null, footnote: 'If you did not request this, your account is safe — ignore this email.' }),
  ),
  merchant_invitation: def(
    () => 'دعوة للانضمام كتاجر في هات الآن',
    () => 'You are invited to join HAAT NOW as a merchant',
    d => ({ heading: 'دعوة تاجر', lines: [`تمت دعوتك للانضمام إلى هات الآن كمتجر${d.merchantName ? ` (${s(d, 'merchantName')})` : ''}.`, 'اقبل الدعوة لإعداد متجرك والبدء في استقبال الطلبات.'], cta: d.url ? { label: 'قبول الدعوة', url: String(d.url) } : null }),
    d => ({ heading: 'Merchant invitation', lines: [`You have been invited to join HAAT NOW as a merchant${d.merchantName ? ` (${s(d, 'merchantName')})` : ''}.`, 'Accept the invitation to set up your store and start receiving orders.'], cta: d.url ? { label: 'Accept invitation', url: String(d.url) } : null }),
  ),
  driver_invitation: def(
    () => 'دعوة للانضمام كسائق في هات الآن',
    () => 'You are invited to join HAAT NOW as a driver',
    d => ({ heading: 'دعوة كابتن', lines: ['تمت دعوتك للانضمام إلى أسطول كباتن هات الآن.', 'اقبل الدعوة لإكمال ملفك والبدء في التوصيل.'], cta: d.url ? { label: 'قبول الدعوة', url: String(d.url) } : null }),
    d => ({ heading: 'Driver invitation', lines: ['You have been invited to join the HAAT NOW driver fleet.', 'Accept the invitation to complete your profile and start delivering.'], cta: d.url ? { label: 'Accept invitation', url: String(d.url) } : null }),
  ),
  order_confirmation: def(
    d => `تأكيد الطلب #${s(d, 'orderId')}`,
    d => `Order confirmed #${s(d, 'orderId')}`,
    d => ({ heading: 'تم تأكيد طلبك ✅', lines: [`رقم الطلب: ${s(d, 'orderId')}`, `${d.merchantName ? `المتجر: ${s(d, 'merchantName')}` : ''}`, 'سنُعلمك بكل تحديث لحالة طلبك.'].filter(Boolean), highlight: d.total ? `${s(d, 'total')} ${s(d, 'currency', '')}` : null, cta: d.url ? { label: 'تتبع الطلب', url: String(d.url) } : null }),
    d => ({ heading: 'Your order is confirmed ✅', lines: [`Order number: ${s(d, 'orderId')}`, `${d.merchantName ? `Store: ${s(d, 'merchantName')}` : ''}`, 'We will keep you posted on every status update.'].filter(Boolean), highlight: d.total ? `${s(d, 'total')} ${s(d, 'currency', '')}` : null, cta: d.url ? { label: 'Track order', url: String(d.url) } : null }),
  ),
  order_delivered: def(
    d => `تم تسليم طلبك #${s(d, 'orderId')}`,
    d => `Delivered #${s(d, 'orderId')}`,
    d => ({ heading: 'تم تسليم طلبك 🎉', lines: [`رقم الطلب: ${s(d, 'orderId')}`, 'نتمنى أن تكون التجربة رائعة. يسعدنا تقييمك.'], cta: d.url ? { label: 'قيّم الطلب', url: String(d.url) } : null }),
    d => ({ heading: 'Your order was delivered 🎉', lines: [`Order number: ${s(d, 'orderId')}`, 'We hope it was great. We would love your rating.'], cta: d.url ? { label: 'Rate order', url: String(d.url) } : null }),
  ),
  payment_receipt: def(
    d => `إيصال الدفع — طلب #${s(d, 'orderId')}`,
    d => `Payment receipt — order #${s(d, 'orderId')}`,
    d => ({ heading: 'إيصال الدفع', lines: [`رقم الطلب: ${s(d, 'orderId')}`, `طريقة الدفع: ${s(d, 'method', 'الدفع عند الاستلام')}`], highlight: `${s(d, 'total')} ${s(d, 'currency', '')}`, footnote: 'احتفظ بهذا الإيصال لسجلاتك.' }),
    d => ({ heading: 'Payment receipt', lines: [`Order number: ${s(d, 'orderId')}`, `Payment method: ${s(d, 'method', 'Cash on delivery')}`], highlight: `${s(d, 'total')} ${s(d, 'currency', '')}`, footnote: 'Keep this receipt for your records.' }),
  ),
  support_ticket: def(
    d => `تذكرة الدعم #${s(d, 'ticketId')}`,
    d => `Support ticket #${s(d, 'ticketId')}`,
    d => ({ heading: 'تم استلام طلب الدعم', lines: [`رقم التذكرة: ${s(d, 'ticketId')}`, s(d, 'summary', 'سيتواصل معك فريق الدعم قريبًا.')], cta: d.url ? { label: 'عرض التذكرة', url: String(d.url) } : null }),
    d => ({ heading: 'We received your support request', lines: [`Ticket number: ${s(d, 'ticketId')}`, s(d, 'summary', 'Our support team will contact you shortly.')], cta: d.url ? { label: 'View ticket', url: String(d.url) } : null }),
  ),
  account_deleted: def(
    () => 'تم حذف حسابك',
    () => 'Your account was deleted',
    d => ({ heading: 'تم حذف الحساب', lines: [`تم حذف حساب هات الآن الخاص بك${d.name ? ` (${s(d, 'name')})` : ''} بناءً على طلبك.`, 'إذا لم تطلب ذلك، تواصل مع الدعم فورًا.'] }),
    d => ({ heading: 'Account deleted', lines: [`Your HAAT NOW account${d.name ? ` (${s(d, 'name')})` : ''} has been deleted as requested.`, 'If you did not request this, contact support immediately.'] }),
  ),
  admin_alert: def(
    d => `تنبيه: ${s(d, 'title', 'حدث تشغيلي')}`,
    d => `Alert: ${s(d, 'title', 'Operational event')}`,
    d => ({ heading: `تنبيه إداري — ${s(d, 'title', '')}`, lines: [s(d, 'body', 'حدث تشغيلي يتطلب انتباهك.'), d.severity ? `الخطورة: ${s(d, 'severity')}` : ''].filter(Boolean), cta: d.url ? { label: 'فتح لوحة التحكم', url: String(d.url) } : null }),
    d => ({ heading: `Admin alert — ${s(d, 'title', '')}`, lines: [s(d, 'body', 'An operational event needs your attention.'), d.severity ? `Severity: ${s(d, 'severity')}` : ''].filter(Boolean), cta: d.url ? { label: 'Open dashboard', url: String(d.url) } : null }),
  ),
};

/** Render a template to subject + HTML + text for a locale. */
export function renderEmail(id: EmailTemplateId, locale: Locale, data: TemplateData = {}): RenderedEmail {
  const t = TEMPLATES[id];
  const blocks = t.blocks[locale](data);
  return {
    subject: t.subject[locale](data),
    html: renderLayout(locale, blocks),
    text: renderText(locale, blocks),
  };
}

export const ALL_TEMPLATE_IDS = Object.keys(TEMPLATES) as EmailTemplateId[];
