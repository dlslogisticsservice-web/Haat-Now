// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Operations Workspace — the snapshot contract.
//
// The Guardian discovery engine analyzes the REPOSITORY. A browser has no
// repository, and the node/fs reader is deliberately kept out of the browser
// bundle (discovery/adapters/nodeRepositoryReader.ts). So architecture facts are
// produced ONCE at build time and shipped as a static artifact, which the ops
// workspace reads. No second analyzer exists — this is the same DiscoveryEngine
// output, serialized.
//
// This file is PURE: shared verbatim by the build-time generator (node) and the
// browser. No fs, no React, no Supabase.
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** One machine-detected problem. Every panel in the workspace emits these. */
export interface OpsFinding {
  id: string;
  /** Which inspector produced it. */
  area: 'architecture' | 'runtime' | 'regression' | 'navigation' | 'journey' | 'build';
  severity: Severity;
  title: string;
  /** Why it is happening — stated as fact, or as a candidate when inferred. */
  rootCause: string;
  /** Repo-relative paths involved. */
  files: string[];
  /** The concrete change being recommended. */
  recommendedFix: string;
  /** True when the finding blocks launch. */
  blocker: boolean;
}

/** Architecture facts, straight from AnalysisFindings. */
export interface ArchitectureSnapshot {
  files: number;
  totalLoc: number;
  circular: string[][];
  layerViolations: { from: string; to: string; rule: string }[];
  duplicates: { hash: string; paths: string[] }[];
  deadCode: string[];
  largeFiles: { path: string; loc: number }[];
  coupling: { path: string; fanIn: number; fanOut: number }[];
}

/** Route table + reachability, from the discovery inventory. */
export interface NavigationSnapshot {
  routes: { key: string; path: string; surface: string; origin: string }[];
  duplicateRoutes: string[];
  /** Routes discovered in source but rendered by no feature. */
  unreachable: string[];
}

export interface FingerprintSnapshot {
  composite: string;
  architecture: string;
  dependency: string;
  repository: string;
}

/** Drift vs the committed baseline (docs/guardian/baseline.json). */
export interface DriftSnapshot {
  hasBaseline: boolean;
  changed: boolean;
  architectureChanged: boolean;
  dependencyChanged: boolean;
  summary: string;
  baselineAt?: string;
}

/** One automated suite's last recorded result. */
export interface SuiteResult {
  suite: string;
  cmd: string;
  passed: number;
  failed: number;
  at?: string;
  /** False when no result file was found — the workspace must say "not run", never invent a pass. */
  recorded: boolean;
}

/** A product journey and whether its suite proved it. */
export interface JourneyResult {
  role: 'customer' | 'merchant' | 'driver' | 'partner' | 'affiliate' | 'admin';
  journey: string;
  status: 'passing' | 'failing' | 'not-verified';
  evidence: string;
}

export interface GuardianSnapshot {
  /** Snapshot contract version — the reader refuses anything it does not understand. */
  schema: 1;
  generatedAt: string;
  sha: string;
  env: string;
  architecture: ArchitectureSnapshot;
  navigation: NavigationSnapshot;
  fingerprint: FingerprintSnapshot;
  drift: DriftSnapshot;
  suites: SuiteResult[];
  journeys: JourneyResult[];
  inventory: {
    services: number;
    features: number;
    routes: number;
    apis: number;
    events: number;
    permissions: number;
    integrations: number;
    envKeys: number;
  };
}

export const SNAPSHOT_SCHEMA = 1 as const;
export const SNAPSHOT_URL = '/guardian-snapshot.json';
