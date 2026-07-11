import type { WebsiteSite } from '../../services/website.service';
import { LEGAL_DOCS } from '../../config/legal';

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
  'Cancellation': 'الإلغاء', 'Merchant Agreement': 'اتفاقية التاجر', 'Driver Agreement': 'اتفاقية الكابتن', 'Still have a question?': 'لا يزال لديك سؤال؟', 'Our team is here to help.': 'فريقنا هنا للمساعدة.',
  // ── Home extras (merchants/deals/waitlist copy) ──
  'Sample partners shown while real merchants onboard for launch.': 'شركاء تجريبيون معروضون بينما يجري ضم تجّار حقيقيين للإطلاق.',
  'Want launch updates?': 'تريد تحديثات الإطلاق؟',
  'Join the waitlist and we’ll tell you when HaaT Now goes live in your city.': 'انضم لقائمة الانتظار وسنخبرك عند انطلاق هات الآن في مدينتك.',
  'Launch offers are on the way': 'عروض الإطلاق في الطريق',
  'A preview of the deals coming to your city. Join the waitlist to unlock your first-order offer at launch.': 'لمحة عن العروض القادمة إلى مدينتك. انضم لقائمة الانتظار لفتح عرض أول طلب عند الإطلاق.',
  'Example deals — real offers activate when we go live': 'عروض توضيحية — تُفعّل العروض الحقيقية عند انطلاقنا',
  'Get your first-order offer': 'احصل على عرض أول طلب',
  'Join the waitlist and we’ll send your launch-day discount.': 'انضم لقائمة الانتظار وسنرسل لك خصم يوم الإطلاق.',
  'One email at launch. No spam.': 'رسالة واحدة عند الإطلاق. بلا إزعاج.',
  // ── Merchants page ──
  'Grow your business with ': 'نمِّ عملك مع ',
  'Reach new customers, boost orders and manage everything from one dashboard.': 'صِل إلى عملاء جدد، وزِد الطلبات، وأدر كل شيء من لوحة واحدة.',
  'Become a partner': 'كن شريكاً',
  'Talk to sales': 'تحدّث مع المبيعات',
  'Built to help you sell more': 'مصمّم لمساعدتك على البيع أكثر',
  'Setup fee': 'رسوم التأسيس',
  '48h': '٤٨ ساعة',
  'Go-live time': 'زمن الإطلاق',
  '24/7': '٢٤/٧',
  'Partner support': 'دعم الشركاء',
  'Day 1': 'اليوم الأول',
  'Customers from launch': 'عملاء من الإطلاق',
  'Everything you need to sell more': 'كل ما تحتاجه للبيع أكثر',
  'More customers': 'عملاء أكثر',
  'Get discovered by hungry customers actively searching nearby.': 'اجعل العملاء الباحثين قربك يكتشفونك.',
  'Smart dashboard': 'لوحة ذكية',
  'Menus, offers, hours and live orders in one place.': 'القوائم والعروض والساعات والطلبات المباشرة في مكان واحد.',
  'Fast payouts': 'مستحقات سريعة',
  'Reliable weekly settlements with transparent reporting.': 'تسويات أسبوعية موثوقة مع تقارير شفّافة.',
  'Marketing built in': 'تسويق مدمج',
  'Run offers and flash deals to drive repeat orders.': 'شغّل العروض والصفقات السريعة لزيادة الطلبات المتكررة.',
  'Live in 3 steps': 'انطلق في ٣ خطوات',
  'Sign up': 'سجّل',
  'Tell us about your business.': 'أخبرنا عن عملك.',
  'Add your menu': 'أضف قائمتك',
  'We help you onboard fast.': 'نساعدك على الانضمام بسرعة.',
  'Start selling': 'ابدأ البيع',
  'Go live and receive orders.': 'انطلق واستقبل الطلبات.',
  'Merchant FAQ': 'أسئلة التجّار الشائعة',
  'How much does it cost?': 'كم التكلفة؟',
  'No setup fee — a simple commission per completed order.': 'لا رسوم تأسيس — عمولة بسيطة لكل طلب مكتمل.',
  'How fast can I go live?': 'متى يمكنني الانطلاق؟',
  'Most partners are live within 48 hours.': 'معظم الشركاء ينطلقون خلال ٤٨ ساعة.',
  'Do I need my own drivers?': 'هل أحتاج سائقين خاصين بي؟',
  'No — our captain network handles delivery for you.': 'لا — شبكة الكباتن لدينا تتولّى التوصيل عنك.',
  'Ready to grow?': 'جاهز للنمو؟',
  'Be one of our founding partners and reach customers from day one.': 'كن أحد شركائنا المؤسسين وصِل إلى العملاء من اليوم الأول.',
  // ── Drivers page ──
  'Drive with ': 'قُد مع ',
  'Flexible hours, weekly payouts and a smart captain app that guides every trip.': 'ساعات مرنة، ومستحقات أسبوعية، وتطبيق كابتن ذكي يرشدك في كل رحلة.',
  'Start earning': 'ابدأ الربح',
  'Why drive with us': 'لماذا تقود معنا',
  'Flexible hours': 'ساعات مرنة',
  'Go online whenever it suits you.': 'اتّصل متى ما يناسبك.',
  'Weekly payouts': 'مستحقات أسبوعية',
  'Get paid reliably, every week.': 'احصل على أجرك بموثوقية، كل أسبوع.',
  'Smart routing': 'توجيه ذكي',
  'Live navigation and batched trips to earn more.': 'ملاحة مباشرة ورحلات مجمّعة لتربح أكثر.',
  'Support that cares': 'دعم يهتم بك',
  'Real help, day or night.': 'مساعدة حقيقية، ليلاً أو نهاراً.',
  'Start in 3 steps': 'ابدأ في ٣ خطوات',
  'Apply': 'قدّم',
  'Share your details and documents.': 'شارك بياناتك ومستنداتك.',
  'Get verified': 'وثّق حسابك',
  'Quick background and vehicle check.': 'فحص سريع للخلفية والمركبة.',
  'Hit the road': 'انطلق',
  'Go online and start earning.': 'اتّصل وابدأ الربح.',
  'Captain FAQ': 'أسئلة الكباتن الشائعة',
  'What do I need?': 'ماذا أحتاج؟',
  'A vehicle, a smartphone and valid documents.': 'مركبة، وهاتف ذكي، ومستندات سارية.',
  'When do I get paid?': 'متى أتقاضى أجري؟',
  'Earnings are settled weekly to your account.': 'تُسوّى الأرباح أسبوعياً إلى حسابك.',
  'Your city needs captains': 'مدينتك تحتاج كباتن',
  'Turn your free time into earnings.': 'حوّل وقت فراغك إلى أرباح.',
  // ── Franchise page ──
  'Bring ': 'أحضر ',
  'A proven delivery platform, launch playbook and hands-on support — from day one.': 'منصّة توصيل مثبتة، وخطة إطلاق، ودعم عملي — من اليوم الأول.',
  'Request the deck': 'اطلب العرض التقديمي',
  'A model that scales': 'نموذج قابل للتوسّع',
  'Cities': 'المدن',
  '90d': '٩٠ يوماً',
  'To launch': 'حتى الإطلاق',
  'Full': 'كامل',
  'Tech stack': 'حزمة التقنية',
  '1:1': '١:١',
  'Launch support': 'دعم الإطلاق',
  'What you get': 'ما تحصل عليه',
  'Turnkey platform': 'منصّة جاهزة',
  'Customer app, merchant tools and dispatch — ready to run.': 'تطبيق العملاء، وأدوات التجّار، والإرسال — جاهزة للتشغيل.',
  'Launch playbook': 'خطة الإطلاق',
  'Marketing, onboarding and ops, documented end to end.': 'التسويق والانضمام والعمليات، موثّقة من البداية للنهاية.',
  'Local brand': 'علامة محلية',
  'Your brand, your city — powered by our technology.': 'علامتك، ومدينتك — مدعومة بتقنيتنا.',
  'Franchise FAQ': 'أسئلة الامتياز الشائعة',
  'What investment is required?': 'ما الاستثمار المطلوب؟',
  'It varies by market — request the deck for details.': 'يختلف حسب السوق — اطلب العرض للتفاصيل.',
  'Do I keep my brand?': 'هل أحتفظ بعلامتي؟',
  'Yes, franchise partners can run under their own local brand.': 'نعم، يمكن لشركاء الامتياز العمل تحت علامتهم المحلية.',
  'Let’s build in your city': 'لنبنِ في مدينتك',
  'Request the franchise deck and we’ll be in touch.': 'اطلب عرض الامتياز وسنتواصل معك.',
  // ── Business / API page ──
  'Delivery, by API': 'التوصيل عبر واجهة برمجية',
  'Add on-demand delivery to your app with a clean REST API, webhooks and live tracking.': 'أضف التوصيل عند الطلب إلى تطبيقك عبر واجهة REST نظيفة، وويب هوكس، وتتبّع مباشر.',
  'Read the docs': 'اقرأ التوثيق',
  'Get API keys': 'احصل على مفاتيح الواجهة',
  'Built for developers': 'مصمّم للمطوّرين',
  'REST + webhooks': 'REST + ويب هوكس',
  'Create orders, get real-time status callbacks.': 'أنشئ الطلبات، واحصل على تحديثات الحالة لحظياً.',
  'Driver location and ETA out of the box.': 'موقع السائق ووقت الوصول جاهزان مباشرةً.',
  'Sandbox': 'بيئة اختبار',
  'Test end to end before you go live.': 'اختبر من البداية للنهاية قبل الانطلاق.',
  'Use cases': 'حالات الاستخدام',
  'Marketplaces': 'المتاجر المتعددة',
  'Add delivery to your storefront checkout.': 'أضف التوصيل إلى صفحة الدفع في متجرك.',
  'Retail chains': 'سلاسل التجزئة',
  'Fulfil online orders from every branch.': 'نفّذ الطلبات الإلكترونية من كل فرع.',
  'Enterprise ops': 'عمليات المؤسسات',
  'Automate B2B and internal logistics.': 'أتمتة الخدمات اللوجستية بين الشركات والداخلية.',
  'Start building': 'ابدأ البناء',
  'Get sandbox keys and ship in days, not months.': 'احصل على مفاتيح بيئة الاختبار وأطلق خلال أيام، لا أشهر.',
  // ── Enterprise page ──
  'Enterprise delivery, done right': 'توصيل المؤسسات، كما يجب',
  'Scale, security and support for large operations — with SLAs and dedicated success.': 'توسّع وأمان ودعم للعمليات الكبيرة — مع اتفاقيات مستوى خدمة وفريق نجاح مخصص.',
  'Contact sales': 'تواصل مع المبيعات',
  'Enterprise-ready': 'جاهز للمؤسسات',
  'SSO & RBAC': 'الدخول الموحّد والصلاحيات',
  'Enterprise auth and granular permissions.': 'مصادقة مؤسسية وصلاحيات دقيقة.',
  'SLAs': 'اتفاقيات مستوى الخدمة',
  '99.9% uptime with priority support.': 'جهوزية ٩٩.٩٪ مع دعم ذي أولوية.',
  'Analytics': 'التحليلات',
  'Live operational dashboards and exports.': 'لوحات تشغيلية مباشرة وتصدير للبيانات.',
  'Dedicated success': 'فريق نجاح مخصص',
  'A named team for onboarding and growth.': 'فريق مُخصّص للانضمام والنمو.',
  'Trusted at scale': 'موثوق على نطاق واسع',
  'Uptime SLA': 'اتفاقية الجهوزية',
  'SOC-ready': 'جاهز لـ SOC',
  'Security': 'الأمان',
  'Global': 'عالمي',
  'Coverage': 'التغطية',
  'Let’s talk scale': 'لنتحدث عن التوسّع',
  'Tell us your requirements and we’ll design a plan.': 'أخبرنا بمتطلباتك وسنصمّم خطة.',
  // ── Careers page ──
  'Build the future of delivery': 'ابنِ مستقبل التوصيل',
  'We’re a team obsessed with speed, craft and customers. Come build with us.': 'نحن فريق مهووس بالسرعة والإتقان والعملاء. تعال وابنِ معنا.',
  'Life at ': 'الحياة في ',
  'We move fast, care deeply about quality, and take ownership end to end. If that sounds like you, we’d love to talk.': 'نتحرك بسرعة، ونهتم بالجودة بعمق، ونتحمّل المسؤولية من البداية للنهاية. إن كان هذا يشبهك، يسعدنا التحدث.',
  'Open roles': 'الوظائف المتاحة',
  'Senior Frontend Engineer': 'مهندس واجهات أول',
  'React · TypeScript · Design systems': 'React · TypeScript · أنظمة تصميم',
  'Operations Manager': 'مدير عمليات',
  'City launches · Dispatch · Growth': 'إطلاق المدن · الإرسال · النمو',
  'Product Designer': 'مصمّم منتجات',
  'Mobile-first · Marketplace · UX': 'الجوال أولاً · المتجر · تجربة المستخدم',
  'Don’t see your role?': 'لا ترى وظيفتك؟',
  'We’re always meeting great people.': 'نحن دائماً نلتقي بأشخاص رائعين.',
  'Send your CV': 'أرسل سيرتك الذاتية',
  // ── Waitlist / app page ──
  'Join the Waitlist': 'انضم لقائمة الانتظار',
  'The HaaT Now app is on its way': 'تطبيق هات الآن في الطريق',
  'We’re putting the finishing touches on the iOS and Android apps. Join the waitlist and we’ll notify you the moment they’re live.': 'نضع اللمسات الأخيرة على تطبيقي iOS وAndroid. انضم لقائمة الانتظار وسنخبرك لحظة توفّرهما.',
  'Get notified at launch': 'أُشعَر عند الإطلاق',
  'Be first to order — and get an exclusive first-order offer.': 'كن أول من يطلب — واحصل على عرض حصري لأول طلب.',
  'We’ll only email you about the launch.': 'سنراسلك عن الإطلاق فقط.',
  'What to expect': 'ما تتوقعه',
  'Your favourites, a tap away — once you’ve placed your first order.': 'مفضّلاتك على بُعد لمسة — بمجرد إتمام أول طلب.',
  'Launch offers': 'عروض الإطلاق',
  'Early members get first access to launch-day deals.': 'الأعضاء الأوائل يحصلون على أول وصول لعروض يوم الإطلاق.',
  'Watch your order arrive in real time.': 'شاهد طلبك يصل لحظياً.',
  // ── About page ──
  'About ': 'عن ',
  'We’re building the delivery platform our region deserves — connecting neighbourhood restaurants, grocers and pharmacies with the people nearby, through one effortless experience.': 'نبني منصّة التوصيل التي تستحقها منطقتنا — نربط مطاعم الحيّ والبقالات والصيدليات بالناس القريبين، عبر تجربة واحدة سلسة.',
  'Our mission & vision': 'رسالتنا ورؤيتنا',
  'Our mission': 'رسالتنا',
  'To make everyday delivery fast, fair and effortless — so anyone can get what they need from local businesses in minutes.': 'أن نجعل التوصيل اليومي سريعاً وعادلاً وسلساً — ليحصل الجميع على ما يحتاجونه من المتاجر المحلية في دقائق.',
  'Our vision': 'رؤيتنا',
  'A connected region where every neighbourhood shop can reach every customer, and every customer can order with total confidence.': 'منطقة مترابطة يصل فيها كل متجر حيّ إلى كل عميل، ويطلب فيها كل عميل بثقة تامة.',
  'The values we build on': 'القيم التي نبني عليها',
  'Speed': 'السرعة',
  'Fast, reliable delivery is the promise we intend to keep on every single order.': 'التوصيل السريع الموثوق هو الوعد الذي نلتزم به في كل طلب.',
  'Fairness': 'العدالة',
  'Honest pricing for customers, fair commissions for merchants, and reliable pay for captains.': 'أسعار صادقة للعملاء، وعمولات عادلة للتجّار، وأجر موثوق للكباتن.',
  'Trust': 'الثقة',
  'Transparent tracking, clear policies and real human support — no surprises, ever.': 'تتبّع شفّاف، وسياسات واضحة، ودعم بشري حقيقي — بلا مفاجآت أبداً.',
  'Craft': 'الإتقان',
  'A beautiful, effortless experience end to end, obsessed over in every detail.': 'تجربة جميلة وسلسة من البداية للنهاية، معتنى بها في كل تفصيل.',
  'How we serve three sides': 'كيف نخدم ثلاثة أطراف',
  'One platform, built for everyone in the loop': 'منصّة واحدة، مبنية لكل طرف في المنظومة',
  'Customers': 'العملاء',
  'Merchants': 'التجّار',
  'Live tracking': 'تتبّع مباشر',
  'Order from local favourites, pay cash on delivery, and track every step live.': 'اطلب من مفضّلاتك المحلية، وادفع نقداً عند الاستلام، وتابع كل خطوة مباشرةً.',
  'Reach new customers with zero setup cost and a dashboard that runs your storefront.': 'صِل إلى عملاء جدد بلا تكلفة تأسيس ولوحة تدير متجرك.',
  'Captains': 'الكباتن',
  'Earn on a flexible schedule with weekly payouts and smart, guided routing.': 'اربح وفق جدول مرن مع مستحقات أسبوعية وتوجيه ذكي.',
  'Where we are today': 'أين نحن اليوم',
  'HaaT Now is pre-launch. We’re onboarding our first merchants and captains and preparing to go live city by city. We’d rather be transparent than show inflated numbers — so instead of vanity metrics, here’s our commitment: fast delivery, fair pricing and real support from day one.': 'هات الآن قبل الإطلاق. نضم أوائل التجّار والكباتن ونستعد للانطلاق مدينة تلو الأخرى. نفضّل الشفافية على عرض أرقام مبالغ فيها — فبدلاً من مقاييس شكلية، هذا التزامنا: توصيل سريع، وأسعار عادلة، ودعم حقيقي من اليوم الأول.',
  'Want to be first?': 'تريد أن تكون الأول؟',
  'Join the waitlist and we’ll tell you when we launch in your city.': 'انضم لقائمة الانتظار وسنخبرك عند إطلاقنا في مدينتك.',
  // ── Contact / help ──
  'Get in touch': 'تواصل معنا',
  'We’re here to help — reach out any time.': 'نحن هنا للمساعدة — تواصل في أي وقت.',
  'Contact us': 'اتصل بنا',
  'Frequently asked questions': 'الأسئلة الشائعة',
  'How fast is delivery?': 'ما سرعة التوصيل؟',
  'Most orders arrive within 30 minutes.': 'معظم الطلبات تصل خلال ٣٠ دقيقة.',
  'How do I track my order?': 'كيف أتتبّع طلبي؟',
  'Open your account and go to Orders to track in real time.': 'افتح حسابك وانتقل إلى الطلبات للتتبّع لحظياً.',
  'What payment methods are accepted?': 'ما طرق الدفع المقبولة؟',
  'At launch, cash on delivery — no account or card needed. Cards and wallet are coming soon.': 'عند الإطلاق، الدفع نقداً عند الاستلام — دون حساب أو بطاقة. البطاقات والمحفظة قريباً.',
  'How do I contact support?': 'كيف أتواصل مع الدعم؟',
  'Still need help?': 'ما زلت بحاجة لمساعدة؟',
  'Our team is happy to assist.': 'فريقنا سعيد بمساعدتك.',
  // ── Legal pages ──
  'Privacy Policy': 'سياسة الخصوصية',
  'How we collect, use and protect your data.': 'كيف نجمع بياناتك ونستخدمها ونحميها.',
  'Questions about your data?': 'أسئلة عن بياناتك؟',
  'We’re here to help.': 'نحن هنا للمساعدة.',
  'Terms of Service': 'شروط الخدمة',
  'Questions about these terms?': 'أسئلة عن هذه الشروط؟',
  'Get in touch any time.': 'تواصل في أي وقت.',
  'Refund Policy': 'سياسة الاسترداد',
  'Fair, fast and transparent — because things occasionally go wrong.': 'عادلة وسريعة وشفّافة — لأن الأمور قد تسوء أحياناً.',
  'Refund FAQ': 'أسئلة الاسترداد الشائعة',
  'How do I request a refund?': 'كيف أطلب استرداداً؟',
  'Open the order and tap “Request refund”, or contact support with your order number.': 'افتح الطلب واضغط «طلب استرداد»، أو تواصل مع الدعم برقم طلبك.',
  'How long does it take?': 'كم يستغرق ذلك؟',
  'Most requests are reviewed within 24 hours; approved refunds are issued promptly.': 'تُراجع معظم الطلبات خلال ٢٤ ساعة؛ وتُصرف الاستردادات المعتمدة فوراً.',
  'What if my order never arrived?': 'ماذا لو لم يصل طلبي؟',
  'You’re fully covered — report it and we’ll refund or redeliver.': 'أنت مغطّى بالكامل — أبلغ عنه وسنسترد أو نعيد التوصيل.',
  'Need help with an order?': 'تحتاج مساعدة في طلب؟',
  'Our support team is here for you.': 'فريق الدعم هنا من أجلك.',
  'Contact support': 'تواصل مع الدعم',
  'Delivery Policy': 'سياسة التوصيل',
  'How, where and when we deliver — clearly explained.': 'كيف وأين ومتى نوصّل — موضّح بجلاء.',
  'Questions about delivery?': 'أسئلة عن التوصيل؟',
  'We’re happy to help.': 'يسعدنا مساعدتك.',
  'Cookie Policy': 'سياسة ملفات الارتباط',
  'The cookies we use, and why.': 'ملفات الارتباط التي نستخدمها، ولماذا.',
  'Questions about cookies?': 'أسئلة عن ملفات الارتباط؟',
  'Reach out any time.': 'تواصل في أي وقت.',
  // ── Blog / misc ──
  '5 tips for faster delivery': '٥ نصائح لتوصيل أسرع',
  'Keep your address precise, add a note for the captain, and order at off-peak times.': 'اجعل عنوانك دقيقاً، وأضف ملاحظة للكابتن، واطلب في أوقات غير الذروة.',
  'Delivery tips': 'نصائح التوصيل',
  '50% off your first order': 'خصم ٥٠٪ على أول طلب',
  'Free delivery weekend': 'توصيل مجاني في العطلة',
  'Buy 1 Get 1 pizza': 'اشترِ بيتزا واحصل على أخرى',
  '20% off wellness': 'خصم ٢٠٪ على العناية',
  'Top rated': 'الأعلى تقييماً',
  'New': 'جديد',
  'Edit this page in the Website Center.': 'عدّل هذه الصفحة من مركز الموقع.',
};

// Register the bilingual legal documents (single source of truth in config/legal.ts)
// so the CMS-authored English legal pages render in Arabic through the same dictionary.
for (const d of LEGAL_DOCS) { AR[d.titleEn] = d.titleAr; AR[d.subtitleEn] = d.subtitleAr; AR[d.bodyEn] = d.bodyAr; }

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
  if (Array.isArray(n.features)) n.features = n.features.map(tr);
  if (n.button) n.button = { ...n.button, label: tr(n.button.label) };
  if (n.viewAll) n.viewAll = { ...n.viewAll, label: tr(n.viewAll.label) };
  if (Array.isArray(n.ctas)) n.ctas = n.ctas.map((c: any) => ({ ...c, label: tr(c.label) }));
  if (Array.isArray(n.items)) n.items = n.items.map((it: any) => {
    const x = { ...it };
    for (const k of ['title', 'body', 'label', 'value', 'quote', 'author', 'role', 'q', 'a', 'discount', 'merchant', 'badge', 'cuisine', 'name']) if (typeof x[k] === 'string') x[k] = tr(x[k]);
    return x;
  });
  return n;
}
