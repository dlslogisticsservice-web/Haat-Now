# 23 · How To: Create a New Provider (Integration)

> **Goal:** add a third-party provider (maps, SMS, analytics, payment-config, …) to the Integration Center.
> **Read first:** [15-integration-center.md](15-integration-center.md).
> **Payment Rule:** you may add + configure a payment provider, but **no runtime charge** while
> `HAAT_LIVE_BACKEND` is disabled.

## Purpose
Register a new external provider so operators can enable it, set its mode/credentials, and (for provisioning)
have it applied per tenant — all through the one provider registry.

## Architecture recap
```
PROVIDER_CATALOG (static defs)  ──▶  platform.service (registry)  ──▶  haat_platform_registry
        ProviderDef                        upsert / enable / mode                per-tenant via provisioning "integrations" step
```
Catalog: [`src/platform/platformModel.ts`](../../src/platform/platformModel.ts). Service:
[`src/platform/platform.service.ts`](../../src/platform/platform.service.ts). UI:
[`IntegrationCenter.tsx`](../../src/features/admin/IntegrationCenter.tsx).

## Flow: step by step
1. **Add a `ProviderDef` to `PROVIDER_CATALOG`** in `platformModel.ts`:
   ```ts
   { key: 'sms_twilio', name: 'Twilio SMS', category: 'sms', modes: ['test', 'live'],
     credentials: ['account_sid', 'auth_token', 'from'], health: 'unknown' }
   ```
   Because `platform.service` **merges** new defaults into stored registries, the provider appears for operators
   automatically without wiping their edits.
2. **Handle it in `platform.service`** if it needs custom enable/validate logic (most don't — the generic
   upsert/enable/mode flow covers it).
3. **Expose it in the Integration Center** (it renders from the catalog).
4. **Gate management** with an RBAC permission (e.g. `platform.integrations.manage`) — [16](16-rbac.md).
5. **Wire the runtime consumer** (optional): the feature that uses the provider reads its config from
   `platform.service` (the control-plane target). Note: some consumers still read env keys directly today — the
   registry is the migration target.
6. **Reference it from templates** via a manifest's `integrations: ['sms_twilio']` so verticals can request it
   ([21](21-how-to-create-new-template.md)).

## Dependencies
- `platformModel` (catalog/types), `platform.service` (registry + webhook logs), Integration Center UI,
  `provisioning.service` (integrations step), `rbac.service` (gate). Payment providers: `payment.service`
  adapters (config only).

## Extension points
- **New provider category** → add it to the catalog's category set. **New webhook** → log to
  `haat_webhook_logs` via `platform.service`.

## Reuse rules
- **One registry.** A provider is a `ProviderDef` + a registry entry — never a bespoke per-feature config store.
- Reads must stay merge-friendly (fall back to `DEFAULT_PLATFORM`), so new catalog entries surface automatically.
- Platform layer imports storage + types only.

## Files involved
- [`src/platform/platformModel.ts`](../../src/platform/platformModel.ts) ·
  [`src/platform/platform.service.ts`](../../src/platform/platform.service.ts) ·
  [`src/features/admin/IntegrationCenter.tsx`](../../src/features/admin/IntegrationCenter.tsx) ·
  [`src/services/payment.service.ts`](../../src/services/payment.service.ts) (payment adapters, config-only).

## Do's
- ✅ Add to the catalog + keep reads merge-friendly. ✅ Gate management with a permission. ✅ Let the runtime
  consumer read config from `platform.service`.

## Don'ts
- ❌ Don't build a per-feature config store. ❌ Don't wire a live payment charge while the live backend is off.
- ❌ Don't import application services from the platform layer.

## Example
```ts
// After adding the catalog def, an operator enables it:
platformService.upsertProvider({ key: 'sms_twilio', mode: 'test', enabled: true,
  credentials: { account_sid: '…', auth_token: '…', from: '+1…' } });
```

## Next
[24-how-to-create-new-theme.md](24-how-to-create-new-theme.md)
