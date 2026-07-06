# Mobile App Growth Engine (Wave 3, Part 5)

> A configurable campaign **platform** (not a popup). Administrators control every field from
> Website Center; **multiple campaigns** run concurrently, each with **A/B variants**. Tenant-scoped
> (`website_growth_campaigns`); reusable by every tenant. Reuses the Wave 2 Conversion Engine helpers
> (targeting/triggers/frequency) + deep linking — no duplicated logic. Flag: `website.growth_engine`.

## Everything is admin-configurable (no hardcoded values)
A `GrowthCampaign`:
- **Campaign Name**, **Status** (`draft`/`active`/`paused`/`expired`), **Priority**.
- **Audience/Targeting**: countries, languages, devices, platforms, visitor (new/returning).
- **Referral / UTM**: `utm.source` / `medium` / `campaign` match lists.
- **Triggers** (`all`/`any`): delay, scroll %, checkout %, cart value, visit count, campaign source
  (reuses the Conversion Engine trigger set).
- **Schedule**: `startsAt` / `expiresAt` (expiration).
- **Frequency / Cooldown**: dismissible, showOnce, maxPerSession, cooldownSeconds.
- **Variants** (1+, A/B): each carries content (title/body/**images/videos**/CTAs/**coupon**/deep-link
  path/app scheme/store links for Play + App Store + AppGallery) + a weight.

## Multiple campaigns + selection
`selectCampaign(campaigns, runtime, session, nowIso, nowMs, anonId, platform, resume)`:
1. keep `active`, not-deleted, within schedule,
2. `matchTargeting` + `matchUtm` + `triggersPass` + `frequencyAllowsFor` (reused conversion helpers),
3. pick the highest **priority** eligible campaign,
4. **assign a variant** deterministically (`assignVariant` — weighted, stable per `anonId+campaignId`),
5. build a deferred deep link from the variant content (continue-in-app / store fallback + resume).

## Service (config CRUD, repository-only)
`GrowthEngine` (`createGrowthEngine(backend)`): create / update / setStatus / remove / listActive +
`resolve(...)`. Validation requires a name + at least one variant (each with a title). All writes go
through the repository — no direct DB.

## Experimentation (Part 7)
Variant assignment is deterministic (above). `ExperimentTracker` (`growth/experiments.ts`) records
exposures / conversions / installs / coupon redemptions per variant (`website_experiment_results`),
summarizes conversion rates, and detects a **winner** via a two-proportion z-test with a minimum
sample + significance threshold. Analytics events tie in (`conversion_shown`/`_clicked`/`deep_link_*`).

## Reusability
100% white-label: campaigns are `tenant_id` (+ optional `site_id`) scoped; the engine holds no
HaaT-specific logic. The official site's prompts are ordinary rows any tenant could create.

## Tests
`__tests__/growth.test.ts` — status/schedule/targeting/UTM/trigger/priority gating, deterministic +
distributed variant assignment, service create/resolve, experiment tracking + winner detection.
