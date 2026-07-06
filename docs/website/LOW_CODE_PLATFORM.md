# Low-Code Platform

> HaaT Now · Phase 10.5 · Design only (Part 11). A **declarative** logic layer for the builder — no
> arbitrary code. It reuses the **one shared predicate/expression grammar** already used by the
> Experience Engine, Personalization, Journeys, and Experiments, so authors learn it once and it is
> safe to evaluate at the edge and on the client.

## 1. The shared grammar (single source of truth)
A small, serializable, side-effect-free expression AST:
- **Predicates**: `all/any/not`, comparisons (`eq/neq/gt/lt/in/contains`), over **context**
  (country, city, locale, device, userType, plan, loyaltyTier, campaign, time/daypart, returning,
  featureFlag) and **data bindings**.
- **Expressions**: literals, context refs, data-binding refs, string/number/date helpers, format.
- **No loops, no I/O, no code** — bounded, deterministic, safe. The same evaluator runs at the edge
  (cache-safe decisions) and in the client island (1:1 decisions).

## 2. Capabilities (Part 11)

| Capability | Design |
|---|---|
| **Visual Logic** | node/blockly-style editor that emits the AST; also an "advanced" expression field |
| **Conditional Rendering** | `renderWhen: <predicate>` on any block/section (from Experience/Personalization) |
| **Dynamic Visibility** | show/hide per breakpoint × condition (extends `visibility`) |
| **Simple Expressions** | computed text/props (e.g. `"Welcome back, {profile.firstName}"`, `"{offers.count} offers near you"`) — safe interpolation only |
| **Event Actions** | trigger→action (click/hover/scroll/in-view/submit → show/hide/scrollTo/navigate/openForm/emitEvent/startJourney/track) — the Interaction Builder grammar |
| **Data Binding** | bind block props to a **data source** (a Realtime Block resolver or Headless API query), tenant/auth scoped |
| **No-Code Forms** | the Phase 10 Forms Platform, exposed as a visual form builder (fields + validation + actions) |
| **No-Code Integrations** | connect a form/journey/event to an external system via **signed webhooks** (no code) or a pre-built connector |

## 3. Data binding model
```
binding = { source: <resolver-id>, params: <expression map>, scope: 'tenant'|'auth', shape: <schema> }
```
- `source` maps to a registered, safe resolver (a Realtime Block data source or a Headless API query)
  — never arbitrary SQL. Params are expressions over context. Scope enforces tenant/auth at the edge.
- Bindings are validated against a declared `shape` so the builder can offer typed field pickers.

## 4. Actions & connectors (no-code integrations)
- **Actions** are declarative and allow-listed: notify, track, emitEvent, startJourney, openForm,
  navigate, webhook(signed). No action can call money/ops RPCs directly — sensitive effects go
  through governed services (the orchestrator discipline).
- **Connectors**: pre-built, capability-scoped integrations (e.g. "send submission to CRM segment",
  "post to Slack", "create CX ticket") configured via UI, executed server-side with signed payloads
  + retry (payment-webhook pattern).

## 5. Safety & governance (why this is safe at 10k tenants)
- **No code execution** by default — only the bounded grammar + allow-listed actions. This avoids the
  security surface of arbitrary tenant code (the Custom Code / Custom Component path stays separately
  gated + sandboxed, Marketplace §5).
- Evaluation is pure and deterministic → cache-safe at the edge, testable, replayable.
- Expressions cannot read cross-tenant data (bindings are tenant-scoped) or PII beyond the visitor's
  own authorized scope.

## 6. Integration with strict concerns
- Multi-tenant (bindings/actions tenant-scoped); RBAC (`lowcode.manage`; sensitive connectors need
  extra permission); localized (expression string outputs are translatable); analytics (actions can
  `track`); flag-gated; audited (logic changes are revisioned); observability monitors connector/
  webhook failures. The grammar is shared with Experience/Personalization/Journey/Experiment — one
  mental model across the whole DXP.
