# Implementation Priority

Ordered to maximise demo-RC quality while honouring the rules: **extend existing modules only**, no
duplicates, no parallel implementations, frozen auth/backend, blueprint engines inventoried-not-built.
Each item ships through: Typecheck → Lint → Build → E2E → commit → push → CI → merge `--no-ff` → main →
production-verify.

## P0 — Remove the one duplicate (consolidation)
1. **Consolidate Growth A/B** → single `GrowthCenter` with sub-tabs (Coupons · Loyalty · Segments ·
   Campaigns). Keep `growth.service` + `growthb.service` behind one UI; retire the second tab/nav entry.
   *(Touches `GrowthCenter.tsx`, `GrowthCenterB.tsx`, `OperationsCenter.tsx`, sidebar.)*

## P1 — Make admin **action modules persist** in the demo (extend existing services)
2. **Customer Care mutations** — extend `cx.service` + `sandboxStore`: persist ticket replies, assign,
   internal note, close, reopen, escalate (a `haat_sb_tickets` store).
3. **KYC mutations** — extend `onboarding.service`: persist approve/reject/suspend/ban/restore against a
   sandbox status store.
4. **Finance mutations** — extend `finance.service`: write-back settlement generate/approve, pay
   merchant/driver, refund to a sandbox ledger so balances change.
5. **Campaigns** — extend `campaign.service` sandbox path (list/create/toggle persist).

## P2 — Depth on existing modules
6. **Growth depth** — segments/rewards/tiers sandbox data + actions (within the consolidated Growth).
7. **Analytics** — extend `analytics.service`: trend/cohort/retention series for dashboards.
8. **Orders** — proof-of-delivery capture component (extend `DriverApp` + `order.service`).

## P3 — Blueprint-engine **extensions** (NOT new engines)
9. **Theme Engine** — extend `DesignCenter` toward a single token source-of-truth (read by surfaces).
10. **Branding Engine** — extend `CountryBranding`/`AssetsManager` cascade.
11. **White-Label Engine** — extend `PlatformRegistry`/`tenant.service` per-tenant overrides.
12. **CMS** — extend `ExperienceBuilder`/`experience.service` (commit a `screen_experiences` migration
    when backend unfreezes).

## P4 — Schema (blocked; do when real backend unfreezes)
13. Add migrations: `vehicles`, `driver_shifts`, `shift_breaks`, `dispatch_assignments`, `kyc_reviews`,
    `account_status`, `tenants`, `screen_experiences`, `campaigns`.

## Out of scope now (per directive)
- Website / Landing Builder / Splash Engine / SEO Engine / AI — **do not build**; inventoried for future,
  must consume the Theme/Branding/Experience layer when built.

## Execution note
Starting at **P0 (Growth consolidation)** — it removes the only duplicate in the platform and directly
serves the "no duplicate modules" mandate, then P1 action-persistence. Each increment is verified at
runtime + deployed before the next.
