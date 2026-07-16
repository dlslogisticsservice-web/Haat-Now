// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · Configuration.
//
// ONE place. Layered: defaults < source < override. Namespaced per module so a
// module can never read (or clobber) another's config. Values are cloned on read
// so no caller can mutate shared state. Secrets NEVER live here — the kernel is
// pure; secrets stay in the host (Edge Function secrets).
// ─────────────────────────────────────────────────────────────────────────────
import type { Result } from './types';
import { ok, err } from './types';

export type ConfigValue = string | number | boolean | null | ConfigValue[] | { [k: string]: ConfigValue };
export type ConfigBag = Record<string, ConfigValue>;

/** A read-only source of config (env, DB row, JSON). Hosts implement; kernel never reads env itself. */
export interface ConfigSource { id: string; load(): ConfigBag }

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export class ConfigStore {
  private readonly defaults = new Map<string, ConfigBag>();   // namespace → defaults
  private readonly layers: ConfigBag[] = [];                   // ordered sources (flat `ns.key`)
  private readonly overrides = new Map<string, ConfigValue>(); // flat `ns.key` → value (highest)
  private frozen = false;

  /** A module declares its defaults at registration. Re-declaring the same namespace is rejected. */
  defineNamespace(namespace: string, defaults: ConfigBag): Result<true> {
    if (this.frozen) return err('config is frozen');
    if (this.defaults.has(namespace)) return err(`namespace already defined: ${namespace}`);
    this.defaults.set(namespace, clone(defaults));
    return ok(true);
  }

  addSource(source: ConfigSource): void {
    if (this.frozen) throw new Error('config is frozen');
    this.layers.push(clone(source.load()));
  }

  /** Highest-precedence explicit set (used by Platform Admin at runtime). */
  set(namespace: string, key: string, value: ConfigValue): Result<true> {
    if (this.frozen) return err('config is frozen');
    if (!this.defaults.has(namespace)) return err(`unknown namespace: ${namespace}`);
    this.overrides.set(`${namespace}.${key}`, clone(value));
    return ok(true);
  }

  /** Resolution order: override → sources (last wins) → namespace default. */
  get<T extends ConfigValue = ConfigValue>(namespace: string, key: string): T | undefined {
    const flat = `${namespace}.${key}`;
    if (this.overrides.has(flat)) return clone(this.overrides.get(flat)) as T;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (flat in layer) return clone(layer[flat]) as T;
    }
    const d = this.defaults.get(namespace);
    return d && key in d ? (clone(d[key]) as T) : undefined;
  }

  /** Typed read with a guaranteed fallback — the shape modules should use. */
  getOr<T extends ConfigValue>(namespace: string, key: string, fallback: T): T {
    const v = this.get<T>(namespace, key);
    return v === undefined ? fallback : v;
  }

  /** Whole namespace, resolved. */
  namespace(ns: string): ConfigBag {
    const out: ConfigBag = clone(this.defaults.get(ns) ?? {});
    for (const layer of this.layers) {
      for (const [k, v] of Object.entries(layer)) if (k.startsWith(`${ns}.`)) out[k.slice(ns.length + 1)] = clone(v);
    }
    for (const [k, v] of this.overrides) if (k.startsWith(`${ns}.`)) out[k.slice(ns.length + 1)] = clone(v);
    return out;
  }

  namespaces(): string[] { return [...this.defaults.keys()].sort(); }

  /** After boot, config becomes immutable — prevents drift mid-flight. */
  freeze(): void { this.frozen = true; }
  isFrozen(): boolean { return this.frozen; }
}
