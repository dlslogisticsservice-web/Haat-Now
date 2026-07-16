// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Repository Analyzer.
//
// Static analysis over an injected RepositoryReader. Regex-based on purpose: it
// must run anywhere (browser, Edge, node, test) with zero dependency on the
// TypeScript compiler, and be fast enough to run on every discovery pass.
//
// It answers: what depends on what · circular dependencies · dead code · duplicate
// logic · large files · coupling · layer violations.
// ─────────────────────────────────────────────────────────────────────────────
import type { AnalysisFindings, FileNode, Layer, RepositoryReader } from './types';

const CODE = /\.(ts|tsx)$/;
const TEST = /(__tests__|\.test\.|\.spec\.)/;

/** Layer inference from path — mirrors the project's real, enforced structure. */
export const layerOf = (path: string): Layer => {
  if (path.startsWith('src/guardian/')) return 'guardian';
  if (path.startsWith('src/website-platform/')) return 'platform';
  if (path.startsWith('src/features/')) return 'feature';
  if (path.startsWith('src/services/')) return 'service';
  if (path.startsWith('src/repositories/')) return 'repository';
  if (path.startsWith('src/lib/')) return 'lib';
  if (path.startsWith('src/components/')) return 'component';
  if (path.startsWith('src/config/')) return 'config';
  if (path === 'src/main.tsx' || path === 'src/App.tsx') return 'app';
  return 'other';
};

/**
 * Architecture rules. `check` returns true when the edge is a VIOLATION.
 * Rule 1 encodes the boundary the repo already enforces in CI
 * (scripts/check-architecture.cjs) — Guardian now understands it structurally.
 */
export const LAYER_RULES: { rule: string; check: (from: Layer, to: Layer, toPath: string) => boolean }[] = [
  { rule: 'features must not import lib/supabase directly (use a repository)', check: (f, _t, p) => f === 'feature' && /^src\/lib\/supabase/.test(p) },
  { rule: 'the Guardian kernel must stay pure (no app/feature/service imports)', check: (f, t) => f === 'guardian' && ['feature', 'service', 'component', 'app', 'repository'].includes(t) },
  { rule: 'website-platform must not depend on features', check: (f, t) => f === 'platform' && t === 'feature' },
  { rule: 'repositories must not import features', check: (f, t) => f === 'repository' && t === 'feature' },
  { rule: 'services must not import features (inverted dependency)', check: (f, t) => f === 'service' && t === 'feature' },
];

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
/** `import type … from 'x'` / `export type … from 'x'` — erased by the compiler. */
const TYPE_IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+type\s[^;\n]*?from\s*['"]([^'"]+)['"]/g;

/** Resolve a relative specifier to a repo path, trying the project's real extensions. */
export function resolveImport(fromPath: string, spec: string, files: Set<string>): string | null {
  if (!spec.startsWith('.')) return null;                       // bare/aliased handled by caller
  const dir = fromPath.split('/').slice(0, -1);
  const parts = spec.split('/');
  const stack = [...dir];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    else if (p === '..') stack.pop();
    else stack.push(p);
  }
  const base = stack.join('/');
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  for (const c of candidates) if (files.has(c)) return c;
  return null;
}

/** Normalize a file for duplicate detection: strip comments/imports/whitespace. */
const normalize = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, '')
    .replace(/(^|\n)\s*import[^\n]*\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

export interface AnalyzeOptions { largeFileLoc?: number; entryPoints?: string[]; hash: (s: string) => string }

export class RepositoryAnalyzer {
  constructor(private readonly reader: RepositoryReader) {}

  /** Parse every code file into a node with resolved internal imports. */
  parse(): FileNode[] {
    const all = this.reader.listFiles().filter(f => CODE.test(f));
    const set = new Set(all);
    const out: FileNode[] = [];
    const resolveAll = (specs: string[], path: string): string[] => [...new Set(
      specs.map(s => (s.startsWith('@/') ? s.slice(2) : s))
        .map(s => (s.startsWith('.') ? resolveImport(path, s, set) : (set.has(s) ? s : set.has(`${s}.ts`) ? `${s}.ts` : null)))
        .filter((x): x is string => !!x),
    )].sort();

    for (const path of all) {
      const src = this.reader.read(path);
      if (src === null) continue;
      const specs: string[] = [];
      for (const re of [IMPORT_RE, DYNAMIC_RE]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) specs.push(m[1]);
      }
      const typeSpecs: string[] = [];
      TYPE_IMPORT_RE.lastIndex = 0;
      let tm: RegExpExecArray | null;
      while ((tm = TYPE_IMPORT_RE.exec(src)) !== null) typeSpecs.push(tm[1]);

      const typeImports = resolveAll(typeSpecs, path);
      // Runtime imports = all imports MINUS the type-only ones (which the compiler erases).
      const imports = resolveAll(specs, path).filter(i => !typeImports.includes(i));
      out.push({ path, loc: src.split('\n').length, imports, typeImports, layer: layerOf(path) });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  analyze(opts: AnalyzeOptions): AnalysisFindings {
    const files = this.parse();
    const byPath = new Map(files.map(f => [f.path, f]));
    const largeLoc = opts.largeFileLoc ?? 500;

    // fan-in / fan-out
    const fanIn = new Map<string, number>();
    for (const f of files) for (const i of f.imports) fanIn.set(i, (fanIn.get(i) ?? 0) + 1);
    const coupling = files
      .map(f => ({ path: f.path, fanIn: fanIn.get(f.path) ?? 0, fanOut: f.imports.length }))
      .sort((a, b) => b.fanIn + b.fanOut - (a.fanIn + a.fanOut));

    // dead code: no inbound import, not an entry point, not a test
    const entry = new Set(opts.entryPoints ?? ['src/main.tsx', 'src/App.tsx']);
    const unusedFiles = files
      .filter(f => !entry.has(f.path) && !TEST.test(f.path) && (fanIn.get(f.path) ?? 0) === 0)
      .map(f => f.path);

    const largeFiles = files.filter(f => f.loc >= largeLoc).map(f => ({ path: f.path, loc: f.loc })).sort((a, b) => b.loc - a.loc);

    // duplicates: identical normalized bodies (real copy-paste, not similar names)
    const buckets = new Map<string, string[]>();
    for (const f of files) {
      if (TEST.test(f.path)) continue;
      const src = this.reader.read(f.path);
      if (!src) continue;
      const norm = normalize(src);
      if (norm.length < 200) continue;                     // ignore trivial files
      const h = opts.hash(norm);
      if (!buckets.has(h)) buckets.set(h, []);
      buckets.get(h)!.push(f.path);
    }
    const duplicates = [...buckets.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([hash, paths]) => ({ hash, paths: paths.sort() }))
      .sort((a, b) => a.paths[0].localeCompare(b.paths[0]));

    // layer violations — tests are exempt: a test legitimately reaches across layers
    // to exercise the unit under test. Enforcing layering on tests yields false positives.
    const layerViolations: AnalysisFindings['layerViolations'] = [];
    for (const f of files) {
      if (TEST.test(f.path)) continue;
      for (const imp of [...f.imports, ...f.typeImports]) {
        const to = byPath.get(imp);
        if (!to) continue;
        for (const r of LAYER_RULES) {
          if (r.check(f.layer, to.layer, imp)) layerViolations.push({ from: f.path, to: imp, rule: r.rule });
        }
      }
    }

    return {
      files: files.length,
      totalLoc: files.reduce((s, f) => s + f.loc, 0),
      circular: this.circular(files),
      unusedFiles: unusedFiles.sort(),
      largeFiles,
      duplicates,
      layerViolations: layerViolations.sort((a, b) => a.from.localeCompare(b.from)),
      coupling: coupling.slice(0, 25),
    };
  }

  /** Circular import chains (Tarjan over the file graph). */
  private circular(files: FileNode[]): string[][] {
    const adj = new Map(files.map(f => [f.path, f.imports]));
    const index = new Map<string, number>(); const low = new Map<string, number>();
    const onStack = new Set<string>(); const stack: string[] = [];
    const out: string[][] = []; let counter = 0;

    const visit = (v: string): void => {
      index.set(v, counter); low.set(v, counter); counter++;
      stack.push(v); onStack.add(v);
      for (const w of adj.get(v) ?? []) {
        if (!adj.has(w)) continue;
        if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
      if (low.get(v) === index.get(v)) {
        const comp: string[] = []; let w: string;
        do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1) out.push(comp.sort());
      }
    };
    for (const f of files.map(f => f.path).sort()) if (!index.has(f)) visit(f);
    return out.sort((a, b) => a[0].localeCompare(b[0]));
  }
}
