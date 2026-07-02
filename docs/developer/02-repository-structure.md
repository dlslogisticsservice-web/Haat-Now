# 02 · Repository Structure

> **Audience:** developers navigating the codebase for the first time.

## Purpose
Explain where everything lives and why, so you can find the right file without guessing.

## Architecture: top-level layout
```
haat-now-phase2/
├── src/                  ← the application (see below)
├── supabase/             ← migrations/, functions/, seed*.sql  (live-mode DB)
├── scripts/              ← build/codegen (gen-version.cjs, gen-icons.cjs, …)
├── docs/                 ← ALL documentation (this hierarchy)  — see docs/INDEX.md
├── public/               ← static assets served as-is
├── dist/                 ← build output (generated — never edit)
├── package.json          ← scripts + deps
├── vite.config.ts        ← build config; forces sandbox in prod unless HAAT_LIVE_BACKEND=1
└── README.md             ← the only Markdown file at repo root (links to docs/)
```
The repository root holds **only `README.md`** among Markdown files — every other document lives under `docs/`
(see [docs/README.md](../README.md)).

## Architecture: `src/` layout
```
src/
├── main.tsx              ← boot + provider tree (AppConfig → Design → Experience → App)
├── App.tsx               ← role router: customer / driver / merchant / admin
├── index.css             ← Tailwind v4 @theme + design-token CSS variables
│
├── features/            ← UI, one folder per surface/domain
│   ├── admin/           ← the Admin Dashboard + every admin console + workspaces/
│   ├── auth/            ← login/OTP screens + auth types
│   ├── checkout/  discover/  home/  orders/  profile/  restaurant/  wallet/
│   ├── driver/          ← Driver app
│   └── merchant/        ← Merchant portal
│
├── services/           ← ALL business logic + data access (the service layer)
│   └── ops/            ← operations-domain services (dispatch, zone, shift, …)
├── platform/           ← platform.service + platformModel (Integration Center registry)
├── experience/         ← experience.service (CMS) + assets.service + types + provider
├── design/             ← designSystem.ts (theme engine) + DesignContext.tsx
├── contexts/           ← AppConfigContext (lang/dir/i18n)
├── hooks/              ← useRbac (+ <Can> guard), and other shared hooks
├── components/         ← shared presentational components (incl. components/brand/)
├── config/             ← countries.ts, version.ts
├── lib/                ← supabase client (mode-gated), low-level libs
├── db/                 ← client-side migration helpers
├── i18n/  utils/  assets/  ← translations, helpers, static imports
```

## Flow: "where does X go?"
| You are building… | It goes in… |
|---|---|
| A new admin console screen | `src/features/admin/` (+ a nav entry in `AdminSidebar.tsx`) |
| A per-entity admin editor | `src/features/admin/workspaces/` |
| Business logic / data access | `src/services/<name>.service.ts` (governed — see [20](20-coding-standards.md)) |
| An operations-domain service | `src/services/ops/` |
| A design token / theme change | `src/design/designSystem.ts` + `src/index.css` |
| A CMS/screen-content change | `src/experience/` |
| A provider/integration | `src/platform/platformModel.ts` (catalog) + `platform.service.ts` |
| A permission | `src/services/rbac.service.ts` |
| Shared UI | `src/components/` |

## Dependencies
Import direction is strictly **downward**: `features (UI) → hooks → services → platform/experience/design →
storage`. This is enforced by convention and documented in [04-service-architecture.md](04-service-architecture.md)
§Layer Rules. Types are leaves (import nothing).

## Extension points
- New surface → add a folder under `features/` and a branch in `App.tsx`.
- New shared hook → `src/hooks/`.
- New static config → `src/config/`.

## Reuse rules
- Look in `src/services/` **before** writing new data logic — 40+ services already exist
  ([04-service-architecture.md](04-service-architecture.md) has the full registry).
- Look in `src/components/` before building a new shared widget.

## Files involved
- [`src/main.tsx`](../../src/main.tsx), [`src/App.tsx`](../../src/App.tsx),
  [`src/index.css`](../../src/index.css) — the three files that wire everything together.

## Do's
- ✅ Keep UI in `features/`, logic in `services/`. One concern per file.
- ✅ Co-locate a feature's components inside its `features/<x>/` folder.

## Don'ts
- ❌ Don't put business logic in a component. ❌ Don't import a service from another service upward.
- ❌ Don't add Markdown docs to the repo root — they belong under `docs/`.

## Example
```
Add a "Refunds" admin screen:
  src/features/admin/RefundsCenter.tsx        ← UI
  src/services/finance.service.ts             ← REUSE (refunds already live here)
  src/features/admin/AdminSidebar.tsx         ← add nav entry + permission gate
```

## Next
[03-system-architecture.md](03-system-architecture.md)
