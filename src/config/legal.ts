// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — production legal documents (bilingual). Single source of truth for the
// public legal pages: the website CMS builds the English pages from `titleEn/bodyEn`,
// and the i18n layer registers `…En → …Ar` so the same pages render in Arabic.
//
// These are production templates. Bracketed placeholders (e.g. [Company registration
// number]) must be completed with the operating entity's real registration details
// before public launch — they are intentionally NOT fabricated here.
// ─────────────────────────────────────────────────────────────────────────────

export interface LegalDoc {
  key: string; path: string; navOrder: number;
  titleEn: string; titleAr: string;
  subtitleEn: string; subtitleAr: string;
  seoDescEn: string;
  bodyEn: string; bodyAr: string;
}

const B = '\n\n';

export const LEGAL_DOCS: LegalDoc[] = [
  {
    key: 'privacy', path: '/privacy', navOrder: 30,
    titleEn: 'Privacy Policy', titleAr: 'سياسة الخصوصية',
    subtitleEn: 'How we collect, use and protect your data.', subtitleAr: 'كيف نجمع بياناتك ونستخدمها ونحميها.',
    seoDescEn: 'How HAAT NOW collects, uses and protects your personal data.',
    bodyEn: [
      '1. Who we are. HAAT NOW ("we", "us") operates a local delivery marketplace connecting customers with restaurants, grocers and pharmacies, and the captains who deliver their orders. Operating entity: [Company legal name], [Company registration number], Egypt.',
      '2. Data we collect. Account details (name, phone number), delivery addresses, order history, device and app usage data, approximate and precise location while an order is active, and support messages. We do not collect payment-card data on our servers — cash on delivery is the launch payment method.',
      '3. How we use it. To place and deliver your orders, show live tracking, provide support, prevent fraud, meet legal obligations, and — only with your consent — send offers. Captains and merchants receive only the data needed to fulfil your order.',
      '4. Sharing. We share order data with the assigned merchant and captain, and with service providers (hosting, mapping, notifications) under contract. We never sell your personal data.',
      '5. Retention & security. We keep data only as long as needed for the service and legal requirements, protected with industry-standard security.',
      '6. Your rights. You may access, correct or delete your data, and withdraw marketing consent at any time, by contacting hello@haatnow.app. This policy is governed by the laws of the Arab Republic of Egypt.',
    ].join(B),
    bodyAr: [
      '١. من نحن. تُشغّل هات الآن («نحن») سوق توصيل محلي يربط العملاء بالمطاعم والبقالات والصيدليات والكباتن الذين يوصّلون طلباتهم. الجهة المُشغّلة: [الاسم القانوني للشركة]، [رقم السجل التجاري]، مصر.',
      '٢. البيانات التي نجمعها. تفاصيل الحساب (الاسم ورقم الهاتف)، وعناوين التوصيل، وسجل الطلبات، وبيانات استخدام الجهاز والتطبيق، والموقع التقريبي والدقيق أثناء تنفيذ الطلب، ورسائل الدعم. لا نجمع بيانات بطاقات الدفع على خوادمنا — الدفع عند الاستلام هو وسيلة الدفع عند الإطلاق.',
      '٣. كيف نستخدمها. لتنفيذ طلباتك وتوصيلها، وعرض التتبّع المباشر، وتقديم الدعم، ومنع الاحتيال، والوفاء بالالتزامات القانونية، وإرسال العروض بموافقتك فقط. يتلقّى الكباتن والتجّار البيانات اللازمة لإتمام طلبك فقط.',
      '٤. المشاركة. نشارك بيانات الطلب مع التاجر والكابتن المعنيين، ومع مزوّدي الخدمة (الاستضافة والخرائط والإشعارات) بموجب عقود. لا نبيع بياناتك الشخصية أبداً.',
      '٥. الاحتفاظ والأمان. نحتفظ بالبيانات للمدة اللازمة للخدمة والمتطلبات القانونية فقط، محميّة بأمان وفق معايير الصناعة.',
      '٦. حقوقك. يمكنك الوصول إلى بياناتك أو تصحيحها أو حذفها، وسحب موافقة التسويق في أي وقت، عبر التواصل مع hello@haatnow.app. تخضع هذه السياسة لقوانين جمهورية مصر العربية.',
    ].join(B),
  },
  {
    key: 'terms', path: '/terms', navOrder: 31,
    titleEn: 'Terms of Service', titleAr: 'شروط الخدمة',
    subtitleEn: 'The terms that apply when you use HAAT NOW.', subtitleAr: 'الشروط التي تنطبق عند استخدامك هات الآن.',
    seoDescEn: 'The terms and conditions for using the HAAT NOW platform.',
    bodyEn: [
      '1. Agreement. By using HAAT NOW you agree to these Terms. If you do not agree, please do not use the service.',
      '2. The service. HAAT NOW is a marketplace: merchants list and prepare products, captains deliver them, and we provide the technology connecting all three. Menus, prices, availability and delivery areas are set by merchants and may change.',
      '3. Orders & pricing. Prices, delivery fees and minimum-order amounts are shown before you confirm. Placing an order is an offer to purchase; the order is confirmed when the merchant accepts it. Cash on delivery is the launch payment method.',
      '4. Your responsibilities. Provide an accurate address and contact number, be available to receive your order, and treat captains and merchant staff respectfully.',
      '5. Cancellations & refunds. See our Cancellation Policy and Refund Policy, which form part of these Terms.',
      '6. Liability. We work to keep the service reliable but do not guarantee uninterrupted availability. Our liability is limited to the value of the affected order to the extent permitted by law.',
      '7. Governing law. These Terms are governed by the laws of the Arab Republic of Egypt. Questions: hello@haatnow.app.',
    ].join(B),
    bodyAr: [
      '١. الاتفاق. باستخدامك هات الآن فإنك توافق على هذه الشروط. إن لم توافق، فيُرجى عدم استخدام الخدمة.',
      '٢. الخدمة. هات الآن سوق إلكتروني: يعرض التجّار المنتجات ويجهّزونها، ويوصّلها الكباتن، ونوفّر نحن التقنية التي تربط الأطراف الثلاثة. القوائم والأسعار والتوفّر ومناطق التوصيل يحدّدها التجّار وقد تتغيّر.',
      '٣. الطلبات والأسعار. تُعرض الأسعار ورسوم التوصيل والحد الأدنى للطلب قبل التأكيد. تقديم الطلب عرضٌ للشراء، ويُؤكَّد عند قبول التاجر له. الدفع عند الاستلام هو وسيلة الدفع عند الإطلاق.',
      '٤. مسؤولياتك. تقديم عنوان ورقم تواصل دقيقين، والتواجد لاستلام طلبك، ومعاملة الكباتن وموظفي التجّار باحترام.',
      '٥. الإلغاء والاسترداد. راجع سياسة الإلغاء وسياسة الاسترداد، وهما جزء من هذه الشروط.',
      '٦. المسؤولية. نعمل على إبقاء الخدمة موثوقة لكن لا نضمن توفّرها دون انقطاع. تقتصر مسؤوليتنا على قيمة الطلب المتأثر بالقدر الذي يسمح به القانون.',
      '٧. القانون الحاكم. تخضع هذه الشروط لقوانين جمهورية مصر العربية. للاستفسار: hello@haatnow.app.',
    ].join(B),
  },
  {
    key: 'refund-policy', path: '/refund-policy', navOrder: 32,
    titleEn: 'Refund Policy', titleAr: 'سياسة الاسترداد',
    subtitleEn: 'Fair, fast and transparent — because things occasionally go wrong.', subtitleAr: 'عادلة وسريعة وشفّافة — لأن الأمور قد تسوء أحياناً.',
    seoDescEn: 'How refunds work on HAAT NOW — fair, fast and transparent.',
    bodyEn: [
      '1. When you are covered. If an order arrives wrong, incomplete, damaged, unsafe to consume, or never arrives, you are entitled to a remedy.',
      '2. How to request. Report the issue from the order screen ("Request refund") or contact support with your order number within 24 hours of delivery (or the expected delivery time).',
      '3. Remedies. Depending on the case we will issue a full or partial refund, a redelivery, or HAAT credit. For cash-on-delivery orders, refunds are issued as HAAT credit or to a method you choose.',
      '4. Timing. Most requests are reviewed within 24 hours. Approved refunds are issued promptly; the time to appear depends on your chosen method.',
      '5. Exceptions. Requests outside the reporting window, or claims that cannot be reasonably verified, may be declined. Repeated fraudulent claims may lead to account action.',
      '6. Contact. hello@haatnow.app.',
    ].join(B),
    bodyAr: [
      '١. متى تكون مغطّى. إذا وصل الطلب خاطئاً أو ناقصاً أو تالفاً أو غير صالح للاستهلاك أو لم يصل، فيحقّ لك التعويض.',
      '٢. كيفية الطلب. أبلغ عن المشكلة من شاشة الطلب («طلب استرداد») أو تواصل مع الدعم برقم طلبك خلال ٢٤ ساعة من التوصيل (أو الوقت المتوقّع للتوصيل).',
      '٣. الحلول. بحسب الحالة نُصدر استرداداً كاملاً أو جزئياً، أو نُعيد التوصيل، أو نمنح رصيد هات. في طلبات الدفع عند الاستلام، تُصرف الاستردادات كرصيد هات أو بالوسيلة التي تختارها.',
      '٤. التوقيت. تُراجع معظم الطلبات خلال ٢٤ ساعة. وتُصرف الاستردادات المعتمدة فوراً؛ ويعتمد وقت ظهورها على الوسيلة المختارة.',
      '٥. الاستثناءات. قد تُرفض الطلبات خارج مدة الإبلاغ أو التي يتعذّر التحقّق منها بشكل معقول. وقد تؤدّي المطالبات الاحتيالية المتكرّرة إلى إجراء على الحساب.',
      '٦. التواصل. hello@haatnow.app.',
    ].join(B),
  },
  {
    key: 'cancellation-policy', path: '/cancellation-policy', navOrder: 33,
    titleEn: 'Cancellation Policy', titleAr: 'سياسة الإلغاء',
    subtitleEn: 'When and how orders can be cancelled.', subtitleAr: 'متى وكيف يمكن إلغاء الطلبات.',
    seoDescEn: 'How order cancellations work on HAAT NOW for customers and merchants.',
    bodyEn: [
      '1. Before the merchant accepts. You can cancel free of charge any time before the merchant accepts your order.',
      '2. After acceptance / during preparation. If the merchant has started preparing your order, a cancellation may incur a charge covering prepared items, shown before you confirm the cancellation.',
      '3. After dispatch. Once a captain has collected the order, it generally cannot be cancelled; if there is a genuine problem, use the Refund Policy instead.',
      '4. Cancellations by us or the merchant. An order may be cancelled if a store is closed, an item is unavailable, the address is outside coverage, or the address/phone cannot be verified. In these cases you are not charged, and any amount paid is refunded in full.',
      '5. Contact. hello@haatnow.app.',
    ].join(B),
    bodyAr: [
      '١. قبل قبول التاجر. يمكنك الإلغاء مجاناً في أي وقت قبل أن يقبل التاجر طلبك.',
      '٢. بعد القبول / أثناء التحضير. إذا بدأ التاجر تحضير طلبك، فقد يترتّب على الإلغاء رسم يغطّي الأصناف المُحضَّرة، يُعرض قبل تأكيد الإلغاء.',
      '٣. بعد الإرسال. بعد استلام الكابتن للطلب لا يمكن إلغاؤه عادةً؛ وإن وُجدت مشكلة حقيقية فاستخدم سياسة الاسترداد بدلاً من ذلك.',
      '٤. الإلغاء من جهتنا أو التاجر. قد يُلغى الطلب إذا كان المتجر مغلقاً أو الصنف غير متوفّر أو العنوان خارج التغطية أو تعذّر التحقّق من العنوان/الهاتف. في هذه الحالات لا تُحاسَب، ويُردّ أي مبلغ مدفوع بالكامل.',
      '٥. التواصل. hello@haatnow.app.',
    ].join(B),
  },
  {
    key: 'delivery-policy', path: '/delivery-policy', navOrder: 34,
    titleEn: 'Delivery Policy', titleAr: 'سياسة التوصيل',
    subtitleEn: 'How, where and when we deliver — clearly explained.', subtitleAr: 'كيف وأين ومتى نوصّل — موضّح بجلاء.',
    seoDescEn: 'Delivery areas, times and fees on HAAT NOW.',
    bodyEn: [
      '1. Coverage. We deliver within each merchant\'s coverage zone. At launch, HAAT NOW operates in selected zones of Greater Cairo and Giza, expanding city by city.',
      '2. Fees & minimums. Delivery fees and any minimum-order amount are shown before checkout. Baskets above the free-delivery threshold ship free. A small-order fee may apply below a zone\'s minimum.',
      '3. Times. Estimated delivery time is shown per store and updated live as your order moves from accepted → preparing → on the way → delivered. Peak periods may extend times.',
      '4. Receiving your order. Please be reachable on the phone number provided. If a captain cannot reach you or your address, the order may be returned; charges may apply per the Cancellation Policy.',
      '5. Contactless delivery. Available on request in the order notes.',
      '6. Contact. hello@haatnow.app.',
    ].join(B),
    bodyAr: [
      '١. التغطية. نوصّل ضمن منطقة تغطية كل تاجر. عند الإطلاق، تعمل هات الآن في مناطق مختارة بالقاهرة الكبرى والجيزة، وتتوسّع مدينة تلو الأخرى.',
      '٢. الرسوم والحدود. تُعرض رسوم التوصيل وأي حد أدنى للطلب قبل الدفع. تُشحن السلال فوق حد التوصيل المجاني مجاناً. وقد يُطبَّق رسم للطلب الصغير دون الحد الأدنى للمنطقة.',
      '٣. الأوقات. يُعرض الوقت المتوقّع للتوصيل لكل متجر ويُحدَّث مباشرةً مع انتقال طلبك من مقبول ← قيد التحضير ← في الطريق ← تم التوصيل. وقد تطيل أوقات الذروة المدة.',
      '٤. استلام طلبك. يُرجى أن تكون متاحاً على رقم الهاتف المقدَّم. إذا تعذّر على الكابتن الوصول إليك أو إلى عنوانك، فقد يُعاد الطلب وقد تُطبَّق رسوم وفق سياسة الإلغاء.',
      '٥. التوصيل بدون تلامس. متاح عند الطلب في ملاحظات الطلب.',
      '٦. التواصل. hello@haatnow.app.',
    ].join(B),
  },
  {
    key: 'cookie-policy', path: '/cookie-policy', navOrder: 35,
    titleEn: 'Cookie Policy', titleAr: 'سياسة ملفات الارتباط',
    subtitleEn: 'The cookies we use, and why.', subtitleAr: 'ملفات الارتباط التي نستخدمها، ولماذا.',
    seoDescEn: 'How HAAT NOW uses cookies to keep the site working and improve it.',
    bodyEn: [
      '1. Essential cookies. Keep the site working — remembering your cart, session and language. These cannot be switched off.',
      '2. Analytics cookies. Help us understand what to improve, in aggregate. Optional.',
      '3. No selling. We do not use cookies to sell your personal data.',
      '4. Managing cookies. You can clear or block cookies from your browser at any time; some features may then not work as intended.',
      '5. Contact. hello@haatnow.app.',
    ].join(B),
    bodyAr: [
      '١. ملفات الارتباط الأساسية. تُبقي الموقع يعمل — بتذكّر سلّتك وجلستك ولغتك. ولا يمكن إيقافها.',
      '٢. ملفات التحليلات. تساعدنا على فهم ما يجب تحسينه، بشكل إجمالي. اختيارية.',
      '٣. لا بيع. لا نستخدم ملفات الارتباط لبيع بياناتك الشخصية.',
      '٤. إدارة ملفات الارتباط. يمكنك مسحها أو حظرها من متصفّحك في أي وقت؛ وقد لا تعمل بعض الميزات كما ينبغي حينها.',
      '٥. التواصل. hello@haatnow.app.',
    ].join(B),
  },
  {
    key: 'merchant-agreement', path: '/merchant-agreement', navOrder: 36,
    titleEn: 'Merchant Agreement', titleAr: 'اتفاقية التاجر',
    subtitleEn: 'The terms for selling on HAAT NOW.', subtitleAr: 'شروط البيع عبر هات الآن.',
    seoDescEn: 'The agreement between HAAT NOW and merchant partners.',
    bodyEn: [
      '1. Partnership. This Agreement governs how a merchant lists and sells products on HAAT NOW. It applies alongside our Terms of Service.',
      '2. Onboarding & verification. Merchants must provide accurate business details, a valid commercial registration and tax card, food-safety/operating licences where applicable, and bank/settlement details. HAAT NOW verifies these before activation.',
      '3. Menu, pricing & availability. Merchants are responsible for accurate menus, prices, allergen/product information, stock and opening hours. Prices to customers must not exceed in-store prices unless agreed.',
      '4. Orders & quality. Merchants accept and prepare orders promptly and to food-safety standards, and are responsible for the quality and packaging of items handed to captains.',
      '5. Commission & settlement. HAAT NOW charges an agreed commission per completed order. Net proceeds are settled to the merchant\'s registered bank account on the agreed cycle (default: weekly), with a transparent statement. Commission rate: [agreed %].',
      '6. Compliance & term. Merchants comply with applicable Egyptian law. Either party may terminate with notice; HAAT NOW may suspend a store for safety, fraud or repeated policy breaches. Contact: partners@haatnow.app.',
    ].join(B),
    bodyAr: [
      '١. الشراكة. تحكم هذه الاتفاقية كيفية إدراج التاجر لمنتجاته وبيعها عبر هات الآن، وتُطبَّق إلى جانب شروط الخدمة.',
      '٢. الانضمام والتحقّق. على التاجر تقديم بيانات نشاط دقيقة وسجل تجاري وبطاقة ضريبية ساريين، وتراخيص سلامة الغذاء/التشغيل عند اللزوم، وبيانات البنك/التسوية. تتحقّق هات الآن منها قبل التفعيل.',
      '٣. القائمة والأسعار والتوفّر. يتحمّل التاجر مسؤولية دقّة القوائم والأسعار ومعلومات المنتج/مسبّبات الحساسية والمخزون وساعات العمل. ويجب ألّا تتجاوز الأسعار للعملاء أسعار المتجر ما لم يُتّفق على غير ذلك.',
      '٤. الطلبات والجودة. يقبل التاجر الطلبات ويحضّرها بسرعة ووفق معايير سلامة الغذاء، ويتحمّل مسؤولية جودة الأصناف وتغليفها عند تسليمها للكباتن.',
      '٥. العمولة والتسوية. تتقاضى هات الآن عمولة متّفقاً عليها لكل طلب مكتمل. وتُسوّى الصافي إلى حساب التاجر البنكي المسجّل وفق الدورة المتّفق عليها (افتراضياً: أسبوعياً) مع كشف شفّاف. نسبة العمولة: [النسبة المتّفق عليها].',
      '٦. الامتثال والمدة. يلتزم التاجر بالقانون المصري المعمول به. ويجوز لأي طرف الإنهاء بإشعار؛ ويجوز لهات الآن تعليق المتجر لأسباب السلامة أو الاحتيال أو المخالفات المتكرّرة. للتواصل: partners@haatnow.app.',
    ].join(B),
  },
  {
    key: 'driver-agreement', path: '/driver-agreement', navOrder: 37,
    titleEn: 'Captain (Driver) Agreement', titleAr: 'اتفاقية الكابتن (السائق)',
    subtitleEn: 'The terms for delivering with HAAT NOW.', subtitleAr: 'شروط التوصيل مع هات الآن.',
    seoDescEn: 'The agreement between HAAT NOW and delivery captains.',
    bodyEn: [
      '1. Engagement. This Agreement governs how a captain delivers orders through HAAT NOW, on a flexible, non-exclusive basis. It applies alongside our Terms of Service.',
      '2. Eligibility & documents. Captains must be of legal working age and provide valid identity (national ID), a driving/vehicle licence where the vehicle requires one, and vehicle details. HAAT NOW verifies these before activation.',
      '3. Availability. Captains choose when to go online. Going online indicates availability to receive delivery offers; accepting an offer is a commitment to complete that delivery.',
      '4. Conduct & safety. Captains follow traffic laws, handle orders hygienically, deliver promptly, and treat customers and merchants respectfully. Unsafe or fraudulent behaviour may lead to deactivation.',
      '5. Cash handling. For cash-on-delivery orders, captains collect the exact order total and remit it per the settlement process. Cash owed may be netted against earnings.',
      '6. Earnings & settlement. Captains earn per completed delivery plus any applicable incentives, settled to their registered account on the agreed cycle (default: weekly), with a transparent statement.',
      '7. Term. Either party may end this Agreement with notice. Contact: captains@haatnow.app.',
    ].join(B),
    bodyAr: [
      '١. التعاقد. تحكم هذه الاتفاقية كيفية توصيل الكابتن للطلبات عبر هات الآن، على أساس مرن وغير حصري، وتُطبَّق إلى جانب شروط الخدمة.',
      '٢. الأهلية والمستندات. على الكابتن أن يكون في سن العمل القانونية وأن يقدّم هوية سارية (بطاقة رقم قومي) ورخصة قيادة/مركبة عند لزومها وبيانات المركبة. تتحقّق هات الآن منها قبل التفعيل.',
      '٣. التوفّر. يختار الكابتن وقت اتصاله. والاتصال يعني التوفّر لاستقبال عروض التوصيل؛ وقبول العرض التزام بإتمام ذلك التوصيل.',
      '٤. السلوك والسلامة. يلتزم الكابتن بقوانين المرور، ويتعامل مع الطلبات بنظافة، ويوصّل بسرعة، ويعامل العملاء والتجّار باحترام. وقد يؤدّي السلوك غير الآمن أو الاحتيالي إلى إلغاء التفعيل.',
      '٥. التعامل النقدي. في طلبات الدفع عند الاستلام، يحصّل الكابتن إجمالي الطلب بدقّة ويورّده وفق عملية التسوية. ويجوز خصم النقد المستحق من الأرباح.',
      '٦. الأرباح والتسوية. يكسب الكابتن عن كل توصيل مكتمل إضافةً إلى أي حوافز مطبّقة، وتُسوّى إلى حسابه المسجّل وفق الدورة المتّفق عليها (افتراضياً: أسبوعياً) مع كشف شفّاف.',
      '٧. المدة. يجوز لأي طرف إنهاء هذه الاتفاقية بإشعار. للتواصل: captains@haatnow.app.',
    ].join(B),
  },
];
