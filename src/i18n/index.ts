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
  restaurant: { meals: 'الوجبات', offers: 'العروض', reviews: 'التقييمات', about: 'عن المتجر', addToCart: 'إضافة للسلة', viewCart: 'عرض السلة', rating: 'التقييم' },
  product: { addToCart: 'إضافة للسلة', total: 'الإجمالي', quantity: 'الكمية', options: 'الخيارات', notes: 'ملاحظات' },
  cart: { title: 'سلة وجباتي', empty: 'سلتك فارغة', subtotal: 'المجموع الفرعي', deliveryFee: 'رسوم التوصيل', total: 'الإجمالي', checkout: 'المتابعة وإتمام الدفع', couponPlaceholder: 'كود الخصم', switchStore: 'لديك أصناف مضافة من متجر آخر بالسلة. هل ترغب في إفراغ السلة وبدء سلة جديدة؟' },
  checkout: { title: 'إتمام الطلب', deliveryAddress: 'عنوان التوصيل', paymentMethod: 'طريقة الدفع', orderSummary: 'ملخص الطلب', swipeToConfirm: 'اسحب لتأكيد الطلب', placing: 'جارٍ تأكيد الطلب…', addAddressFirst: 'لا يوجد عنوان توصيل. يُرجى إضافة عنوان من صفحة حسابك الشخصي.', selectAddress: 'الرجاء تحديد عنوان التوصيل', selectPayment: 'الرجاء تحديد طريقة الدفع', deliveryFee: 'رسوم التوصيل', preparing: 'مراحل التحضير' },
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
  orders: { title: 'طلباتي', active: 'النشطة', past: 'السابقة', empty: 'لا توجد طلبات بعد', track: 'تتبع الطلب', reorder: 'إعادة الطلب', status: 'الحالة', placed: 'تم الطلب', preparing: 'قيد التحضير', onTheWay: 'في الطريق', delivered: 'تم التوصيل' },
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
  restaurant: { meals: 'Meals', offers: 'Offers', reviews: 'Reviews', about: 'About', addToCart: 'Add to cart', viewCart: 'View cart', rating: 'Rating' },
  product: { addToCart: 'Add to cart', total: 'Total', quantity: 'Quantity', options: 'Options', notes: 'Notes' },
  cart: { title: 'My Cart', empty: 'Your cart is empty', subtotal: 'Subtotal', deliveryFee: 'Delivery fee', total: 'Total', checkout: 'Continue to checkout', couponPlaceholder: 'Promo code', switchStore: 'Your cart has items from another store. Empty it and start a new cart?' },
  checkout: { title: 'Checkout', deliveryAddress: 'Delivery address', paymentMethod: 'Payment method', orderSummary: 'Order summary', swipeToConfirm: 'Swipe to confirm order', placing: 'Confirming your order…', addAddressFirst: 'No delivery address. Please add one from your profile.', selectAddress: 'Please select a delivery address', selectPayment: 'Please select a payment method', deliveryFee: 'Delivery fee', preparing: 'Preparation steps' },
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
  orders: { title: 'My Orders', active: 'Active', past: 'Past', empty: 'No orders yet', track: 'Track order', reorder: 'Reorder', status: 'Status', placed: 'Placed', preparing: 'Preparing', onTheWay: 'On the way', delivered: 'Delivered' },
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
