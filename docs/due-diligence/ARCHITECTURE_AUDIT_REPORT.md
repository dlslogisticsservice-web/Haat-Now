# Architecture Audit Report
**HAAT NOW — Enterprise Due-Diligence Audit (Part 4)**
Scope: `src/` (169 files, ~28.6k LOC), React 19 + Vite + TS SPA. Read-only. Every finding cites `file:line`.

---

## Executive summary
Layering **intent** is sound (features → services → lib), there are **no circular dependencies**, and no service imports feature *logic*. But the boundary is **not enforced downward**: UI components query the database directly, the persistence layer is **re-implemented inline** across many services, and the largest feature files are **god objects** fusing data-fetch + business rules + local persistence + UI. State management is a coherent-config / ad-hoc-domain split.

## Findings

| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| A1 | **UI bypasses the service layer and queries the DB directly** — 11 feature files import `lib/supabase`; ~25 raw `supabase.from/rpc/auth` calls inside components | **High** | `checkout/CheckoutPage.tsx:3` (6 calls), `merchant/MerchantApp.tsx:4` (4), `orders/MultiTargetReview.tsx` (4), `orders/OrdersList.tsx` (3), `driver/DriverApp.tsx` (2), `home/HomeScreen.tsx` (2), `admin/{AdminDashboard,OperationsCenter,SystemLogs}.tsx`, `onboarding/OnboardingForm.tsx`, `App.tsx:2` | Route all DB access through `*.service.ts`. Add an ESLint `no-restricted-imports` rule forbidding `lib/supabase` outside `src/services`/`src/lib`. |
| A2 | **God objects** — top files mix data fetch, domain logic, local persistence, gesture/UI | **High** | `merchant/MerchantApp.tsx` (1220), `profile/ProfileScreen.tsx` (1156), `checkout/CheckoutPage.tsx` (974), `App.tsx` (900), `orders/OrdersList.tsx` (760), `driver/DriverApp.tsx` (751), `admin/AdminDashboard.tsx` (726). E.g. `ProfileScreen.tsx:64-83` embeds payment-method CRUD + localStorage seeding; `MerchantApp.tsx:107-120` has 14+ `useState` | Extract sub-screens + custom hooks; push domain rules into services. |
| A3 | **Duplicated persistence layer** — `admin-crud.service` is canonical localStorage CRUD, but 7 services re-implement inline `haat_crud_${table}` readers/writers | **High** | `cx.service.ts:5`, `finance.service.ts:13`, `growthb.service.ts:6`, `onboarding.service.ts:33`, `subscription.service.ts`, `demoSeed.ts:8`, `ops/command.service.ts` vs canonical `admin-crud.service.ts:15-16`. **109 `localStorage.*` calls across 41 files**, no central wrapper | Centralize on `adminCrud`/a `kv` module; forbid direct `localStorage` elsewhere. Same keys mutated from many sites = data-integrity risk. |
| A4 | **Cross-feature imports** (a feature reaching into a sibling feature's internals) | **Medium** | `merchant/MerchantApp.tsx:25` → `../admin/NotificationCenter`; `driver/DriverApp.tsx:19` → `../onboarding/OnboardingForm`; `admin/WebsiteCenter.tsx:8-9` → `../website/MediaPicker`, `../website/blocks` | Promote shared components to `src/components/*`; features should import only `components/`, `services/`, `contexts/`. |
| A5 | **Business/persistence logic in components (wrong ownership)** | **Medium** | `profile/ProfileScreen.tsx:59-83` (payment-method domain + storage in a UI file); `merchant/MerchantApp.tsx:77-81` (`validateImage` rule inline) | Move to `account.service`/a `payment-methods.service`; component consumes via props/hooks. |
| A6 | **Ad-hoc global domain store** — `sandboxStore` is a 381-LOC mutable singleton (plain object, localStorage-backed) mutated directly by UI, with no reactivity | **Medium** | `services/sandboxStore.ts:84`; imported/mutated in `App.tsx:4`, `MerchantApp.tsx:9`, `CheckoutPage.tsx:9`; no `subscribe/notify` API → components hand-poll/refetch | Gate strictly behind `VITE_AUTH_MODE`, or give it a subscribe API. It currently sits on production UI paths. |
| A7 | **Service→feature type inversion** — a service imports a domain type from inside a feature | **Low** | `services/auth.service.ts:2` → `../features/auth/types` (`User`); that type then flows app-wide from a feature folder | Relocate `User`/domain types to `src/services/types` (or `src/domain`). |
| A8 | **Split state paradigm** (informational, not a defect) — 3 React contexts + 1 imperative singleton | **Low** | `main.tsx:55-68` nests `AppConfigProvider`→`DesignProvider`→`ExperienceProvider`; domain data via `sandboxStore`. Config/theme/experience-via-context is coherent; domain data has no store abstraction | Consider a lightweight query/cache layer (e.g. React Query) before a real backend cutover. |
| A9 | **Overloaded "experience/design/platform" trio** — three top-level dirs with overlapping theming/branding responsibility | **Low** | Theming spans `design/DesignContext`, `experience/`, and tenant-brand logic in `features/website` + `tenant.service`; a newcomer must learn which owns what | Document ownership; consider merging `design/` into `experience/` or vice-versa. |

## Verified NOT problems (evidence)
- **No circular dependencies.** Service→service graph is a DAG. Chains checked: `provisioning → {tenant, subscription, rbac, monitoring, admin-crud}`, `subscription → tenant`, `tenant → {admin-crud, themePresets}`, `order → notification`, `wallet → notification`, `growthb → loyalty`. No back-edge found.
- **Services do not import feature logic** — the only service→feature edge is the type-only import in A7.
- **Shared UI (`components/ui`) imports 0 services** (grep = 0). Service coupling in `components/` is confined to justified infra shims (`ErrorBoundary→monitoring`, `AppGate→release`, `CrudManager→admin-crud`, location badges→`location.service` formatters).
- **No `window.__` global back-channels** in app code; the 4 dev hooks (`__sb/__site/__prov/__tpl`) are all `import.meta.env.DEV`-gated (see Security review) and tree-shaken from production.

## Structural context from the data model (cross-ref: Database Review)
- **No `tenant_id` on any domain table and no per-tenant RLS** — multi-tenant isolation is deferred to a "future rollout" (`…000008_tenants.sql:6-7`; `…000018:37-39`). Isolation today is app-logic + admin country-scoping, not the database. This is the single largest *architectural* gap for a white-label multi-tenant product and is scored under Scalability.
- **Duplicate physical tables** (`vehicles`, `driver_shifts`) whose surviving schema depends on migration apply-order (`…000028` vs `…000027·5/·6`) — an architecture-of-data hazard.

## Recommended priority order
1. Enforce the DB boundary (A1) — biggest leak, easiest to lint-gate.
2. Consolidate the localStorage/CRUD layer (A3).
3. Decompose the 1000+ LOC god objects (A2), moving domain logic (A5) into services.
4. Fix the 4 cross-feature imports (A4) and relocate shared `User` types (A7).
