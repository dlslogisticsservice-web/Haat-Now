// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Discovery — node/fs RepositoryReader adapter.
//
// ⚠ NOT exported from `discovery/index.ts` on purpose: it imports `node:fs` and must
// never enter the browser bundle. Only filesystem hosts (CI, scripts, tests) import
// this path directly. The engine itself stays pure and knows nothing about fs.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { RepositoryReader } from '../types';

export interface NodeReaderOptions {
  /** Absolute repo root. */
  root: string;
  /** Directories to walk, repo-relative. */
  include?: string[];
  /** Directory names skipped anywhere in the tree. */
  exclude?: string[];
  /** Extensions to expose. */
  extensions?: string[];
  /** Skip files larger than this (bytes) — protects the analyzer from generated blobs. */
  maxBytes?: number;
}

const DEFAULT_EXCLUDE = ['node_modules', 'dist', '.git', '.vercel', 'coverage', 'build', '.next', 'android', 'ios'];
const DEFAULT_EXT = ['.ts', '.tsx', '.sql', '.json', '.md', '.cjs'];

/** Filesystem-backed reader. Files are read lazily and cached per instance. */
export function createNodeRepositoryReader(opts: NodeReaderOptions): RepositoryReader {
  const root = opts.root;
  const include = opts.include ?? ['src', 'supabase', 'scripts', 'docs'];
  const exclude = new Set(opts.exclude ?? DEFAULT_EXCLUDE);
  const exts = opts.extensions ?? DEFAULT_EXT;
  const maxBytes = opts.maxBytes ?? 512 * 1024;
  const cache = new Map<string, string | null>();
  let listed: string[] | null = null;

  const toPosix = (p: string): string => p.split(sep).join('/');

  const walk = (dir: string, out: string[]): void => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (exclude.has(name)) continue;
      const full = join(dir, name);
      let st: ReturnType<typeof statSync>;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full, out);
      else if (exts.some(e => name.endsWith(e)) && st.size <= maxBytes) out.push(toPosix(relative(root, full)));
    }
  };

  return {
    listFiles(): string[] {
      if (listed) return listed;
      const out: string[] = [];
      for (const dir of include) walk(join(root, dir), out);
      // repo-root config files discovery cares about
      for (const f of ['package.json', 'vercel.json', 'tsconfig.json', 'vite.config.ts', 'capacitor.config.ts']) {
        try { statSync(join(root, f)); out.push(f); } catch { /* absent */ }
      }
      listed = out.sort();
      return listed;
    },
    read(path: string): string | null {
      if (cache.has(path)) return cache.get(path)!;
      let v: string | null;
      try { v = readFileSync(join(root, path), 'utf8'); } catch { v = null; }
      cache.set(path, v);
      return v;
    },
  };
}
