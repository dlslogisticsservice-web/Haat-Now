// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Plugin SDK foundation (STEP 10).
//
// Contracts ONLY — no implementation. This is the surface a future plugin/extension author
// (and the Marketplace) uses to contribute components, channels, themes, renderers, rules,
// analytics, assets and lifecycles into the Engine's registries. The functions are declared
// as an interface (ExperienceSDK) so later waves supply a concrete SDK bound to the engine.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ComponentMetadata, ThemeMetadata, RendererMetadata, RuleMetadata,
  AnalyticsMetadata, AssetMetadata, PluginMetadata,
} from './metadata';
import type { AnyChannel } from './channels';

/** A component contribution: metadata + an opaque render implementation (bound per channel). */
export interface ComponentContribution {
  metadata: ComponentMetadata;
  /** Render impl is intentionally opaque here — its type is fixed by the channel's renderer. */
  render: unknown;
}

export interface RendererContribution {
  metadata: RendererMetadata;
  render: unknown;
}

export interface LifecycleContribution {
  name: string;
  states: string[];
  /** Allowed transitions as [from, to] pairs. */
  transitions: Array<[string, string]>;
}

/** The registration surface. Each call is additive and returns an unregister handle. */
export interface ExperienceSDK {
  registerComponent(contribution: ComponentContribution): () => void;
  registerChannel(channel: AnyChannel): () => void;
  registerTheme(theme: ThemeMetadata): () => void;
  registerRenderer(contribution: RendererContribution): () => void;
  registerRule(rule: RuleMetadata): () => void;
  registerAnalytics(analytics: AnalyticsMetadata): () => void;
  registerPlugin(plugin: PluginMetadata): () => void;
  registerAsset(asset: AssetMetadata): () => void;
  registerLifecycle(lifecycle: LifecycleContribution): () => void;
}
