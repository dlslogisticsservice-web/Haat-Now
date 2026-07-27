# Database — Website Studio Data Platform

The Studio models data **visually**; records live in-session (`recordStore`). Providers are
declarative mappings; SQL is **generated, never executed**.

## Schema source of truth
`src/component-platform/data/dataModel.ts` (Entity/Field/Relation) + `haatSchema.ts` (the 23
canonical HAAT NOW entities). Field → SQL type mapping in `sqlGenerator.ts`.

## Generating SQL
```
store.entitiesSQL()          // CREATE TABLE + indexes + constraints + FKs
store.migrationSQL()         // { up, down } — down is the rollback (DROP … cascade)
store.entityInsertsSQL(id)   // INSERT statements for current rows (tenant-scoped)
```
- Every table gets `tenant_id uuid not null`.
- `rating` fields get a `check (… between 1 and 5)` constraint; numeric min/max become range checks.
- Foreign keys derive from relations with the declared `onDelete` behavior.

## Providers (mapping only — no duplicated client)
`local` (in-session) · `supabase` (→ `lib/supabase`) · `firebase` (declared) · `rest`/`graphql`
(→ fetch). The mapping records which existing service it would wrap; live connection is a backend
step and never re-implements a client.

## Tenancy
Every row carries `tenantId`; all reads filter by the active tenant context. Cross-tenant reads are
impossible through the public API.

## Migrations
Preview + rollback are generated for review. Applying them to a real Postgres/Supabase instance is a
deliberate, human-run backend step (out of Studio scope by design).
