import type { WebsiteSite } from '../../services/website.service';

// ─────────────────────────────────────────────────────────────────────────────
// Website localization (EN ⇄ العربية). Runtime language switch with RTL, persistence
// and localized SEO. localizeSite() deep-maps the CMS content through the dictionary,
// so the SAME content model renders in either language (Studio-editable; unknown
// strings gracefully fall back to English). No duplicate CMS, no duplicate pages.
// ─────────────────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'ar';
export const LANG_KEY = 'haat_web_lang';
export const getLocale = (): Locale => { try { return localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en'; } catch { return 'en'; } };
export const setLocale = (l: Locale) => { try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } };

// UI chrome strings (site shell, not CMS content).
export const UI: Record<string, Record<Locale, string>> = {
  login: { en: 'Log in', ar: 'تسجيل الدخول' },
  skip: { en: 'Skip to content', ar: 'تخطّي إلى المحتوى' },
  home: { en: 'Home', ar: 'الرئيسية' },
  langLabel: { en: 'العربية', ar: 'English' },
  cookie: { en: 'We use cookies to improve your experience. See our', ar: 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك. اطّلع على' },
  cookiePolicy: { en: 'privacy policy', ar: 'سياسة الخصوصية' },
  accept: { en: 'Accept', ar: 'موافق' },
  preview: { en: 'PREVIEW — showing the unpublished draft. Publish in the Website Center to go live.', ar: 'معاينة — تعرض المسودة غير المنشورة. انشر من مركز الموقع لتصبح مباشرة.' },
  notFoundTitle: { en: 'This page took a wrong turn', ar: 'هذه الصفحة سلكت طريقاً خاطئاً' },
  notFoundBody: { en: 'We couldn’t find what you were looking for. Try one of these:', ar: 'لم نتمكن من العثور على ما تبحث عنه. جرّب أحد الخيارات التالية:' },
  restaurants: { en: 'Restaurants', ar: 'المطاعم' },
  offers: { en: 'Offers', ar: 'العروض' },
  joinWaitlist: { en: 'Join the waitlist', ar: 'انضم لقائمة الانتظار' },
};
export const t = (key: string, locale: Locale): string => (UI[key] ? UI[key][locale] : key);

// Content dictionary (EN → AR). Covers the flagship homepage, nav, footer, CTAs and
// common page chrome. Unlisted strings fall back to English.
const AR: Record<string, string> = {
  // ── Navigation ──
  'Home': 'الرئيسية', 'Restaurants': 'المطاعم', 'Grocery': 'البقالة', 'Pharmacy': 'الصيدلية', 'Offers': 'العروض',
  'About': 'من نحن', 'Blog': 'المدونة', 'Contact': 'اتصل بنا', 'Help': 'المساعدة',
  // ── Hero ──
  'Your city’s food, groceries & pharmacy — delivered': 'طعام مدينتك والبقالة والصيدلية — يُوصَّل إليك',
  'HaaT Now is a new local delivery service launching soon. Order in a few taps, pay cash at your door, and track every delivery live.': 'هات الآن خدمة توصيل محلية جديدة تنطلق قريباً. اطلب بلمسات قليلة، وادفع نقداً عند بابك، وتابع كل طلب مباشرةً.',
  'Search for a restaurant, dish or store': 'ابحث عن مطعم أو طبق أو متجر',
  'Start ordering': 'ابدأ الطلب',
  'Join the waitlist': 'انضم لقائمة الانتظار',
  // ── Why HaaT Now ──
  'Why HaaT Now?': 'لماذا هات الآن؟',
  'Everything, one place': 'كل شيء في مكان واحد',
  'Restaurants, grocery and pharmacy from your neighbourhood — in a single app.': 'المطاعم والبقالة والصيدلية من حيّك — في تطبيق واحد.',
  'Fair for everyone': 'عادل للجميع',
  'Honest pricing for customers, fair commissions for merchants, weekly payouts for captains.': 'أسعار صادقة للعملاء، وعمولات عادلة للتجّار، ومستحقات أسبوعية للكباتن.',
  'Pay cash, no account': 'ادفع نقداً بدون حساب',
  'Order as a guest and pay cash on delivery. Cards and wallet are coming soon.': 'اطلب كضيف وادفع نقداً عند الاستلام. البطاقات والمحفظة قريباً.',
  'Live, transparent tracking': 'تتبّع مباشر وشفّاف',
  'Follow your order end to end — no guessing where it is.': 'تابع طلبك من البداية للنهاية — دون تخمين.',
  // ── Categories ──
  'What are you craving?': 'ماذا تشتهي؟',
  'Explore the categories launching in your city': 'استكشف الفئات التي تنطلق في مدينتك',
  'Coffee': 'القهوة', 'Sweets': 'الحلويات', 'Healthy': 'صحّي', 'Flowers': 'الزهور', 'Gifts': 'الهدايا', 'Parcels': 'الطرود',
  // ── Merchants / deals ──
  'A preview of what’s coming': 'لمحة عمّا هو قادم',
  'Sample partners — real merchants are onboarding now for launch': 'شركاء تجريبيون — يجري ضم تجّار حقيقيين استعداداً للإطلاق',
  'See the lineup': 'شاهد القائمة',
  'Grocery & pharmacy': 'البقالة والصيدلية',
  'Preview — neighbourhood stores joining at launch': 'معاينة — متاجر الحيّ التي تنضم عند الإطلاق',
  'Launch offers (preview)': 'عروض الإطلاق (معاينة)',
  'Example deals — your first-order offer lands when we go live': 'عروض توضيحية — يصلك عرض أول طلب عند انطلاقنا',
  // ── Why choose ──
  'Why choose HaaT Now': 'لماذا تختار هات الآن',
  'Fast local delivery': 'توصيل محلي سريع',
  'Neighbourhood merchants and nearby captains mean your order arrives quickly.': 'تجّار الحيّ والكباتن القريبون يعنيان وصول طلبك بسرعة.',
  'Real-time tracking': 'تتبّع فوري',
  'Follow every order live, from the store to your door — no guessing.': 'تابع كل طلب مباشرةً من المتجر إلى بابك — دون تخمين.',
  'Cash on delivery': 'الدفع عند الاستلام',
  'Order as a guest and pay cash at your door. No card or account required.': 'اطلب كضيف وادفع نقداً عند بابك. لا حاجة لبطاقة أو حساب.',
  'Secure & private': 'آمن وخصوصي',
  'Your details are used only to complete your delivery — never sold.': 'تُستخدم بياناتك فقط لإتمام التوصيل — ولا تُباع أبداً.',
  '24/7 support': 'دعم على مدار الساعة',
  'Real people ready to help with any order, any time.': 'فريق حقيقي جاهز لمساعدتك في أي طلب وفي أي وقت.',
  'Verified merchants': 'تجّار موثّقون',
  'Every partner is reviewed before going live on the platform.': 'تتم مراجعة كل شريك قبل ظهوره على المنصّة.',
  // ── Stats ──
  'Built to serve your whole city': 'مصمّم لخدمة مدينتك بالكامل',
  '3-in-1': '٣ في ١', 'Food · grocery · pharmacy': 'طعام · بقالة · صيدلية',
  '~30 min': '≈ ٣٠ دقيقة', 'Target delivery time': 'زمن التوصيل المستهدف',
  'COD': 'نقداً', 'Pay your way': 'ادفع كما يناسبك',
  '100%': '١٠٠٪', 'Live order tracking': 'تتبّع مباشر للطلب',
  // ── Testimonials ──
  'The reviews below are illustrative examples of the experience we are building — real customer reviews will appear here at launch. (Editable in Website Studio.)': 'المراجعات أدناه أمثلة توضيحية للتجربة التي نبنيها — ستظهر مراجعات العملاء الحقيقية هنا عند الإطلاق. (قابلة للتحرير في استوديو الموقع.)',
  'Loved by our early community': 'محبوب من مجتمعنا المبكّر',
  'Ordering felt effortless and I could watch my delivery the whole way. Exactly what our neighbourhood needed.': 'كان الطلب سهلاً وتابعت التوصيل طوال الطريق. تماماً ما احتاجه حيّنا.',
  'Early tester': 'مختبِر مبكّر', 'Riyadh · illustrative': 'الرياض · توضيحي',
  'Cash on delivery with no account made it so easy to try. The tracking is genuinely useful.': 'الدفع عند الاستلام بدون حساب جعل التجربة سهلة جداً. والتتبّع مفيد فعلاً.',
  'Beta customer': 'عميل تجريبي', 'Jeddah · illustrative': 'جدة · توضيحي',
  'Fast, clear pricing, and real support when I had a question. A promising start.': 'سريع، وأسعار واضحة، ودعم حقيقي عند سؤالي. بداية واعدة.',
  'Community member': 'عضو في المجتمع', 'Dammam · illustrative': 'الدمّام · توضيحي',
  // ── Steps ──
  'How it works': 'كيف تعمل',
  'Three taps to your door': 'ثلاث لمسات حتى بابك',
  'Browse & choose': 'تصفّح واختر',
  'Discover restaurants and stores near you, with clear ETAs and prices.': 'اكتشف المطاعم والمتاجر القريبة منك، بأوقات وأسعار واضحة.',
  'Order & pay cash': 'اطلب وادفع نقداً',
  'Check out as a guest and pay cash on delivery — no account or card needed.': 'أتمم الطلب كضيف وادفع نقداً عند الاستلام — دون حساب أو بطاقة.',
  'Track live': 'تتبّع مباشرةً',
  'Follow your order in real time, right to your door.': 'تابع طلبك لحظياً حتى بابك.',
  // ── Waitlist ──
  'Launching soon': 'الإطلاق قريباً',
  'Be among the first to order': 'كن من أوائل الطالبين',
  'HaaT Now is launching in your city. Join the waitlist and we’ll email you the moment we go live — with a first-order offer.': 'هات الآن ينطلق في مدينتك. انضم لقائمة الانتظار وسنراسلك لحظة انطلاقنا — مع عرض لأول طلب.',
  'you@email.com': 'بريدك@الإيميل.com',
  'No spam. One email when we launch.': 'بلا إزعاج. رسالة واحدة عند الإطلاق.',
  // ── Grow with us ──
  'Grow with us': 'انمُ معنا',
  'Become a partner →': 'كن شريكاً →',
  'List your restaurant or store and reach new local customers from day one.': 'أدرج مطعمك أو متجرك وصِل إلى عملاء محليين جدد من اليوم الأول.',
  'Drive & earn →': 'قُد واربح →',
  'Flexible hours and weekly payouts. Deliver on your schedule.': 'ساعات مرنة ومستحقات أسبوعية. وصّل وفق جدولك.',
  'Own a franchise →': 'امتلك امتيازاً →',
  'Bring HaaT Now to your city with a full launch playbook.': 'أحضر هات الآن إلى مدينتك بخطة إطلاق متكاملة.',
  // ── Even better in the app ──
  'Even better in the app': 'أفضل في التطبيق',
  'One-tap reorder': 'إعادة الطلب بلمسة',
  'Your favourites, saved and a single tap away.': 'مفضّلاتك محفوظة وعلى بُعد لمسة.',
  'Live map tracking': 'تتبّع على الخريطة',
  'Watch your captain approach in real time.': 'شاهد كابتنك يقترب لحظياً.',
  'Exclusive offers': 'عروض حصرية',
  'App-only deals and launch-day discounts.': 'عروض حصرية للتطبيق وخصومات يوم الإطلاق.',
  'Instant updates': 'تحديثات فورية',
  'Push alerts at every step of your order.': 'تنبيهات فورية في كل خطوة من طلبك.',
  // ── App download ──
  'Get the HaaT Now app': 'احصل على تطبيق هات الآن',
  'One-tap reordering, live tracking and launch-day offers — landing on iOS and Android. Join the waitlist and we’ll send the download link the day it drops.': 'إعادة الطلب بلمسة، وتتبّع مباشر، وعروض يوم الإطلاق — قريباً على iOS وAndroid. انضم لقائمة الانتظار وسنرسل رابط التحميل يوم صدوره.',
  // ── Closing CTA ──
  'Hungry to get started?': 'جاهز للبدء؟',
  'Order now, or join the waitlist for launch updates.': 'اطلب الآن، أو انضم لقائمة الانتظار لتصلك تحديثات الإطلاق.',
  // ── Footer ──
  'Company': 'الشركة', 'Careers': 'الوظائف', 'Partners': 'الشركاء', 'Support': 'الدعم',
  'For Merchants': 'للتجّار', 'Drive & Earn': 'قُد واربح', 'Franchise': 'الامتياز', 'Business API': 'واجهة الأعمال', 'Enterprise': 'المؤسسات',
  'Help Center': 'مركز المساعدة', 'Privacy': 'الخصوصية', 'Terms': 'الشروط', 'Refunds': 'الاستردادات', 'Cookies': 'الكوكيز',
};

const tr = (v: unknown): unknown => (typeof v === 'string' ? (AR[v] ?? v) : v);

/** Deep-localize a site's CMS content to Arabic (fallback to English for unlisted strings). */
export function localizeSite(site: WebsiteSite, locale: Locale): WebsiteSite {
  if (locale === 'en') return site;
  const s: WebsiteSite = JSON.parse(JSON.stringify(site));
  s.navigation = s.navigation.map(n => ({ ...n, label: tr(n.label) as string }));
  s.footer.copyright = (AR[s.footer.copyright] ?? s.footer.copyright.replace('All rights reserved', 'جميع الحقوق محفوظة'));
  s.footer.columns = s.footer.columns.map(c => ({ title: tr(c.title) as string, links: c.links.map(l => ({ ...l, label: tr(l.label) as string })) }));
  s.footer.legalLinks = s.footer.legalLinks.map(l => ({ ...l, label: tr(l.label) as string }));
  const locSeo = (seo: any) => ({ ...seo, title: tr(seo?.title) as string, description: tr(seo?.description) as string });
  s.seoDefaults = locSeo(s.seoDefaults);
  s.pages = s.pages.map(p => ({
    ...p, title: tr(p.title) as string, seo: locSeo(p.seo),
    sections: p.sections.map(localizeBlock),
  }));
  return s;
}

function localizeBlock(b: any): any {
  const n = { ...b };
  for (const k of ['title', 'subtitle', 'heading', 'body', 'searchPlaceholder', 'placeholder', 'cta', 'note', 'badge', 'label']) {
    if (typeof n[k] === 'string') n[k] = tr(n[k]);
  }
  if (Array.isArray(n.chips)) n.chips = n.chips.map((c: any) => ({ ...c, label: tr(c.label) }));
  if (n.button) n.button = { ...n.button, label: tr(n.button.label) };
  if (n.viewAll) n.viewAll = { ...n.viewAll, label: tr(n.viewAll.label) };
  if (Array.isArray(n.ctas)) n.ctas = n.ctas.map((c: any) => ({ ...c, label: tr(c.label) }));
  if (Array.isArray(n.items)) n.items = n.items.map((it: any) => {
    const x = { ...it };
    for (const k of ['title', 'body', 'label', 'value', 'quote', 'author', 'role', 'q', 'a']) if (typeof x[k] === 'string') x[k] = tr(x[k]);
    return x;
  });
  return n;
}
