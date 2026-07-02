# HAAT NOW — Developer Platform

> The complete entry point for any developer who wants to **understand, extend, and maintain** HAAT NOW.
> Read top-to-bottom the first time; use it as a reference after that.

HAAT NOW is a single React 19 + Vite + TypeScript SPA that serves four portals (customer, driver, merchant,
admin) over a swappable backend (localStorage **sandbox** by default, **Supabase** when live). It is built as a
white-label, multi-tenant SaaS platform: one theme engine, one CMS, one permission source, one provider registry,
one provisioning engine — all driven by declarative config, not per-tenant code.

## Read in order (foundations)
| # | Doc | What you'll learn |
|---|---|---|
| 01 | [Getting Started](01-getting-started.md) | Run it locally, log in to every portal, the essential commands |
| 02 | [Repository Structure](02-repository-structure.md) | Where everything lives and why |
| 03 | [System Architecture](03-system-architecture.md) | One app, four surfaces, two backends; how changes propagate |
| 04 | [Service Architecture](04-service-architecture.md) | The service layer, layering rules, reuse governance |
| 05 | [Database & Storage](05-database.md) | localStorage sandbox vs Supabase; namespaces & tables |

## The platform engines
| # | Doc | Engine / concern |
|---|---|---|
| 06 | [Theme Engine](06-theme-engine.md) | `applyDesign()` → CSS vars → live re-skin (the White-Label lever) |
| 07 | [Brand Assets](07-brand-assets.md) | Logos, favicon, splash, media library |
| 08 | [Template Marketplace](08-template-marketplace.md) | Declarative business manifests (verticals) |
| 09 | [Provisioning Engine](09-provisioning-engine.md) | Orchestrator-only tenant provisioning |
| 10 | [Onboarding Wizard](10-onboarding.md) | Presentation-only tenant onboarding |
| 11 | [Tenant Control Center](11-tenant-control-center.md) | Per-tenant management + lifecycle |
| 12 | [White-Label](12-white-label.md) | The tenant config spine |
| 13 | [CMS (Experience)](13-cms.md) | Screen content: splash/login/onboarding |
| 14 | [Design Center](14-design-center.md) | The visual design admin surface |
| 15 | [Integration Center](15-integration-center.md) | The one provider registry |
| 16 | [RBAC](16-rbac.md) | Roles, permissions, `<Can>` guards |
| 17 | [Authentication](17-authentication.md) | Dual-mode phone + OTP (frozen) |
| 18 | [Multi-Tenancy](18-multi-tenancy.md) | Tenant isolation & per-tenant config |

## Process
| # | Doc | |
|---|---|---|
| 19 | [Release Process](19-release-process.md) | Gate → git workflow → verify production |
| 20 | [Coding Standards](20-coding-standards.md) | The non-negotiable rules + Definition of Done |

## How-to guides (extend the platform)
| # | Doc | You'll add… |
|---|---|---|
| 21 | [Create a New Template](21-how-to-create-new-template.md) | A business-template manifest |
| 22 | [Create a New Industry](22-how-to-create-new-industry.md) | A whole vertical (composed from engines) |
| 23 | [Create a New Provider](23-how-to-create-new-provider.md) | A third-party integration |
| 24 | [Create a New Theme](24-how-to-create-new-theme.md) | A reusable theme preset |
| 25 | [Create a New White-Label](25-how-to-create-new-white-label.md) | A branded tenant, end to end |

## The rules in one screen
- **One engine per concern** — theme, CMS, RBAC, provider registry, CRUD. Never build a second.
- **Layering is downward-only** — `UI → hooks → services → platform/experience/design → storage`. 0 cycles.
- **Services own storage** — components never touch localStorage/Supabase directly.
- **Additive + backward compatible** — new tokens/fields default to today's behavior; live changes are flagged.
- **Mode gate is `VITE_AUTH_MODE`** — never `import.meta.env.DEV`.
- **Frozen systems** — auth/OTP/migration/backend/DB, Design Center, White-Label. Touch only for a critical bug.
- **Payment Rule** — no payment gateway while `HAAT_LIVE_BACKEND` is off; subscription management only.
- **New service** — governance header + `SERVICE_REGISTRY.md` entry in the same commit.
- **Definition of Done** — typecheck 0 · build ✓ · E2E 24/24 · runtime-verified · deployed + prod-verified.

## Authoritative governance (read these too)
- [../governance/SERVICE_REGISTRY.md](../governance/SERVICE_REGISTRY.md) — every service, owner, layer rules (frozen).
- [../governance/IMPLEMENTATION_STANDARD.md](../governance/IMPLEMENTATION_STANDARD.md) — the Definition of Done (frozen).
- [../architecture/SYSTEM_DEPENDENCY_MAP.md](../architecture/SYSTEM_DEPENDENCY_MAP.md) — factual dependency map.
- [../plans/PRODUCTIZATION_MASTER_PLAN_V2.md](../plans/PRODUCTIZATION_MASTER_PLAN_V2.md) — frozen architecture.

Back to the documentation hub: [../INDEX.md](../INDEX.md).
