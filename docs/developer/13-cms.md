# 13 · CMS (Experience Engine)

> **Audience:** developers changing screen content (splash, login, onboarding) or building website content.
> **Key principle:** there is **one** CMS — `experience.service`. Website content extends it; it is not a second
> system.

## Purpose
Let operators edit the content of key screens per country — **splash, login, onboarding** — with draft/publish,
versioning, and rollback, so changes propagate to all users without a rebuild.

## Architecture
```
ExperienceBuilder (admin UI)  ──▶  experience.service  ──▶  screen_experiences (Supabase)  |  localStorage (sandbox)
                                       │  draft_config / published_config / version_number / history[]
                                       ▼
                               ExperienceProvider  ──▶  splash / login / onboarding screens render published content
```
- [`src/experience/experience.service.ts`](../../src/experience/experience.service.ts) — persistence:
  - Live: Supabase `screen_experiences` (+ history). Sandbox: `localStorage` key
    `haat_sb_screen_experiences_v1` (mirrors the campaign.service pattern).
  - Row = `{ country_code, screen_type, draft_config, published_config, version_number, history[] }` keyed by
    `${country}:${screen}`.
  - Screen types: `splash`, `login`, `onboarding` (with `DEFAULT_SPLASH`/`DEFAULT_ONBOARDING`/`DEFAULT_LOGIN`).
  - Draft → publish → version bump; `history[]` enables rollback.
- [`src/experience/ExperienceContext.tsx`](../../src/experience/ExperienceContext.tsx) — `ExperienceProvider`
  supplies the published content to the screens at boot (per country).
- [`src/features/admin/ExperienceBuilder.tsx`](../../src/features/admin/ExperienceBuilder.tsx) — the editor.
- Building blocks live in [`src/experience/blocks/`](../../src/experience/).

## Flow: edit → publish → rollback
```
Edit in ExperienceBuilder → saves draft_config
Publish → published_config = draft, version_number++, push previous into history[]
ExperienceProvider reads published_config for the country → screens render it
Rollback → restore a history[] entry as published
```

## Dependencies
- `experienceTypes.ts` (schema/defaults), Supabase (live) / localStorage (sandbox), `ExperienceProvider`
  consumers (splash/login/onboarding screens). Sits in the boot tree under `DesignProvider`.

## Extension points
- **New editable screen** → add a `ScreenType` + its default in `experienceTypes.ts`, extend `SCREEN_KEYS`, and
  render it via `ExperienceProvider`. Additive.
- **Website content** → extend the same experience model (per the registry: "one CMS — website content extends
  it"). Do **not** create a second CMS service.

## Reuse rules
- One CMS engine. Any content-management need (website pages, banners-as-content) extends `experience.service`,
  not a new service.
- Keep the draft/publish/version/rollback contract — don't bypass it with direct writes.

## Files involved
- [`src/experience/experience.service.ts`](../../src/experience/experience.service.ts) ·
  [`src/experience/experienceTypes.ts`](../../src/experience/experienceTypes.ts) ·
  [`src/experience/ExperienceContext.tsx`](../../src/experience/ExperienceContext.tsx) ·
  [`src/features/admin/ExperienceBuilder.tsx`](../../src/features/admin/ExperienceBuilder.tsx).

## Do's
- ✅ Use draft → publish → version. ✅ Keep new screen defaults equal to current content (additive).
- ✅ Scope content by `country_code`.

## Don'ts
- ❌ Don't create a second CMS. ❌ Don't render draft content to users (only `published_config`).
- ❌ Don't write `published_config` without bumping the version + pushing history.

## Example
```ts
// Publish edited onboarding content for Egypt:
experienceService.saveDraft('EG', 'onboarding', editedConfig);
experienceService.publish('EG', 'onboarding');   // version++, previous → history[]
```

## Next
[14-design-center.md](14-design-center.md) · [15-integration-center.md](15-integration-center.md)
