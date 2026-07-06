# AI Experience Platform

> HaaT Now · Phase 10.5 · Design only (Part 7). AI is an **assistive generation seam**, fully
> **decoupled from business logic**. It produces **draft** content that is validated against the
> Phase 10 component schemas and always passes through the normal Publishing/Workflow gates — AI
> never writes live content, never touches money/ops, never bypasses RBAC or governance.

## 1. The decoupling principle (how AI integrates without coupling)
```
AI Service (stateless generation)
   input:  prompt + context (brand, tenant, locale, page goal, existing blocks)
   output: a PROPOSED payload (blocks/sections/snapshot patch/translations/SEO)
   ↓ ALWAYS validated by website_component_library JSON-schemas
   ↓ ALWAYS written as a DRAFT (website_revisions), never published directly
   ↓ ALWAYS subject to human review + the Workflow Engine + RBAC
```
Rules that keep it decoupled:
- **Output is data, not behavior.** AI emits block props / snapshot patches / text — never code that
  runs in the platform, never DB writes, never RPC calls to money/ops.
- **Schema-validated.** Every generated block must conform to a registered component schema; invalid
  output is rejected, not rendered (same guard as the Visual Builder).
- **Provider-agnostic.** A thin `ai.service` interface (generate/rewrite/translate/score) with a
  pluggable provider (Claude/others). Follows the platform's provider-registry pattern
  (`platformModel.PROVIDER_CATALOG`); credentials server-side only.
- **Tenant-scoped + governed.** AI runs within one tenant's data/brand; usage metered; gated by plan
  + feature flag; audited.

## 2. Capabilities (Part 7)
| Capability | Output | Notes |
|---|---|---|
| Generate Landing Page | sections+blocks draft | from a brief + brand + goal |
| Generate Website | multi-page draft site | seeds `website_pages/sections/blocks` as draft |
| Generate Campaign | campaign + landing variant | feeds Experience variant + campaign service |
| Generate SEO | `website_seo` fields + JSON-LD | reviewed before publish |
| Generate FAQ | FAQ block items | + FAQ JSON-LD |
| Generate Blog | blog post draft | revisioned draft |
| Rewrite Content | block text | tone/length transforms |
| Translate Content | `website_translations` drafts | feeds Localization TM; human-review status |
| Improve UX / Suggest Layout | layout suggestions | proposes section order/variants |
| Generate Images | media (integration-ready) | via image provider seam → Media Library asset |
| Generate Sections | reusable section drafts | saved to section templates |
| Optimize Conversion | experiment + variant proposal | feeds Experimentation Platform |

## 3. Tables (additive, multi-tenant, RLS)
```sql
create table website_ai_generations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid,
  kind text not null,                          -- 'page'|'seo'|'translate'|'rewrite'|'image'|...
  prompt jsonb, context jsonb, output jsonb,   -- proposed payload (schema-validated)
  status text default 'proposed' check (status in ('proposed','accepted','rejected')),
  provider text, tokens int, cost_cents int, created_by uuid, created_at timestamptz default now()
);
```

## 4. Grounding & brand safety
- Generations are **grounded** in the tenant's brand tokens, existing content, locale, and (for
  copy about stores/offers) real platform data — so AI writes on-brand, factual copy, not hallucinated
  claims. Dynamic facts (prices/ETAs) are **never** baked into AI text; they render via Realtime
  Blocks.
- Brand-safety + policy filters; no PII in prompts (Phase 9 discipline); outputs logged for audit.

## 5. Conversion optimization loop
AI proposes → Experimentation Platform tests the proposal against control → winner is promoted via
the Workflow Engine. AI never auto-promotes; the experiment + human decide.

## 6. Integration with strict concerns
- Multi-tenant (RLS); RBAC (`ai.generate`); localized (generates per-locale drafts); SEO-aware;
  audited (`website_ai_generations` + `operation_events`); flag/plan-gated with per-tenant quotas;
  cost metered (settles via the finance ledger for paid AI usage). Business logic (orders, payments,
  dispatch) is untouched — AI only ever produces reviewable content drafts.
