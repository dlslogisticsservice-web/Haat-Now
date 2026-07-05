// ─────────────────────────────────────────────────────────────────────────────
// Demo environment seeder — populates the sandbox admin data layer (the
// `haat_crud_*` localStorage tables read by CrudManager / workspaces / SLA monitor)
// with a realistic, interconnected dataset so NO admin page appears empty in demo.
// Sandbox-only, idempotent (seeds once). Real shapes — not placeholders.
// ─────────────────────────────────────────────────────────────────────────────
import { kv } from '../lib/kv';

const SEED_FLAG = 'haat_demo_seeded_v2';
const put = (table: string, rows: any[]) => kv.set(table, rows);
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();

const AR_FIRST = ['أحمد', 'محمد', 'علي', 'خالد', 'سعد', 'فهد', 'يوسف', 'عمر', 'سلطان', 'ماجد', 'ناصر', 'تركي', 'بدر', 'فيصل', 'ريان', 'نواف', 'مشعل', 'عبدالله', 'وليد', 'هاني'];
const AR_LAST = ['العتيبي', 'القحطاني', 'الشمري', 'الدوسري', 'الحربي', 'المطيري', 'الزهراني', 'الغامدي', 'السبيعي', 'العنزي', 'الرشيدي', 'البقمي'];
const BIZ = ['مطعم', 'كافيه', 'بقالة', 'صيدلية', 'حلويات', 'مخبز', 'سوبرماركت', 'عصائر', 'مشاوي', 'بيتزا'];
const BIZ2 = ['الذواقة', 'الرياض', 'البركة', 'النخيل', 'الواحة', 'السلطان', 'الأصيل', 'الفخامة', 'الربيع', 'النور'];
// City → [lat, lng] anchor for realistic GPS scatter.
const CITY_GPS: Record<string, [number, number]> = {
  'الرياض': [24.7136, 46.6753], 'جدة': [21.4858, 39.1925], 'الدمام': [26.4207, 50.0888], 'مكة': [21.3891, 39.8579],
  'المدينة': [24.5247, 39.5692], 'الخبر': [26.2172, 50.1971], 'الطائف': [21.2854, 40.4183], 'تبوك': [28.3838, 36.5550],
};
const CITIES = Object.keys(CITY_GPS);
const STREETS = ['شارع الملك فهد', 'شارع العليا', 'طريق الملك عبدالله', 'شارع التحلية', 'حي الياسمين', 'حي النرجس', 'حي الملقا', 'حي الورود'];
const ORDER_STATUS = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'delivered', 'delivered', 'cancelled'];
const name = () => `${pick(AR_FIRST)} ${pick(AR_LAST)}`;
const phone = (i: number) => `+9665${String(10000000 + i).slice(0, 8)}`;
const gps = (city: string): { lat: number; lng: number } => { const [la, lo] = CITY_GPS[city] || CITY_GPS['الرياض']; return { lat: +(la + (Math.random() - 0.5) * 0.16).toFixed(5), lng: +(lo + (Math.random() - 0.5) * 0.16).toFixed(5) }; };
const addr = (city: string) => `${pick(STREETS)}، ${city}`;

// Product catalogue templates per merchant kind → realistic line items.
const PRODUCTS_BY_KIND: Record<string, string[]> = {
  'مطعم': ['برجر لحم', 'شاورما دجاج', 'كبسة لحم', 'مندي دجاج', 'بيتزا مارجريتا', 'باستا الفريدو', 'سلطة سيزر', 'مشاوي مشكلة'],
  'كافيه': ['قهوة سعودية', 'كابتشينو', 'لاتيه', 'موكا', 'شاي كرك', 'عصير برتقال', 'تشيز كيك', 'كروسان'],
  'بقالة': ['أرز بسمتي', 'زيت زيتون', 'سكر', 'حليب طويل الأجل', 'بيض طازج', 'معكرونة', 'جبن', 'تونة'],
  'صيدلية': ['بنادول', 'فيتامين سي', 'كمامات', 'معقم يدين', 'شراب سعال', 'لاصق طبي', 'مقياس حرارة', 'مكمل حديد'],
  'حلويات': ['كنافة', 'بقلاوة', 'بسبوسة', 'معمول', 'تشوكلت كيك', 'دونات', 'آيس كريم', 'وافل'],
};
const productNames = (kind: string) => PRODUCTS_BY_KIND[kind] || PRODUCTS_BY_KIND['مطعم'];

export function seedDemoData(force = false): boolean {
  if (typeof localStorage === 'undefined') return false;
  if (!force && localStorage.getItem(SEED_FLAG)) return false;

  // Zones (15) across cities — with GPS centre for the live map
  const zones = Array.from({ length: 15 }, (_, i) => { const city = pick(CITIES); const c = gps(city); return { id: `z${i + 1}`, name: `${city} - حي ${i + 1}`, city, city_id: `c${rnd(8) + 1}`, lat: c.lat, lng: c.lng, is_active: Math.random() > 0.1 }; });
  // Categories (12)
  const cats = ['مطاعم', 'بقالة', 'صيدليات', 'حلويات', 'قهوة', 'مشروبات', 'إلكترونيات', 'زهور', 'عطور', 'خضار وفواكه', 'لحوم', 'مخابز']
    .map((n, i) => ({ id: `cat${i + 1}`, name: n }));
  // Merchants (20)
  const merchants = Array.from({ length: 20 }, (_, i) => { const kind = pick(BIZ); return {
    id: `m${i + 1}`, business_name: `${kind} ${pick(BIZ2)}`, kind,
    contact_email: `merchant${i + 1}@haatnow.com`, contact_phone: phone(2000 + i),
    status: pick(['active', 'active', 'active', 'pending']),
  }; });
  // Branches (35) → merchants + zones, with GPS
  const branches = Array.from({ length: 35 }, (_, i) => {
    const m = pick(merchants); const z = pick(zones); const c = gps(z.city);
    return { id: `b${i + 1}`, name: `${m.business_name} - فرع ${1 + rnd(5)}`, merchant_id: m.id, zone_id: z.id, city: z.city, address: addr(z.city), latitude: c.lat, longitude: c.lng, lat: c.lat, lng: c.lng, is_active: Math.random() > 0.15 };
  });
  // Drivers (120) — with live GPS + status (available/assigned/busy) for the map
  const DRV_STATUS = ['available', 'available', 'assigned', 'busy', 'available'];
  const drivers = Array.from({ length: 120 }, (_, i) => { const city = pick(CITIES); const c = gps(city); const st = pick(DRV_STATUS); return {
    id: `d${i + 1}`, full_name: name(), phone_number: phone(3000 + i), city,
    vehicle_plate: `${pick(['أ', 'ب', 'ج', 'د'])} ${1000 + rnd(9000)}`, is_online: st !== 'available' ? true : Math.random() > 0.4,
    status: st, current_lat: c.lat, current_lng: c.lng, rating: (3.6 + Math.random() * 1.4).toFixed(1),
  }; });
  // Vehicles (135) → 80 motorcycles + 40 cars + 15 vans
  const VEH_SPLIT = [...Array(80).fill('motorcycle'), ...Array(40).fill('car'), ...Array(15).fill('van')];
  const vehicles = VEH_SPLIT.map((vehicle_type, i) => ({
    id: `v${i + 1}`, plate: `${pick(['أ', 'ب', 'ج'])} ${1000 + rnd(9000)}`, vehicle_type,
    status: pick(['active', 'active', 'active', 'maintenance']), driver_id: drivers[i] ? drivers[i].id : null,
    insurance_expiry: `2027-${String(1 + rnd(12)).padStart(2, '0')}-15`, license_expiry: `2028-${String(1 + rnd(12)).padStart(2, '0')}-20`,
  }));
  // Customers (50) — with address + GPS
  const customers = Array.from({ length: 50 }, (_, i) => { const city = pick(CITIES); const c = gps(city); return {
    id: `cu${i + 1}`, full_name: name(), phone_number: phone(5000 + i), email: `customer${i + 1}@example.com`,
    city, address: addr(city), lat: c.lat, lng: c.lng, created_at: iso(rnd(43200)),
  }; });
  // Products (150) → branches/merchants + categories
  const products = Array.from({ length: 150 }, (_, i) => {
    const b = pick(branches); const m = merchants.find(x => x.id === b.merchant_id) || pick(merchants);
    return { id: `p${i + 1}`, name: pick(productNames(m.kind)), price: (8 + rnd(120)).toFixed(2), merchant_id: m.id, branch_id: b.id, category: m.kind, stock: rnd(120), is_active: Math.random() > 0.12 };
  });
  // Orders (400) — varied statuses + ages; delivery + branch GPS for the map; cancellations with reasons
  const FAIL = ['merchant_rejected', 'failed_delivery', 'customer_refused', 'customer_no_show'];
  const orders = Array.from({ length: 400 }, (_, i) => {
    const status = pick(ORDER_STATUS);
    const active = ['pending', 'confirmed', 'preparing', 'delivering'].includes(status);
    const ageMin = active ? rnd(90) : rnd(20160); // some active orders > 45min = delayed
    const cu = pick(customers); const br = pick(branches);
    const row: any = {
      id: `o${1000 + i}`, status, total_amount: (25 + rnd(400)).toFixed(2),
      customer_id: cu.id, driver_id: status === 'pending' ? null : pick(drivers).id,
      branch_id: br.id, created_at: iso(ageMin),
      delivery_lat: cu.lat, delivery_lng: cu.lng, branch_lat_snapshot: br.lat, branch_lng_snapshot: br.lng,
    };
    if (status === 'cancelled') { row.failureReason = pick(FAIL); row.failedBy = row.failureReason.startsWith('merchant') ? 'merchant' : row.failureReason.startsWith('customer') ? 'customer' : 'driver'; }
    return row;
  });
  // Tenants (8)
  const tenants = ['HAAT NOW', 'FoodExpress', 'QuickMart', 'PharmaGo', 'FreshDaily', 'CityEats', 'RapidDeliver', 'GoMarket']
    .map((b, i) => ({ id: `t${i + 1}`, brand_name: b, slug: b.toLowerCase().replace(/ /g, '-'), status: pick(['active', 'active', 'draft', 'suspended']), plan: pick(['starter', 'business', 'enterprise']), vertical: pick(['food', 'market', 'pharmacy']), country_code: 'SA', primary_color: '#A3F95B' }));

  put('zones', zones); put('categories', cats); put('merchants', merchants);
  put('merchant_branches', branches); put('drivers', drivers); put('vehicles', vehicles);
  put('customers', customers); put('products', products); put('orders', orders); put('tenants', tenants);
  localStorage.setItem(SEED_FLAG, '1');
  return true;
}
