// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · descriptor + registration (STEP 1 + STEP 7).
//
// Registers Website as Channel #1 inside an Engine instance: the channel descriptor, its two
// renderers (the existing string SSR renderer.ts and the React blocks.tsx runtime — declared
// by target, never rewritten), a default theme, and every website experience the content
// source knows. Finally it installs the Website ExperienceResolver into engine.services.
// Nothing here touches WebsiteCenter, publishing, rollback, routes or the public site.
// ─────────────────────────────────────────────────────────────────────────────
import type { ExperienceEngine, WebsiteChannel } from '../../experience-engine';
import type { WebsiteContentSource } from './types';
import { mapSiteToMetadata } from './mapper';
import { createWebsiteRuleResolver, createWebsiteVersionResolver, createWebsiteExperienceResolver } from './resolvers';
import { createWebsiteHtmlRenderingPort } from './htmlRenderer';

/** The Website channel descriptor. Render target 'html-string' = the existing SnapshotRenderer. */
export const websiteChannel: WebsiteChannel = {
  id: 'website',
  metadata: {
    id: 'website',
    name: 'Website',
    version: '1.0.0',
    supportedPlatforms: ['web'],
    supportedDevices: ['mobile', 'tablet', 'desktop'],
    defaultLocale: 'ar',
    roles: ['guest', 'customer'],
  },
  renderTarget: 'html-string',
  roles: ['guest', 'customer'],
  hasNavigation: true,
  publishable: true,
};

export interface RegisterWebsiteResult {
  channelId: 'website';
  experiencesRegistered: number;
}

/**
 * Wire the Website channel into an Engine. Additive and side-effect-free beyond the engine's
 * own registries/services — it wraps existing behaviour and installs the resolver.
 */
export function registerWebsiteChannel(engine: ExperienceEngine, source: WebsiteContentSource): RegisterWebsiteResult {
  // Channel
  engine.registries.channels.register('website', websiteChannel);

  // Renderers — the two EXISTING website renderers, declared by target (not reimplemented).
  // html-string has higher priority: it is the engine's executable server render target.
  engine.registries.renderers.register('website:html-string', {
    id: 'website:html-string', name: 'Website SSR Renderer (SnapshotRenderer)', version: '1.0.0',
    channels: ['website'], target: 'html-string', priority: 10, capabilities: ['ssr', 'rtl'],
  });
  engine.registries.renderers.register('website:react-dom', {
    id: 'website:react-dom', name: 'Website React Runtime (blocks.tsx)', version: '1.0.0',
    channels: ['website'], target: 'react-dom', priority: 5, capabilities: ['interactive'],
  });

  // Register the executable HTML RenderingPort (wraps SnapshotRenderer). The react-dom port is
  // the existing browser runtime (blocks.tsx) — declared above, bound by the host later, not here.
  engine.pipeline.registerPort(createWebsiteHtmlRenderingPort());

  // Theme
  engine.registries.themes.register('website:default', {
    id: 'website:default', name: 'Website Default Theme', version: '1.0.0',
    channels: ['website'], supportsDarkMode: true, supportsRtl: true, tokenKeys: [],
  });

  // Experiences — one per known site.
  let experiencesRegistered = 0;
  for (const id of source.listSiteIds()) {
    const site = source.getPublishedSite(id) ?? source.getDraftSite(id);
    if (!site) continue;
    engine.registries.experiences.register(id, mapSiteToMetadata(site, source.getVersion(id) ?? 1));
    experiencesRegistered++;
  }

  // Install the resolver chain into the engine's services.
  const rules = createWebsiteRuleResolver();
  const versions = createWebsiteVersionResolver(source);
  engine.services.experience = createWebsiteExperienceResolver(source, rules, versions);
  engine.services.version = versions;
  engine.services.rules = rules;

  return { channelId: 'website', experiencesRegistered };
}
