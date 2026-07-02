# PROJECT_CLEANUP_PLAN.md

Structure + tech-debt audit. **Analysis only — no files changed by this document** (except creating this file).

## 1. Audit summary (evidence-based)
- **Two migration directories** (one stale): `src/db/migrations/` (0000–0007) vs `supabase/migrations/` (0000–0017). `src/db/migrations` is a stale subset, **not referenced by any code**.
- **4 dead services** (0 references): `payment.service`, `product.service`, `restaurant.service`, `user.service`.
- **Dead/standalone UI components**: `location/LocationPicker.tsx`, `location/LocationCard.tsx` (0 importers); `ui/BottomNavBar.tsx`, `ui/TopAppBar.tsx`, `location/DistanceBadge.tsx`, `location/EtaBadge.tsx` (barrel/parent-only — verify).
- **Two docs folders**: `documentation/` (3 files) + `docs/` (~30 files across audits/reports/plans/verification).
- **Root QA/dev scripts**: `__db_audit.cjs`, `__db_check.cjs`, `screenshot.cjs`, `screenshot_audit.cjs`, `screenshot_extra.cjs`.
- **No custom hooks** (no `src/hooks`).

## 2. File-level cleanup

### Delete
| File(s) | Reason |
|---|---|
| `src/db/migrations/` (0000–0007, 8 files) | **Duplicate, stale** — superseded by `supabase/migrations/` (0000–0017); not imported anywhere |
| `src/services/payment.service.ts` | 0 references; payments go through edge functions called inline in `CheckoutPage` |
| `src/services/product.service.ts` | 0 references; product reads inline via `supabase.from('products')` |
| `src/services/restaurant.service.ts` | 0 references; superseded by inline catalog queries |
| `src/services/user.service.ts` | 0 references |
| `src/components/location/LocationPicker.tsx` | 0 importers |
| `src/components/location/LocationCard.tsx` | 0 importers |
| `__db_audit.cjs`, `__db_check.cjs` | one-off anon-key probe scripts; superseded by docs |
| `screenshot.cjs`, `screenshot_audit.cjs`, `screenshot_extra.cjs` | ad-hoc QA capture scripts (mock-fetch era) |

### Verify, then delete (barrel/parent-only references)
| File | Reason / check |
|---|---|
| `src/components/ui/BottomNavBar.tsx` | Legacy — real nav is `.bottom-nav` in `App.tsx`; likely only re-exported by `ui/index.ts` |
| `src/components/ui/TopAppBar.tsx` | Same — confirm no screen renders it |
| `src/components/location/DistanceBadge.tsx`, `EtaBadge.tsx` | Confirm not used outside the dead `LocationCard` |

### Keep
| File | Reason |
|---|---|
| `supabase/migrations/*` | Canonical, CLI-applied migration history |
| `src/services/{auth,order,wallet,driver,merchant,admin,cart,checkout,customer,notification,location,tracking,storage,country-detection,sandboxStore}.ts` | All referenced (1–13 importers) |
| `src/components/ui/{Icon,Card,Badge,Button,Primitives,Input,Modal,EnterpriseSidebar}.tsx`, `splash`, `onboarding` | In active use |
| `README.md`, `DEMO_ACCOUNTS.md`, `PAYMENT_ACTIVATION_GUIDE.md` | Operational |

### Merge (overlapping reports)
| Merge into | Sources | Reason |
|---|---|---|
| `docs/architecture/AUTH.md` | `AUTH_AUDIT`, `AUTH_WIRING_AUDIT`, `AUTH_VERIFICATION` | 3 overlapping auth docs |
| `docs/deployment/PRODUCTION_STATUS.md` | `PRODUCTION_READINESS`, `PRODUCTION_VALIDATION_REPORT`, `CRITICAL_BLOCKERS_REPORT` | overlapping prod-status |
| `docs/product/UI_HISTORY.md` (archive) | `VISUAL_DIFF_ANALYSIS`, `VISUAL_PARITY_REPORT`, `DESIGN_CONFLICT_REPORT`, `HOME_SCREEN_REDESIGN`, `CATEGORY_UI_REPORT`, `HERO_REDESIGN_PLAN`, `HOME_RESTRUCTURE_PLAN`, `REFERENCE_AUDIT` | historical UI-iteration; archive, don't maintain |

## 3. Recommended docs structure
```
docs/
  architecture/   <- Architecture.md, AUTH.md, MASTER_PROJECT_STATUS.md, RBAC_AUDIT, DATA_AUDIT
  verification/   <- WORKFLOW/PORTALS/DEMO_ACCOUNTS/ADMIN runtime tests, SAFE_AREA, PRODUCT_IMAGE audits
  deployment/     <- PRODUCTION_STATUS, PAYMENT_ACTIVATION_GUIDE, PRIORITIZED_BACKLOG, NEXT_30_DAYS, REAL_BACKEND_MIGRATION_PLAN
  business/       <- DEMO_ACCOUNTS.md (credentials), pricing/ops notes
  product/        <- HAAT-NOW-DESIGN-SPEC, VISUAL_BIBLE, UI_HISTORY (archived iteration reports)
```
**Mapping of current files:** `documentation/Architecture.md`→architecture; `documentation/design/*`→product; `docs/audits/{RBAC,DATA}`→architecture, `docs/audits/{SAFE_AREA,PRODUCT_IMAGE,REFERENCE}`→verification/product; `docs/reports/*` split per merge table; `docs/plans/*`→deployment; `docs/verification/*`→verification. Collapse the old `audits/reports/plans` buckets into the 5 above. Delete `documentation/` after move (eliminate the two-folder split).

## 4. Sandbox architecture
| Element | Recommendation |
|---|---|
| `src/services/sandboxStore.ts` | **Keep** (powers demo/CI workflow) — it's the only shared demo backend |
| `DEMO_ACCOUNTS` (`auth.service.ts`) | **Keep, centralize** — move to `src/config/demoAccounts.ts` |
| Scattered `import.meta.env.VITE_AUTH_MODE === 'sandbox'` (CheckoutPage, MerchantApp, DriverApp, OrdersList, AdminDashboard, auth.service) | **Feature-flag**: single `isSandbox()` helper in `src/config/flags.ts`; replace all inline checks |
| Sandbox code in production bundle | **Risk**: runtime env-checks are **not tree-shaken**, so demo/auth-bypass code ships in prod. Recommend a **build-time** flag (Vite `define`/`import.meta.env.PROD` guard) so `supabase` production builds **exclude** sandbox branches |
| `SANDBOX` forks | **Remain, flag-gated** — do not delete (keep demos working); guard behind the build-time flag |

## 5. Production cutover risk
| Sev | Risk | Mitigation |
|---|---|---|
| 🔴 Critical | Sandbox auth/order forks ship in prod (runtime flag, not stripped) → fake login / demo data if `VITE_AUTH_MODE` misset | Build-time flag + CI assert `VITE_AUTH_MODE=supabase` for prod; verify bundle excludes `sandboxStore` |
| 🟠 High | Duplicate migration dirs → wrong/stale migrations applied | Delete `src/db/migrations`; single source `supabase/migrations` |
| 🟠 High | Dead `payment.service` alongside real edge-fn payments → maintenance confusion | Delete dead services |
| 🟡 Medium | Doc sprawl (2 folders, ~30 files, overlapping) → stale guidance | Consolidate to the 5-folder structure; merge overlaps |
| 🟡 Medium | Root QA `.cjs` scripts in repo root | Move to `tools/` or delete |
| 🟢 Low | Unused UI components | Delete after import check |

## 6. Technical-debt estimate
| Category | Items | Effort |
|---|---|---|
| Duplicate migrations | 8 files (one dir) | 0.5h (delete + verify) |
| Dead services | 4 | 0.5h |
| Dead/standalone components | 2 confirmed + 4 verify | 1h |
| Root scripts | 5 | 0.25h |
| Doc consolidation | ~33 files, 2 folders → 5 | 2–3h |
| Sandbox flag centralization + build-time strip | ~8 sites + Vite config | 0.5 day |
| **Total** | | **~1.5–2 days** |
Code-health: app `tsc` clean, build exit 0 — debt is **organizational/dead-code**, not correctness.

## 7. Cleanup roadmap
1. **Delete duplicates** (0 risk): `src/db/migrations/`, 4 dead services, `LocationPicker`/`LocationCard`, 5 root `.cjs` → confirm `tsc`/build still green.
2. **Verify-then-delete** barrel-only components (BottomNavBar/TopAppBar/badges).
3. **Centralize sandbox**: `src/config/flags.ts` `isSandbox()` + `demoAccounts.ts`; replace inline env checks; add **build-time** strip so prod bundles exclude sandbox.
4. **Consolidate docs** into `architecture/verification/deployment/business/product`; merge overlapping reports; delete `documentation/`.
5. **CI guard**: assert `VITE_AUTH_MODE=supabase` + bundle-excludes-sandbox before a production build is publishable.

Do 1–2 first (pure dead-code removal, lowest risk), then 3 (the only Critical-risk item), then 4–5.
