# Experience Platform (DXP) — Vision & Experience Engine

> HaaT Now · Phase 10.5 · Enterprise DXP design (documentation only). **Builds on Phase 10** — it
> does not redesign it. The Phase 10 primitives it extends: the Builder/Data/Delivery split, the
> immutable **published snapshot**, `website_published_pages`, the **Rendering/Preview edge engine**,
> the **Publishing Engine**, the **Theme Engine**, and the platform's Phase 9 primitives
> (`auth_tenant` RLS, `role_permissions`/`auth_has_permission`, the scheduler, realtime, Storage).

---

# PART 1 — Experience Platform Vision & Moat

## 1.1 The reframe
Phase 10 built a **Website Platform** (a site is a set of published pages). Phase 10.5 turns it into
a **Digital Experience Platform**: a site is a set of **experiences** — the *same* page can render
differently per country, city, language, device, user type, campaign, loyalty tier, or behavior —
served from the edge with no rebuild.

The unit of delivery is no longer "the published page snapshot" but "**the resolved experience**":
`experience = f(published snapshot, audience, rules, personalization, experiment)` computed at the
edge and cached per **experience key**.

## 1.2 What makes HaaT fundamentally different

| vs | They are | HaaT DXP is |
|---|---|---|
| **WordPress** | a CMS + plugin sprawl, single-site | multi-tenant DXP with governance, experiments, journeys, wired to live operations |
| **Webflow** | a beautiful visual builder, single-account | visual builder **+** personalization + experiments + headless APIs + multi-tenant white-label |
| **Shopify** | a store per merchant | a *platform of platforms*: website + app + operations + payments + delivery, one tenant |
| **Framer** | design-first sites | design **+** rules engine + realtime delivery blocks + low-code logic |
| **Adobe AEM / Sitecore / Optimizely / Bloomreach / Contentful / Builder.io** | enterprise DXPs (content, personalization, experiments) **decoupled from any real business** | an enterprise DXP **fused to a live delivery marketplace** — experiences driven by real stores, offers, drivers, ETAs, loyalty, and wallet |

## 1.3 The strategic moat (three layers no incumbent has together)
1. **Operational data as experience primitives.** AEM/Sitecore/Contentful personalize *content*;
   they have no stores, drivers, ETAs, or wallets. HaaT can personalize on **real logistics state**
   (nearest open store, live offer, driver density, delivery ETA, loyalty tier) — because the DXP
   sits on the same backend as the marketplace. This is impossible to replicate without owning the
   operations.
2. **Multi-tenant white-label DXP by construction.** One deployment serves 10k tenants/agencies/
   franchises, each isolated by `tenant_id` RLS, each with its own experiences, experiments, and
   domains. Enterprise DXPs are single-org installs; multi-client is professional-services glue.
3. **One governance/RBAC/audit spine across web + app + ops.** A country legal approval, an RBAC
   permission, an audit entry — all shared with the platform (Phase 9 `role_permissions`,
   `operation_events`). Incumbents govern only their own content island.

**Positioning:** *"Adobe Experience Manager for delivery marketplaces — multi-tenant, white-label,
and wired to your real operations."* We do not out-CMS WordPress; we out-**experience** everyone by
fusing DXP with live logistics.

---

# PART 2 — Experience Engine

## 2.1 Concept
The **Experience Engine** decides *which variant* of a published page to render for a given request,
by evaluating ordered **experience rules** against a **request context**. It is a thin, deterministic
resolution layer inserted between host resolution and snapshot rendering in the Phase 10 edge
pipeline — it changes *selection*, never the rendering contract.

```
Phase 10:  host → tenant → published snapshot(path) → render → CDN
Phase 10.5: host → tenant → CONTEXT → Experience Engine picks variant →
            personalization overlay → experiment assignment → render → CDN(per experience key)
```

## 2.2 Request context (the signals)
Resolved at the edge, privacy-first (cookieless option, hashed identifiers):

| Signal | Source |
|---|---|
| Country / City / Geo | edge geo + `config/countries`/zones (tenant-scoped) |
| Language / Locale | Accept-Language / path / subdomain (Phase 10 localization) |
| Device | UA class (mobile/tablet/desktop) |
| User Type | anonymous / customer / merchant / driver (from session JWT if present) |
| Campaign / Referral | UTM + referrer |
| Subscription Plan | tenant/plan (existing subscription model) |
| Time | edge clock (business hours, dayparting) |
| Feature Flags | `website_feature_flags` (per tenant/site) |
| Behavior History | visitor profile (Personalization Engine) — returning, last-viewed, loyalty tier |
| Loyalty Tier / Wallet | platform loyalty/wallet (authenticated, tenant-scoped, no PII in cache key) |

## 2.3 Rules model (additive tables, multi-tenant)
```sql
create table website_experience_rules (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  page_id uuid,                                  -- null = site-wide
  name text not null, priority int not null default 0, enabled boolean not null default true,
  conditions jsonb not null,                     -- AST: all/any/not over context predicates
  variant_id uuid not null references website_experience_variants(id),
  created_at timestamptz default now()
);
create table website_experience_variants (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  page_id uuid, key text not null,               -- 'default' | 'eg-ramadan' | 'vip' ...
  snapshot_patch jsonb,                          -- overrides layered on the base published snapshot
  full_snapshot jsonb,                           -- OR a full variant snapshot (compiled at publish)
  unique (page_id, key)
);
```
- **Conditions** are a serializable predicate AST (`{all:[{country:'EG'}, {tier:'gold'}]}`) — the
  same low-code expression grammar used by the Low-Code Platform and Personalization Engine (one
  grammar, reused).
- **Variants** are either a *patch* over the base snapshot (cheap, most common) or a *full* variant
  snapshot (compiled at publish, like the base). Publishing compiles all active variants into the
  snapshot set (Publishing Engine extension) — resolution stays O(1) reads.

## 2.4 Resolution algorithm (edge, deterministic)
1. Build context (§2.2).
2. Fetch the page's active rules (ordered by `priority`), from the published snapshot's rule index.
3. First rule whose `conditions` match → its variant key; else `default`.
4. Apply personalization overlay (Personalization Engine) + experiment assignment (Experimentation
   Platform) → final render tree.
5. Cache under an **experience cache key** = `host:path:locale:variantKey:experimentBucket:deviceClass`
   (bounded cardinality — coarse buckets, never per-user, to stay CDN-cacheable).

## 2.5 Cache-key discipline (the scaling guardrail)
Personalization threatens cacheability. Rule: **only coarse, low-cardinality signals enter the cache
key** (country, deviceClass, variantKey, experiment bucket, loyalty *tier*). Fine-grained/1:1
personalization (specific recommendations, wallet balance) renders as **client-hydrated islands**
that fetch from the Headless API after first paint — so the HTML stays CDN-cacheable while the
experience still personalizes. This is the key architectural discipline that lets a DXP scale to 10k
tenants without exploding cache cardinality.

## 2.6 Integration with the strict concerns
- **Multi-tenancy**: rules/variants are `tenant_id`+`site_id` scoped (RLS); the edge resolves within
  one tenant only.
- **RBAC**: editing experiences requires `experience.rules.manage`; publishing variants uses the
  Phase 10 publish permissions.
- **Localization/SEO**: variant selection is orthogonal to locale; each rendered experience still
  emits correct `hreflang`/canonical (canonical points to the *default* experience to avoid cloaking
  penalties — governance rule).
- **Analytics**: the resolved `variantKey`/experiment bucket is attached to every analytics beacon.
- **Feature Flags**: flags are a first-class condition and a kill-switch for any rule.
- **Audit**: rule create/edit/enable and variant publish write `operation_events`.

## 2.7 Anti-cloaking & fairness (governance built-in)
- Experiences must not show search crawlers different *primary content* than users (SEO cloaking
  risk). Crawlers receive the `default` experience; canonical always points to default. Personalized
  overlays are additive, not content-swaps for bots. Enforced in the Experience Engine.
