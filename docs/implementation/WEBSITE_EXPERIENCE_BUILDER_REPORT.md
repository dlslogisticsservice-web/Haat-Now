# Website Experience Builder — Implementation Report

> Sprint: **Transform the Website Center into a true visual Website Experience Builder.**
> Constraint honored verbatim: *do NOT redesign the Website, do NOT create a new Website Engine, do NOT create a
> new CMS, do NOT duplicate the Media or Theme systems.* Everything below **reuses existing modules only.**

## 1. What was built

The Website Center's page editor is now a **visual, WYSIWYG Experience Builder** — no JSON editing anywhere. Every
change updates a live device-accurate preview instantly, and Publish still flows through the existing
**Draft → Preview → Publish** pipeline (`website.service`).

### Section types (all 12, per spec)
| Section | Editable properties |
|---|---|
| **Hero** | Background **image** or **video** (from Media Library), overlay opacity, heading, subtitle, **multiple CTA buttons** (label/href/style), layout (center / left) |
| **Features** | heading + repeatable title/body items |
| **Cards** | heading + cards (title, body, **image**, link) |
| **Statistics** | heading + value/label pairs |
| **Testimonials** | heading + quote/author/role/**avatar** |
| **Partners** | heading + **logo images** |
| **Gallery** | heading + **image list** |
| **App Download** | heading, subtitle, iOS/Android URLs, **image** |
| **FAQ** | heading + question/answer items |
| **Contact** | heading, email, phone, address |
| **CTA banner** | title, subtitle, button |
| **Rich text** | heading + body |

### Per-section controls (all sections)
- **Enable / Disable** (disabled sections are excluded from the published render)
- **Drag & drop reordering** (plus up/down move buttons as a keyboard/click fallback)
- **Duplicate**
- **Delete**
- **Visibility rules** — independent Desktop / Tablet / Mobile toggles
- **Inline visual editor** (expand/collapse per section)

### Builder-level features
- **Device preview** — Desktop / Tablet (768px) / Mobile (390px) live frame, rendered by the **same public
  `BlockRenderer`** the runtime uses (true WYSIWYG, not a separate preview path).
- **Section templates** — one-click starter layouts (SaaS / Product / Simple) that insert pre-composed sections.
- **Import / Export page layouts** — export the current page's sections to a JSON file; import to restore/clone.
- **Instant preview** — every edit re-renders the preview frame synchronously.

## 2. Reuse map — nothing new was created

| Requirement | Reused existing module | New system created? |
|---|---|---|
| Images & videos | **`src/experience/assets.service.ts`** (the one Media Library) via a thin `MediaPicker` UI | ❌ No |
| Content model / Draft→Publish/versioning/rollback | **`src/services/website.service.ts`** (extended, backward-compatible) | ❌ No |
| Public rendering | **`src/features/website/blocks.tsx`** `BlockRenderer` + **`PublicSiteApp.tsx`** runtime | ❌ No |
| Theming / brand tokens | **Theme Engine** (`--color-primary-fixed` / `--color-on-primary-fixed`) | ❌ No |
| Editor host | **`src/features/admin/WebsiteCenter.tsx`** (the existing console, upgraded) | ❌ No |

The **only new file** is `src/features/website/MediaPicker.tsx` — a *UI wrapper* over the existing
`assets.service` (list / upload / registerUrl). It introduces **no storage, no new asset model**.

## 3. Files changed
| File | Change |
|---|---|
| `src/services/website.service.ts` | Extended the `WebsiteBlock` union: added `enabled`/`visibility` to every block, hero `bgImage`/`bgVideo`/`overlay`/`ctas`/`layout`, and new block types (`cards`, `stats`, `testimonials`, `partners`, `gallery`, `app_download`, `faq`, `contact`). **Backward compatible** — existing content is untouched. |
| `src/features/website/MediaPicker.tsx` | **New.** Media Library picker reusing `assets.service` (list/upload/paste-URL). |
| `src/features/website/blocks.tsx` | `BlockRenderer` extended for all new section types; hero enhanced (bg image/video, overlay, multi-CTA, layout). Uses brand tokens `--color-primary-fixed` / `--color-on-primary-fixed`. |
| `src/features/website/PublicSiteApp.tsx` | Honors per-section `enabled` (filters disabled sections) and responsive `visibility` (Desktop/Tablet/Mobile via CSS media classes). |
| `src/features/admin/WebsiteCenter.tsx` | Page editor rewritten as the Experience Builder: drag/drop, enable/duplicate/delete, per-type visual editors + MediaPicker, device preview, section templates, import/export. No JSON editing. |

## 4. Validation — release gate

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run lint` (`tsc --noEmit`) | ✅ **0 errors** |
| Production build | `npm run build` | ✅ built (~16s), `version.json` / `sw.js` stamped `@187bab2` |
| E2E (sandbox) | `node docs/testing/e2e_runner.cjs` | ✅ **24/24 pass, 0 fail** |
| **Experience Builder runtime probe** | Puppeteer (super admin → Website Center → Pages) | ✅ **10/10 checks, 0 console errors** |

### Runtime probe — 10/10
Builder renders · **Add section** (count +1) · **Instant preview** (new section content appears immediately) ·
**Disable hides** in preview · **Re-enable shows** · **Duplicate + Delete** (count deltas correct) ·
**Media Library picker opens** (reuses `assets.service`) · **Section templates** insert (count +3) ·
**Device preview** toggles · **0 console errors**.

> During the probe a real defect was found and fixed: an `<svg>` icon rendered inside an `<option>` element
> (invalid HTML → React console error). Removed — console is now clean (0 errors).

## 5. Constraints honored
- ✅ Website **not** redesigned; no new engine, CMS, media, or theme system.
- ✅ Media comes **only** from the existing Media Library (`assets.service`).
- ✅ Publish uses the **existing Draft → Preview → Publish** workflow.
- ✅ **No JSON editing** — everything is visual.
- ✅ Reusable section templates + page layout import/export.
- ✅ Reports live under `docs/` (root stays clean); production `main` untouched.
