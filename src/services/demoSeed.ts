// ─────────────────────────────────────────────────────────────────────────────
// Demo environment seeder — populates the sandbox admin data layer (the
// `haat_crud_*` localStorage tables read by CrudManager / workspaces / SLA monitor)
// with a realistic, interconnected dataset so NO admin page appears empty in demo.
// Sandbox-only, idempotent (seeds once). Real shapes — not placeholders.
// ─────────────────────────────────────────────────────────────────────────────
const SEED_FLAG = 'haat_demo_seeded_v1';
const put = (table: string, rows: any[]) => { try { localStorage.setItem(`haat_crud_${table}`, JSON.stringify(rows)); } catch { /* quota */ } };
const has = (table: string) => { try { return JSON.parse(localStorage.getItem(`haat_crud_${table}`) || '[]').length > 0; } catch { return false; } };
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();

const AR_FIRST = ['أحمد', 'محمد', 'علي', 'خالد', 'سعد', 'فهد', 'يوسف', 'عمر', 'سلطان', 'ماجد', 'ناصر', 'تركي', 'بدر', 'فيصل', 'ريان'];
const AR_LAST = ['العتيبي', 'القحطاني', 'الشمري', 'الدوسري', 'الحربي', 'المطيري', 'الزهراني', 'الغامدي', 'السبيعي', 'العنزي'];
const BIZ = ['مطعم', 'كافيه', 'بقالة', 'صيدلية', 'حلويات', 'مخبز', 'سوبرماركت', 'عصائر', 'مشاوي', 'بيتزا'];
const BIZ2 = ['الذواقة', 'الرياض', 'البركة', 'النخيل', 'الواحة', 'السلطان', 'الأصيل', 'الفخامة', 'الربيع', 'النور'];
const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'الخبر', 'الطائف', 'تبوك'];
const VEH = ['motorcycle', 'car', 'bicycle', 'van'];
const ORDER_STATUS = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'delivered', 'delivered', 'cancelled'];
const name = () => `${pick(AR_FIRST)} ${pick(AR_LAST)}`;
const phone = (i: number) => `+9665${String(10000000 + i).slice(0, 8)}`;

export function seedDemoData(force = false): boolean {
  if (typeof localStorage === 'undefined') return false;
  if (!force && localStorage.getItem(SEED_FLAG)) return false;
  if (!force && (has('drivers') || has('orders'))) { localStorage.setItem(SEED_FLAG, '1'); return false; }

  // Zones (20) across cities
  const zones = Array.from({ length: 20 }, (_, i) => ({ id: `z${i + 1}`, name: `${pick(CITIES)} - حي ${i + 1}`, city_id: `c${rnd(8) + 1}` }));
  // Categories (12)
  const cats = ['مطاعم', 'بقالة', 'صيدليات', 'حلويات', 'قهوة', 'مشروبات', 'إلكترونيات', 'زهور', 'عطور', 'خضار وفواكه', 'لحوم', 'مخابز']
    .map((n, i) => ({ id: `cat${i + 1}`, name: n }));
  // Merchants (50)
  const merchants = Array.from({ length: 50 }, (_, i) => ({
    id: `m${i + 1}`, business_name: `${pick(BIZ)} ${pick(BIZ2)}`,
    contact_email: `merchant${i + 1}@haatnow.com`, contact_phone: phone(2000 + i),
    status: pick(['active', 'active', 'active', 'pending']),
  }));
  // Branches (80) → merchants + zones
  const branches = Array.from({ length: 80 }, (_, i) => {
    const m = pick(merchants);
    return { id: `b${i + 1}`, name: `${m.business_name} - فرع ${1 + rnd(5)}`, merchant_id: m.id, zone_id: pick(zones).id, is_active: Math.random() > 0.15 };
  });
  // Drivers (100)
  const drivers = Array.from({ length: 100 }, (_, i) => ({
    id: `d${i + 1}`, full_name: name(), phone_number: phone(3000 + i),
    vehicle_plate: `${pick(['أ', 'ب', 'ج', 'د'])} ${1000 + rnd(9000)}`, is_online: Math.random() > 0.45,
    rating: (3.6 + Math.random() * 1.4).toFixed(1),
  }));
  // Vehicles (70) → drivers
  const vehicles = Array.from({ length: 70 }, (_, i) => ({
    id: `v${i + 1}`, plate: `${pick(['أ', 'ب', 'ج'])} ${1000 + rnd(9000)}`, vehicle_type: pick(VEH),
    status: pick(['active', 'active', 'maintenance', 'active']), driver_id: drivers[i] ? drivers[i].id : null,
    insurance_expiry: `2027-${String(1 + rnd(12)).padStart(2, '0')}-15`, license_expiry: `2028-${String(1 + rnd(12)).padStart(2, '0')}-20`,
  }));
  // Customers (150)
  const customers = Array.from({ length: 150 }, (_, i) => ({
    id: `cu${i + 1}`, full_name: name(), phone_number: phone(5000 + i), email: `customer${i + 1}@example.com`, created_at: iso(rnd(43200)),
  }));
  // Orders (300) — varied statuses + ages; some delayed (old + active); some cancelled with reasons
  const FAIL = ['merchant_rejected', 'failed_delivery', 'customer_refused', 'customer_no_show'];
  const orders = Array.from({ length: 300 }, (_, i) => {
    const status = pick(ORDER_STATUS);
    const active = ['pending', 'confirmed', 'preparing', 'delivering'].includes(status);
    const ageMin = active ? rnd(90) : rnd(20160); // some active orders > 45min = delayed
    const row: any = {
      id: `o${1000 + i}`, status, total_amount: (25 + rnd(400)).toFixed(2),
      customer_id: pick(customers).id, driver_id: status === 'pending' ? null : pick(drivers).id,
      branch_id: pick(branches).id, created_at: iso(ageMin),
    };
    if (status === 'cancelled') { row.failureReason = pick(FAIL); row.failedBy = row.failureReason.startsWith('merchant') ? 'merchant' : row.failureReason.startsWith('customer') ? 'customer' : 'driver'; }
    return row;
  });
  // Tenants (8)
  const tenants = ['HAAT NOW', 'FoodExpress', 'QuickMart', 'PharmaGo', 'FreshDaily', 'CityEats', 'RapidDeliver', 'GoMarket']
    .map((b, i) => ({ id: `t${i + 1}`, brand_name: b, slug: b.toLowerCase().replace(/ /g, '-'), status: pick(['active', 'active', 'draft', 'suspended']), plan: pick(['starter', 'business', 'enterprise']), vertical: pick(['food', 'market', 'pharmacy']), country_code: 'SA', primary_color: '#A3F95B' }));

  put('zones', zones); put('categories', cats); put('merchants', merchants);
  put('merchant_branches', branches); put('drivers', drivers); put('vehicles', vehicles);
  put('customers', customers); put('orders', orders); put('tenants', tenants);
  localStorage.setItem(SEED_FLAG, '1');
  return true;
}
