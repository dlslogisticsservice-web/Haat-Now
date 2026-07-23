// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · Stable block identifiers (Wave 16, STEP 1).
//
// Replaces the positional `blk_0 / blk_1 / blk_2` ids. Positional ids silently retarget when an
// editor inserts a block above — a plan aimed at `blk_1` would hide the wrong section. A stable id
// is derived from the block's AUTHORED IDENTITY instead, so it survives reordering of other blocks.
//
// Volatile fields are deliberately EXCLUDED from the fingerprint — most importantly `items`, which
// the live runtime replaces with live catalog data (hydrateSections). Including them would make a
// block's id change the moment live data arrived, breaking targeting intermittently.
//
// PURE. Type-only import of the website content model; no service call, no DOM, no clock.
// ─────────────────────────────────────────────────────────────────────────────
import type { WebsiteBlock } from '../../services/website.service';

/** Author-controlled, stable identity fields. Volatile/derived content is never fingerprinted. */
const IDENTITY_FIELDS = ['heading', 'title', 'subtitle', 'body'] as const;

const djb2 = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/** A content fingerprint over the block's type + its authored identity fields. */
export function blockFingerprint(block: WebsiteBlock): string {
  const b = block as unknown as Record<string, unknown>;
  const parts: string[] = [String(b.type ?? 'block')];
  for (const field of IDENTITY_FIELDS) {
    const v = b[field];
    if (typeof v === 'string' && v.length > 0) parts.push(`${field}=${v.slice(0, 120)}`);
  }
  return djb2(parts.join('|'));
}

/** The un-disambiguated id for a block (`<type>_<fingerprint>`). */
export function blockBaseId(block: WebsiteBlock): string {
  return `${String((block as unknown as Record<string, unknown>).type ?? 'block')}_${blockFingerprint(block)}`;
}

/**
 * Stable ids for a page's sections, index-aligned with the input.
 *
 * Two blocks that are genuinely indistinguishable (same type AND same authored identity) share a
 * base id, so they are disambiguated by their occurrence among *those duplicates only* (`~2`, `~3`).
 * Inserting or removing an unrelated block never changes any other block's id.
 */
export function assignBlockIds(sections: readonly WebsiteBlock[]): string[] {
  const seen = new Map<string, number>();
  return sections.map(block => {
    const base = blockBaseId(block);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}~${n + 1}`;
  });
}

/** Single-block convenience (occurrence 0 = the first of its kind). */
export function stableBlockId(block: WebsiteBlock, occurrence = 0): string {
  const base = blockBaseId(block);
  return occurrence === 0 ? base : `${base}~${occurrence + 1}`;
}
