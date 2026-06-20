// ─────────────────────────────────────────────────────────────────────────────
// Category-specific visual system — single source of truth for fallback imagery.
//
// Problem this fixes: every component used to fall back to a generic FOOD image
// (grilled meat / burger), so pharmacies, flower shops, electronics, etc. all
// showed restaurant food. Here each business category maps to its OWN imagery,
// and `resolveCategory` classifies a store/product by name or explicit type.
// The last-resort default is 'market' (generic commerce) — NEVER restaurant food
// unless the name/type actually resolves to 'restaurant'.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryKey =
  | 'restaurant' | 'coffee' | 'market' | 'pharmacy'
  | 'flowers' | 'electronics' | 'sweets' | 'gifts' | 'perfume';

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&q=90&w=${w}&crop=entropy`;

interface CategorySet { cover: string; thumbs: string[]; }

// Every URL below was verified to resolve (HTTP 200) before being committed.
export const CATEGORY_IMAGES: Record<CategoryKey, CategorySet> = {
  restaurant: {
    cover: U('photo-1544025162-d76694265947'),                 // grilled food
    thumbs: [U('photo-1544025162-d76694265947'),               // grill
             U('photo-1568901346375-23c9450c58cd'),            // burger
             U('photo-1565299624946-b28f40a0ae38'),            // pizza
             U('photo-1414235077428-338989a2e8c0')],           // premium dining
  },
  coffee: {
    cover: U('photo-1495474472287-4d71bcdd2085'),              // coffee cup
    thumbs: [U('photo-1495474472287-4d71bcdd2085'),            // cup
             U('photo-1509042239860-f550ce710b93'),            // espresso
             U('photo-1554118811-1e0d58224f24')],              // cafe environment
  },
  market: {
    cover: U('photo-1542838132-92c53300491e'),                 // groceries aisle
    thumbs: [U('photo-1542838132-92c53300491e'),               // groceries
             U('photo-1488459716781-31db52582fe9'),            // vegetables
             U('photo-1604719312566-8912e9227c6a')],           // shopping basket
  },
  pharmacy: {
    cover: U('photo-1586015555751-63bb77f4322a'),              // pharmacy shelves
    thumbs: [U('photo-1586015555751-63bb77f4322a'),            // shelves
             U('photo-1584308666744-24d5c474f2ae'),            // medicines
             U('photo-1607619056574-7b8d3ee536b2')],           // healthcare
  },
  flowers: {
    cover: U('photo-1561181286-d3fee7d55364'),                 // flower bouquet
    thumbs: [U('photo-1561181286-d3fee7d55364'),               // bouquet
             U('photo-1487070183336-b863922373d4'),            // floral
             U('photo-1563241527-3004b7be0ffd')],              // arrangement
  },
  electronics: {
    cover: U('photo-1511707171634-5f897ff02aa9'),              // smartphone
    thumbs: [U('photo-1511707171634-5f897ff02aa9'),            // smartphone
             U('photo-1496181133206-80ce9b88a853'),            // laptop
             U('photo-1498049794561-7780e7231661')],           // gadgets
  },
  sweets: {
    cover: U('photo-1551024506-0bccd828d307'),                 // dessert
    thumbs: [U('photo-1551024506-0bccd828d307'),               // dessert
             U('photo-1486427944299-d1955d23e34d'),            // cake
             U('photo-1509440159596-0249088772ff')],           // bakery
  },
  gifts: {
    cover: U('photo-1513885535751-8b9238bd345a'),              // gift boxes
    thumbs: [U('photo-1513885535751-8b9238bd345a'),            // gift boxes
             U('photo-1549465220-1a8b9238cd48'),               // wrapped gifts
             U('photo-1607344645866-009c320b63e0')],           // luxury wrapping
  },
  perfume: {
    cover: U('photo-1592945403244-b3fbafd7f539'),              // perfume bottle
    thumbs: [U('photo-1592945403244-b3fbafd7f539'),            // bottle
             U('photo-1541643600914-78b084683601'),            // fragrance flatlay
             U('photo-1594035910387-fea47794261f')],           // luxury perfume
  },
};

// Map an explicit `type` token (used by HomeScreen mock data) to a category.
const TYPE_MAP: Record<string, CategoryKey> = {
  grills: 'restaurant', pizza: 'restaurant', restaurant: 'restaurant', food: 'restaurant',
  coffee: 'coffee', cafe: 'coffee',
  market: 'market', grocery: 'market', supermarket: 'market',
  pharmacy: 'pharmacy', health: 'pharmacy',
  flowers: 'flowers', floral: 'flowers',
  electronics: 'electronics', tech: 'electronics',
  sweets: 'sweets', dessert: 'sweets', bakery: 'sweets',
  gifts: 'gifts', gift: 'gifts',
  perfume: 'perfume', fragrance: 'perfume', cologne: 'perfume',
};

// Name-keyword resolution (Arabic + English). Order matters: most specific first,
// 'restaurant' last among real matches so non-food keywords win.
const NAME_PATTERNS: [CategoryKey, RegExp][] = [
  ['coffee',      /قهو|كافيه|لاتيه|كابتشينو|موكا|coffee|espresso|latte|cafe|مليون/i],
  ['pharmacy',    /صيدل|دواء|أدوية|نهدي|باراسيتامول|فيتامين|pharmacy|medic|health/i],
  ['flowers',     /زهور|ورد|بوكيه|flower|floral|bouquet/i],
  ['perfume',     /عطر|عطور|فوحة|بخور|عود|perfume|fragrance|cologne|scent|عبير/i],
  ['electronics', /إلكترون|الكترون|جوال|هاتف|laptop|phone|electronic|gadget|tech/i],
  ['sweets',      /حلوي|حلوى|حلويات|كيك|كنافة|بسبوسة|معجنات|dessert|cake|bakery|sweet/i],
  ['gifts',       /هدية|هدايا|gift|present/i],
  ['market',      /تميمي|بقالة|سوبر|ماركت|فريش|خضار|market|grocery|fresh|mart/i],
  ['restaurant',  /مطعم|جليلة|مايسترو|باشا|رومانو|بيتزا|برجر|مشاوي|كباب|شاورما|مندي|كبسة|pizza|burger|grill|restaurant|kitchen/i],
];

/** Classify a store/product into a visual category by explicit type, then name. */
export function resolveCategory(name?: string | null, type?: string | null): CategoryKey {
  if (type) {
    const mapped = TYPE_MAP[type.toLowerCase()];
    if (mapped) return mapped;
  }
  const n = (name || '').toLowerCase();
  for (const [cat, re] of NAME_PATTERNS) if (re.test(n)) return cat;
  return 'market'; // neutral commerce fallback — never restaurant food
}

/** Cover image for a store. */
export function getCategoryCover(name?: string | null, type?: string | null): string {
  return CATEGORY_IMAGES[resolveCategory(name, type)].cover;
}

/** A thumbnail for a store/product, rotated by index for visual variety. */
export function getCategoryThumb(name?: string | null, type?: string | null, idx = 0): string {
  const set = CATEGORY_IMAGES[resolveCategory(name, type)];
  return set.thumbs[idx % set.thumbs.length];
}

/** Product fallback: prefer the product's own category, else the branch's category. */
export function getProductFallback(productName: string, branchCategory: CategoryKey, idx = 0): string {
  // If the product name itself resolves to a concrete non-market category, use it;
  // otherwise inherit the branch's category so e.g. pharmacy items show health imagery.
  const own = resolveCategory(productName);
  const cat = own === 'market' ? branchCategory : own;
  const set = CATEGORY_IMAGES[cat];
  return set.thumbs[idx % set.thumbs.length];
}
