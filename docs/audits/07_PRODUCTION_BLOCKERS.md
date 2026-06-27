# 07 — Production Blockers (ranked, inspection-only)

## CRITICAL (blocks launch)
1. **Mobile app icons missing** — `public/icons/` has only `README.md`; manifest references 4 PNGs
   that don't exist → PWA install + native build will fail icon validation. (`06`)
2. **No native android/ios projects** — cannot ship to Play Store / App Store until generated,
   signed, and configured. (`06`)
3. **Push notifications not wired** — only Capacitor plugin *config*; no Firebase configs, no
   register/handler code. Order/delivery updates can't reach mobile users. (`06`)
4. **`audit_logs` SELECT grant not applied to the live/sandbox DB** — System Logs shows
   "not yet enabled"; the migration `20260626000001` is committed but unapplied (MCP read-only).
   (`02`, prior reports)

## HIGH
5. **Admin Design/Experience/Campaign panels Arabic-only** — DesignCenter, ExperienceBuilder,
   AssetsManager, CountryBranding, CampaignCenter not `L(ar,en)` → fail bilingual requirement for
   those screens. (`02`, `04`)
6. **Design store is localStorage-only** (not a `design_settings` DB table) → theme changes are
   per-browser, not server-published per environment (experience layer IS DB-backed). (`04`)
7. **Google Maps key required at runtime** — Command Center live map degrades to fallback without
   `VITE_GOOGLE_MAPS_API_KEY`. (`06`)
8. **No deep-link / universal-link handling** — PWA shortcuts use `?screen=` but native deep links
   are unconfigured. (`06`)

## MEDIUM
9. **Growth module duplication** — `GrowthCenter` (legacy) + `GrowthCenterB` overlap; consolidate to
   avoid drift. (`02`)
10. **No feature-flag system** — gating/rollout is hard-coded (super/role checks only). (`01`)
11. **Real-backend dependency for many admin tables** — settlements/KYC/performance are empty in
   sandbox; need seeded/real data to validate UX at scale. (`02`)
12. **No automated tests beyond E2E (24)** — no unit/integration coverage for services. (evidence:
   single `docs/testing/e2e_runner.cjs`)

## LOW
13. **Two sidebar implementations** (`AdminSidebar` admin, `EnterpriseSidebar` merchant) — fine but
    worth unifying long-term. (`05`)
14. **Country flag emoji + demo campaign emoji** remain (intentional data, not UI chrome). (prior)
15. **Light theme tokens exist but no runtime light/dark toggle**. (`04`)

## NOT blockers (already solid)
- i18n infra + customer/driver/merchant apps + Dashboard/Growth/Finance/Operations/KYC bilingual.
- Toast/Confirm/Input dialog system (0 `alert`/`confirm`/`prompt` in `src/features`).
- Shared `AdminDataTable` + `Skeleton` + `EnterpriseUI` components.
- Build ✅ / Lint ✅ / Typecheck ✅ / E2E 24/24 (as of last sprint).
