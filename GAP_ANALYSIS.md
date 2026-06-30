# Gap Analysis

Derived from the Enterprise Inventory. Gaps are classified by whether they are **demo-functional**
(works on the demo backend now) vs **schema/backend** (needs the frozen real Supabase) vs **greenfield**.

## 1. Consolidation (highest priority — removes a duplicate)
- **Growth A/B (`GrowthCenter` + `GrowthCenterB`)** — two overlapping growth surfaces. Gap: confusing
  split, duplicated intent across `growth.service`/`growthb.service`. **Action: merge into one Growth
  module with sub-tabs (Coupons · Loyalty · Segments · Campaigns), keep both services but behind one UI.**
  Do not add a third.

## 2. Demo-functional gaps (fixable now on the sandbox backend — extend existing)
| Module | Gap | Extend |
|---|---|---|
| Customer Care | replies / assign / transfer / close / reopen / escalate don't persist | `cx.service` + `sandboxStore` (add ticket store + mutations) |
| KYC / Compliance | approve / reject / suspend / ban / restore don't persist | `onboarding.service` + sandbox status store |
| Campaigns | list/create don't persist in demo | `campaign.service` sandbox path |
| Growth | deeper panels (segments, rewards, tiers) partial in demo | `growthb`/`growth` sandbox paths |
| Finance | generate/approve/pay mutations are no-ops in demo (read-views wired) | `finance.service` write-back to a sandbox ledger |
| Analytics | sandbox-computed; no trends/cohorts | extend `analytics.service` sandbox |

## 3. Schema / backend gaps (blocked by frozen real backend — document, don't fake)
- No committed migrations for: `vehicles`, `driver_shifts`, `shift_breaks`, `dispatch_assignments`,
  `kyc_reviews`, `account_status`, `tenants`, `screen_experiences`, `campaigns`. These run from the
  **sandbox store** today; they need migrations when the real backend is unfrozen.

## 4. Blueprint engines — partial vs missing
| Engine | State | Gap | Action |
|---|---|---|---|
| Theme | 🟡 `DesignCenter` | not yet a single token source-of-truth consumed everywhere | extend |
| Branding | 🟡 `CountryBranding`+`AssetsManager` | per-surface cascade incomplete | extend |
| White-Label | 🟡 `PlatformRegistry`+`tenant.service` | per-tenant override engine partial | extend |
| CMS / Experience | 🟡 `ExperienceBuilder`+`experience.service` | no committed schema; screen coverage partial | extend |
| Website | 🔴 | none | build later, consuming Theme/Branding |
| Landing Builder | 🔴 | none | build later |
| Splash Engine | 🔴 (manifest only) | none | build later |
| SEO Engine | 🔴 (meta/robots/sitemap only) | none | build later |
| Analytics Engine | 🟡 | basic | extend |
| AI | 🔴 | none | greenfield (out of scope) |

> Per directive: blueprint engines are **inventoried only**; new ones are **not** implemented now. When
> built they must **extend** the existing Theme/Branding/Experience modules — never a parallel build.

## 5. Cross-cutting (verified, no gap)
- Auth (frozen, working all roles), order lifecycle (load-proven 800 orders), CRUD (9 entities UI-verified),
  realtime (gated by design in demo), production deploy pipeline (CI + verify) — **no gaps**.

## Summary
- **1 consolidation** (Growth A/B).
- **6 demo-functional extensions** (Care, KYC, Campaigns, Growth-depth, Finance mutations, Analytics).
- **9 schema items** blocked on the frozen backend (documented).
- **Blueprint engines:** 5 partial (extend), 5 missing (build later, consume existing).
