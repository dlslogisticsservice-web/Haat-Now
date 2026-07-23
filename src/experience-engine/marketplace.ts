// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Marketplace foundation (STEP 11).
//
// Contracts ONLY — no functionality. Describes how experiences, themes, components,
// plugins, templates and bundles will be packaged, versioned, signed and distributed
// (internally today; a marketplace later). Signing mirrors the platform's existing
// HMAC-verified, fail-closed pattern — a package is never trusted unsigned.
// ─────────────────────────────────────────────────────────────────────────────
import type { SemVer, Timestamp } from './types';
import type {
  ComponentMetadata, ThemeMetadata, PluginMetadata, ExperienceMetadata,
} from './metadata';

export type MarketplaceItemKind = 'package' | 'theme' | 'component' | 'plugin' | 'template' | 'bundle';

export interface MarketplaceVersion {
  version: SemVer;
  publishedAt?: Timestamp;
  changelog?: string;
}

export interface MarketplaceDependency {
  id: string;
  /** Semver range the dependency must satisfy, e.g. "^1.2.0". */
  range: string;
}

/** Detached signature envelope for authenticity/integrity (verified before install). */
export interface MarketplaceSignature {
  algorithm: 'HMAC-SHA256' | (string & {});
  /** Hex digest over the canonical manifest bytes. */
  signature: string;
  signedAt: Timestamp;
  keyId?: string;
}

export interface MarketplaceManifest {
  id: string;
  name: string;
  kind: MarketplaceItemKind;
  version: SemVer;
  dependencies: MarketplaceDependency[];
  versions: MarketplaceVersion[];
  signature?: MarketplaceSignature;
}

export interface MarketplaceComponent { manifest: MarketplaceManifest; metadata: ComponentMetadata }
export interface MarketplaceTheme { manifest: MarketplaceManifest; metadata: ThemeMetadata }
export interface MarketplacePlugin { manifest: MarketplaceManifest; metadata: PluginMetadata }
export interface MarketplaceTemplate { manifest: MarketplaceManifest; experience: ExperienceMetadata }

/** A package groups one primary artifact + its manifest. */
export interface MarketplacePackage {
  manifest: MarketplaceManifest;
  kind: MarketplaceItemKind;
}

/** A bundle ships several packages together (e.g. a themed component set). */
export interface MarketplaceBundle {
  manifest: MarketplaceManifest;
  packages: MarketplacePackage[];
}
