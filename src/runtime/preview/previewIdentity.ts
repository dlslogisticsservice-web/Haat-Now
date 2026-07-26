// ─────────────────────────────────────────────────────────────────────────────
// Preview Identity (Phase 8K — deduplicated).
//
// The single source of the seeded per-channel identities that drive the Application Studio's Live
// App runtime and the Motion Studio Boot Simulator. These are sandbox-only preview identities:
// consumers MUST read them behind the DEMO_CONTENT_ENABLED gate and pass `null` in production-data
// mode (adapters never mount a seeded identity in production). Kept in src/runtime (a neutral seam)
// so both admin surfaces share ONE definition instead of duplicating it.
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewIdentity { id: string; phone: string; role: string }

export const PREVIEW_IDENTITY: Record<string, PreviewIdentity> = {
  customer: { id: '11111111-0000-0000-0000-000000000001', phone: '+201000000001', role: 'customer' },
  merchant: { id: '22222222-0000-0000-0000-000000000001', phone: '+201000000002', role: 'merchant' },
  driver: { id: '33333333-0000-0000-0000-000000000001', phone: '+201000000003', role: 'driver' },
};
