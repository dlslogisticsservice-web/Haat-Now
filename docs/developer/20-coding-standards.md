# 20 · Coding Standards

> **Audience:** every contributor.
> **Authoritative sources:** [../governance/IMPLEMENTATION_STANDARD.md](../governance/IMPLEMENTATION_STANDARD.md)
> (Definition of Done) + [../governance/SERVICE_REGISTRY.md](../governance/SERVICE_REGISTRY.md) (service
> governance). This page distills them for daily work.

## Purpose
The non-negotiable rules that keep the platform coherent: one engine per concern, strict layering, additive
changes, and a green gate before every commit.

## Architecture: the rules that shape the code
1. **Layering (downward only):** `UI → hooks → services → platform/experience/design → storage`. Types are
   leaves. **0 circular imports.** ([04-service-architecture.md](04-service-architecture.md))
2. **One engine per concern:** one theme engine, one CMS, one permission source, one provider registry, one CRUD
   engine. Never build a second.
3. **Additive + backward compatible:** new tokens/fields default to today's value/behavior; live-surface changes
   are feature-flagged so disabling restores prior behavior exactly.
4. **Services own storage:** components never touch `localStorage`/Supabase directly.
5. **Mode gate = `VITE_AUTH_MODE`** everywhere; never `import.meta.env.DEV`.
6. **Frozen systems:** auth/OTP/migration/backend/DB, Design Center, White-Label — touch only for a critical
   bug. **Payment Rule:** no gateway while `HAAT_LIVE_BACKEND` is off.

## Flow: adding a new service (governance)
Every new service **must** begin with this header and get a `SERVICE_REGISTRY.md` entry **in the same commit**:
```ts
// AUTHORIZED BY:
// Phase:
// Purpose:
// Existing services reused:
// Why a new service is required:
// Duplicate analysis:
// Consumers:
// Future merge candidate: YES/NO
```
Prefer **extending** an existing service — the "Duplicate analysis" line must prove nothing already covers the
concern.

## Flow: the Definition of Done (per change)
```
[ ] Typecheck 0 errors (npm run lint)      [ ] Build ✓ (version.json stamped)   [ ] E2E 24/24
[ ] Runtime-verified in the real UI         [ ] 0 console errors                 [ ] State persists on reload
[ ] Cross-module propagation verified       [ ] RBAC gate verified (if gated)    [ ] No regressions
[ ] Existing engines reused (no duplication)[ ] New service governed (header+registry)  [ ] 0 circular imports
[ ] Frozen constraints honored              [ ] Deployed via git workflow + prod verified + rollback stated
[ ] Sprint report committed
```

## Conventions
- **TypeScript**, functional React components + hooks. Keep UI presentational; logic in services.
- **i18n:** all user-facing strings via i18next; the app is **RTL/LTR** (Arabic default). Provide `ar` + `en`.
- **Styling:** Tailwind v4 utilities + design **tokens** (`var(--…)`); never hardcode colors/radii/fonts.
- **Naming:** services `*.service.ts`; permission keys dotted (`group.entity.action`); localStorage namespaces
  `haat_*`.
- **Verification is behavioral:** prove it works by exercising the UI, not by "the class exists."

## Extension points
- New capability → method on the owning service. New permission → `rbac.service`. New provider →
  `platform.service`. New token → `designSystem`. All additive.

## Reuse rules
- Search `src/services/` and `src/components/` before writing anything new. Reuse `admin-crud` for persistence,
  `applyDesign` for theming, `<Can>` for gating, `operation_events` for audit.

## Files involved
- [../governance/IMPLEMENTATION_STANDARD.md](../governance/IMPLEMENTATION_STANDARD.md) ·
  [../governance/SERVICE_REGISTRY.md](../governance/SERVICE_REGISTRY.md) ·
  [`package.json`](../../package.json) (gate commands).

## Do's
- ✅ Green gate before commit. ✅ Reuse engines. ✅ Additive + flagged changes. ✅ ar+en strings. ✅ Tokens, not
  hardcoded styles.

## Don'ts
- ❌ Don't duplicate an engine. ❌ Don't touch storage from a component. ❌ Don't break layering or add a cycle.
- ❌ Don't add a service without header + registry entry. ❌ Don't touch frozen systems or the Payment Rule.

## Example
```ts
// GOOD: reuse the CRUD engine + audit; no new store.
import { adminCrud } from './admin-crud.service';
const events = adminCrud('operation_events');
await events.create({ action: 'zone_created', entity_type: 'zone', entity_id: id, created_at: new Date().toISOString() });
```

## Next
[19-release-process.md](19-release-process.md) · how-to guides: [21](21-how-to-create-new-template.md)–[25](25-how-to-create-new-white-label.md)
