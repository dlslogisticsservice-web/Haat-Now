// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Platform Discovery — types & PORTS.
//
// Discovery reads the repository, the database and the environment. The kernel is
// pure, so discovery stays pure too: every external fact arrives through a PORT.
// A node/fs adapter, a Supabase adapter or a static snapshot all satisfy the same
// interfaces — and tests inject fakes. Nothing here imports fs, Supabase or React.
//
// SECURITY: EnvReader exposes KEYS ONLY. Guardian must never read, store, index or
// fingerprint a secret VALUE. This is enforced by the port's shape.
// ─────────────────────────────────────────────────────────────────────────────

// ── PORTS ────────────────────────────────────────────────────────────────────

/** Read-only view of the source tree. */
export interface RepositoryReader {
  /** Repo-relative POSIX paths (e.g. 'src/services/order.service.ts'). */
  listFiles(): string[];
  /** File contents, or null when unreadable/binary. */
  read(path: string): string | null;
}

export interface TableInfo { name: string; schema: string; rls: boolean; columns?: string[]; rows?: number }
export interface RelationInfo { fromTable: string; fromColumn: string; toTable: string; toColumn: string }
export interface IndexInfo { name: string; table: string; unique?: boolean }
export interface PolicyInfo { name: string; table: string; command?: string }
export interface DbFunctionInfo { name: string; kind: 'function' | 'trigger'; securityDefiner?: boolean }
export interface ViewInfo { name: string; materialized?: boolean }
export interface BucketInfo { id: string; public: boolean }
export interface EdgeFunctionInfo { slug: string; verifyJwt?: boolean; status?: string }

/** Read-only view of the backend schema. Implemented later by a Supabase adapter or a snapshot. */
export interface SchemaReader {
  tables(): TableInfo[];
  views(): ViewInfo[];
  relations(): RelationInfo[];
  indexes(): IndexInfo[];
  policies(): PolicyInfo[];
  functions(): DbFunctionInfo[];
  buckets(): BucketInfo[];
  edgeFunctions(): EdgeFunctionInfo[];
}

/** KEYS ONLY — never values. */
export interface EnvReader { keys(): string[]; isSecret?(key: string): boolean }

export interface DeploymentInfo { sha: string; shortSha?: string; builtAt?: string; env?: string }
export interface DeploymentReader { current(): DeploymentInfo | null }

/** Everything discovery may touch. All optional — discovery degrades, never throws. */
export interface DiscoveryPorts {
  repository?: RepositoryReader;
  schema?: SchemaReader;
  env?: EnvReader;
  deployment?: DeploymentReader;
}

// ── GRAPH MODEL ──────────────────────────────────────────────────────────────

export type NodeType =
  | 'service' | 'module' | 'api' | 'database' | 'table' | 'route' | 'feature'
  | 'permission' | 'environment' | 'job' | 'event' | 'integration' | 'website'
  | 'storage' | 'queue' | 'worker' | 'repository' | 'view' | 'policy' | 'edge_function';

export const NODE_TYPES: readonly NodeType[] = [
  'service', 'module', 'api', 'database', 'table', 'route', 'feature', 'permission',
  'environment', 'job', 'event', 'integration', 'website', 'storage', 'queue', 'worker',
  'repository', 'view', 'policy', 'edge_function',
];

export type EdgeType =
  | 'depends_on'   // A imports/needs B
  | 'reads'        // A reads B (table/bucket)
  | 'writes'       // A writes B
  | 'exposes'      // A exposes B (service → api)
  | 'emits'        // A emits event B
  | 'listens'      // A listens to event B
  | 'guards'       // permission guards A
  | 'renders'      // route renders feature
  | 'uses'         // A uses integration/env B
  | 'relates_to';  // table ↔ table FK

export const EDGE_TYPES: readonly EdgeType[] = [
  'depends_on', 'reads', 'writes', 'exposes', 'emits', 'listens', 'guards', 'renders', 'uses', 'relates_to',
];

/** Node id convention: `${type}:${key}` — stable, human-readable, collision-free. */
export interface GraphNode {
  id: string;
  type: NodeType;
  key: string;
  label: string;
  /** Where it was found (file path, table name, env key). */
  origin?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface GraphEdge { from: string; to: string; type: EdgeType; meta?: Record<string, unknown> }

export const nodeId = (type: NodeType, key: string): string => `${type}:${key}`;

// ── INVENTORY (the unified Discovery Registry payload) ───────────────────────

export interface ServiceEntry { key: string; file: string; kind: 'service' | 'manager' | 'engine' | 'controller' | 'repository'; exports: string[]; imports: string[]; loc: number }
export interface FeatureEntry { key: string; dir: string; files: number; loc: number }
export interface RouteEntry { key: string; path: string; surface: 'public' | 'app' | 'admin' | 'console'; origin: string }
export interface ApiEntry { key: string; kind: 'rpc' | 'edge_function' | 'rest'; name: string; origin: string }
export interface EventEntry { key: string; origin: string }
export interface PermissionEntry { key: string; origin: string }
export interface JobEntry { key: string; origin: string; schedule?: string }
export interface IntegrationEntry { key: string; category: 'maps' | 'sms' | 'email' | 'push' | 'payments' | 'analytics' | 'storage' | 'auth' | 'other'; origin: string; configured?: boolean }
export interface EnvEntry { key: string; secret: boolean; origin: string }

export interface Inventory {
  services: ServiceEntry[];
  features: FeatureEntry[];
  routes: RouteEntry[];
  apis: ApiEntry[];
  tables: TableInfo[];
  views: ViewInfo[];
  relations: RelationInfo[];
  policies: PolicyInfo[];
  buckets: BucketInfo[];
  edgeFunctions: EdgeFunctionInfo[];
  events: EventEntry[];
  permissions: PermissionEntry[];
  jobs: JobEntry[];
  integrations: IntegrationEntry[];
  env: EnvEntry[];
  deployment: DeploymentInfo | null;
}

export const emptyInventory = (): Inventory => ({
  services: [], features: [], routes: [], apis: [], tables: [], views: [], relations: [],
  policies: [], buckets: [], edgeFunctions: [], events: [], permissions: [], jobs: [],
  integrations: [], env: [], deployment: null,
});

// ── Repository analysis findings ─────────────────────────────────────────────

export interface FileNode {
  path: string;
  loc: number;
  /** RUNTIME imports (value imports). These are the real dependency edges. */
  imports: string[];
  /** Type-only imports — ERASED at compile time, so they create no runtime dependency
   *  and cannot form a runtime cycle. Tracked separately for accuracy. */
  typeImports: string[];
  layer: Layer;
}
export type Layer = 'app' | 'feature' | 'service' | 'repository' | 'lib' | 'component' | 'guardian' | 'platform' | 'config' | 'other';

export interface AnalysisFindings {
  files: number;
  totalLoc: number;
  circular: string[][];
  unusedFiles: string[];
  largeFiles: { path: string; loc: number }[];
  duplicates: { hash: string; paths: string[] }[];
  layerViolations: { from: string; to: string; rule: string }[];
  coupling: { path: string; fanIn: number; fanOut: number }[];
}
