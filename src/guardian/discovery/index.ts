// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Discovery — public surface.
//
// NOTE: the node/fs adapter is intentionally NOT exported here. Importing it would
// pull `node:fs` into the browser bundle. Hosts that have a filesystem (CI, scripts,
// tests) import `./adapters/nodeRepositoryReader` directly.
// ─────────────────────────────────────────────────────────────────────────────

export { DiscoveryEngine, createDiscoveryModule, DISCOVERY_MODULE_ID, DISCOVERY_SERVICES } from './engine';
export type { DiscoveryResult, DiscoveryEngineOptions, DiscoveryModuleOptions } from './engine';

export { KnowledgeGraph } from './graph';
export type { GraphStats } from './graph';

export { DiscoveryRegistry, buildGraph } from './registry';
export { DigitalTwin } from './twin';
export type { ImpactReport, RemovalReport, UnusedReport } from './twin';

export { RepositoryAnalyzer, layerOf, resolveImport, LAYER_RULES } from './analyzers';
export type { AnalyzeOptions } from './analyzers';

export { scanAll, scanServices, scanFeatures, scanRoutes, scanApis, scanEvents, scanPermissions, scanJobs, scanIntegrations, scanEnv } from './scanners';
export type { ScanInput } from './scanners';

export { fingerprint, diffFingerprint } from './fingerprint';
export type { Fingerprint, FingerprintDiff, FingerprintInput } from './fingerprint';

export {
  allSources, architectureSource, servicesSource, databaseSource, apiSource, routesSource,
  permissionsSource, environmentSource, integrationSource, websiteSource, deploymentSource,
} from './sources';

export { nodeId, NODE_TYPES, EDGE_TYPES, emptyInventory } from './types';
export type {
  DiscoveryPorts, RepositoryReader, SchemaReader, EnvReader, DeploymentReader,
  NodeType, EdgeType, GraphNode, GraphEdge, Inventory, Layer, FileNode, AnalysisFindings,
  ServiceEntry, FeatureEntry, RouteEntry, ApiEntry, EventEntry, PermissionEntry, JobEntry,
  IntegrationEntry, EnvEntry, TableInfo, ViewInfo, RelationInfo, IndexInfo, PolicyInfo,
  DbFunctionInfo, BucketInfo, EdgeFunctionInfo, DeploymentInfo,
} from './types';
