// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Scanners — turn PORT data into the unified Inventory.
//
// Each scanner is a pure function over the reader output. They are deliberately
// conservative: a scanner reports what it can PROVE from the source, and reports
// nothing when it cannot. Guardian must never invent platform facts.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ApiEntry, EnvEntry, EventEntry, FeatureEntry, IntegrationEntry, Inventory, JobEntry,
  PermissionEntry, RepositoryReader, RouteEntry, SchemaReader, ServiceEntry, EnvReader, DeploymentReader,
} from './types';
import { emptyInventory } from './types';
import type { FileNode } from './types';

// ── services / managers / engines / controllers / repositories ───────────────
const SERVICE_KIND = (path: string): ServiceEntry['kind'] | null => {
  if (/^src\/repositories\/.*\.ts$/.test(path)) return 'repository';
  if (/\.service\.ts$/.test(path) || /^src\/services\/[^/]+\.ts$/.test(path)) return 'service';
  if (/manager\.ts$/i.test(path)) return 'manager';
  if (/engine\.ts$/i.test(path)) return 'engine';
  if (/controller\.ts$/i.test(path)) return 'controller';
  return null;
};

const EXPORT_RE = /export\s+(?:const|function|class|interface|type)\s+([A-Za-z0-9_]+)/g;

export function scanServices(files: FileNode[], reader: RepositoryReader): ServiceEntry[] {
  const out: ServiceEntry[] = [];
  for (const f of files) {
    const kind = SERVICE_KIND(f.path);
    if (!kind) continue;
    const src = reader.read(f.path) ?? '';
    const exports: string[] = [];
    EXPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EXPORT_RE.exec(src)) !== null) exports.push(m[1]);
    const key = f.path.split('/').pop()!.replace(/\.(ts|tsx)$/, '');
    out.push({ key, file: f.path, kind, exports: [...new Set(exports)].sort(), imports: f.imports, loc: f.loc });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

// ── features ────────────────────────────────────────────────────────────────
export function scanFeatures(files: FileNode[]): FeatureEntry[] {
  const byDir = new Map<string, { files: number; loc: number }>();
  for (const f of files) {
    const m = /^src\/features\/([^/]+)\//.exec(f.path);
    if (!m) continue;
    const cur = byDir.get(m[1]) ?? { files: 0, loc: 0 };
    cur.files++; cur.loc += f.loc;
    byDir.set(m[1], cur);
  }
  return [...byDir.entries()].map(([key, v]) => ({ key, dir: `src/features/${key}`, ...v })).sort((a, b) => a.key.localeCompare(b.key));
}

// ── routes (public / app / admin / console) ─────────────────────────────────
const ROUTE_LITERAL = /['"](\/[a-z0-9\-/_:]*)['"]/g;

/**
 * Routes are read from the ROUTING SOURCE OF TRUTH only (features/website/routes.ts
 * + the CMS page seed). We do not guess routes from arbitrary string literals
 * elsewhere — that would manufacture false facts.
 */
export function scanRoutes(reader: RepositoryReader): RouteEntry[] {
  const out: RouteEntry[] = [];
  const push = (path: string, surface: RouteEntry['surface'], origin: string): void => {
    if (!path.startsWith('/')) return;
    const key = `${surface}:${path}`;
    if (!out.some(r => r.key === key)) out.push({ key, path, surface, origin });
  };

  const routesSrc = reader.read('src/features/website/routes.ts');
  if (routesSrc) {
    const consoleBlock = /CONSOLE_ROUTES\s*=\s*\[([^\]]+)\]/.exec(routesSrc);
    if (consoleBlock) {
      ROUTE_LITERAL.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ROUTE_LITERAL.exec(consoleBlock[1])) !== null) push(m[1], 'console', 'src/features/website/routes.ts');
    }
    const appPrefix = /APP_ROUTE_PREFIX\s*=\s*['"]([^'"]+)['"]/.exec(routesSrc);
    if (appPrefix) push(appPrefix[1], 'app', 'src/features/website/routes.ts');
  }

  const site = reader.read('src/services/website.service.ts');
  if (site) {
    const re = /path:\s*['"](\/[a-z0-9\-/]*)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(site)) !== null) push(m[1], 'public', 'src/services/website.service.ts');
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

// ── APIs: Supabase RPCs + edge functions ────────────────────────────────────
export function scanApis(files: FileNode[], reader: RepositoryReader, schema?: SchemaReader): ApiEntry[] {
  const out: ApiEntry[] = [];
  const seen = new Set<string>();
  const add = (e: ApiEntry): void => { if (!seen.has(e.key)) { seen.add(e.key); out.push(e); } };

  // client-side RPC calls are proof an API is USED
  const RPC = /\.rpc\(\s*['"]([a-z0-9_]+)['"]/g;
  for (const f of files) {
    const src = reader.read(f.path);
    if (!src) continue;
    RPC.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RPC.exec(src)) !== null) add({ key: `rpc:${m[1]}`, kind: 'rpc', name: m[1], origin: f.path });
  }
  for (const fn of schema?.functions() ?? []) add({ key: `rpc:${fn.name}`, kind: 'rpc', name: fn.name, origin: 'database' });
  for (const ef of schema?.edgeFunctions() ?? []) add({ key: `edge:${ef.slug}`, kind: 'edge_function', name: ef.slug, origin: 'supabase/functions' });
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

// ── events (kernel catalog + emitters) ──────────────────────────────────────
export function scanEvents(files: FileNode[], reader: RepositoryReader): EventEntry[] {
  const out = new Map<string, string>();
  const CATALOG = /^\s*'([a-z0-9_.]+)':\s*\{/gm;      // GuardianEventMap entries
  const EMIT = /\.emit\(\s*'([a-z0-9_.]+)'/g;
  for (const f of files) {
    const src = reader.read(f.path);
    if (!src) continue;
    if (f.path.endsWith('guardian/kernel/events.ts')) {
      CATALOG.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = CATALOG.exec(src)) !== null) out.set(m[1], f.path);
    }
    EMIT.lastIndex = 0;
    let e: RegExpExecArray | null;
    while ((e = EMIT.exec(src)) !== null) if (!out.has(e[1])) out.set(e[1], f.path);
  }
  return [...out.entries()].map(([key, origin]) => ({ key, origin })).sort((a, b) => a.key.localeCompare(b.key));
}

// ── permissions ─────────────────────────────────────────────────────────────
export function scanPermissions(files: FileNode[], reader: RepositoryReader): PermissionEntry[] {
  const out = new Map<string, string>();
  const KEY = /key:\s*'([a-z][a-z0-9_.]*\.[a-z0-9_.]+)'/g;          // kernel PermissionDef
  const HAS = /auth_has_permission\(\s*'([a-z0-9_.]+)'/g;           // server-side guard
  for (const f of files) {
    const src = reader.read(f.path);
    if (!src) continue;
    for (const re of [KEY, HAS]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) if (!out.has(m[1])) out.set(m[1], f.path);
    }
  }
  return [...out.entries()].map(([key, origin]) => ({ key, origin })).sort((a, b) => a.key.localeCompare(b.key));
}

// ── jobs ────────────────────────────────────────────────────────────────────
export function scanJobs(files: FileNode[], reader: RepositoryReader): JobEntry[] {
  const out = new Map<string, JobEntry>();
  const DEF = /defineJob\(\s*\{\s*id:\s*'([a-z0-9_.-]+)'/g;
  const CRON = /cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  for (const f of files) {
    const src = reader.read(f.path);
    if (!src) continue;
    DEF.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DEF.exec(src)) !== null) out.set(m[1], { key: m[1], origin: f.path });
    CRON.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = CRON.exec(src)) !== null) out.set(c[1], { key: c[1], origin: f.path, schedule: c[2] });
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ── integrations ────────────────────────────────────────────────────────────
const INTEGRATION_SIGNS: { key: string; category: IntegrationEntry['category']; re: RegExp }[] = [
  { key: 'google_maps', category: 'maps', re: /VITE_GOOGLE_MAPS_API_KEY|maps\.googleapis\.com/ },
  { key: 'moyasar', category: 'payments', re: /moyasar/i },
  { key: 'paymob', category: 'payments', re: /paymob/i },
  { key: 'stripe', category: 'payments', re: /stripe/i },
  { key: 'supabase', category: 'storage', re: /supabase/i },
  { key: 'firebase_fcm', category: 'push', re: /firebase|fcm|messaging/i },
  { key: 'apns', category: 'push', re: /apns|APNs/ },
  { key: 'sms_provider', category: 'sms', re: /twilio|messagebird|vonage|SMS_PROVIDER/i },
  { key: 'email_provider', category: 'email', re: /sendgrid|resend|postmark|nodemailer/i },
  { key: 'sentry', category: 'analytics', re: /VITE_SENTRY_DSN|sentry/i },
  { key: 'analytics_collector', category: 'analytics', re: /VITE_ANALYTICS_URL/ },
];

export function scanIntegrations(files: FileNode[], reader: RepositoryReader, envKeys: string[]): IntegrationEntry[] {
  const found = new Map<string, IntegrationEntry>();
  for (const f of files) {
    const src = reader.read(f.path);
    if (!src) continue;
    for (const sign of INTEGRATION_SIGNS) {
      if (found.has(sign.key)) continue;
      if (sign.re.test(src)) found.set(sign.key, { key: sign.key, category: sign.category, origin: f.path, configured: envKeys.some(k => sign.re.test(k)) });
    }
  }
  return [...found.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ── environment (KEYS ONLY — never values) ─────────────────────────────────
const SECRET_HINT = /(KEY|SECRET|TOKEN|PASSWORD|DSN|CREDENTIAL)/i;

export function scanEnv(files: FileNode[], reader: RepositoryReader, env?: EnvReader): EnvEntry[] {
  const out = new Map<string, EnvEntry>();
  // Must start with a letter and END on an alphanumeric — otherwise a doc comment like
  // `import.meta.env.VITE_*` yields the truncated phantom key "VITE_".
  const USE = /import\.meta\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b/g;
  for (const f of files) {
    const src = reader.read(f.path);
    if (!src) continue;
    USE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = USE.exec(src)) !== null) {
      if (!out.has(m[1])) out.set(m[1], { key: m[1], secret: SECRET_HINT.test(m[1]), origin: f.path });
    }
  }
  for (const k of env?.keys() ?? []) {
    if (!out.has(k)) out.set(k, { key: k, secret: env?.isSecret?.(k) ?? SECRET_HINT.test(k), origin: 'environment' });
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ── full scan ───────────────────────────────────────────────────────────────
export interface ScanInput { files: FileNode[]; repository: RepositoryReader; schema?: SchemaReader; env?: EnvReader; deployment?: DeploymentReader }

export function scanAll(input: ScanInput): Inventory {
  const inv = emptyInventory();
  const { files, repository, schema, env, deployment } = input;
  inv.services = scanServices(files, repository);
  inv.features = scanFeatures(files);
  inv.routes = scanRoutes(repository);
  inv.apis = scanApis(files, repository, schema);
  inv.events = scanEvents(files, repository);
  inv.permissions = scanPermissions(files, repository);
  inv.jobs = scanJobs(files, repository);
  inv.env = scanEnv(files, repository, env);
  inv.integrations = scanIntegrations(files, repository, inv.env.map(e => e.key));
  inv.tables = schema?.tables() ?? [];
  inv.views = schema?.views() ?? [];
  inv.relations = schema?.relations() ?? [];
  inv.policies = schema?.policies() ?? [];
  inv.buckets = schema?.buckets() ?? [];
  inv.edgeFunctions = schema?.edgeFunctions() ?? [];
  inv.deployment = deployment?.current() ?? null;
  return inv;
}
