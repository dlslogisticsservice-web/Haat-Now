# Website Platform · Service Layer (Wave 1)

> The 12 services. Every service uses **repositories only** — no direct database access — and adds
> validation, audit, and (where relevant) events + transactions on top of the persistence engine.

## 1. The generic core (no duplicate logic)
`AggregateService<TEntity,TCreate,TUpdate>` implements `create / get / list / update / remove /
restore` once, wired with:
- **validation** (an optional DTO validator; rejects before persistence with a `validation` error),
- **audit** (create → after; update → before+after; delete → before) via the `AuditRecorder`,
- **optimistic concurrency** (passes `expectedVersion` through to the repository).

The 12 named services are thin configurations of this core (plus a few domain methods).

## 2. The services (Part 2)
| Service | Backed by | Extra |
|---|---|---|
| `WebsiteService` | sites repo | AggregateService |
| `PageService` | pages repo | + `page.created` event, transactional `reorder()` |
| `SectionService` | sections repo | AggregateService |
| `BlockService` | blocks repo | AggregateService + block validation |
| `NavigationService` | menus + navigation repos | + transactional `reorder()` |
| `ThemeService` | themes repo | AggregateService |
| `MediaMetadataService` | assets + media-variants + asset-usage | + `recordUsage()` / `usageCount()` (delete-safety) |
| `SEOService` | seo repo | AggregateService |
| `TranslationService` | translations repo | AggregateService |
| `RevisionService` | revisions child | append + list by entity (append-only) |
| `SettingsService` | settings child | `set` (upsert) / `get` / `list` |
| `TemplateService` | templates repo | AggregateService |

*(Forms also has a service instance; it composes the same core.)*

## 3. Rules
- **Repository-only.** Services never touch `supabase`; they call repositories, children, the audit
  recorder, the outbox, the snapshot store, or the unit of work — all injected via `PlatformContext`.
- **Validation is business + domain + schema.** DTO validators (`requireFields`, the DRY helper)
  enforce required/typed fields; schema/enum constraints mirror the DB CHECKs; conflict detection is
  the optimistic-lock path.
- **Audit is automatic** on every create/update/delete (who/when/before/after/correlation/tenant/env).
- **Events** are emitted through the durable outbox (`PageService` emits `website.page.created`;
  other lifecycle events are added as later waves wire them).
- **Transactions** use the Unit of Work for multi-step atomicity (page/nav reorder) with compensation.

## 4. Usage
```ts
const ctx = createPlatformContext({ backend: 'supabase', environment: 'production' });
const services = createServices(ctx);
const op = { tenantId, actorId, correlationId };
const site = await services.websites.create(op, { tenantId, slug: 'acme', name: 'Acme' });
```
Nothing here runs in the app until `website.db_backend` is enabled for the tenant (default OFF).
