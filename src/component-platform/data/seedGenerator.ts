// ─────────────────────────────────────────────────────────────────────────────
// Seed Data Generator (Phase 9D) — realistic, deterministic fake data for HAAT NOW entities.
// A seeded PRNG (no Math.random → reproducible) + domain value pools; scales to 10k+ records with
// a single tight loop (no per-record allocation beyond the row). Field values are chosen by field
// name/type heuristics + entity-domain pools. Pure.
// ─────────────────────────────────────────────────────────────────────────────
import type { Entity, DataRecord } from './dataModel';

function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const POOLS = {
  restaurant: ['Al Basha', 'Pizza Roma', 'Burger House', 'Shawarma King', 'Sushi Bay', 'Taco Loco', 'Green Bowl', 'Grill Master', 'Noodle Bar', 'Falafel Corner'],
  category: ['Food', 'Groceries', 'Pharmacy', 'Coffee', 'Desserts', 'Flowers', 'Electronics', 'Bakery', 'Butcher', 'Juice'],
  product: ['Chicken Shawarma', 'Margherita Pizza', 'Beef Burger', 'Caesar Salad', 'Falafel Wrap', 'Latte', 'Cheesecake', 'Fresh Juice', 'Grilled Kebab', 'Pasta Alfredo'],
  city: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar', 'Taif', 'Tabuk'],
  first: ['Sara', 'Omar', 'Layla', 'Youssef', 'Nour', 'Khaled', 'Mona', 'Ali', 'Huda', 'Faisal'],
  status: ['pending', 'preparing', 'on_the_way', 'delivered', 'cancelled'],
  vehicle: ['Motorcycle', 'Car', 'Bicycle', 'Van'],
};

const domainPool = (entityName: string): string[] => {
  const n = entityName.toLowerCase();
  if (/restaurant|branch|merchant|store/.test(n)) return POOLS.restaurant;
  if (/categor/.test(n)) return POOLS.category;
  if (/product|item|variant|modifier|offer|coupon/.test(n)) return POOLS.product;
  if (/customer|driver|user/.test(n)) return POOLS.first;
  if (/zone|address/.test(n)) return POOLS.city;
  if (/vehicle/.test(n)) return POOLS.vehicle;
  return [];
};

/** Generate `n` deterministic records for an entity. Scales to 10k+ (tight loop). */
export function generateSeed(entity: Entity, tenantId: string, n: number, seed = 42): DataRecord[] {
  const rnd = mulberry32(seed + entity.name.length * 7);
  const pool = domainPool(entity.name);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const out: DataRecord[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const rec: DataRecord = { id: `seed_${entity.id}_${i}`, tenantId, _createdAt: 1_700_000_000_000 + i * 3_600_000, _updatedAt: 1_700_000_000_000 + i * 3_600_000 };
    for (const f of entity.fields) {
      const fn = f.name.toLowerCase();
      if (f.name === 'id') { rec[f.name] = rec.id; continue; }
      if (fn.includes('createdat') || fn.includes('updatedat')) { rec[f.name] = rec._createdAt; continue; }
      switch (f.type) {
        case 'boolean': rec[f.name] = rnd() > 0.4; break;
        case 'integer': case 'autoincrement': rec[f.name] = 1 + Math.floor(rnd() * 1000); break;
        case 'decimal': case 'currency': rec[f.name] = Math.round(rnd() * 20000) / 100; break;
        case 'rating': rec[f.name] = 1 + Math.floor(rnd() * 5); break;
        case 'email': rec[f.name] = `${pick(POOLS.first).toLowerCase()}${i}@haat.app`; break;
        case 'phone': rec[f.name] = `+2010${String(10000000 + Math.floor(rnd() * 8999999))}`; break;
        case 'enum': case 'multiselect': rec[f.name] = f.settings.options?.length ? pick(f.settings.options) : pick(POOLS.status); break;
        default:
          if (/status/.test(fn)) rec[f.name] = pick(POOLS.status);
          else if (/city|zone/.test(fn)) rec[f.name] = pick(POOLS.city);
          else if (/name|title/.test(fn)) rec[f.name] = pool.length ? `${pick(pool)}${n > 20 ? ' ' + (i + 1) : ''}` : `${entity.name} ${i + 1}`;
          else rec[f.name] = `${f.name}-${i + 1}`;
      }
    }
    out[i] = rec;
  }
  return out;
}
