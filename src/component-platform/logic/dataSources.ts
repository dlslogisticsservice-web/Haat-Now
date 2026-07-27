// ─────────────────────────────────────────────────────────────────────────────
// Unified Data Source abstraction (Phase 9B).
//
// ONE way to reference data regardless of origin. Each source declares a kind and a sample
// payload; the same resolver reads a dotted path from any of them, so binding is uniform.
// External kinds (supabase/firebase/rest/graphql/auth/tenant/storage/media/flags) WRAP the
// existing services — the `reuses` field records which one; live fetch is the connection step and
// never re-implements a service. Build-time preview resolves against each source's sample.
// ─────────────────────────────────────────────────────────────────────────────
import type { DataSource } from './logicTypes';

/** The default sources every project gets, spanning every supported kind (no duplicated services). */
export function defaultDataSources(): DataSource[] {
  return [
    { id: 'ds_local', name: 'Local Data', kind: 'local', reuses: '—', sample: { appName: 'HAAT NOW', tagline: 'Everything, delivered' } },
    { id: 'ds_customer', name: 'Auth User', kind: 'auth', reuses: 'auth.service', sample: { name: 'Sara', phone: '+201000000001', role: 'customer' } },
    { id: 'ds_tenant', name: 'Tenant Data', kind: 'tenant', reuses: 'tenant.service', sample: { brand: 'HAAT NOW', country: 'SA', currency: 'SAR' } },
    { id: 'ds_flags', name: 'Feature Flags', kind: 'flags', reuses: 'experience-engine/flags', sample: { customer_offers: true, customer_welcome: true } },
    { id: 'ds_products', name: 'Products (Static)', kind: 'static', reuses: '—', sample: [{ name: 'Shawarma', price: 22 }, { name: 'Pizza', price: 49 }, { name: 'Burger', price: 35 }] },
    { id: 'ds_restaurant', name: 'Restaurant (JSON)', kind: 'json', reuses: '—', sample: { name: 'Al Basha', rating: 4.8, logo: 'https://haatnow.app/icon-192.png' } },
    { id: 'ds_orders', name: 'Orders (Runtime)', kind: 'runtime', reuses: 'sandboxStore', sample: [{ id: '#1042', status: 'preparing', total: 84 }] },
    { id: 'ds_supabase', name: 'Supabase', kind: 'supabase', reuses: 'lib/supabase', sample: {}, config: { table: '' } },
    { id: 'ds_rest', name: 'REST API', kind: 'rest', reuses: 'services/monitoring (fetch)', sample: {}, config: { url: '' } },
    { id: 'ds_storage', name: 'Storage', kind: 'storage', reuses: 'storage.service', sample: { files: [] } },
    { id: 'ds_media', name: 'Media Library', kind: 'media', reuses: 'assets.service', sample: { images: ['https://haatnow.app/icon-192.png'] } },
  ];
}

/** Read a dotted path from a source's sample payload (null-safe). */
export function resolvePath(root: unknown, path: string): unknown {
  if (!path) return root;
  let cur: unknown = root;
  for (const part of path.split('.')) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Build the `data` sub-scope (source name → sample) for expression evaluation + binding. */
export function dataScope(sources: DataSource[]): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (const s of sources) {
    // Address by a stable key derived from the source name (first word, lowercased).
    const key = s.name.split(/\s|\(/)[0].toLowerCase();
    scope[key] = s.sample;
  }
  return scope;
}
