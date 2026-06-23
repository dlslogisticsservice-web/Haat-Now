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
    mostOrdered: 'الأكثر طلباً', refresh: 'تحديث', logout: 'خروج', notifications: 'الإشعارات والدعم',
  },
  auth: {
    phoneLabel: 'رقم الهاتف', phonePlaceholder: '000 000 000', sendCode: 'إرسال رمز التحقق',
    otpTitle: 'رمز التحقق', otpSent: 'تم إرسال رمز التحقق لجوالك بنجاح.', verify: 'تأكيد',
    resend: 'إعادة الإرسال', changeNumber: 'تغيير الرقم', tagline: 'فاخر · سريع · حصري',
    invalidCode: 'الرمز المدخل غير صحيح', sendError: 'خطأ في إرسال الرمز',
    continueGuest: 'الدخول كزائر', or: 'أو',
    signIn: 'تسجيل الدخول', confirmCode: 'تأكيد الرمز', enterPhone: 'أدخل رقم هاتفك للمتابعة', codeSentTo: 'أُرسل رمز التحقق إلى',
  },
  home: {
    exclusiveOffers: 'العروض الحصرية', nearest: 'أقرب المطاعم إليك', featured: 'المتاجر المميزة',
    searchResults: 'نتائج البحث', why: 'لماذا تختار Haat Now؟', toggleView: 'تبديل العرض',
    noResults: 'لا نتائج لـ', fastDelivery: 'توصيل سريع', fastDeliverySub: 'في 30 دقيقة',
    quality: 'جودة مضمونة', qualitySub: 'أفضل المطاعم', prices: 'أسعار مميزة', pricesSub: 'عروض حصرية دائماً',
    chooseCountry: 'اختر دولتك',
  },
  cats: { restaurant: 'المطاعم', market: 'السوبر ماركت', pharmacy: 'الصيدلية', coffee: 'القهوة', sweets: 'الحلويات', gifts: 'الهدايا', perfume: 'العطور', flowers: 'الزهور', electronics: 'إلكترونيات' },
  restaurant: { meals: 'الوجبات', offers: 'العروض', reviews: 'التقييمات', about: 'عن المتجر', aboutStore: 'عن المطعم', addToCart: 'إضافة للسلة', addToYourCart: 'أضف لسلتك', viewCart: 'عرض السلة', rating: 'التقييم', delivery: 'التوصيل', deliveryTime: 'وقت التوصيل', minOrder: 'الحد الأدنى', minOrderFull: 'الحد الأدنى للطلب', openNow: 'مفتوح الآن', status: 'الحالة', name: 'الاسم', category: 'الفئة', premiumItem: 'صنف عالي الجودة يحضر فورياً عند طلبكم.', featuredOffers: 'العروض المميزة', mostOrderedMeals: 'الوجبات الأكثر طلباً' },
  product: { addToCart: 'إضافة للسلة', total: 'الإجمالي', quantity: 'الكمية', options: 'الخيارات', notes: 'ملاحظات' },
  cart: { title: 'سلة وجباتي', empty: 'سلتك فارغة', subtotal: 'المجموع الفرعي', deliveryFee: 'رسوم التوصيل', total: 'الإجمالي', checkout: 'المتابعة وإتمام الدفع', couponPlaceholder: 'كود الخصم', switchStore: 'لديك أصناف مضافة من متجر آخر بالسلة. هل ترغب في إفراغ السلة وبدء سلة جديدة؟' },
  checkout: { title: 'إتمام الطلب', deliveryAddress: 'عنوان التوصيل', paymentMethod: 'طريقة الدفع', orderSummary: 'ملخص الطلب', swipeToConfirm: 'اسحب لتأكيد الطلب', placing: 'جارٍ تأكيد الطلب…', addAddressFirst: 'لا يوجد عنوان توصيل. يُرجى إضافة عنوان من صفحة حسابك الشخصي.', selectAddress: 'الرجاء تحديد عنوان التوصيل', selectPayment: 'الرجاء تحديد طريقة الدفع', deliveryFee: 'رسوم التوصيل', preparing: 'مراحل التحضير',
    payFailedRetryMsg: 'فشلت عملية الدفع أو تم إلغاؤها. حاول مجدداً.', payProcessing: 'جاري معالجة الدفع. سنُخطرك فور التأكيد.', payFailedMsg: 'فشلت عملية الدفع. يمكنك المحاولة مجدداً.', payCancelledMsg: 'تم إلغاء عملية الدفع.', customLocation: 'موقع مخصص', addAddressError: 'خطأ في إضافة العنوان', couponInvalid: 'الكود غير صالح أو انتهت صلاحيته', couponApplied: 'تم تفعيل الخصم!', couponError: 'حدث خطأ أثناء التحقق من الكوبون', demoCustomer: 'عميل تجريبي', default: 'الافتراضي', orderError: 'خطأ في إنشاء الطلب', tryAgain: 'حاول مجدداً', payStartFail: 'فشل في بدء عملية الدفع', noPayLink: 'لم يتم الحصول على رابط الدفع. حاول مجدداً.', internalError: 'حدث خطأ داخلي.', premiumOrder: 'طلبك المميز', stepSupply: 'التوريد', stepPrep: 'التحضير', stepCook: 'الطهي', stepPack: 'التغليف', cancel: 'إلغاء', edit: 'تعديل', addressDetails: 'العنوان التفصيلي', saveAddress: 'حفظ العنوان', addCard: 'إضافة بطاقة', cardNumber: 'رقم البطاقة', cardHolder: 'اسم حامل البطاقة', saveCard: 'حفظ البطاقة', couponLabel: 'كوبون خصم', processing: 'جاري المعالجة...', verifyingPayment: 'جاري التحقق من الدفع...', payFailedShort: 'فشل الدفع — حاول مجدداً', orderNote: 'طلبك قيد التحضير. سنُخطرك فور مغادرة الكابتن.', confirmed: 'تم التأكيد!' },
  wallet: {
    title: 'المحفظة', balance: 'الرصيد', topUp: 'شحن الرصيد', points: 'نقاط هات ناو', point: 'نقطة',
    redeem: 'استبدل', redeemHint: 'رصيد محفظة', transactions: 'العمليات الأخيرة', viewAllTx: 'عرض كل المعاملات',
    deposit: 'إيداع', withdraw: 'سحب', refund: 'استرداد مبلغ', deliveryReward: 'مكافأة توصيل',
    redeemTitle: 'استبدال نقاط برصيد محفظة', redeemFail: 'تعذّر الاستبدال', insufficientPoints: 'نقاط غير كافية',
    redeemSuccess: 'تم استبدال النقاط برصيد محفظة 🎉', loadFail: 'تعذّر تحميل بيانات المحفظة',
    unexpected: 'حدث خطأ غير متوقع. تحقق من اتصالك وأعد المحاولة.', refreshWallet: 'تحديث المحفظة', opCount: 'عملية',
  },
  profile: { title: 'حسابي', tabInfo: 'الملف الشخصي', tabAddresses: 'عناوين التوصيل', fullName: 'الاسم الكامل', email: 'البريد الإلكتروني', phone: 'رقم الجوال', readOnly: 'للقراءة فقط', paymentMethods: 'طرق الدفع', notificationsPrefs: 'تفضيلات الإشعارات', savedOnDevice: 'تُحفظ تفضيلاتك على هذا الجهاز وتُطبَّق على إشعارات حالة الطلب.', enterName: 'أدخل اسمك الكامل', platinumMember: 'عضو بلاتيني' },
  addresses: { title: 'عناوين التوصيل', add: 'إضافة عنوان', edit: 'تعديل العنوان', label: 'اسم العنوان', details: 'تفاصيل العنوان', setDefault: 'تعيين كافتراضي', default: 'افتراضي', none: 'لا توجد عناوين محفوظة بعد' },
  orders: { title: 'طلباتي', active: 'النشطة', past: 'السابقة', empty: 'لا توجد طلبات بعد', track: 'تتبع الطلب', reorder: 'إعادة الطلب', status: 'الحالة', placed: 'تم الطلب', preparing: 'قيد التحضير', onTheWay: 'في الطريق', delivered: 'تم التوصيل',
    stPending: 'انتظار الموافقة', stAccepted: 'مقبول', stPreparing: 'يُحضَّر الآن', stOnway: 'في الطريق', stDelivered: 'تم التوصيل', stCancelled: 'ملغي',
    tlConfirmed: 'تم تأكيد الطلب', tlPreparing: 'يتم تحضير الطلب', tlPicked: 'السائق استلم الطلب', tlPlaced: 'تم الطلب', tlConfirmedShort: 'تم التأكيد', tlPreparingShort: 'يتم التجهيز', tlPickedShort: 'استلمه المندوب', tlInPrep: 'قيد التحضير', tlReady: 'جاهز', tlPacking: 'التغليف', tlPrepBouquet: 'تجهيز الباقة', tlPacked: 'تم التغليف',
    store: 'المتجر', home: 'البيت', captainHaat: 'كابتن هات ناو', cancelConfirm: 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟', cancelReason: 'إلغاء سريع من المستخدم', cancelSuccess: 'تم إلغاء الطلب وتحويل المبلغ للمحفظة', cancelFail: 'لا يمكن إلغاء الطلب', ticketOpened: 'تم فتح تذكرة دعم! سنرد عليك خلال دقائق.', homeLabel: 'المنزل', driver: 'السائق', captain: 'الكابتن', driverOnWay: 'السائق في الطريق إليك', preparingYourOrder: 'يتم تحضير طلبك', deliveredSuccess: 'تم التوصيل بنجاح 🎉', orderConfirmed: 'تم تأكيد طلبك', thanksRating: 'شكراً لتقييمك 🙏', howWasExperience: 'كيف كانت تجربتك؟', addComment: 'أضف تعليقاً (اختياري)…', sendReview: 'إرسال التقييم', complaintPlaceholder: 'مثال: تأخر التسليم، أو الطلب غير مكتمل...', reportNow: 'سجل بلاغ فوري', storeLocation: 'موقع المتجر', notSet: 'غير محدد', homeLocation: 'موقع المنزل', driverLocation: 'موقع المندوب', waiting: 'في الانتظار', remainingDistance: 'المسافة المتبقية', km: 'كم' },
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
    mostOrdered: 'Most ordered', refresh: 'Refresh', logout: 'Sign out', notifications: 'Notifications & support',
  },
  auth: {
    phoneLabel: 'Phone number', phonePlaceholder: '000 000 000', sendCode: 'Send verification code',
    otpTitle: 'Verification code', otpSent: 'A verification code has been sent to your phone.', verify: 'Verify',
    resend: 'Resend', changeNumber: 'Change number', tagline: 'Premium · Fast · Exclusive',
    invalidCode: 'The code you entered is incorrect', sendError: 'Could not send the code',
    continueGuest: 'Continue as guest', or: 'or',
    signIn: 'Sign in', confirmCode: 'Confirm code', enterPhone: 'Enter your phone number to continue', codeSentTo: 'Code sent to',
  },
  home: {
    exclusiveOffers: 'Exclusive Offers', nearest: 'Restaurants near you', featured: 'Featured stores',
    searchResults: 'Search results', why: 'Why choose Haat Now?', toggleView: 'Toggle view',
    noResults: 'No results for', fastDelivery: 'Fast delivery', fastDeliverySub: 'In 30 minutes',
    quality: 'Guaranteed quality', qualitySub: 'The best restaurants', prices: 'Great prices', pricesSub: 'Always exclusive deals',
    chooseCountry: 'Choose your country',
  },
  cats: { restaurant: 'Restaurants', market: 'Supermarket', pharmacy: 'Pharmacy', coffee: 'Coffee', sweets: 'Desserts', gifts: 'Gifts', perfume: 'Perfume', flowers: 'Flowers', electronics: 'Electronics' },
  restaurant: { meals: 'Meals', offers: 'Offers', reviews: 'Reviews', about: 'About', aboutStore: 'About', addToCart: 'Add to cart', addToYourCart: 'Add to cart', viewCart: 'View cart', rating: 'Rating', delivery: 'Delivery', deliveryTime: 'Delivery time', minOrder: 'Minimum', minOrderFull: 'Minimum order', openNow: 'Open now', status: 'Status', name: 'Name', category: 'Category', premiumItem: 'A premium item, prepared fresh as soon as you order.', featuredOffers: 'Featured offers', mostOrderedMeals: 'Most-ordered meals' },
  product: { addToCart: 'Add to cart', total: 'Total', quantity: 'Quantity', options: 'Options', notes: 'Notes' },
  cart: { title: 'My Cart', empty: 'Your cart is empty', subtotal: 'Subtotal', deliveryFee: 'Delivery fee', total: 'Total', checkout: 'Continue to checkout', couponPlaceholder: 'Promo code', switchStore: 'Your cart has items from another store. Empty it and start a new cart?' },
  checkout: { title: 'Checkout', deliveryAddress: 'Delivery address', paymentMethod: 'Payment method', orderSummary: 'Order summary', swipeToConfirm: 'Swipe to confirm order', placing: 'Confirming your order…', addAddressFirst: 'No delivery address. Please add one from your profile.', selectAddress: 'Please select a delivery address', selectPayment: 'Please select a payment method', deliveryFee: 'Delivery fee', preparing: 'Preparation steps',
    payFailedRetryMsg: 'Payment failed or was cancelled. Please try again.', payProcessing: 'Processing your payment. We will notify you once it is confirmed.', payFailedMsg: 'Payment failed. You can try again.', payCancelledMsg: 'Payment was cancelled.', customLocation: 'Custom location', addAddressError: 'Error adding address', couponInvalid: 'The code is invalid or has expired', couponApplied: 'Discount applied!', couponError: 'An error occurred while validating the coupon', demoCustomer: 'Demo customer', default: 'Default', orderError: 'Failed to create the order', tryAgain: 'Try again', payStartFail: 'Failed to start the payment', noPayLink: 'Could not get the payment link. Please try again.', internalError: 'An internal error occurred.', premiumOrder: 'Your premium order', stepSupply: 'Sourcing', stepPrep: 'Preparing', stepCook: 'Cooking', stepPack: 'Packaging', cancel: 'Cancel', edit: 'Edit', addressDetails: 'Address details', saveAddress: 'Save address', addCard: 'Add card', cardNumber: 'Card number', cardHolder: 'Cardholder name', saveCard: 'Save card', couponLabel: 'Promo code', processing: 'Processing…', verifyingPayment: 'Verifying payment…', payFailedShort: 'Payment failed — try again', orderNote: 'Your order is being prepared. We will notify you when the captain departs.', confirmed: 'Confirmed!' },
  wallet: {
    title: 'Wallet', balance: 'Balance', topUp: 'Top up', points: 'Haat Now points', point: 'points',
    redeem: 'Redeem', redeemHint: 'wallet credit', transactions: 'Recent activity', viewAllTx: 'View all transactions',
    deposit: 'Deposit', withdraw: 'Withdraw', refund: 'Refund', deliveryReward: 'Delivery reward',
    redeemTitle: 'Redeem points for wallet credit', redeemFail: 'Redemption failed', insufficientPoints: 'Not enough points',
    redeemSuccess: 'Points redeemed for wallet credit 🎉', loadFail: 'Could not load wallet data',
    unexpected: 'Something went wrong. Check your connection and try again.', refreshWallet: 'Refresh wallet', opCount: 'transactions',
  },
  profile: { title: 'My Account', tabInfo: 'Profile', tabAddresses: 'Addresses', fullName: 'Full name', email: 'Email', phone: 'Phone number', readOnly: 'Read only', paymentMethods: 'Payment methods', notificationsPrefs: 'Notification preferences', savedOnDevice: 'Your preferences are saved on this device and applied to order-status alerts.', enterName: 'Enter your full name', platinumMember: 'Platinum Member' },
  addresses: { title: 'Delivery addresses', add: 'Add address', edit: 'Edit address', label: 'Address label', details: 'Address details', setDefault: 'Set as default', default: 'Default', none: 'No saved addresses yet' },
  orders: { title: 'My Orders', active: 'Active', past: 'Past', empty: 'No orders yet', track: 'Track order', reorder: 'Reorder', status: 'Status', placed: 'Placed', preparing: 'Preparing', onTheWay: 'On the way', delivered: 'Delivered',
    stPending: 'Awaiting approval', stAccepted: 'Accepted', stPreparing: 'Preparing now', stOnway: 'On the way', stDelivered: 'Delivered', stCancelled: 'Cancelled',
    tlConfirmed: 'Order confirmed', tlPreparing: 'Your order is being prepared', tlPicked: 'Driver picked up the order', tlPlaced: 'Order placed', tlConfirmedShort: 'Confirmed', tlPreparingShort: 'Getting ready', tlPickedShort: 'Picked up by courier', tlInPrep: 'Preparing', tlReady: 'Ready', tlPacking: 'Packaging', tlPrepBouquet: 'Preparing the bouquet', tlPacked: 'Packaged',
    store: 'Store', home: 'Home', captainHaat: 'Haat Now Captain', cancelConfirm: 'Are you sure you want to cancel this order?', cancelReason: 'Quick cancel by the user', cancelSuccess: 'Order cancelled and the amount returned to your wallet', cancelFail: 'Could not cancel the order', ticketOpened: 'Support ticket opened! We will reply within minutes.', homeLabel: 'Home', driver: 'Driver', captain: 'Captain', driverOnWay: 'Your driver is on the way', preparingYourOrder: 'Your order is being prepared', deliveredSuccess: 'Delivered successfully 🎉', orderConfirmed: 'Your order is confirmed', thanksRating: 'Thanks for your rating 🙏', howWasExperience: 'How was your experience?', addComment: 'Add a comment (optional)…', sendReview: 'Submit review', complaintPlaceholder: 'e.g. late delivery, or incomplete order…', reportNow: 'Report an issue now', storeLocation: 'Store location', notSet: 'Not set', homeLocation: 'Home location', driverLocation: 'Courier location', waiting: 'Waiting', remainingDistance: 'Remaining distance', km: 'km' },
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
