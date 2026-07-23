// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · registries (STEP 4).
//
// Registries are the Engine's catalogs. The generic InMemoryRegistry is pure infrastructure
// (a typed Map with register/get/list/has) — NOT business logic. The ten named registries
// are created EMPTY and left unpopulated at this foundation stage; later waves register real
// channels/components/themes into them via the SDK.
// ─────────────────────────────────────────────────────────────────────────────
import type { RegistryPort } from './ports';
import type {
  ExperienceMetadata, ComponentMetadata, RendererMetadata,
  ThemeMetadata, AssetMetadata, AnalyticsMetadata, RuleMetadata, PluginMetadata,
} from './metadata';
import type { AnyChannel } from './channels';

/** Generic, pure, in-memory registry. Last registration under an id wins. */
export class InMemoryRegistry<T> implements RegistryPort<T> {
  private readonly items = new Map<string, T>();
  register(id: string, value: T): void { this.items.set(id, value); }
  get(id: string): T | null { return this.items.has(id) ? (this.items.get(id) as T) : null; }
  list(): T[] { return [...this.items.values()]; }
  ids(): string[] { return [...this.items.keys()]; }
  has(id: string): boolean { return this.items.has(id); }
  get size(): number { return this.items.size; }
  clear(): void { this.items.clear(); }
}

// ── The ten named registries — all empty at foundation stage ───────────────────
export class ExperienceRegistry extends InMemoryRegistry<ExperienceMetadata> {}
export class ComponentRegistry extends InMemoryRegistry<ComponentMetadata> {}
export class ChannelRegistry extends InMemoryRegistry<AnyChannel> {}
export class ThemeRegistry extends InMemoryRegistry<ThemeMetadata> {}
export class RuleRegistry extends InMemoryRegistry<RuleMetadata> {}

/** Renderer catalog with channel/target/version matching (STEP 1). Query-only additions. */
export class RendererRegistry extends InMemoryRegistry<RendererMetadata> {
  /** Renderers that can emit for a channel. */
  byChannel(channel: string): RendererMetadata[] {
    return this.list().filter(r => r.channels.includes(channel));
  }
  /** Renderers for an output target. */
  byTarget(target: string): RendererMetadata[] {
    return this.list().filter(r => r.target === target);
  }
  /** Renderers matching all provided criteria, highest priority first. */
  matching(criteria: { channel?: string; target?: string; version?: string; capability?: string }): RendererMetadata[] {
    return this.list()
      .filter(r =>
        (criteria.channel == null || r.channels.includes(criteria.channel)) &&
        (criteria.target == null || r.target === criteria.target) &&
        (criteria.version == null || r.version === criteria.version) &&
        (criteria.capability == null || (r.capabilities ?? []).includes(criteria.capability)))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
}

export class AssetRegistry extends InMemoryRegistry<AssetMetadata> {}
export class PluginRegistry extends InMemoryRegistry<PluginMetadata> {}
export class LifecycleRegistry extends InMemoryRegistry<{ name: string; states: string[] }> {}
export class AnalyticsRegistry extends InMemoryRegistry<AnalyticsMetadata> {}

/** The complete set of registries the Engine owns. Constructed empty. */
export interface EngineRegistries {
  experiences: ExperienceRegistry;
  components: ComponentRegistry;
  channels: ChannelRegistry;
  themes: ThemeRegistry;
  rules: RuleRegistry;
  renderers: RendererRegistry;
  assets: AssetRegistry;
  plugins: PluginRegistry;
  lifecycles: LifecycleRegistry;
  analytics: AnalyticsRegistry;
}

/** Build a fresh, empty set of registries. */
export function createRegistries(): EngineRegistries {
  return {
    experiences: new ExperienceRegistry(),
    components: new ComponentRegistry(),
    channels: new ChannelRegistry(),
    themes: new ThemeRegistry(),
    rules: new RuleRegistry(),
    renderers: new RendererRegistry(),
    assets: new AssetRegistry(),
    plugins: new PluginRegistry(),
    lifecycles: new LifecycleRegistry(),
    analytics: new AnalyticsRegistry(),
  };
}
