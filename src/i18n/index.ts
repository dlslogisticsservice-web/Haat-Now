// ─────────────────────────────────────────────────────────────────────────────
// i18next setup + regional Arabic dialect layer.
// FULL LOCALIZATION: user-facing UI chrome is organized into namespaced keys
// (nav, common, auth, home, restaurant, product, cart, checkout, wallet, profile,
// addresses, orders, errors, success, onboarding). Seed/mock catalogue DATA
// (restaurant names, product names) is NOT translated here — in production it
// comes from the database. Arabic uses consistent terminology; English is natural.
// ─────────────────────────────────────────────────────────────────────────────
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Dialect } from '../config/countries';

export const STORAGE_LANG_KEY = 'haat_lang';

const ar = {
  nav: { home: 'الرئيسية', orders: 'طلباتي', cart: 'سلتي', wallet: 'المحفظة', profile: 'حسابي' },
  common: {
    all: 'الكل', search: 'ماذا تريد اليوم؟ مطاعم، أكلات، متاجر...', viewAll: 'عرض الكل', more: 'المزيد',
    openNow: 'مفتوح الآن', free: 'مجاني', deliverTo: 'التوصيل إلى', language: 'اللغة',
    save: 'حفظ', cancel: 'إلغاء', confirm: 'تأكيد', back: 'رجوع', next: 'التالي', edit: 'تعديل',
    delete: 'حذف', add: 'إضافة', close: 'إغلاق', retry: 'إعادة المحاولة', loading: 'جارٍ التحميل…',
    apply: 'تطبيق', remove: 'إزالة', discount: 'خصم', featured: 'مميز',
    mostOrdered: 'الأكثر طلباً', refresh: 'تحديث', logout: 'خروج', signOut: 'تسجيل الخروج', customer: 'عميل', notifications: 'الإشعارات والدعم', minutesShort: 'د', minutes: 'دقيقة',
  },
  auth: {
    phoneLabel: 'رقم الهاتف', phonePlaceholder: '000 000 000', sendCode: 'إرسال رمز التحقق',
    otpTitle: 'رمز التحقق', otpSent: 'تم إرسال رمز التحقق لجوالك بنجاح.', verify: 'تأكيد',
    resend: 'إعادة الإرسال', changeNumber: 'تغيير الرقم', tagline: 'فاخر · سريع · حصري',
    invalidCode: 'الرمز المدخل غير صحيح', sendError: 'خطأ في إرسال الرمز',
    continueGuest: 'الدخول كزائر', or: 'أو',
    signIn: 'تسجيل الدخول', confirmCode: 'تأكيد الرمز', enterPhone: 'أدخل رقم هاتفك للمتابعة', codeSentTo: 'أُرسل رمز التحقق إلى', orContinueWith: 'أو المتابعة عبر', sandboxHint: ' وضع التجربة: استخدم الرمز 123456', noCode: 'لم يصلك الرمز؟', terms1: 'من خلال الاستمرار، فإنك توافق على', termsLink: 'شروط الخدمة', and2: 'و', privacyLink: 'سياسة الخصوصية',
  },
  home: {
    exclusiveOffers: 'العروض الحصرية', nearest: 'أقرب المطاعم إليك', featured: 'المتاجر المميزة',
    searchResults: 'نتائج البحث', why: 'لماذا تختار Haat Now؟', toggleView: 'تبديل العرض',
    noResults: 'لا نتائج لـ', fastDelivery: 'توصيل سريع', fastDeliverySub: 'في 30 دقيقة',
    quality: 'جودة مضمونة', qualitySub: 'أفضل المطاعم', prices: 'أسعار مميزة', pricesSub: 'عروض حصرية دائماً',
    chooseCountry: 'اختر دولتك',
    filters: 'فلاتر', showAllStores: 'عرض كل المتاجر', minLabel: 'الحد',
  },
  cats: { restaurant: 'المطاعم', market: 'السوبر ماركت', pharmacy: 'الصيدلية', coffee: 'القهوة', sweets: 'الحلويات', gifts: 'الهدايا', perfume: 'العطور', flowers: 'الزهور', electronics: 'إلكترونيات' },
  restaurant: { meals: 'الوجبات', offers: 'العروض', reviews: 'التقييمات', about: 'عن المتجر', aboutStore: 'عن المطعم', addToCart: 'إضافة للسلة', addToYourCart: 'أضف لسلتك', viewCart: 'عرض السلة', rating: 'التقييم', delivery: 'التوصيل', deliveryTime: 'وقت التوصيل', minOrder: 'الحد الأدنى', minOrderFull: 'الحد الأدنى للطلب', openNow: 'مفتوح الآن', status: 'الحالة', name: 'الاسم', category: 'الفئة', premiumItem: 'صنف عالي الجودة يحضر فورياً عند طلبكم.', featuredOffers: 'العروض المميزة', loadingMenu: 'جاري جلب القائمة...', menuUnavailable: 'قائمة هذا الفرع غير متوفرة حالياً', noReviews: 'لا توجد تقييمات بعد. كن أول من يقيّم بعد استلام طلبك.', orderNow: 'اطلب الآن', offerSampleTitle: '30% خصم', offerSampleSub: 'على جميع وجبات كومبو العائلية', customerReviews: 'آراء العملاء', chooseSize: 'اختر الحجم:', luxuryRestaurant: 'مطعم فاخر', mostOrderedMeals: 'الوجبات الأكثر طلباً' },
  product: { addToCart: 'إضافة للسلة', total: 'الإجمالي', quantity: 'الكمية', options: 'الخيارات', notes: 'ملاحظات' },
  cart: { title: 'سلة وجباتي', empty: 'سلتك فارغة', subtotal: 'المجموع الفرعي', deliveryFee: 'رسوم التوصيل', total: 'الإجمالي', checkout: 'المتابعة وإتمام الدفع', emptyHint: 'تصفح المتاجر وأضف ما يشتهيك!', browseStores: 'تصفح المتاجر', couponPlaceholder: 'كود الخصم', switchStore: 'لديك أصناف مضافة من متجر آخر بالسلة. هل ترغب في إفراغ السلة وبدء سلة جديدة؟' },
  checkout: { title: 'إتمام الطلب', deliveryAddress: 'عنوان التوصيل', paymentMethod: 'طريقة الدفع', orderSummary: 'ملخص الطلب', swipeToConfirm: 'اسحب لتأكيد الطلب', placing: 'جارٍ تأكيد الطلب…', addAddressFirst: 'لا يوجد عنوان توصيل. يُرجى إضافة عنوان من صفحة حسابك الشخصي.', selectAddress: 'الرجاء تحديد عنوان التوصيل', selectPayment: 'الرجاء تحديد طريقة الدفع', deliveryFee: 'رسوم التوصيل', preparing: 'مراحل التحضير',
    payFailedRetryMsg: 'فشلت عملية الدفع أو تم إلغاؤها. حاول مجدداً.', payProcessing: 'جاري معالجة الدفع. سنُخطرك فور التأكيد.', payFailedMsg: 'فشلت عملية الدفع. يمكنك المحاولة مجدداً.', payCancelledMsg: 'تم إلغاء عملية الدفع.', customLocation: 'موقع مخصص', addAddressError: 'خطأ في إضافة العنوان', couponInvalid: 'الكود غير صالح أو انتهت صلاحيته', couponApplied: 'تم تفعيل الخصم!', couponError: 'حدث خطأ أثناء التحقق من الكوبون', demoCustomer: 'عميل تجريبي', default: 'الافتراضي', orderError: 'خطأ في إنشاء الطلب', tryAgain: 'حاول مجدداً', payStartFail: 'فشل في بدء عملية الدفع', noPayLink: 'لم يتم الحصول على رابط الدفع. حاول مجدداً.', internalError: 'حدث خطأ داخلي.', premiumOrder: 'طلبك المميز', stepSupply: 'التوريد', stepPrep: 'التحضير', stepCook: 'الطهي', stepPack: 'التغليف', cancel: 'إلغاء', edit: 'تعديل', addressDetails: 'العنوان التفصيلي', saveAddress: 'حفظ العنوان', addCard: 'إضافة بطاقة', cardNumber: 'رقم البطاقة', cardHolder: 'اسم حامل البطاقة', saveCard: 'حفظ البطاقة', couponLabel: 'كوبون خصم', processing: 'جاري المعالجة...', verifyingPayment: 'جاري التحقق من الدفع...', payFailedShort: 'فشل الدفع — حاول مجدداً', preparingData: 'جاري تحضير بيانات الطلب...', items: 'أصناف', inProgress: 'قيد التنفيذ', noAddressSelected: 'لم يتم تحديد عنوان توصيل', noAddressHint: 'أضف عنوانك من صفحة الحساب الشخصي ثم عد للطلب', expectedDelivery: 'التوصيل المتوقع: ~30 دقيقة', deliveryRoute: 'مسار التوصيل', speed: 'السرعة', luxuryFee: 'رسوم الرفاهية', orderConfirmedTitle: 'تم تأكيد الطلب', orderNote: 'طلبك قيد التحضير. سنُخطرك فور مغادرة الكابتن.', confirmed: 'تم التأكيد!' },
  wallet: {
    title: 'المحفظة', balance: 'الرصيد', topUp: 'شحن الرصيد', points: 'نقاط هات ناو', point: 'نقطة',
    redeem: 'استبدل', redeemHint: 'رصيد محفظة', transactions: 'العمليات الأخيرة', viewAllTx: 'عرض كل المعاملات',
    deposit: 'إيداع', withdraw: 'سحب', refund: 'استرداد مبلغ', deliveryReward: 'مكافأة توصيل',
    redeemTitle: 'استبدال نقاط برصيد محفظة', redeemFail: 'تعذّر الاستبدال', insufficientPoints: 'نقاط غير كافية',
    redeemSuccess: 'تم استبدال النقاط برصيد محفظة', loadFail: 'تعذّر تحميل بيانات المحفظة',
    unexpected: 'حدث خطأ غير متوقع. تحقق من اتصالك وأعد المحاولة.', refreshWallet: 'تحديث المحفظة', opCount: 'عملية', availableBalance: 'الرصيد المتاح', lastUpdate: 'آخر تحديث: الآن',
  },
  profile: { title: 'حسابي', tabInfo: 'الملف الشخصي', tabAddresses: 'عناوين التوصيل', fullName: 'الاسم الكامل', email: 'البريد الإلكتروني', phone: 'رقم الجوال', readOnly: 'للقراءة فقط', paymentMethods: 'طرق الدفع', notificationsPrefs: 'تفضيلات الإشعارات', savedOnDevice: 'تُحفظ تفضيلاتك على هذا الجهاز وتُطبَّق على إشعارات حالة الطلب.', enterName: 'أدخل اسمك الكامل', platinumMember: 'عضو بلاتيني',
    avatarTypeError: 'يُسمح فقط بصور JPG أو PNG أو WebP', avatarSizeError: 'حجم الصورة يتجاوز الحد المسموح به (2 ميغابايت)', avatarUploadFail: 'فشل رفع الصورة. تحقق من اتصالك وحاول مرة أخرى.', saveFail: 'فشل الحفظ. تحقق من اتصالك وحاول مرة أخرى.', saving: 'جاري الحفظ...', saveChanges: 'حفظ التغييرات', noName: 'بدون اسم', orders: 'الطلبات', favorites: 'المفضلة', points: 'النقاط', back: 'العودة',
    noPaymentMethods: 'لا توجد طرق دفع. أضف واحدة أدناه.', default: 'افتراضي', setDefault: 'تعيين افتراضي', editPaymentMethod: 'تعديل طريقة الدفع', name: 'الاسم', last4: 'آخر 4 أرقام', setAsDefault: 'تعيين كافتراضي', deletePaymentQ: 'حذف طريقة الدفع؟', codOnDelivery: 'الدفع عند الاستلام', haatWallet: 'محفظة هات ناو', cashOnDelivery: 'نقداً عند الاستلام' },
  settings: { paymentTitle: 'طرق الدفع', paymentSub: 'إدارة البطاقات وطرق الدفع المحفوظة', paymentSoon: 'ستتوفر قريباً. يمكنك إضافة بطاقتك عند إتمام الطلب.', notifTitle: 'الإشعارات', notifSub: 'تخصيص تنبيهات الطلبات والعروض والأخبار', notifSoon: 'ستتوفر قريباً. ستتلقى إشعارات حالة الطلب تلقائياً.', langTitle: 'اللغة والمنطقة', langSub: 'اختيار لغة التطبيق وإعدادات المنطقة الزمنية', langSoon: 'ستتوفر قريباً. اللغة الحالية: العربية.', privacyTitle: 'الخصوصية والأمان', privacySub: 'إدارة بياناتك وإعدادات أمان الحساب', privacySoon: 'بياناتك محمية ومشفّرة. يمكنك حذف حسابك أو تنزيل بياناتك من هنا.', supportTitle: 'المساعدة والدعم', supportSub: 'تواصل مع فريق دعم هات ناو', supportSoon: 'ستتوفر قريباً. للتواصل: support@hatnow.com', appLanguage: 'لغة التطبيق', arabic: 'العربية', countryCurrency: 'الدولة والعملة', orderUpdates: 'تحديثات الطلبات', offersDiscounts: 'العروض والخصومات', news: 'الأخبار والجديد', privacy1: 'بياناتك مشفّرة ومحمية وتُستخدم فقط لتنفيذ طلباتك.', privacy2: 'لا نشارك رقم هاتفك أو عنوانك مع أطراف خارجية للتسويق.', privacy3: 'يمكنك طلب حذف حسابك وبياناتك في أي وقت.', requestDelete: 'طلب حذف الحساب', email: 'البريد الإلكتروني', whatsapp: 'واتساب', supportHours: 'فريق الدعم متاح يومياً من 9 صباحاً حتى 12 منتصف الليل.' },
  addresses: { title: 'عناوين التوصيل', add: 'إضافة عنوان', edit: 'تعديل العنوان', label: 'اسم العنوان', details: 'تفاصيل العنوان', setDefault: 'تعيين كافتراضي', default: 'افتراضي', none: 'لا توجد عناوين محفوظة بعد',
    enterDetails: 'يرجى إدخال تفاصيل العنوان', selectZone: 'يرجى اختيار الحي أو المنطقة', myAddress: 'عنواني', editFail: 'فشل تعديل العنوان. حاول مرة أخرى.', saveFail: 'فشل حفظ العنوان. حاول مرة أخرى.', deleteQ: 'هل أنت متأكد من حذف هذا العنوان؟', deleteFail: 'فشل حذف العنوان.', setDefaultFail: 'فشل تحديد العنوان الافتراضي.', newAddress: 'عنوان جديد', editAddress: 'تعديل العنوان', addressExample: 'مثال: شارع الأمير محمد، بناية 12', home: 'المنزل', work: 'العمل', otherLocation: 'موقع آخر', saveEdit: 'حفظ التعديل', addAddress: 'إضافة العنوان', addressWord: 'عنوان' },
  orders: { title: 'طلباتي', active: 'النشطة', past: 'السابقة', empty: 'لا توجد طلبات بعد', track: 'تتبع الطلب', reorder: 'إعادة الطلب', status: 'الحالة', placed: 'تم الطلب', preparing: 'قيد التحضير', onTheWay: 'في الطريق', delivered: 'تم التوصيل',
    stPending: 'انتظار الموافقة', stAccepted: 'مقبول', stPreparing: 'يُحضَّر الآن', stOnway: 'في الطريق', stDelivered: 'تم التوصيل', stCancelled: 'ملغي',
    tlConfirmed: 'تم تأكيد الطلب', tlPreparing: 'يتم تحضير الطلب', tlPicked: 'السائق استلم الطلب', tlPlaced: 'تم الطلب', tlConfirmedShort: 'تم التأكيد', tlPreparingShort: 'يتم التجهيز', tlPickedShort: 'استلمه المندوب', tlInPrep: 'قيد التحضير', tlReady: 'جاهز', tlPacking: 'التغليف', tlPrepBouquet: 'تجهيز الباقة', tlPacked: 'تم التغليف',
    store: 'المتجر', home: 'البيت', captainHaat: 'كابتن هات ناو', cancelConfirm: 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟', cancelReason: 'إلغاء سريع من المستخدم', cancelSuccess: 'تم إلغاء الطلب وتحويل المبلغ للمحفظة', cancelFail: 'لا يمكن إلغاء الطلب', ticketOpened: 'تم فتح تذكرة دعم! سنرد عليك خلال دقائق.', homeLabel: 'المنزل', driver: 'السائق', captain: 'الكابتن', driverOnWay: 'السائق في الطريق إليك', preparingYourOrder: 'يتم تحضير طلبك', deliveredSuccess: 'تم التوصيل بنجاح', orderConfirmed: 'تم تأكيد طلبك', thanksRating: 'شكراً لتقييمك', howWasExperience: 'كيف كانت تجربتك؟', addComment: 'أضف تعليقاً (اختياري)…', sendReview: 'إرسال التقييم', complaintPlaceholder: 'مثال: تأخر التسليم، أو الطلب غير مكتمل...', reportNow: 'سجل بلاغ فوري', storeLocation: 'موقع المتجر', notSet: 'غير محدد', homeLocation: 'موقع المنزل', driverLocation: 'موقع المندوب', waiting: 'في الانتظار', recentOrders: 'طلباتي الأخيرة', loadingOrders: 'جاري جلب الطلبات...', emptyHint: 'ابدأ رحلتك مع هات ناو واستمتع', updatingOrder: 'جاري تحديث بيانات الطلب...', orderHash: 'طلب', onWayToYou: 'في الطريق إليك', expectedTime: 'الوقت المتوقع: ', cancelOrderRefund: 'إلغاء الطلب (استرجاع المحفظة)', supportCenter: 'مركز الدعم', remainingDistance: 'المسافة المتبقية', km: 'كم', reorderNoItems: 'لا توجد أصناف لإعادة الطلب.', reorderAdded: 'تمت إضافة {{added}} صنف إلى السلة', reorderSkipped: ' · تم تخطّي {{skipped}} (غير متوفّر)', reorderFailed: 'تعذّر إعادة الطلب — الأصناف غير متوفّرة حاليًا.', reorderLoading: 'جارٍ الإضافة...', call: 'اتصال', emptyHint2: 'بتجربة توصيل فاخرة' },
  notifications: { title: 'الإشعارات', empty: 'لا توجد إشعارات', emptySub: 'ستظهر هنا تحديثات طلباتك وعروضك الحصرية', markAllRead: 'تحديد الكل كمقروء' },
  discover: {
    tabSearch: 'بحث واكتشاف', tabFavorites: 'المفضّلة', tabRewards: 'مكافآتي', tabSupport: 'الدعم',
    searchPlaceholder: 'ابحث عن منتج أو متجر...', searchBtn: 'بحث', noResults: 'لا نتائج', tryAnother: 'جرّب كلمة أخرى',
    stores: 'المتاجر', products: 'المنتجات', recentlyOrdered: 'طلبتها مؤخرًا', mostOrdered: 'الأكثر طلبًا',
    noDataYet: 'لا بيانات بعد', orderUnit: 'طلب', noFavorites: 'لا متاجر مفضّلة', noFavoritesSub: 'أضف متاجرك المفضّلة لتجدها هنا',
    store: 'متجر', remove: 'إزالة', myPoints: 'نقاطي', level: 'المستوى', statusLabel: 'الحالة',
    availableRewards: 'المكافآت المتاحة', noRewards: 'لا مكافآت', pointUnit: 'نقطة', redeem: 'استبدال',
    insufficientPoints: 'نقاطك غير كافية.', redeemedWallet: 'تم الاستبدال! أُضيف {{value}} {{cur}} لمحفظتك.', redeemedActivated: 'تم الاستبدال! تم تفعيل المكافأة.',
    activePromos: 'العروض النشطة', newTicket: 'تذكرة دعم جديدة', subjectPlaceholder: 'الموضوع',
    typeGeneral: 'استفسار عام', typeDispute: 'نزاع على طلب', typeRefund: 'طلب استرداد', typeInquiry: 'استفسار',
    explainProblem: 'اشرح مشكلتك...', sendTicket: 'إرسال التذكرة', enterSubjectMessage: 'أدخل الموضوع والرسالة.',
  },
  errors: { generic: 'حدث خطأ. حاول مرة أخرى.', network: 'تحقق من اتصالك بالإنترنت.', notFound: 'غير موجود', orderCreate: 'خطأ في إنشاء الطلب', required: 'هذا الحقل مطلوب' },
  success: { saved: 'تم الحفظ بنجاح', orderPlaced: 'تم تأكيد طلبك بنجاح', added: 'تمت الإضافة', updated: 'تم التحديث' },
  onboarding: { skip: 'تخطي', start: 'ابدأ التجربة', next: 'التالي' },
};

const en = {
  nav: { home: 'Home', orders: 'Orders', cart: 'Cart', wallet: 'Wallet', profile: 'Profile' },
  common: {
    all: 'All', search: 'What are you craving? Restaurants, food, stores…', viewAll: 'View all', more: 'More',
    openNow: 'Open now', free: 'Free', deliverTo: 'Deliver to', language: 'Language',
    save: 'Save', cancel: 'Cancel', confirm: 'Confirm', back: 'Back', next: 'Next', edit: 'Edit',
    delete: 'Delete', add: 'Add', close: 'Close', retry: 'Try again', loading: 'Loading…',
    apply: 'Apply', remove: 'Remove', discount: 'Off', featured: 'Featured',
    mostOrdered: 'Most ordered', refresh: 'Refresh', logout: 'Sign out', signOut: 'Sign out', customer: 'Customer', notifications: 'Notifications & support', minutesShort: 'min', minutes: 'min',
  },
  auth: {
    phoneLabel: 'Phone number', phonePlaceholder: '000 000 000', sendCode: 'Send verification code',
    otpTitle: 'Verification code', otpSent: 'A verification code has been sent to your phone.', verify: 'Verify',
    resend: 'Resend', changeNumber: 'Change number', tagline: 'Premium · Fast · Exclusive',
    invalidCode: 'The code you entered is incorrect', sendError: 'Could not send the code',
    continueGuest: 'Continue as guest', or: 'or',
    signIn: 'Sign in', confirmCode: 'Confirm code', enterPhone: 'Enter your phone number to continue', codeSentTo: 'Code sent to', orContinueWith: 'Or continue with', sandboxHint: ' Demo mode: use code 123456', noCode: "Didn't receive the code?", terms1: 'By continuing, you agree to', termsLink: 'Terms of Service', and2: 'and', privacyLink: 'Privacy Policy',
  },
  home: {
    exclusiveOffers: 'Exclusive Offers', nearest: 'Restaurants near you', featured: 'Featured stores',
    searchResults: 'Search results', why: 'Why choose Haat Now?', toggleView: 'Toggle view',
    noResults: 'No results for', fastDelivery: 'Fast delivery', fastDeliverySub: 'In 30 minutes',
    quality: 'Guaranteed quality', qualitySub: 'The best restaurants', prices: 'Great prices', pricesSub: 'Always exclusive deals',
    chooseCountry: 'Choose your country',
    filters: 'Filters', showAllStores: 'View all stores', minLabel: 'Min',
  },
  cats: { restaurant: 'Restaurants', market: 'Supermarket', pharmacy: 'Pharmacy', coffee: 'Coffee', sweets: 'Desserts', gifts: 'Gifts', perfume: 'Perfume', flowers: 'Flowers', electronics: 'Electronics' },
  restaurant: { meals: 'Meals', offers: 'Offers', reviews: 'Reviews', about: 'About', aboutStore: 'About', addToCart: 'Add to cart', addToYourCart: 'Add to cart', viewCart: 'View cart', rating: 'Rating', delivery: 'Delivery', deliveryTime: 'Delivery time', minOrder: 'Minimum', minOrderFull: 'Minimum order', openNow: 'Open now', status: 'Status', name: 'Name', category: 'Category', premiumItem: 'A premium item, prepared fresh as soon as you order.', featuredOffers: 'Featured offers', loadingMenu: 'Loading the menu…', menuUnavailable: "This branch's menu is currently unavailable", noReviews: 'No reviews yet. Be the first to review after your order arrives.', orderNow: 'Order now', offerSampleTitle: '30% off', offerSampleSub: 'on all family combo meals', customerReviews: 'Customer reviews', chooseSize: 'Choose size:', luxuryRestaurant: 'Premium restaurant', mostOrderedMeals: 'Most-ordered meals' },
  product: { addToCart: 'Add to cart', total: 'Total', quantity: 'Quantity', options: 'Options', notes: 'Notes' },
  cart: { title: 'My Cart', empty: 'Your cart is empty', subtotal: 'Subtotal', deliveryFee: 'Delivery fee', total: 'Total', checkout: 'Continue to checkout', emptyHint: 'Browse stores and add what you like!', browseStores: 'Browse stores', couponPlaceholder: 'Promo code', switchStore: 'Your cart has items from another store. Empty it and start a new cart?' },
  checkout: { title: 'Checkout', deliveryAddress: 'Delivery address', paymentMethod: 'Payment method', orderSummary: 'Order summary', swipeToConfirm: 'Swipe to confirm order', placing: 'Confirming your order…', addAddressFirst: 'No delivery address. Please add one from your profile.', selectAddress: 'Please select a delivery address', selectPayment: 'Please select a payment method', deliveryFee: 'Delivery fee', preparing: 'Preparation steps',
    payFailedRetryMsg: 'Payment failed or was cancelled. Please try again.', payProcessing: 'Processing your payment. We will notify you once it is confirmed.', payFailedMsg: 'Payment failed. You can try again.', payCancelledMsg: 'Payment was cancelled.', customLocation: 'Custom location', addAddressError: 'Error adding address', couponInvalid: 'The code is invalid or has expired', couponApplied: 'Discount applied!', couponError: 'An error occurred while validating the coupon', demoCustomer: 'Demo customer', default: 'Default', orderError: 'Failed to create the order', tryAgain: 'Try again', payStartFail: 'Failed to start the payment', noPayLink: 'Could not get the payment link. Please try again.', internalError: 'An internal error occurred.', premiumOrder: 'Your premium order', stepSupply: 'Sourcing', stepPrep: 'Preparing', stepCook: 'Cooking', stepPack: 'Packaging', cancel: 'Cancel', edit: 'Edit', addressDetails: 'Address details', saveAddress: 'Save address', addCard: 'Add card', cardNumber: 'Card number', cardHolder: 'Cardholder name', saveCard: 'Save card', couponLabel: 'Promo code', processing: 'Processing…', verifyingPayment: 'Verifying payment…', payFailedShort: 'Payment failed — try again', preparingData: 'Preparing your order details…', items: 'items', inProgress: 'In progress', noAddressSelected: 'No delivery address selected', noAddressHint: 'Add your address from your profile, then come back to order', expectedDelivery: 'Expected delivery: ~30 min', deliveryRoute: 'Delivery route', speed: 'Speed', luxuryFee: 'Luxury fee', orderConfirmedTitle: 'Order confirmed', orderNote: 'Your order is being prepared. We will notify you when the captain departs.', confirmed: 'Confirmed!' },
  wallet: {
    title: 'Wallet', balance: 'Balance', topUp: 'Top up', points: 'Haat Now points', point: 'points',
    redeem: 'Redeem', redeemHint: 'wallet credit', transactions: 'Recent activity', viewAllTx: 'View all transactions',
    deposit: 'Deposit', withdraw: 'Withdraw', refund: 'Refund', deliveryReward: 'Delivery reward',
    redeemTitle: 'Redeem points for wallet credit', redeemFail: 'Redemption failed', insufficientPoints: 'Not enough points',
    redeemSuccess: 'Points redeemed for wallet credit', loadFail: 'Could not load wallet data',
    unexpected: 'Something went wrong. Check your connection and try again.', refreshWallet: 'Refresh wallet', opCount: 'transactions', availableBalance: 'Available balance', lastUpdate: 'Last updated: now',
  },
  profile: { title: 'My Account', tabInfo: 'Profile', tabAddresses: 'Addresses', fullName: 'Full name', email: 'Email', phone: 'Phone number', readOnly: 'Read only', paymentMethods: 'Payment methods', notificationsPrefs: 'Notification preferences', savedOnDevice: 'Your preferences are saved on this device and applied to order-status alerts.', enterName: 'Enter your full name', platinumMember: 'Platinum Member',
    avatarTypeError: 'Only JPG, PNG or WebP images are allowed', avatarSizeError: 'Image exceeds the maximum allowed size (2 MB)', avatarUploadFail: 'Image upload failed. Check your connection and try again.', saveFail: 'Save failed. Check your connection and try again.', saving: 'Saving…', saveChanges: 'Save changes', noName: 'No name', orders: 'Orders', favorites: 'Favorites', points: 'Points', back: 'Back',
    noPaymentMethods: 'No payment methods. Add one below.', default: 'Default', setDefault: 'Set default', editPaymentMethod: 'Edit payment method', name: 'Name', last4: 'Last 4 digits', setAsDefault: 'Set as default', deletePaymentQ: 'Delete payment method?', codOnDelivery: 'Pay on delivery', haatWallet: 'Haat Now Wallet', cashOnDelivery: 'Cash on delivery' },
  settings: { paymentTitle: 'Payment methods', paymentSub: 'Manage your saved cards and payment methods', paymentSoon: 'Coming soon. You can add your card at checkout.', notifTitle: 'Notifications', notifSub: 'Customize order, offer and news alerts', notifSoon: 'Coming soon. You will receive order-status alerts automatically.', langTitle: 'Language & region', langSub: 'Choose the app language and time-zone settings', langSoon: 'Coming soon. Current language: English.', privacyTitle: 'Privacy & security', privacySub: 'Manage your data and account security settings', privacySoon: 'Your data is protected and encrypted. You can delete your account or export your data here.', supportTitle: 'Help & support', supportSub: 'Contact the Haat Now support team', supportSoon: 'Coming soon. Contact: support@hatnow.com', appLanguage: 'App language', arabic: 'Arabic', countryCurrency: 'Country & currency', orderUpdates: 'Order updates', offersDiscounts: 'Offers & discounts', news: 'News & updates', privacy1: 'Your data is encrypted, protected and used only to fulfil your orders.', privacy2: 'We never share your phone number or address with third parties for marketing.', privacy3: 'You can request deletion of your account and data at any time.', requestDelete: 'Request account deletion', email: 'Email', whatsapp: 'WhatsApp', supportHours: 'Our support team is available daily from 9 AM to 12 midnight.' },
  addresses: { title: 'Delivery addresses', add: 'Add address', edit: 'Edit address', label: 'Address label', details: 'Address details', setDefault: 'Set as default', default: 'Default', none: 'No saved addresses yet',
    enterDetails: 'Please enter the address details', selectZone: 'Please choose a district or area', myAddress: 'My address', editFail: 'Failed to edit the address. Please try again.', saveFail: 'Failed to save the address. Please try again.', deleteQ: 'Are you sure you want to delete this address?', deleteFail: 'Failed to delete the address.', setDefaultFail: 'Failed to set the default address.', newAddress: 'New address', editAddress: 'Edit address', addressExample: 'e.g. Prince Mohammed St, Building 12', home: 'Home', work: 'Work', otherLocation: 'Other location', saveEdit: 'Save changes', addAddress: 'Add address', addressWord: 'Address' },
  orders: { title: 'My Orders', active: 'Active', past: 'Past', empty: 'No orders yet', track: 'Track order', reorder: 'Reorder', status: 'Status', placed: 'Placed', preparing: 'Preparing', onTheWay: 'On the way', delivered: 'Delivered',
    stPending: 'Awaiting approval', stAccepted: 'Accepted', stPreparing: 'Preparing now', stOnway: 'On the way', stDelivered: 'Delivered', stCancelled: 'Cancelled',
    tlConfirmed: 'Order confirmed', tlPreparing: 'Your order is being prepared', tlPicked: 'Driver picked up the order', tlPlaced: 'Order placed', tlConfirmedShort: 'Confirmed', tlPreparingShort: 'Getting ready', tlPickedShort: 'Picked up by courier', tlInPrep: 'Preparing', tlReady: 'Ready', tlPacking: 'Packaging', tlPrepBouquet: 'Preparing the bouquet', tlPacked: 'Packaged',
    store: 'Store', home: 'Home', captainHaat: 'Haat Now Captain', cancelConfirm: 'Are you sure you want to cancel this order?', cancelReason: 'Quick cancel by the user', cancelSuccess: 'Order cancelled and the amount returned to your wallet', cancelFail: 'Could not cancel the order', ticketOpened: 'Support ticket opened! We will reply within minutes.', homeLabel: 'Home', driver: 'Driver', captain: 'Captain', driverOnWay: 'Your driver is on the way', preparingYourOrder: 'Your order is being prepared', deliveredSuccess: 'Delivered successfully', orderConfirmed: 'Your order is confirmed', thanksRating: 'Thanks for your rating', howWasExperience: 'How was your experience?', addComment: 'Add a comment (optional)…', sendReview: 'Submit review', complaintPlaceholder: 'e.g. late delivery, or incomplete order…', reportNow: 'Report an issue now', storeLocation: 'Store location', notSet: 'Not set', homeLocation: 'Home location', driverLocation: 'Courier location', waiting: 'Waiting', recentOrders: 'Recent orders', loadingOrders: 'Loading orders…', emptyHint: 'Start your Haat Now journey and enjoy', updatingOrder: 'Updating order details…', orderHash: 'Order', onWayToYou: 'On the way to you', expectedTime: 'Expected time: ', cancelOrderRefund: 'Cancel order (wallet refund)', supportCenter: 'Support center', remainingDistance: 'Remaining distance', km: 'km', reorderNoItems: 'No items to reorder.', reorderAdded: '{{added}} item(s) added to cart', reorderSkipped: ' · {{skipped}} skipped (unavailable)', reorderFailed: 'Could not reorder — items currently unavailable.', reorderLoading: 'Adding…', call: 'Call', emptyHint2: 'with a premium delivery experience' },
  notifications: { title: 'Notifications', empty: 'No notifications', emptySub: 'Your order updates and exclusive offers will appear here', markAllRead: 'Mark all as read' },
  discover: {
    tabSearch: 'Search & discover', tabFavorites: 'Favorites', tabRewards: 'Rewards', tabSupport: 'Support',
    searchPlaceholder: 'Search for a product or store…', searchBtn: 'Search', noResults: 'No results', tryAnother: 'Try another keyword',
    stores: 'Stores', products: 'Products', recentlyOrdered: 'Recently ordered', mostOrdered: 'Most ordered',
    noDataYet: 'No data yet', orderUnit: 'orders', noFavorites: 'No favorite stores', noFavoritesSub: 'Add your favorite stores to find them here',
    store: 'Store', remove: 'Remove', myPoints: 'My points', level: 'Level', statusLabel: 'Status',
    availableRewards: 'Available rewards', noRewards: 'No rewards', pointUnit: 'pts', redeem: 'Redeem',
    insufficientPoints: "You don't have enough points.", redeemedWallet: 'Redeemed! {{value}} {{cur}} added to your wallet.', redeemedActivated: 'Redeemed! Reward activated.',
    activePromos: 'Active promotions', newTicket: 'New support ticket', subjectPlaceholder: 'Subject',
    typeGeneral: 'General inquiry', typeDispute: 'Order dispute', typeRefund: 'Refund request', typeInquiry: 'Inquiry',
    explainProblem: 'Describe your issue…', sendTicket: 'Send ticket', enterSubjectMessage: 'Enter a subject and message.',
  },
  errors: { generic: 'Something went wrong. Please try again.', network: 'Check your internet connection.', notFound: 'Not found', orderCreate: 'Failed to create the order', required: 'This field is required' },
  success: { saved: 'Saved successfully', orderPlaced: 'Your order was confirmed', added: 'Added', updated: 'Updated' },
  onboarding: { skip: 'Skip', start: 'Get started', next: 'Next' },
};

const resources = { ar: { translation: ar }, en: { translation: en } };

// Regional Arabic wording. Auto-selected by the active country's dialect.
export const DIALECT: Record<Dialect, { orderCta: string; nearest: string }> = {
  eg:     { orderCta: 'اطلب أكلك',  nearest: 'أقرب مطعم ليك' },
  sa:     { orderCta: 'اطلب وجبتك', nearest: 'أقرب مطعم لك' },
  gulf:   { orderCta: 'اطلب طلبك',  nearest: 'أقرب مطعم لك' },
  levant: { orderCta: 'اطلب أكلك',  nearest: 'أقرب مطعم إلك' },
};

export function dialectText(dialect: Dialect, key: keyof (typeof DIALECT)['sa']): string {
  return DIALECT[dialect][key];
}

const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_LANG_KEY)) || 'ar';

i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

export default i18n;
