// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — Website Schema Migration Framework (vNext).
//
// Makes the Website Platform survive every future schema change. A stored website
// (any age, any shape, corrupt, partial, null) is ALWAYS upgraded to the latest
// schema before it renders — validated, repaired, migrated, normalized — and it
// NEVER throws. This eliminates the whole class of "old object missing new field"
// runtime crashes (e.g. the `site.cookie.enabled` incident).
//
// Design:
//   • schemaVersion  — structural version of the object (independent of seedVersion,
//     which tracks CONTENT freshness). Never conflate the two.
//   • MIGRATIONS      — small, isolated v→v+1 steps (renames / backward-compat). Never
//     one giant function. Each preserves unknown fields (forward compatibility).
//   • repair/mergeDefaults — non-destructive backfill of missing shapes from the ONE
//     source of truth (the injected createDefault = website.service.defaultSite).
//   • loadWebsite     — the safe loader: recover → migrate → validate → repair →
//     normalize → stamp version, returning a MigrationReport.
//
// Dependency-injected defaults (createDefault) keep this module free of a cycle with
// website.service and make it the SINGLE place migration/validation/repair lives.
// ─────────────────────────────────────────────────────────────────────────────
import type { WebsiteSite } from './website.service';

/** Current structural schema version. Bump + add a migration for any breaking shape change. */
export const WEBSITE_SCHEMA_VERSION = 3;

export type MakeDefault = (tenant: any) => WebsiteSite;

export interface MigrationReport {
  websiteId: string;
  fromVersion: number;
  toVersion: number;
  created: string[];    // fields that were missing and filled from defaults
  renamed: string[];    // legacy → new field remaps applied
  repaired: string[];   // fields that were present but invalid and fixed
  warnings: string[];
  errors: string[];
  recovered: boolean;   // true when the raw input was unusable and defaults were used
  changed: boolean;     // true when anything was migrated/repaired (⇒ persist)
  at: string;
}

interface MigrationResult { site: any; renamed?: string[]; warnings?: string[] }
interface Migration { from: number; to: number; describe: string; migrate: (site: any) => MigrationResult }

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const nowIso = () => new Date().toISOString();

// ── PART 6 — Backward-compatibility remaps (declarative legacy → new field moves) ──
// Each entry moves a deprecated field to its modern location, non-destructively.
const LEGACY_REMAPS: { legacy: string; describe: string; apply: (s: any) => boolean }[] = [
  { legacy: 'socialLinks', describe: 'socialLinks → footer.social', apply: (s) => { if (Array.isArray(s.socialLinks)) { s.footer = isObj(s.footer) ? s.footer : {}; if (!Array.isArray(s.footer.social)) s.footer.social = s.socialLinks; delete s.socialLinks; return true; } return false; } },
  { legacy: 'legalLinks', describe: 'legalLinks → footer.legalLinks', apply: (s) => { if (Array.isArray(s.legalLinks)) { s.footer = isObj(s.footer) ? s.footer : {}; if (!Array.isArray(s.footer.legalLinks)) s.footer.legalLinks = s.legalLinks; delete s.legalLinks; return true; } return false; } },
  { legacy: 'heroTitle', describe: 'heroTitle → first hero block title', apply: (s) => { if (typeof s.heroTitle === 'string' && Array.isArray(s.pages)) { const hero = s.pages.flatMap((p: any) => Array.isArray(p?.sections) ? p.sections : []).find((b: any) => b?.type === 'hero'); if (hero && !hero.title) hero.title = s.heroTitle; delete s.heroTitle; return true; } return false; } },
  { legacy: 'analyticsId', describe: 'analyticsId → analytics.measurementId', apply: (s) => { if (typeof s.analyticsId === 'string') { s.analytics = isObj(s.analytics) ? s.analytics : {}; if (!s.analytics.measurementId) s.analytics.measurementId = s.analyticsId; delete s.analyticsId; return true; } return false; } },
];

/** PART 6 — Backward-compatibility pass (always runs): translate deprecated field
 *  names to their modern locations, non-destructively. Idempotent. */
export function applyBackwardCompat(site: any): string[] {
  const renamed: string[] = [];
  for (const r of LEGACY_REMAPS) { try { if (r.apply(site)) renamed.push(r.describe); } catch { /* skip a bad remap, never throw */ } }
  return renamed;
}

// ── PART 2 — Migration Engine: small, isolated, structural steps (v→v+1) ─────────
const MIGRATIONS: Migration[] = [
  {
    from: 1, to: 2, describe: 'v1→v2: guarantee cookie + analytics objects exist',
    migrate: (site) => {
      if (!isObj(site.cookie)) site.cookie = { enabled: true, policyPath: '/cookie-policy' };
      if (!isObj(site.analytics)) site.analytics = {};
      return { site };
    },
  },
  {
    from: 2, to: 3, describe: 'v2→v3: guarantee footer object + its arrays exist',
    migrate: (site) => {
      const warnings: string[] = [];
      if (!isObj(site.footer)) { site.footer = { columns: [], legalLinks: [], social: [], copyright: '' }; warnings.push('footer object was missing'); }
      for (const k of ['columns', 'legalLinks', 'social'] as const) if (!Array.isArray(site.footer[k])) site.footer[k] = [];
      return { site, warnings };
    },
  },
];

/** Infer the schema version of a record that predates explicit versioning. */
function inferVersion(site: any): number {
  if (typeof site?.schemaVersion === 'number') return site.schemaVersion;
  // A record already carrying cookie + footer arrays is effectively v3-shaped.
  if (isObj(site?.cookie) && isObj(site?.footer) && Array.isArray(site?.footer?.social)) return 3;
  if (isObj(site?.footer)) return 2;
  return 1;
}

// ── PART 4/11 — non-destructive deep backfill from the single source of truth ────
function mergeDefaults(obj: any, def: any, path: string, created: string[]): any {
  if (!isObj(def)) return obj == null ? def : obj;
  const base = isObj(obj) ? { ...obj } : {}; // preserve ALL existing keys, incl. unknown (forward compat)
  if (!isObj(obj)) created.push(path || '(root)');
  for (const k of Object.keys(def)) {
    const p = path ? `${path}.${k}` : k;
    const dv = def[k];
    if (base[k] == null) { base[k] = dv; created.push(p); }
    else if (isObj(dv)) base[k] = mergeDefaults(base[k], dv, p, created);
    else if (Array.isArray(dv) && !Array.isArray(base[k])) { base[k] = dv; created.push(p); }
  }
  return base;
}

// ── PART 4/7 — validation (structural; used by health monitor + loader) ──────────
export function validateSite(site: any): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!isObj(site)) return { valid: false, issues: ['site is not an object'] };
  if (!Array.isArray(site.pages) || site.pages.length === 0) issues.push('pages missing/empty');
  if (!Array.isArray(site.navigation)) issues.push('navigation missing');
  if (!Array.isArray(site.blog)) issues.push('blog missing');
  if (!isObj(site.footer)) issues.push('footer missing');
  else for (const k of ['columns', 'legalLinks', 'social']) if (!Array.isArray(site.footer[k])) issues.push(`footer.${k} missing`);
  if (!isObj(site.cookie)) issues.push('cookie missing');
  if (!isObj(site.analytics)) issues.push('analytics missing');
  if (!isObj(site.seoDefaults)) issues.push('seoDefaults missing');
  return { valid: issues.length === 0, issues };
}

/** Repair a site into a fully-valid shape (non-destructive backfill + critical guarantees). */
export function repairSite(site: any, tenant: any, makeDefault: MakeDefault): { site: WebsiteSite; created: string[]; repaired: string[] } {
  const def = makeDefault(tenant);
  const created: string[] = [];
  const repaired: string[] = [];
  let s = mergeDefaults(site, def, '', created);
  // Critical guarantees the generic merge can't express:
  if (!Array.isArray(s.pages) || s.pages.length === 0) { s.pages = def.pages; if (!created.includes('pages')) repaired.push('pages'); }
  if (!isObj(s.cookie) || typeof s.cookie.enabled !== 'boolean') { s.cookie = def.cookie; repaired.push('cookie'); }
  if (typeof s.footer?.copyright !== 'string') { s.footer.copyright = def.footer.copyright; repaired.push('footer.copyright'); }
  if (s.status !== 'draft' && s.status !== 'published' && s.status !== 'suspended') { s.status = def.status; repaired.push('status'); }
  return { site: s as WebsiteSite, created, repaired };
}

// ── PART 2/3/5/12 — the safe loader: recover → migrate → validate → repair ───────
export function loadWebsite(raw: unknown, tenant: any, makeDefault: MakeDefault): { site: WebsiteSite; report: MigrationReport } {
  const websiteId = String(tenant?.id ?? 'unknown');
  const report: MigrationReport = { websiteId, fromVersion: 0, toVersion: WEBSITE_SCHEMA_VERSION, created: [], renamed: [], repaired: [], warnings: [], errors: [], recovered: false, changed: false, at: nowIso() };

  // PART 5 — recover unusable input (null / undefined / string / broken JSON).
  let site: any = raw;
  if (typeof site === 'string') { try { site = JSON.parse(site); } catch { site = null; } }
  if (!isObj(site)) { report.recovered = true; report.warnings.push('raw record unusable; seeded from defaults'); site = makeDefault(tenant); site.schemaVersion = WEBSITE_SCHEMA_VERSION; report.changed = true; report.fromVersion = WEBSITE_SCHEMA_VERSION; return { site: site as WebsiteSite, report }; }

  site = JSON.parse(JSON.stringify(site)); // work on a copy; never mutate the caller's object

  // PART 6 — backward-compatibility remaps run FIRST, regardless of version, so a legacy
  // record that still uses deprecated top-level fields is translated before validation.
  try { const renamed = applyBackwardCompat(site); if (renamed.length) { report.renamed.push(...renamed); report.changed = true; } }
  catch (e) { report.errors.push(`backward-compat failed: ${String((e as Error)?.message || e)}`); }

  const startVersion = inferVersion(site);
  report.fromVersion = startVersion;

  // PART 2/12 — run isolated migrations in order; a failing step is logged and skipped
  // (repair below is the safety net), never crashing.
  let version = startVersion;
  for (const m of MIGRATIONS) {
    if (m.from < version) continue;
    if (m.from !== version) continue;
    try {
      const res = m.migrate(site);
      site = res.site;
      if (res.renamed?.length) report.renamed.push(...res.renamed);
      if (res.warnings?.length) report.warnings.push(...res.warnings);
      version = m.to;
      report.changed = true;
    } catch (e) {
      report.errors.push(`migration v${m.from}→v${m.to} failed: ${String((e as Error)?.message || e)}`);
      version = m.to; // continue the chain; repair will backfill anything the step missed
    }
  }

  // PART 4/7 — validate then repair (non-destructive backfill) → always valid.
  const before = validateSite(site);
  const rep = repairSite(site, tenant, makeDefault);
  site = rep.site;
  report.created.push(...rep.created);
  report.repaired.push(...rep.repaired);
  if (!before.valid) report.warnings.push(`pre-repair issues: ${before.issues.join(', ')}`);
  if (rep.created.length || rep.repaired.length) report.changed = true;

  // Stamp the version. If it moved, that's a change.
  if (site.schemaVersion !== WEBSITE_SCHEMA_VERSION) report.changed = true;
  site.schemaVersion = WEBSITE_SCHEMA_VERSION;

  return { site: site as WebsiteSite, report };
}
