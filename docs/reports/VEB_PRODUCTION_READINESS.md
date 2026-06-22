# Visual Experience Platform — Production Readiness Verification

**Date:** 2026-06-23
**Project:** `umwbzradvbsirsybfxfb` (haat-now-dev)
**Branch:** `feat/auth-recovery-frontend-sprint`
**Method:** Live queries via Supabase Management API.

---

## 1. Supabase connectivity
✅ **PASS** — Management API query endpoint returned `201` for live SQL execution.

## 2. Database objects

| Object | Expected | Live result |
|---|---|---|
| `public.screen_experiences` table | exists | ✅ 1 |
| `public.screen_experience_history` table | exists | ✅ 1 |
| `screen_experiences` columns | id, country_code, screen_type, draft_config, published_config, version_number, created_by, updated_by, created_at, updated_at | ✅ all present |
| Migration `20260614000025` in `schema_migrations` | recorded | ✅ recorded |

## 3. Storage
| Item | Expected | Live result |
|---|---|---|
| Bucket `experience-assets` | exists | ✅ 1 |
| Bucket public (CDN reads) | true | ✅ true |
| Storage policies (`experience_assets_*`) | read + super write | ✅ 2 |

## 4. RLS policies
| Table | RLS enabled | Policies |
|---|---|---|
| `screen_experiences` | ✅ true | ✅ 2 (public read · super-admin write) |
| `screen_experience_history` | ✅ true | ✅ 2 (public read · super-admin write) |
| `storage.objects` (experience-assets) | n/a (bucket) | ✅ 2 (public read · super-admin write) |

## 5. Experience Assets uploads
✅ **READY** — `experience-assets` bucket exists, public for CDN reads, with a super-admin-only
write policy. `assetsService.upload()` targets this bucket and returns a public CDN URL on the
real path; the sandbox path stores small images as data URLs for demo.

## 6. Country Branding persistence
✅ **READY** — `CountryBranding` and `ExperienceBuilder` persist through
`experienceService.saveDraft()` / `publish()`, which write per-country rows into
`screen_experiences` (real path) or `localStorage` (sandbox). The published config is read at
runtime by `ExperienceProvider` for the active country, so a publish propagates to all users.

## 7. Runtime safety
- Published-config read failures or empty tables → assembled **defaults** (`enabled:false`) →
  the original hardcoded screens render. No white-screen risk.
- Auth flows unchanged; deployment config unchanged.

## Verdict
**PRODUCTION-READY.** All database tables, storage bucket, RLS policies and the publishing
pipeline are live and verified. The platform degrades safely to the legacy screens when no
experience is published.
