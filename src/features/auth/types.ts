// Phase-2: the canonical identity types now live in the service layer
// (src/services/types.ts) so services no longer import from a feature folder.
// Re-exported here for backward compatibility with any existing feature imports.
export type { User, AuthState } from '../../services/types';
