# 15 · Integration Center

> **Audience:** developers adding third-party providers (maps, SMS, payments-config, analytics, …).
> **Payment Rule:** the Integration Center may *configure* payment providers (control plane), but while
> `HAAT_LIVE_BACKEND` is disabled **no runtime charge is made** — subscription management only.

## Purpose
One registry (the "control plane") for all external providers, feature flags, brands, environments, and webhook
logs. It is where an operator turns a provider on/off and sets its mode/credentials — a single source of truth
for integrations.

## Architecture
```
IntegrationCenter (admin UI)  ──▶  platform.service  ──▶  haat_platform_registry (localStorage / platform_registry table)
                                       │  brands · applications · providers · flags · environments
                                       └▶ haat_webhook_logs
Provider catalog (static)  ──▶  platformModel.PROVIDER_CATALOG (ProviderDef, health, mode)
```
- [`src/platform/platform.service.ts`](../../src/platform/platform.service.ts) — FOUNDATION-layer registry.
  Reads fall back to `DEFAULT_PLATFORM` and **merge** new default entries so newly-added providers/flags appear
  without wiping operator edits. Live path = the additive `platform_registry` table (documented seam).
- [`src/platform/platformModel.ts`](../../src/platform/platformModel.ts) — types + `PROVIDER_CATALOG`
  (`ProviderDef`, `ProviderHealth`, `ProviderMode`, `FlagState`, `WebhookLog`, …).
- [`src/features/admin/IntegrationCenter.tsx`](../../src/features/admin/IntegrationCenter.tsx) and
  [`PlatformRegistry.tsx`](../../src/features/admin/PlatformRegistry.tsx) — the UI.

**Note (readiness):** some runtime consumers (e.g. maps) still read env keys directly today; the registry is the
control plane and the migration target — see [SYSTEM_DEPENDENCY_MAP.md](../architecture/SYSTEM_DEPENDENCY_MAP.md).

## Flow: configuring a provider
```
Operator → Integration Center → select provider → set mode (test/live) + credentials + enable
  platform.service.upsertProvider(config) → haat_platform_registry
Provisioning: the engine's "integrations" step reads spec.integrations → platform.service (per-tenant enablement)
Webhooks: inbound events logged to haat_webhook_logs
```

## Dependencies
- `platformModel` (catalog/types), storage (localStorage / `platform_registry`), consumed by the Provisioning
  Engine's integrations step and future runtime adapters. `payment.service` provides gateway **adapters**
  (config only — no live charge).

## Extension points
- **New provider** → add a `ProviderDef` to `PROVIDER_CATALOG` + handle it in `platform.service`. See
  [23-how-to-create-new-provider.md](23-how-to-create-new-provider.md). Additive — the merge-read makes it
  appear automatically.
- **New feature flag** → add to `DEFAULT_PLATFORM.flags`.

## Reuse rules
- **One provider registry.** Every integration is a `ProviderDef` in the catalog + a registry entry — never a
  bespoke config store per feature.
- Respect the Payment Rule: configure payment providers, but no runtime charge while the live backend is off.
- Platform layer imports storage + types only (never application services).

## Files involved
- [`src/platform/platform.service.ts`](../../src/platform/platform.service.ts) ·
  [`src/platform/platformModel.ts`](../../src/platform/platformModel.ts) ·
  [`src/features/admin/IntegrationCenter.tsx`](../../src/features/admin/IntegrationCenter.tsx) ·
  [`src/features/admin/PlatformRegistry.tsx`](../../src/features/admin/PlatformRegistry.tsx).

## Do's
- ✅ Add providers to the catalog + registry. ✅ Keep reads merge-friendly (fall back to `DEFAULT_PLATFORM`).
- ✅ Gate provider-management UI with an RBAC permission.

## Don'ts
- ❌ Don't create a per-feature config store. ❌ Don't wire a live payment charge while `HAAT_LIVE_BACKEND` is
  off. ❌ Don't import application services from the platform layer.

## Example
```ts
// Enable a maps provider in test mode:
platformService.upsertProvider({ key: 'mapbox', mode: 'test', enabled: true, credentials: { token: '…' } });
```

## Next
[16-rbac.md](16-rbac.md) · [23-how-to-create-new-provider.md](23-how-to-create-new-provider.md)
