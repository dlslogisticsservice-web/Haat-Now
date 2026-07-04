# Website Center — Implementation Report

**Sprint:** Website Center — a complete **visual** website-management console **inside** the existing Admin Portal.
No Admin redesign, reuse-first, no raw JSON editing.

## Outcome
✅ Implemented and runtime-verified. Gate green: **typecheck 0 · build ✓ · sandbox E2E 24/24 · Website Center
probe PASS**. Additive; the sandbox demo and all existing admin consoles are unchanged.

## Reused (no duplication)
| Reused | How |
|---|---|
| **Website Runtime** (`website.service`) | draft/publish/version/rollback + page/nav/footer/blog/SEO content — the editor drives it, no parallel store |
| **CMS / Experience Service** | same publish/version model (the Website Center edits drafts, publishes, rolls back) |
| **Theme Engine / Design Center / Brand Assets** | brand/colours/typography/logo come from the tenant + theme engine at render (the editor doesn't re-implement theming) |
| **Tenant Service** | tenant selector + site ownership |
| **Subscription / Permissions** | gated by `isSuper` + `<Can perm="platform.whitelabel.manage">` |
| **Integration Center** | analytics **provider** dropdown reads `platform.service.providers()` (category `analytics`) |
| **EnterpriseUI primitives** | `WorkspaceHeader`, `SectionHeader`, `EmptyStateBox` + design tokens (no new design system) |

## Files
| File | Role |
|---|---|
| `src/features/admin/WebsiteCenter.tsx` (new) | The visual editor console. |
| `src/services/website.service.ts` (edit) | `getDraftSite(slugOrId)`, `resolveTenantByDomain`, `addPage`/`removePage`/`upsertPost`/`removePost`. Dev hook `window.__site` stays `import.meta.env.DEV`-only. |
| `src/features/website/runtime.ts` (edit) | Host-resolution **priority** + preview(draft) flag + custom-domain resolution. |
| `src/features/website/PublicSiteApp.tsx` (edit) | Preview banner + preview-preserving navigation. |
| `src/features/admin/{AdminSidebar,AdminDashboard}.tsx` (edit) | `website` NavKey + Platform-group item + gated render. |

## Visual editors (no JSON) — every required surface
| Requirement | Editor |
|---|---|
| Website Settings | name · **Website status** select · **Maintenance mode** toggle |
| Navigation | link list — add/remove/reorder, edit label + path |
| Footer | columns + links, copyright — visual list editor |
| Homepage / Landing / About / Contact / Custom Pages | **Pages** tab — visual **block editor** (hero/richtext/features/cta/faq/contact), add/remove/reorder blocks, per-page SEO |
| Blog | post editor (title/slug/author/excerpt/body) — add/remove |
| Help Center / Privacy / Terms | edited as pages (help = FAQ blocks; legal = rich text) in the Pages editor |
| Cookie Banner | enable toggle + policy path |
| SEO / OpenGraph | default title/description/OG image + per-page SEO |
| Analytics | provider select (from Integration Center) + measurement ID |
| Custom Domain / SSL Status / Website Status | Domain tab — subdomain (read-only), custom domain, SSL-status select, status |

## Publishing / Preview / Draft / Rollback / History
All reuse the existing publish/version pattern (`website.service`):
- **Draft** — every edit writes the draft (`saveDraft`/`updatePage`/`upsertPost`).
- **Preview** — opens the site with the **unpublished draft** (`?site=<slug>&preview=1`) + a preview banner.
- **Publish** — promotes draft → live immediately (event → the running site re-renders, no rebuild).
- **History / Rollback** — version list with per-version rollback.

## Host resolution priority (per spec)
`resolvePublicRequest` now resolves in order: **1. Custom Domain → 2. Tenant Subdomain → 3. Dev query param
(`?site=`)**. The query param is a **non-primary fallback**, consulted only when the host does not resolve — it is
never the primary runtime. Preview is a `preview=1` flag layered on top.

## Dev hooks
`window.__site` (and `__sb`/`__prov`/`__tpl`) are guarded by `import.meta.env.DEV`, so Vite **dead-code-eliminates
them from production builds** — never exposed in Production.

## Runtime verification (Definition of Done)
Puppeteer probe (super admin → Website Center):
```
render: center + tenant select + tabs + publish/preview + name field
edit name → Publish → published site name = "PUBBRAND9"
edit name (draft only, no publish) → draft = "DRAFTONLY9", published STILL "PUBBRAND9"
public site (?site=slug) header = "PUBBRAND9"  |  preview (&preview=1) header = "DRAFTONLY9" + preview banner
history: ≥1 version + rollback button · console errors: 0   → PROBE PASS
```

## Known limitations
- Sandbox (localStorage) editor + runtime are complete and verified; **live** wiring (the `website_*` Supabase
  tables, edge SEO serving, real custom-domain DNS/SSL provisioning) is the documented staging follow-up.
- Media picking uses URL fields; deeper Media Library picker integration (`assets.service` browse dialog) is a
  natural enhancement (the URL fields already accept asset URLs).

## Rollback
Additive + gated. Revert the commit (`git revert <sha>`) or remove the `website` nav item + render — the role
apps, other admin consoles, and the sandbox demo are unaffected. Content rollback is built in
(`website.service.rollback`).
