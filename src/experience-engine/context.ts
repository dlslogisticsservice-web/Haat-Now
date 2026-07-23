// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · core request/response + descriptor model (STEP 2).
//
// The vocabulary a resolution is expressed in: WHO is asking (ExperienceContext), WHAT
// they asked for (ExperienceRequest), and WHAT they get back (ExperienceResponse /
// ExperienceResolution). Descriptors/manifests describe a registered experience. Pure
// data — no resolution logic (that arrives in later waves as ExperienceResolver).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ChannelId, DeviceKind, Environment, ExperienceId, LocaleCode, PlatformKind, RoleId, SemVer, TenantId, TextDirection, Timestamp,
} from './types';
import type { ExperienceSchema } from './schema';
import type { ExperienceMetadata } from './metadata';

/** The build/deploy environment an experience resolves within. */
export interface ExperienceEnvironment {
  environment: Environment;
  /** Deployed build sha, when known — for version pinning + diagnostics. */
  buildSha?: string;
}

/**
 * The full context a resolution reads: identity, locale, device, tenancy and the ambient
 * signals the Rules engine consults. Everything the Engine needs to decide *what to render,
 * for whom, when* is here — nothing is read from globals.
 */
export interface ExperienceContext {
  tenantId: TenantId;
  channel: ChannelId;
  role: RoleId;
  locale: LocaleCode;
  direction: TextDirection;
  device: DeviceKind;
  platform: PlatformKind;
  environment: ExperienceEnvironment;
  /** Country/region — a common Rules dimension. */
  country?: string;
  /** Opaque user/segment signals the Rules engine may read (no PII contract here). */
  segments?: string[];
  /** Feature flags already resolved for this context, if pre-computed. */
  flags?: { [key: string]: boolean };
  now?: Timestamp;
}

/** A request to resolve an experience for a context. */
export interface ExperienceRequest {
  experienceId: ExperienceId;
  context: ExperienceContext;
  /** Pin to a specific version; otherwise the published version for the context is used. */
  version?: SemVer;
  /** Resolve the staging/preview variant instead of published (Studio preview). */
  preview?: boolean;
}

/** The outcome status of a resolution. */
export type ResolutionStatus = 'resolved' | 'not-found' | 'not-permitted' | 'no-version' | 'error';

/** A fully resolved experience, ready for a renderer to consume. */
export interface ExperienceResolution {
  status: ResolutionStatus;
  experienceId: ExperienceId;
  version?: SemVer;
  channel: ChannelId;
  /** The resolved schema instance (layout + components + theme ref). */
  schema?: ExperienceSchema;
  /** The variant chosen by experiments/personalization, if any. */
  variant?: string;
  /** Rules/flags that fired, for observability. */
  appliedRules?: string[];
  diagnostics?: string[];
}

/** The response envelope returned by the Engine. `renderingResult` is present when the
 *  rendering pipeline ran (Wave 3); resolution-only calls leave it undefined. Its type is
 *  imported lazily to avoid a static cycle — see `RenderingResult` in pipeline.ts. */
export interface ExperienceResponse {
  resolution: ExperienceResolution;
  resolvedAt: Timestamp;
  renderingResult?: import('./pipeline').RenderingResult;
  diagnostics?: string[];
}

// ── Descriptors describe a REGISTERED experience (not a resolution) ────────────
export interface ExperienceVersion {
  version: SemVer;
  status: 'draft' | 'review' | 'approved' | 'testing' | 'staging' | 'published' | 'archived';
  publishedAt?: Timestamp;
  publishedBy?: string;
}

/** A registered experience: its metadata + the versions it has. */
export interface ExperienceDescriptor {
  metadata: ExperienceMetadata;
  versions: ExperienceVersion[];
}

/** A manifest bundles the descriptors an experience package ships. */
export interface ExperienceManifest {
  id: string;
  name: string;
  version: SemVer;
  experiences: ExperienceDescriptor[];
  createdAt?: Timestamp;
}
