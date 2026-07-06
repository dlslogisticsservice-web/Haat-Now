// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Child/registry repositories (Wave 1).
// Typed collection repositories for the non-aggregate tables. Thin wrappers over the
// generic collection (no duplicated logic); each is fully backend-selectable.
// ─────────────────────────────────────────────────────────────────────────────

import type { CollectionRepository } from './collection';
import { createCollection } from './collection';
import type { RepositoryBackend } from './registry';
import type {
  WebsiteThemeTokenRow, WebsiteSettingRow, WebsiteRevisionRow, WebsitePublishHistoryRow,
  WebsiteComponentRow, WebsiteFeatureFlagRow, WebsiteAssetUsageRow, WebsiteFormSubmissionRow,
} from '../domain/aggregates';

export interface ChildRepositoryBundle {
  themeTokens: CollectionRepository<WebsiteThemeTokenRow & Record<string, unknown>>;
  settings: CollectionRepository<WebsiteSettingRow & Record<string, unknown>>;
  revisions: CollectionRepository<WebsiteRevisionRow & Record<string, unknown>>;
  publishHistory: CollectionRepository<WebsitePublishHistoryRow & Record<string, unknown>>;
  componentLibrary: CollectionRepository<WebsiteComponentRow & Record<string, unknown>>;
  featureFlags: CollectionRepository<WebsiteFeatureFlagRow & Record<string, unknown>>;
  assetUsage: CollectionRepository<WebsiteAssetUsageRow & Record<string, unknown>>;
  formSubmissions: CollectionRepository<WebsiteFormSubmissionRow & Record<string, unknown>>;
}

export function createChildBundle(backend: RepositoryBackend): ChildRepositoryBundle {
  return {
    themeTokens: createCollection(backend, 'website_theme_tokens'),
    settings: createCollection(backend, 'website_settings'),
    revisions: createCollection(backend, 'website_revisions'),
    publishHistory: createCollection(backend, 'website_publish_history'),
    componentLibrary: createCollection(backend, 'website_component_library'),
    featureFlags: createCollection(backend, 'website_feature_flags'),
    assetUsage: createCollection(backend, 'website_asset_usage'),
    formSubmissions: createCollection(backend, 'website_form_submissions'),
  };
}
