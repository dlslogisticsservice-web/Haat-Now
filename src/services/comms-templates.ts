// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — communication templates (production). Bilingual (AR/EN) catalog for
// transactional email, SMS, push and marketing messages across the order lifecycle
// and onboarding. Templates use {{variables}} filled by the sending service; nothing
// here is fabricated data. `render()` substitutes variables and picks the locale.
// ─────────────────────────────────────────────────────────────────────────────

export type CommsChannel = 'email' | 'sms' | 'push';
export type CommsCategory = 'transactional' | 'auth' | 'merchant' | 'driver' | 'marketing';

export interface CommsTemplate {
  key: string;
  channel: CommsChannel;
  category: CommsCategory;
  vars: string[];
  subjectAr?: string; subjectEn?: string;  // email + push title
  bodyAr: string; bodyEn: string;
}

export const COMMS_TEMPLATES: CommsTemplate[] = [
  // ── Auth ──
  { key: 'otp', channel: 'sms', category: 'auth', vars: ['code'],
    bodyAr: 'رمز تأكيد هات الآن: {{code}}. لا تُشاركه مع أحد. صالح لـ 5 دقائق.',
    bodyEn: 'Your HAAT NOW verification code is {{code}}. Do not share it. Valid for 5 minutes.' },

  // ── Transactional: order lifecycle ──
  { key: 'order_confirmed', channel: 'push', category: 'transactional', vars: ['orderId', 'merchant'],
    subjectAr: 'تم استلام طلبك', subjectEn: 'Order received',
    bodyAr: 'استلمنا طلبك #{{orderId}} من {{merchant}}. سنخبرك عند قبوله.',
    bodyEn: 'We’ve received your order #{{orderId}} from {{merchant}}. We’ll let you know when it’s accepted.' },
  { key: 'order_accepted', channel: 'push', category: 'transactional', vars: ['orderId', 'eta'],
    subjectAr: 'جارٍ تحضير طلبك', subjectEn: 'Your order is being prepared',
    bodyAr: 'قبل المتجر طلبك #{{orderId}} ويحضّره الآن. الوصول المتوقّع خلال {{eta}}.',
    bodyEn: 'The store accepted order #{{orderId}} and is preparing it. Estimated arrival in {{eta}}.' },
  { key: 'order_on_the_way', channel: 'push', category: 'transactional', vars: ['orderId', 'captain'],
    subjectAr: 'طلبك في الطريق', subjectEn: 'Your order is on the way',
    bodyAr: 'الكابتن {{captain}} في طريقه إليك بطلب #{{orderId}}. تابعه مباشرةً في التطبيق.',
    bodyEn: 'Captain {{captain}} is on the way with order #{{orderId}}. Track it live in the app.' },
  { key: 'order_delivered', channel: 'push', category: 'transactional', vars: ['orderId'],
    subjectAr: 'تم توصيل طلبك', subjectEn: 'Order delivered',
    bodyAr: 'تم توصيل طلبك #{{orderId}}. بالهناء والشفاء! قيّم تجربتك في ثوانٍ.',
    bodyEn: 'Your order #{{orderId}} has been delivered. Enjoy! Rate your experience in seconds.' },
  { key: 'order_cancelled', channel: 'email', category: 'transactional', vars: ['orderId', 'reason'],
    subjectAr: 'تم إلغاء طلبك #{{orderId}}', subjectEn: 'Your order #{{orderId}} was cancelled',
    bodyAr: 'نأسف — تم إلغاء طلبك #{{orderId}}. السبب: {{reason}}. لم تُحاسَب، وأي مبلغ مدفوع يُردّ بالكامل. نحن هنا للمساعدة على hello@haatnow.app.',
    bodyEn: 'We’re sorry — your order #{{orderId}} was cancelled. Reason: {{reason}}. You were not charged, and any amount paid is refunded in full. We’re here to help at hello@haatnow.app.' },
  { key: 'refund_issued', channel: 'email', category: 'transactional', vars: ['orderId', 'amount', 'method'],
    subjectAr: 'تم إصدار استرداد لطلبك #{{orderId}}', subjectEn: 'A refund was issued for order #{{orderId}}',
    bodyAr: 'أصدرنا استرداداً بقيمة {{amount}} لطلبك #{{orderId}} عبر {{method}}. قد يستغرق ظهوره وقتاً حسب وسيلتك. شكراً لتفهّمك.',
    bodyEn: 'We’ve issued a {{amount}} refund for order #{{orderId}} via {{method}}. It may take a little time to appear depending on your method. Thank you for your patience.' },
  { key: 'receipt', channel: 'email', category: 'transactional', vars: ['orderId', 'merchant', 'total', 'address'],
    subjectAr: 'إيصال طلبك #{{orderId}}', subjectEn: 'Your receipt for order #{{orderId}}',
    bodyAr: 'شكراً لطلبك من {{merchant}}. الإجمالي: {{total}} (الدفع عند الاستلام). التوصيل إلى: {{address}}. تجد التفاصيل الكاملة في التطبيق.',
    bodyEn: 'Thanks for ordering from {{merchant}}. Total: {{total}} (cash on delivery). Delivering to: {{address}}. Full details are in the app.' },

  // ── Merchant ──
  { key: 'merchant_new_order', channel: 'push', category: 'merchant', vars: ['orderId', 'items', 'total'],
    subjectAr: 'طلب جديد #{{orderId}}', subjectEn: 'New order #{{orderId}}',
    bodyAr: 'طلب جديد: {{items}} صنف بقيمة {{total}}. اقبله وابدأ التحضير من لوحة التاجر.',
    bodyEn: 'New order: {{items}} items, {{total}}. Accept and start preparing from your dashboard.' },
  { key: 'merchant_settlement', channel: 'email', category: 'merchant', vars: ['period', 'amount', 'orders'],
    subjectAr: 'كشف التسوية الأسبوعي', subjectEn: 'Your weekly settlement statement',
    bodyAr: 'تسوية {{period}}: {{amount}} عن {{orders}} طلباً مكتملاً، وُدِّعت إلى حسابك المسجّل. الكشف المفصّل في لوحة التاجر.',
    bodyEn: 'Settlement for {{period}}: {{amount}} across {{orders}} completed orders, deposited to your registered account. The itemised statement is in your dashboard.' },
  { key: 'merchant_approved', channel: 'email', category: 'merchant', vars: ['store'],
    subjectAr: 'تم اعتماد متجرك على هات الآن', subjectEn: 'Your store is approved on HAAT NOW',
    bodyAr: 'تهانينا! تم اعتماد {{store}} وأصبح جاهزاً لاستقبال الطلبات. أكمل قائمتك وساعات العمل للانطلاق.',
    bodyEn: 'Congratulations! {{store}} is approved and ready to receive orders. Finish your menu and opening hours to go live.' },

  // ── Driver / captain ──
  { key: 'driver_assignment', channel: 'push', category: 'driver', vars: ['orderId', 'pickup', 'payout'],
    subjectAr: 'عرض توصيل جديد', subjectEn: 'New delivery offer',
    bodyAr: 'توصيل #{{orderId}} من {{pickup}}. العائد: {{payout}}. اقبل خلال الوقت المحدّد.',
    bodyEn: 'Delivery #{{orderId}} from {{pickup}}. Payout: {{payout}}. Accept within the countdown.' },
  { key: 'driver_earnings', channel: 'push', category: 'driver', vars: ['period', 'amount', 'trips'],
    subjectAr: 'أرباحك هذا الأسبوع', subjectEn: 'Your earnings this week',
    bodyAr: 'أرباح {{period}}: {{amount}} عن {{trips}} رحلة. سُوّيت إلى حسابك. أحسنت!',
    bodyEn: 'Earnings for {{period}}: {{amount}} across {{trips}} trips, settled to your account. Great work!' },
  { key: 'driver_approved', channel: 'email', category: 'driver', vars: ['name'],
    subjectAr: 'تم اعتماد حسابك ككابتن', subjectEn: 'You’re approved to drive with HAAT NOW',
    bodyAr: 'مرحباً {{name}}! تم اعتماد مستنداتك. اتّصل من تطبيق الكابتن وابدأ استقبال العروض.',
    bodyEn: 'Welcome {{name}}! Your documents are approved. Go online in the captain app and start receiving offers.' },

  // ── Marketing (consent-based) ──
  { key: 'welcome', channel: 'email', category: 'marketing', vars: ['name'],
    subjectAr: 'أهلاً بك في هات الآن', subjectEn: 'Welcome to HAAT NOW',
    bodyAr: 'أهلاً {{name}}! طعام مدينتك والبقالة والصيدلية — يُوصَّل إليك في دقائق. اطلب أول مرة وادفع نقداً عند بابك.',
    bodyEn: 'Welcome {{name}}! Your city’s food, groceries and pharmacy — delivered in minutes. Place your first order and pay cash at your door.' },
  { key: 'first_order_offer', channel: 'email', category: 'marketing', vars: ['code', 'discount'],
    subjectAr: 'خصم {{discount}} على أول طلب', subjectEn: '{{discount}} off your first order',
    bodyAr: 'جاهز لأول طلب؟ استخدم كود {{code}} واحصل على خصم {{discount}}. عرض لفترة محدودة.',
    bodyEn: 'Ready for your first order? Use code {{code}} for {{discount}} off. Limited-time offer.' },
  { key: 'we_miss_you', channel: 'push', category: 'marketing', vars: ['discount'],
    subjectAr: 'اشتقنا إليك', subjectEn: 'We miss you',
    bodyAr: 'مرّ وقت! ارجع واطلب اليوم واحصل على خصم {{discount}} على طلبك القادم.',
    bodyEn: 'It’s been a while! Come back today and enjoy {{discount}} off your next order.' },
];

const BY_KEY: Record<string, CommsTemplate> = Object.fromEntries(COMMS_TEMPLATES.map(t => [t.key, t]));

/** Render a template: substitute {{vars}} and pick the locale. Missing vars are left blank. */
export function renderTemplate(key: string, vars: Record<string, string | number> = {}, locale: 'ar' | 'en' = 'ar'): { subject?: string; body: string; channel: CommsChannel } | null {
  const t = BY_KEY[key];
  if (!t) return null;
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  const subject = locale === 'ar' ? t.subjectAr : t.subjectEn;
  return { subject: subject ? fill(subject) : undefined, body: fill(locale === 'ar' ? t.bodyAr : t.bodyEn), channel: t.channel };
}

export const commsTemplate = (key: string) => BY_KEY[key] || null;
