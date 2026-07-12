// ─────────────────────────────────────────────────────────────────────────────
// Partner Center content — one bilingual, data-driven config that a SINGLE landing
// template renders for all 7 partner types (no duplicated pages). Each type defines
// its hero, benefits, requirements, how-it-works, FAQ, success stories, timeline,
// sub-types and application form schema. Document requirements live in the dynamic
// engine (partner.service), not here.
// ─────────────────────────────────────────────────────────────────────────────
import type { PartnerType } from '../../../services/partner.service';

export interface BiText { ar: string; en: string }
export interface FormField { key: string; ar: string; en: string; type: 'text' | 'tel' | 'email' | 'number' | 'select' | 'textarea'; required?: boolean; options?: BiText[] }
export interface PartnerTypeContent {
  type: PartnerType;
  slug: string;
  icon: string;                       // lucide icon name (resolved in the view)
  title: BiText;
  tagline: BiText;
  heroSub: BiText;
  subTypes: BiText[];                  // business categories within this partner type
  benefits: { icon: string; title: BiText; body: BiText }[];
  requirements: BiText[];
  howItWorks: { title: BiText; body: BiText }[];
  faq: { q: BiText; a: BiText }[];
  stories: { quote: BiText; author: BiText }[];
  timeline: BiText[];                  // headline lifecycle for the applicant
  fields: FormField[];                // extra structured fields beyond name/phone/email/city
}

const T = (ar: string, en: string): BiText => ({ ar, en });

const APPLY_TIMELINE = [
  T('تقديم الطلب', 'Application submitted'),
  T('مراجعة المستندات', 'Documents review'),
  T('تعيين موظف ومكالمة', 'Assigned & phone call'),
  T('زيارة ميدانية وتفاوض', 'Field visit & negotiation'),
  T('اعتماد وتفعيل', 'Approval & go-live'),
];

export const PARTNER_TYPES: PartnerTypeContent[] = [
  {
    type: 'merchant', slug: 'merchant', icon: 'Store',
    title: T('كن تاجراً', 'Become a Merchant'),
    tagline: T('انمِ مبيعاتك مع هات الآن', 'Grow your sales with HAAT NOW'),
    heroSub: T('أدرج متجرك وأوصله إلى عملاء جدد في مدينتك من اليوم الأول.', 'List your store and reach new customers in your city from day one.'),
    subTypes: [T('مطاعم', 'Restaurants'), T('كافيه', 'Cafe'), T('مخبوزات', 'Bakery'), T('حلويات', 'Sweets'), T('بقالة', 'Grocery'), T('هايبر ماركت', 'Hyper Market'), T('صيدلية', 'Pharmacy'), T('زهور', 'Flowers'), T('هدايا', 'Gifts'), T('إلكترونيات', 'Electronics'), T('متجر طرود', 'Parcel Store'), T('مغسلة', 'Laundry'), T('مطبخ سحابي', 'Dark Kitchen'), T('متجر حيوانات', 'Pet Store'), T('طعام صحي', 'Healthy Food'), T('نشاط آخر', 'Any other business')],
    benefits: [
      { icon: 'Users', title: T('عملاء جدد', 'New customers'), body: T('اظهر لعملاء يبحثون قربك.', 'Get discovered by nearby customers.') },
      { icon: 'LayoutDashboard', title: T('لوحة ذكية', 'Smart dashboard'), body: T('القوائم والعروض والطلبات في مكان واحد.', 'Menus, offers and orders in one place.') },
      { icon: 'Wallet', title: T('تسويات سريعة', 'Fast payouts'), body: T('مستحقات أسبوعية موثوقة وشفافة.', 'Reliable, transparent weekly settlements.') },
      { icon: 'Megaphone', title: T('تسويق مدمج', 'Built-in marketing'), body: T('عروض وصفقات لزيادة الطلبات.', 'Offers and deals to drive orders.') },
    ],
    requirements: [T('سجل تجاري وبطاقة ضريبية ساريان', 'Valid commercial registration & tax card'), T('حساب بنكي للتسوية', 'Bank account for settlement'), T('قائمة منتجات وأسعار', 'Product list & prices')],
    howItWorks: [
      { title: T('سجّل', 'Sign up'), body: T('أخبرنا عن نشاطك.', 'Tell us about your business.') },
      { title: T('أضف قائمتك', 'Add your menu'), body: T('نساعدك على الانضمام بسرعة.', 'We help you onboard fast.') },
      { title: T('ابدأ البيع', 'Start selling'), body: T('انطلق واستقبل الطلبات.', 'Go live and receive orders.') },
    ],
    faq: [
      { q: T('كم التكلفة؟', 'How much does it cost?'), a: T('لا رسوم تأسيس — عمولة بسيطة لكل طلب مكتمل.', 'No setup fee — a simple commission per completed order.') },
      { q: T('متى أنطلق؟', 'How fast can I go live?'), a: T('معظم الشركاء ينطلقون خلال ٤٨ ساعة.', 'Most partners are live within 48 hours.') },
      { q: T('هل أحتاج سائقين؟', 'Do I need my own drivers?'), a: T('لا — شبكة الكباتن تتولّى التوصيل.', 'No — our captain network handles delivery.') },
    ],
    stories: [{ quote: T('زادت طلباتنا بشكل ملحوظ منذ الانضمام.', 'Our orders grew noticeably after joining.'), author: T('شريك تجريبي · توضيحي', 'Pilot partner · illustrative') }],
    timeline: APPLY_TIMELINE,
    fields: [
      { key: 'businessName', ar: 'اسم النشاط', en: 'Business name', type: 'text', required: true },
      { key: 'branches', ar: 'عدد الفروع', en: 'Number of branches', type: 'number' },
      { key: 'address', ar: 'العنوان', en: 'Address', type: 'text' },
    ],
  },
  {
    type: 'fleet', slug: 'fleet', icon: 'Truck',
    title: T('شركة توصيل / أسطول', 'Delivery / Fleet Company'),
    tagline: T('شغّل أسطولك مع منصّة متكاملة', 'Run your fleet on one platform'),
    heroSub: T('اربط سائقيك بطلبات حقيقية وأدر التغطية والتوفّر من مكان واحد.', 'Connect your drivers to real orders and manage coverage and availability in one place.'),
    subTypes: [T('شركات كوريير', 'Courier Companies'), T('مزوّدو أساطيل', 'Fleet Providers'), T('مكاتب توظيف', 'Recruitment Offices'), T('وكالات توصيل', 'Delivery Agencies'), T('شركات الميل الأخير', 'Last-Mile Companies'), T('لوجستيات طرف ثالث 3PL', '3PL'), T('شركات نقل', 'Transport Companies')],
    benefits: [
      { icon: 'PackageCheck', title: T('طلبات مستمرة', 'Steady orders'), body: T('استغلال أعلى لأسطولك.', 'Higher utilisation for your fleet.') },
      { icon: 'MapPin', title: T('تحكّم بالتغطية', 'Coverage control'), body: T('حدّد المدن والمناطق.', 'Define cities and zones.') },
      { icon: 'Wallet', title: T('تسوية موحّدة', 'Consolidated settlement'), body: T('كشوف واضحة لكل السائقين.', 'Clear statements for all drivers.') },
    ],
    requirements: [T('سجل تجاري ورخصة نقل/توصيل', 'Commercial registration & transport licence'), T('أسطول ومستندات مركبات', 'Fleet with vehicle documents'), T('حساب بنكي للتسوية', 'Bank account for settlement')],
    howItWorks: [
      { title: T('سجّل الشركة', 'Register the company'), body: T('قدّم بيانات الشركة والأسطول.', 'Submit company and fleet details.') },
      { title: T('اربط السائقين', 'Connect drivers'), body: T('نضم سائقيك ونفعّلهم.', 'We onboard and activate your drivers.') },
      { title: T('ابدأ التشغيل', 'Start operating'), body: T('استقبل الطلبات في مناطقك.', 'Receive orders in your zones.') },
    ],
    faq: [{ q: T('كم سائقاً يمكنني ضمّه؟', 'How many drivers can I add?'), a: T('لا حد — أضف أسطولك كاملاً.', 'No limit — add your whole fleet.') }],
    stories: [{ quote: T('رفعنا استغلال الأسطول بشكل كبير.', 'We raised fleet utilisation significantly.'), author: T('شركة أسطول · توضيحي', 'Fleet company · illustrative') }],
    timeline: APPLY_TIMELINE,
    fields: [
      { key: 'companyName', ar: 'اسم الشركة', en: 'Company name', type: 'text', required: true },
      { key: 'fleetSize', ar: 'حجم الأسطول', en: 'Fleet size', type: 'number', required: true },
      { key: 'cities', ar: 'المدن / التغطية', en: 'Cities / coverage', type: 'text' },
      { key: 'vehicleTypes', ar: 'أنواع المركبات', en: 'Vehicle types', type: 'text' },
    ],
  },
  {
    type: 'driver', slug: 'driver', icon: 'Bike',
    title: T('كن كابتن توصيل', 'Become a Driver'),
    tagline: T('اعمل بمرونة واربح أسبوعياً', 'Work flexibly, earn weekly'),
    heroSub: T('استلم الطلبات وقت ما يناسبك، وتابع أرباحك، واسحبها أسبوعياً.', 'Accept orders whenever suits you, track earnings, and get paid weekly.'),
    subTypes: [T('دراجة هوائية', 'Bike'), T('دراجة نارية', 'Motorcycle'), T('سيارة', 'Car'), T('فان', 'Van'), T('كابتن مشي', 'Walking Courier')],
    benefits: [
      { icon: 'Clock', title: T('ساعات مرنة', 'Flexible hours'), body: T('اتصل متى ما تريد.', 'Go online whenever you want.') },
      { icon: 'Wallet', title: T('مستحقات أسبوعية', 'Weekly payouts'), body: T('أجر موثوق كل أسبوع.', 'Reliable pay every week.') },
      { icon: 'Navigation', title: T('توجيه ذكي', 'Smart routing'), body: T('رحلات مجمّعة لتربح أكثر.', 'Batched trips to earn more.') },
    ],
    requirements: [T('هوية سارية', 'Valid ID'), T('رخصة قيادة عند اللزوم', 'Driving licence where required'), T('هاتف ذكي', 'A smartphone')],
    howItWorks: [
      { title: T('قدّم', 'Apply'), body: T('شارك بياناتك ومستنداتك.', 'Share your details and documents.') },
      { title: T('وثّق', 'Get verified'), body: T('فحص سريع للخلفية والمركبة.', 'Quick background and vehicle check.') },
      { title: T('انطلق', 'Hit the road'), body: T('اتصل وابدأ الربح.', 'Go online and start earning.') },
    ],
    faq: [{ q: T('متى أتقاضى أجري؟', 'When do I get paid?'), a: T('تُسوّى الأرباح أسبوعياً إلى حسابك.', 'Earnings are settled weekly to your account.') }],
    stories: [{ quote: T('دخل إضافي مرن يناسب وقتي.', 'Flexible extra income that fits my time.'), author: T('كابتن · توضيحي', 'Captain · illustrative') }],
    timeline: APPLY_TIMELINE,
    fields: [
      { key: 'vehicle', ar: 'نوع المركبة', en: 'Vehicle type', type: 'select', required: true, options: [T('دراجة نارية', 'Motorcycle'), T('سيارة', 'Car'), T('دراجة', 'Bike'), T('فان', 'Van'), T('مشي', 'Walking')] },
      { key: 'availability', ar: 'التوفّر', en: 'Availability', type: 'select', options: [T('دوام كامل', 'Full-time'), T('دوام جزئي', 'Part-time')] },
    ],
  },
  {
    type: 'affiliate', slug: 'affiliate', icon: 'Megaphone',
    title: T('شريك تسويق بالعمولة', 'Affiliate Partner'),
    tagline: T('سوّق واربح عمولة عن كل طلب', 'Promote and earn on every order'),
    heroSub: T('احصل على رمز ورابط إحالة ولوحة تتبّع لأرباحك — واسحب متى شئت.', 'Get a referral code, link and a dashboard to track your earnings — withdraw anytime.'),
    subTypes: [T('مسوّق حر', 'Freelance Marketer'), T('مؤثّر', 'Influencer'), T('مندوب مبيعات', 'Sales Representative'), T('سفير جامعي', 'Campus Ambassador'), T('شريك إحالة', 'Referral Partner')],
    benefits: [
      { icon: 'QrCode', title: T('رمز ورابط إحالة', 'Referral code & link'), body: T('شارك واكسب فوراً.', 'Share and start earning.') },
      { icon: 'BarChart3', title: T('لوحة أداء', 'Performance dashboard'), body: T('نقرات، تحميلات، طلبات، عمولات.', 'Clicks, downloads, orders, commission.') },
      { icon: 'Wallet', title: T('محفظة وسحب', 'Wallet & withdrawals'), body: T('اسحب أرباحك بسهولة.', 'Withdraw your earnings easily.') },
    ],
    requirements: [T('هوية سارية', 'Valid ID'), T('بيانات استلام/محفظة', 'Payout / wallet details')],
    howItWorks: [
      { title: T('سجّل', 'Register'), body: T('قدّم بياناتك.', 'Submit your details.') },
      { title: T('احصل على رمزك', 'Get your code'), body: T('رمز ورابط و QR فور الاعتماد.', 'Code, link and QR upon approval.') },
      { title: T('سوّق واربح', 'Promote & earn'), body: T('اكسب عن كل طلب محال.', 'Earn on every referred order.') },
    ],
    faq: [{ q: T('كيف أتقاضى العمولة؟', 'How am I paid?'), a: T('تُضاف العمولة لمحفظتك وتسحبها متى شئت.', 'Commission is credited to your wallet — withdraw anytime.') }],
    stories: [{ quote: T('رابط الإحالة سهل المشاركة ومربح.', 'The referral link is easy to share and rewarding.'), author: T('مؤثّر · توضيحي', 'Influencer · illustrative') }],
    timeline: APPLY_TIMELINE,
    fields: [
      { key: 'channel', ar: 'القناة / المنصّة', en: 'Channel / platform', type: 'text' },
      { key: 'audience', ar: 'حجم الجمهور', en: 'Audience size', type: 'number' },
    ],
  },
  {
    type: 'franchise', slug: 'franchise', icon: 'Building2',
    title: T('امتياز', 'Franchise'),
    tagline: T('أحضر هات الآن إلى مدينتك', 'Bring HAAT NOW to your city'),
    heroSub: T('شغّل منصّة توصيل مثبتة بخطة إطلاق ودعم متكامل في منطقتك.', 'Operate a proven delivery platform with a launch playbook and full support in your region.'),
    subTypes: [T('مدينة', 'City'), T('دولة', 'Country'), T('إقليم', 'Region'), T('محافظة', 'Governorate')],
    benefits: [
      { icon: 'Rocket', title: T('منصّة جاهزة', 'Turnkey platform'), body: T('تطبيق عملاء وأدوات تجّار وإرسال.', 'Customer app, merchant tools and dispatch.') },
      { icon: 'BookOpen', title: T('خطة إطلاق', 'Launch playbook'), body: T('تسويق وانضمام وعمليات موثّقة.', 'Marketing, onboarding and ops documented.') },
      { icon: 'BadgeCheck', title: T('علامة محلية', 'Local brand'), body: T('علامتك ومدينتك بتقنيتنا.', 'Your brand, your city, our technology.') },
    ],
    requirements: [T('رأس مال كافٍ للسوق', 'Sufficient capital for the market'), T('خبرة تشغيلية', 'Operational experience'), T('خطة عمل', 'Business plan')],
    howItWorks: [
      { title: T('قدّم اهتمامك', 'Express interest'), body: T('أخبرنا عن مدينتك المستهدفة.', 'Tell us your target city.') },
      { title: T('التقييم والتفاوض', 'Assessment & negotiation'), body: T('نراجع الخطة ونتفق على النموذج.', 'We review the plan and agree the model.') },
      { title: T('الإطلاق', 'Launch'), body: T('ننطلق بخطة متكاملة.', 'We launch with a full playbook.') },
    ],
    faq: [{ q: T('ما الاستثمار المطلوب؟', 'What investment is required?'), a: T('يختلف حسب السوق — اطلب العرض للتفاصيل.', 'It varies by market — request the deck for details.') }],
    stories: [{ quote: T('نموذج قابل للتوسّع بدعم حقيقي.', 'A scalable model with real support.'), author: T('شريك امتياز · توضيحي', 'Franchise partner · illustrative') }],
    timeline: APPLY_TIMELINE,
    fields: [
      { key: 'targetCity', ar: 'المدينة المستهدفة', en: 'Target city', type: 'text', required: true },
      { key: 'capital', ar: 'رأس المال المتاح', en: 'Available capital', type: 'text' },
      { key: 'experience', ar: 'الخبرة', en: 'Experience', type: 'textarea' },
      { key: 'employees', ar: 'عدد الموظفين', en: 'Employees', type: 'number' },
    ],
  },
  {
    type: 'enterprise', slug: 'enterprise', icon: 'Landmark',
    title: T('شريك مؤسسي', 'Enterprise Partner'),
    tagline: T('حلول توصيل للمؤسسات الكبيرة', 'Delivery solutions for large organisations'),
    heroSub: T('حسابات مؤسسية وتوصيل بحجم كبير مع اتفاقيات مستوى خدمة ودعم مخصّص.', 'Corporate accounts and delivery at scale with SLAs and dedicated support.'),
    subTypes: [T('سلاسل', 'Chains'), T('مستشفيات', 'Hospitals'), T('جامعات', 'Universities'), T('حسابات شركات', 'Corporate Accounts'), T('مصانع', 'Factories'), T('فنادق', 'Hotels'), T('جهات حكومية', 'Government')],
    benefits: [
      { icon: 'ShieldCheck', title: T('اتفاقيات خدمة', 'SLAs'), body: T('التزام بمستوى خدمة عالٍ.', 'Committed high service levels.') },
      { icon: 'BarChart3', title: T('تحليلات', 'Analytics'), body: T('لوحات تشغيلية وتصدير.', 'Operational dashboards and exports.') },
      { icon: 'Users', title: T('نجاح مخصّص', 'Dedicated success'), body: T('فريق مُخصّص لحسابك.', 'A named team for your account.') },
    ],
    requirements: [T('سجل تجاري للجهة', 'Company registration'), T('مفوّض بالتوقيع', 'Authorized signatory')],
    howItWorks: [
      { title: T('تواصل', 'Get in touch'), body: T('أخبرنا بمتطلباتك.', 'Tell us your requirements.') },
      { title: T('تصميم الحل', 'Design the solution'), body: T('نصمّم خطة تناسب حجمك.', 'We design a plan for your scale.') },
      { title: T('التفعيل', 'Activate'), body: T('نفعّل الحساب والدعم.', 'We activate the account and support.') },
    ],
    faq: [{ q: T('هل تدعمون الجهات الحكومية؟', 'Do you support government entities?'), a: T('نعم، مع عقود واتفاقيات مناسبة.', 'Yes, with appropriate contracts and agreements.') }],
    stories: [{ quote: T('تكامل سلس مع عملياتنا.', 'Seamless integration with our operations.'), author: T('حساب مؤسسي · توضيحي', 'Enterprise account · illustrative') }],
    timeline: APPLY_TIMELINE,
    fields: [
      { key: 'orgName', ar: 'اسم الجهة', en: 'Organisation name', type: 'text', required: true },
      { key: 'orgType', ar: 'نوع الجهة', en: 'Organisation type', type: 'text' },
      { key: 'volume', ar: 'الحجم المتوقّع شهرياً', en: 'Expected monthly volume', type: 'number' },
    ],
  },
  {
    type: 'career', slug: 'careers', icon: 'Briefcase',
    title: T('الوظائف', 'Careers'),
    tagline: T('انضم لفريق هات الآن', 'Join the HAAT NOW team'),
    heroSub: T('ابنِ مستقبل التوصيل معنا — فرص في التقنية والدعم والتسويق والمبيعات والعمليات.', 'Build the future of delivery with us — roles across tech, support, marketing, sales and operations.'),
    subTypes: [T('مطوّرون', 'Developers'), T('دعم العملاء', 'Customer Support'), T('تسويق', 'Marketing'), T('مبيعات', 'Sales'), T('عمليات', 'Operations'), T('كباتن', 'Drivers')],
    benefits: [
      { icon: 'Rocket', title: T('نمو سريع', 'Fast growth'), body: T('بيئة تتحرك بسرعة.', 'A fast-moving environment.') },
      { icon: 'Users', title: T('فريق رائع', 'Great team'), body: T('نهتم بالجودة والملكية.', 'We care about quality and ownership.') },
      { icon: 'Award', title: T('أثر حقيقي', 'Real impact'), body: T('اعمل على منتج يستخدمه الآلاف.', 'Work on a product used by thousands.') },
    ],
    requirements: [T('سيرة ذاتية', 'CV / Resume'), T('شهادات عند اللزوم', 'Certificates where relevant')],
    howItWorks: [
      { title: T('قدّم', 'Apply'), body: T('ارفع سيرتك الذاتية.', 'Upload your CV.') },
      { title: T('المقابلة', 'Interview'), body: T('نتواصل معك للمقابلة.', 'We reach out for an interview.') },
      { title: T('انضم', 'Join'), body: T('ابدأ رحلتك معنا.', 'Start your journey with us.') },
    ],
    faq: [{ q: T('هل تقبلون التدريب؟', 'Do you accept internships?'), a: T('نعم، نرحّب بالمواهب الجديدة.', 'Yes, we welcome new talent.') }],
    stories: [{ quote: T('مكان رائع للتعلّم والنمو.', 'A great place to learn and grow.'), author: T('عضو فريق · توضيحي', 'Team member · illustrative') }],
    timeline: [T('تقديم الطلب', 'Application submitted'), T('مراجعة السيرة', 'CV review'), T('مقابلة', 'Interview'), T('عرض', 'Offer'), T('انضمام', 'Onboarding')],
    fields: [
      { key: 'role', ar: 'الوظيفة المطلوبة', en: 'Desired role', type: 'select', required: true, options: [T('مطوّر', 'Developer'), T('دعم', 'Support'), T('تسويق', 'Marketing'), T('مبيعات', 'Sales'), T('عمليات', 'Operations'), T('كابتن', 'Driver')] },
      { key: 'expectedSalary', ar: 'الراتب المتوقّع', en: 'Expected salary', type: 'text' },
      { key: 'linkedin', ar: 'رابط LinkedIn', en: 'LinkedIn URL', type: 'text' },
    ],
  },
];

export const partnerTypeBySlug = (slug: string) => PARTNER_TYPES.find(p => p.slug === slug) || null;
