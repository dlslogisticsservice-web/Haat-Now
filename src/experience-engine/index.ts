// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · public API barrel.
//
// The single import surface for the Experience Engine foundation. Everything below is a
// contract, a metadata model, an empty registry, or the pure engine chassis — no business
// logic, no integration with Website Studio, no runtime wiring. Import from
// `src/experience-engine` only; never reach into internal files.
//
// This module is deliberately the sole inbound edge for the tree, so Guardian's dead-code
// analysis sees every foundation file as reachable (barrel + tests reference them).
// ─────────────────────────────────────────────────────────────────────────────
export * from './types';
export * from './metadata';
export * from './tree';
export * from './schema';
export * from './events';
export * from './context';
export * from './decision-context';
export * from './experience-events';
export * from './personalization';
export * from './ports';
export * from './channels';
export * from './registries';
export * from './services';
export * from './sdk';
export * from './marketplace';
export * from './pipeline';
export * from './delivery';
export * from './providers';
export * from './policy';
export * from './configuration';
export * from './audience';
export * from './flags';
export * from './experiments';
export * from './enforcement';
export * from './render-adapter';
export * from './render-plan';
export * from './render-plan-executor';
export * from './rollout';
export * from './runtime';
export * from './engine';
