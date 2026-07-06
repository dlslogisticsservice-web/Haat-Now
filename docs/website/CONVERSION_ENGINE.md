# App Conversion Engine (Wave 2)

> A fully **config-driven** engine that shows app-install / continue-in-app prompts on the website.
> Nothing is hardcoded — administrators control everything from Website Center. Rules are tenant-scoped
> (`website_conversion_rules`) and reusable by every white-label tenant. Flag: `website.conversion_engine`.

## Admin-controlled configuration (all of it)
A `ConversionRule` carries:
- **Content**: title, body, image, video, CTAs (label + action), coupon code, deep-link path, app
  scheme, store links (Google Play / App Store / **Huawei AppGallery**).
- **Timing**: `delaySeconds` before eligible.
- **Frequency**: `dismissible`, `showOnce`, `maxPerSession`, `cooldownSeconds`.
- **Targeting**: countries, languages, devices (mobile/tablet/desktop), platforms (mobile/desktop),
  visitor (new/returning).
- **Triggers** (`all` or `any`): `checkout_progress ≥ %`, `cart_value ≥ amount`, `time_on_page ≥ s`,
  `exit_intent`, `scroll_depth ≥ %`, `visit_count ≥ n`, `campaign_source = x`.
- **priority**, **enabled**.

## Evaluation
`evaluateConversion(rules, runtime, session, now, platform, resume)`:
1. filter enabled + not-deleted,
2. `matchTargeting` (country/language/device/platform/visitor),
3. `triggersMatch` (all/any over the trigger set),
4. `frequencyAllows` (showOnce / maxPerSession / cooldown / dismissed),
5. pick the highest **priority** eligible rule,
6. if the rule has app+store config, build a **deferred deep link** (see `DEEP_LINKING.md`).

`ConversionSession` tracks per-rule `shown {count,lastAt}` + `dismissed[]`; `markShown` / `markDismissed`
update it. Evaluation is pure + deterministic → runs at the edge or in the browser.

## Deferred deep linking (Part 5)
When the winning rule targets checkout, the engine produces:
- a **deep link** (`haatnow://checkout?resume=<token>`) — if the app is installed, checkout resumes
  in-app;
- a **store URL** (correct store per platform) — if not installed;
- a **resume token** carrying checkout state so the app can **resume checkout after install**.

## Service (config CRUD, repository-only)
`ConversionService` (`createConversionService(backend)`) — create/update/remove/listEnabled +
`resolve(tenantId, runtime, session, now, …)` which fetches enabled rules and evaluates. Validation
requires a title + CTAs. All writes go through the repository (no direct DB).

## Analytics
Displays/clicks/dismissals + deep-link success are tracked via the analytics events
(`conversion_shown` / `conversion_clicked` / `conversion_dismissed` / `deep_link_success` /
`deep_link_fallback`) — see the analytics module + `computeFunnel` / `conversionPerformance`.

## Reusability
100% white-label: every rule is `tenant_id` (+ optional `site_id`) scoped; the engine holds no
HaaT-specific logic — the official site's prompts are just rows a tenant could equally create.

## Tests
`__tests__/conversion.test.ts` (targeting/triggers/priority/frequency/service/deferred link) +
`deeplink-ordering-website.test.ts` (deep-link + resume token).
