// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · public API barrel.
//
// The Website channel adapter — how the Experience Engine learns to resolve the existing
// Website. It WRAPS website.service / renderer.ts / blocks.tsx via ports + a pure mapper;
// it rewrites none of them. Import the browser wiring (createWebsiteContentSource) only from
// app code; pure consumers (and tests) can import the mapper/resolvers/channel directly.
// ─────────────────────────────────────────────────────────────────────────────
export * from './types';
export * from './mapper';
export * from './resolvers';
export * from './htmlRenderer';
export * from './channel';
export * from './contentSource';
