# Personalization Activation (Wave 20.1)

Wave 20 built the deterministic Personalization Engine. Wave 20.1 makes the product actually use
it. No new engine, no AI, no second decision path — the surfaces that used to decide for themselves
now ask the engine that already existed.

## What changed, in one sentence per surface

| Surface | Before | After |
|---|---|---|
| Customer home | fixed chain: welcome → offers → tour | `usePersonalizedExperiences()` ranks all eligible candidates |
| Merchant portal | announcements and beta stacked in source order | ranked set of announcements / beta / education, top 2 |
| Driver portal | rollout gate → beta banner | rollout decides *eligibility*, personalization decides *attention* across beta / safety / training |
| Website | authored order, engine could only hide | promotional blocks additionally filtered per visitor via an injected personalizer |

## The three defects activation exposed

Activation is where a subsystem meets reality. Three things were wrong, and none of them were
visible while the engine was only being tested in isolation.

### 1 · The customer banners emitted no telemetry at all

`HomeScreen` rendered `ExperienceBanner` without `decision` or `experienceId`, so the shared
telemetry hook short-circuited. Every view and every dismissal on the customer app was dropped.
A profile built from nothing can never personalize anything — frequency caps and fatigue were
structurally dead on the busiest surface in the product.

### 2 · Ranking had no per-experience term

`rankExperiences` scored `engagement * weight`, where `engagement` is a **single number for the
whole visitor**. Adding the same constant to every candidate cannot change their order. The only
per-candidate signals were priority, segment match, novelty and fatigue — so personalization could
*suppress* an experience but never *promote* one. A visitor who clicked and redeemed offers ten
times still saw the higher-priority generic welcome banner.

Fixed with `experienceAffinity(profile, experienceId)` — `(clicks + 2·conversions − dismisses) /
evidence`, clamped to [-1, 1], derived entirely from counters the profile already kept. Unseen
experiences score 0: absence of evidence is neutral, not negative, and novelty stays a separate
term so a new experience is not judged as though it had been ignored.

### 3 · Surfaces evicted themselves (caught only by visual verification)

A surface emits `experience.rendered` on mount. That event lands in the profile the *next* decision
reads. With `minGapMinutes: 30` in the default frequency cap, any surface that re-decided on every
render immediately capped itself and vanished the instant it appeared — the customer app rendered
no experience surface at all.

TypeScript, the 667-test suite, Guardian, the journeys and the parity check all passed while this
was broken. Nine visual checks caught it.

The fix is `usePersonalizedExperiences()`, which latches the decision for the life of an exposure
and recomputes only when the candidate set genuinely changes (dismissal, flag toggle, new visitor).
**One exposure means one decision** — this is correctness, not an optimisation.

## Category signals

`InteractionSignals` — `category`, `merchant`, `campaign`, `offer`, `cuisine`, `storeType` — flow
from surfaces through the tracking helpers into the event payload, where `deriveVisitorProfile`
already read `payload.category` and `payload.merchant` since Wave 20.

`signalPayload()` copies **only** the signals a surface actually supplied. The platform never
invents a signal a caller did not declare — an absent signal and an explicitly-undefined one are
treated identically.

Beyond the experience surfaces, the customer app now emits signals from real marketplace
interactions via `trackInteraction()`: opening a merchant carries merchant + cuisine + store type,
selecting a category carries the category. Without these, `preferredCategories` and
`favouriteMerchants` stay empty no matter how much a visitor browses.

## Persistence

A profile is *derived* from the event log, so persisting a profile would create a second source of
truth free to drift. Instead the visitor's own **event tail** is persisted (bounded at
`VISITOR_HISTORY_MAX = 200`) and replayed into the store at boot, through the same `adminCrud`
repository every other piece of platform state uses. The profile then rebuilds from the one model
it always had.

Replayed events carry a marker so they are never re-persisted — without it, a returning visitor's
counts would double on every reload.

## Architecture

The website channel must not import the services layer, so the host injects the personalizer via
`setLiveRuntimePersonalizer()` — the same seam pattern `setLiveRuntimeReporter()` already used for
monitoring. With nothing injected the site behaves exactly as before.

Website personalization is fail-open in every direction — no personalizer, no promotional blocks,
an empty answer, or a throw all mean "render what was authored" — and applies only to promotional
block types (`hero`, `cta`, `deals`, `waitlist`, `app_download`). Structural content is out of
scope by construction: personalization may never remove the page's substance.

Guardian: 441 files, **0 cycles**, 0 violations.
