# Localization Platform

> HaaT Now · Phase 10 · Design only (Part 9). Today the app supports only AR/EN with hand-wired
> `dir=` per component (Phase 8 finding), and website content is single-locale. Website OS makes
> every site **multi-locale, RTL/LTR-aware, with per-page and per-block translations**.

## 1. Model
- A site declares `default_locale` + `locales[]` (`website_sites`).
- Content lives once (the source locale); translations are stored per field in
  `website_translations` keyed `(entity_type, entity_id, locale, field_path)`.
- `field_path` addresses a specific translatable string inside a block's props (e.g.
  `props.title`, `props.items[2].body`), so translation is **per-block, per-field**.

## 2. Capabilities (Part 9)

| Requirement | Design |
|---|---|
| Arabic / English | first-class; AR is a common default (RTL) |
| Unlimited languages | any BCP-47 locale added to `website_sites.locales` |
| RTL / LTR | direction derived from locale; `<html dir>` set server-side per page; theme mirrors (logical CSS props) |
| Translation Memory | `website_translations.source_hash` — reuse prior translations for identical source strings across pages/sites |
| Per-page translations | each page has translated title/slug/SEO per locale |
| Per-block translations | each translatable field addressable and translatable independently |

## 3. Direction & rendering
- **Server-set direction**: the edge renderer sets `<html lang="ar" dir="rtl">` from the requested
  locale — no client flash. This replaces the app's scattered `dir=` (a debt the Phase 8 audit
  flagged).
- **Logical CSS**: blocks use logical properties (`margin-inline`, `inset-inline`) so RTL/LTR mirror
  automatically (the app already uses `insetInlineStart` in places).
- **Per-locale routing**: default locale at root; others at `/{locale}/…` or a locale subdomain
  (site setting). Correct `hreflang` alternates emitted (SEO Platform §8).

## 4. Translation workflow
```
Author writes source locale → strings extracted by field_path with a source_hash
  → Translation view: side-by-side source vs target per locale
  → Translation Memory suggests prior translations for matching source_hash
  → status per string: draft → translated → reviewed → stale (when source changes)
  → publish compiles per-locale snapshots (one published page per locale)
```
- **Staleness**: editing a source string flips its translations to `stale` (source_hash mismatch),
  surfacing exactly what needs re-translation — nothing silently ships outdated copy.
- **Fallback**: a missing translation falls back to the default locale (never a blank), with a
  visible "untranslated" indicator in the editor.

## 5. Machine-translation seam (optional)
- A pluggable MT provider can pre-fill `translated` suggestions (human review before `reviewed`).
- Off by default; gated by plan/flag. No provider is assumed in this design.

## 6. Localization of non-text
- Media per locale (e.g. a localized hero image) via locale-scoped asset references.
- Number/currency/date formatting reuses the platform's `config/countries` locale data (8 markets,
  correct 3-decimal Gulf currencies already implemented).

## 7. SEO & analytics interplay
- Each locale is a distinct published page (own SEO row, own sitemap entry, own analytics).
- `hreflang` + `x-default` connect the locale set for search engines.

## 8. Multi-tenant
`website_translations` is tenant/site-scoped (RLS). Translation Memory is scoped to the tenant (no
cross-tenant string leakage), with an optional platform-level glossary for common UI strings.

## 9. Reuse vs build
| Reuse | Build |
|---|---|
| App i18n (AR/EN), `config/countries` locale/currency data, `insetInline*` usage | `website_translations`, per-field addressing, translation memory, staleness, per-locale snapshots + routing, server-set direction |
