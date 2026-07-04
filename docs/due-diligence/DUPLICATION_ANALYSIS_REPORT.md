# Duplication Analysis Report
**HAAT NOW — Enterprise Due-Diligence Audit (Part 2)**
Repo: `haat-now-phase2` · Method: static import-graph analysis (Grep/Glob/Read) + migration inspection. Every claim cites `file:line`. Read-only; no code was modified.

> Scope note: "CONFIRMED" = proven from code with importer evidence. "REFUTED" = flagged as a suspected duplicate but proven to be distinct-by-design. Where dynamic loading could defeat static proof it is called out.

---

## 1. Summary — confirmed duplicates / overlaps

| # | Duplicate pair | Verdict | Both live? | Survivor | Cleanup effort |
|---|---|---|---|---|---|
| D1 | `growth.service` + `GrowthCenter` **vs** `growthb.service` + `GrowthCenterB` | **CONFIRMED** | Yes — both rendered | Merge into `growthb` + single console | **L** |
| D2 | i18next (`useTranslation().t()`) **vs** inline `L('ar','en')` | **CONFIRMED** (two i18n systems) | Yes | i18next (long-term) | **L** |
| D3 | `features/website/MediaPicker` **vs** `experience/admin/MediaPicker` | **CONFIRMED** (different return contracts) | Yes | Both; share inner component | **M** |
| D4 | `components/admin/CrudManager` **vs** `AdminDataTable` | Partial (table mechanics) | Yes | `CrudManager` should compose `AdminDataTable` | **M** |
| D5 | `experience/assets.service` **vs** `services/storage.service` | Mild (two storage wrappers) | Yes | Both (disjoint buckets) | **S** |
| D6 | DB tables `vehicles` ×2 and `driver_shifts` ×2 (incompatible) | **CONFIRMED (critical)** | Ambiguous by apply-order | Reconcile to one definition each | **M** |
| D7 | Naming collision: admin `ExperienceBuilder` **vs** `WebsiteCenter` (branded "Experience Builder") | Naming only | Yes | Rename one | **S** |
| D8 | `PlatformRegistry` (in DesignCenter) **vs** `PlatformModuleRegistry` (in AdminDashboard) | Overlapping concept, two consoles | Yes | Consolidate registry UX | **M** |

## Refuted suspects (verified NOT duplicates)

| Suspect | Finding |
|---|---|
| provisioning vs tenant vs onboarding vs platform service | **Cleanly layered.** `provisioning.service.ts:42-57` is an orchestrator delegating to `tenant.service`; `onboarding.service.ts` is merchant/driver KYC (different domain); `platform.service.ts` is the platform registry. No redundant tenant creation. |
| "3 onboarding flows" | **3 distinct domains.** `components/onboarding/OnboardingScreen.tsx` = consumer intro carousel (`App.tsx:289`); `features/onboarding/OnboardingForm.tsx` = KYC applicant form (`DriverApp.tsx:397`); `admin/TenantOnboardingWizard.tsx` = white-label tenant provisioning. |
| "5 theme/design/config systems" | **ONE token engine.** `design/designSystem.ts` (`applyDesign`) is reused by `DesignContext` (global), `tenant.service.ts:8,64` (per-tenant), and `themePresets.service` (catalog). `AppConfigContext` = locale only; `ExperienceContext` = screen content. Layered, non-overlapping. |
| `Primitives.tsx` vs Button/Card/Input/Modal | **Complementary.** `Primitives.tsx` exports `ProgressSteps/ProgressBar/Divider/Loader/Avatar/EmptyState` — no overlap with the leaf UI components. |
| `features/website/blocks` vs `experience/blocks` | **Name collision only.** Former = public-site `BlockRenderer` for CMS `WebsiteBlock`s; latter = in-app `MediaRenderer/LottieBlock/VideoBackgroundBlock` for experience screens. Different type systems. |
| `OperationsCenter` vs `OperationsCommandCenter` | **Not a duplicate — nested.** `OperationsCommandCenter` is a *sub-panel* mounted inside `OperationsCenter.tsx`; it hosts the Ops* live consoles (`OpsExecutionConsole/OpsIncidentLog/OpsSlaMonitor/OpsSvgMap`). |

---

## 2. Detailed findings

### D1 — Growth engine implemented twice (CONFIRMED, both live)
- `src/services/growth.service.ts` ("Growth Engine": referrals, cashback, affiliates/influencers, audience segments, message campaigns, `tiers()` at `:29`).
- `src/services/growthb.service.ts` ("Enterprise-B Growth": advanced coupons, loyalty rules/rewards, segments, banners, promotions, retention, analytics, `tiers()` at `:141`).
- **Both consoles are rendered simultaneously**: `OperationsCenter.tsx:86` → `{growthSub === 'mgmt' ? <GrowthCenterB /> : <GrowthCenter />}`. `GrowthCenter.tsx:3` imports `growthService`; `GrowthCenterB.tsx:4` imports `growthbService`.
- Overlap: both expose `tiers()`; `growthb` already partially de-duped by delegating `myPoints()` → `loyaltyService.getPoints` (`growthb.service.ts:178-181`).
- **Why:** `growthb` was a later "Enterprise-B" sprint that re-implemented growth as a superset instead of extending the original.
- **Survivor:** `growthb.service` (broader consumer set incl. `AdminDashboardHome.tsx:11`, `DiscoverScreen.tsx:6`). Fold `growth`'s unique surfaces (affiliates, influencers, cashback campaigns, message campaigns) in and merge to one tabbed console.
- **Migration risk:** Medium — `GrowthCenter` owns unique UI not present in `GrowthCenterB`; a real merge, not a rename. **Effort: L.**

### D2 — Two i18n systems (CONFIRMED, both live)
- **System A (i18next):** `src/i18n/index.ts` full ar/en catalogue via `initReactI18next`. Consumed by `useTranslation().t()` in ~12 files (all customer-facing: `App.tsx:27`, `LoginScreen`, `HomeScreen`, `WalletScreen`, `RestaurantScreen`, `CheckoutPage`, `OrdersList`, `DiscoverScreen`, `ProfileScreen`, `OrderTrackingMap`, `DriverOpsPanel`).
- **System B (inline ternary):** `const L = (ar,en) => lang==='ar' ? ar : en` — **~1,278 occurrences across 54 files**, dominating every admin/merchant/driver feature.
- **Why:** i18next was the intended standard; adoption stalled at the customer screens and the admin build-out used the cheaper inline helper.
- **Survivor (long-term):** i18next (keys/pluralization/interpolation). Inline `L()` is unscalable (no key reuse, translator can't work off a catalogue). **Risk:** low severity / high volume — mechanical. **Effort: L.**

### D3 — Two MediaPickers (CONFIRMED, different contracts)
- `features/website/MediaPicker.tsx` — modal library browser returning a **URL string**; wraps `assetsService` (`:3`).
- `experience/admin/MediaPicker.tsx` — inline single-field editor returning a **`MediaRef` object** (icon/image/lottie/video kind toggle, `:20`).
- Both back onto the same `assets.service`. Different UX + return shape → both legitimate; a shared inner upload/list component could serve both. **Effort: M.**

### D4 — `CrudManager` vs `AdminDataTable` (partial overlap)
- `AdminDataTable.tsx` — generic read-only table (sort/search/paginate/CSV, `:6-34`).
- `CrudManager.tsx` — full CRUD workspace bound to `adminCrud(table)` that **re-implements** its own search/sort/pagination/CSV (`:37-44`) rather than composing `AdminDataTable`.
- **Survivor:** both, but `CrudManager` should render through `AdminDataTable`. **Effort: M.**

### D5 — `assets.service` vs `storage.service` (mild)
- `storage.service.ts:3-9` — marketplace buckets (`product-images`, `merchant-logos`, `banners`, `offer-images`, `avatars`).
- `experience/assets.service.ts:10` — `experience-assets` bucket (brand/experience/website media).
- Both wrap `supabase.storage` + `getPublicUrl` on **disjoint** buckets. Only realistic consolidation is a shared low-level `upload(bucket,file)` helper. **Effort: S.**

### D6 — Duplicate physical DB tables (CONFIRMED — CRITICAL) → see Database Review
- **`vehicles` defined twice, incompatibly:** reference/config table in `…000028_operations_engine.sql:16-24` (type/capacity/pricing) **vs** fleet-instance table in `…000027·5_business_crud.sql:10-19` (plate/status/driver_id/insurance). Because `000028` sorts first and both use `CREATE TABLE IF NOT EXISTS`, the second no-ops; then `000005:26` builds `idx_vehicles_driver on vehicles(driver_id)` — a column that doesn't exist on the surviving table → **apply-time error / wrong physical schema** vs `src/services/ops/vehicle.service.ts`.
- **`driver_shifts` defined twice:** `000028:59-67` (`scheduled_start/end`, status `scheduled|active|closed`) vs `…000027·6_operations_execution.sql:24-31` (`started_at/ended_at`, status `open|closed`). `src/services/ops/shift.service.ts` may query columns that don't exist on the surviving definition.
- These are the most serious model-level duplicates: physical schema depends on migration apply-order. **Effort: M** (reconcile + a corrective migration — but per policy, only reported here, not fixed).

### D7 — "Experience Builder" name used for two different things (naming collision)
- `src/features/admin/ExperienceBuilder.tsx` (mounted in `DesignCenter`) — builder for **in-app experience screens** (splash/onboarding/login), driven by `experienceTypes.MediaRef`.
- `src/features/admin/WebsiteCenter.tsx` — the **tenant website** page builder, branded "Experience Builder" in the most recent sprint.
- Not code duplication, but a **conceptual collision** that will confuse operators and future engineers. **Recommendation:** rename the website one to "Website Builder" (its actual domain). **Effort: S.**

### D8 — Two "registry" consoles
- `PlatformRegistry.tsx` — mounted in `DesignCenter.tsx`.
- `PlatformModuleRegistry.tsx` — mounted in `AdminDashboard.tsx` (the runtime module catalog console).
- Overlapping "platform registry" concept surfaced in two different admin hubs. Verify intended split; if they show related data, consolidate into one console with tabs. **Effort: M.**

---

## 3. Duplicate documentation (Part 2 — docs)
- **Two documentation roots:** `docs/` (large, many subdirs: `audits/`, `archive/`, `apps/`, `auth/`, `architecture/`, …) **and** `documentation/` (`Architecture.md`, `design/`). The second is a small stale island. **Recommendation:** fold `documentation/` into `docs/` and delete the empty root. **Effort: S.**
- Within `docs/`, numerous overlapping audit/report files (`PRODUCTION_BLOCKERS_REPORT.md`, `PRODUCTION_BLOCKERS_STATUS.md`, `07_PRODUCTION_BLOCKERS.md`; `SAFE_AREA_AUDIT.md` + `SAFE_AREA_AUDIT_REPORT.md`) — historical accretion. Per the audit brief these prior reports were **not** relied upon; all findings here are re-derived from code.

---

## 4. Net assessment
The codebase is **not riddled with duplication**. The two genuinely actionable code duplicates are **D1 (Growth A/B)** and **D2 (two i18n systems)** — both large but low-risk. The most dangerous duplication is **D6 (duplicate DB tables)**, which is a correctness/apply-order hazard, not merely cosmetic. The remaining items (D3–D5, D7–D8) are partial overlaps or naming issues. Four loudly-suspected duplicates (provisioning, onboarding, theming, primitives) were **refuted** — they are correctly layered.
