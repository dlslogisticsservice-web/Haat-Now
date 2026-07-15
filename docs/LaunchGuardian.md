# Launch Guardian — V1

A lightweight **production-health & launch-readiness** workspace inside Super Admin. It is
**not** a monitoring server, **not** a QA platform, and it **never executes fixes** — it
surfaces health, collects existing signals, and prepares an AI Repair Prompt for a human to
review and approve.

Access: **Super Admin → System → Launch Guardian** (`guardian` nav key, `super: true`).

---

## Architecture

**Design principle: reuse-only.** Launch Guardian adds one component + one small read-side
buffer. It creates no new service, no new API, no duplicate logic.

```
                         LaunchGuardian.tsx  (features/admin)
                         ┌───────────────────────────────────────────┐
   /version.json ───────►│  System Health (17 subsystems 🟢🟡🔴)      │
   /health signal        │  System Metrics (latency, orders, storage) │
                         │  AI Assistant (Repair Prompt · copy-only)  │
                         │  Regression (suite list + commands)        │
                         └──────┬───────────┬───────────┬────────────┘
                                │           │           │
      reuse (no new services)  ▼           ▼           ▼
   monitoring.service     analytics.service /       admin.service
   .recentEvents()        sandboxStore                .auditLogs()
   (ring buffer added)    .getPlatformAnalytics()     (audit rows)
                          .getFailedOrders()
```

**Files:**
| File | Change | Why |
|---|---|---|
| `src/features/admin/LaunchGuardian.tsx` | **new** component | the workspace |
| `src/services/monitoring.service.ts` | **+ read-side ring buffer** (`recentEvents()`, `MonitorEvent`) | so the existing monitoring seam can be *displayed*; no new service |
| `src/features/admin/AdminSidebar.tsx` | + `guardian` NavKey + nav item (System group, super-only) | navigation |
| `src/features/admin/AdminDashboard.tsx` | + `guardian` tab + import + render branch | routing (same pattern as every other module) |

**Data sources (all pre-existing):**
- **Health:** `/version.json` fetch (API/website + latency), the `VITE_AUTH_MODE` / `VITE_GOOGLE_MAPS_API_KEY` env flags, and known backend state (7 buckets, 4 edge functions, migrated DB).
- **Metrics:** `sandboxStore.getPlatformAnalytics()` + `getFailedOrders()` + `getDriverAvailable()` (demo) or `analyticsService.getPlatformAnalytics()` (live); `localStorage` size for storage; timed probes for latency.
- **Logs / errors:** `monitoring.recentEvents()` (ring buffer fed by the existing `captureError`/`track`/`log`) + `adminService.auditLogs()`.
- **Build:** `/version.json` (`sha`, `short`, `builtAt`, `env`).

**UI:** reuses `EnterpriseUI` atoms only — `WorkspaceHeader`, `AdminCard`, `MetricCard`,
`StatusBadge`, `SectionHeader`, `ActionButton`, `DashboardGrid`. No new design system.

**Health colour mapping:** `success → 🟢 green`, `warning`/`pending → 🟡 yellow`, `error → 🔴 red`.

---

## User Guide

Open **Super Admin → System → Launch Guardian**.

1. **System Health** — 17 subsystems (Website, Website Studio, API, Supabase, Realtime,
   Authentication, Orders, Payments, COD, Drivers, Merchants, Partner Center, Affiliate,
   Notifications, Storage, Edge Functions, Maps), each with a 🟢/🟡/🔴 pill and a one-line
   detail. The header shows the 🟢/🟡/🔴 tally. In demo (sandbox) mode, backend subsystems
   show 🟡 with a "demo" note — expected until cutover.
2. **System Metrics** — API/DB/Realtime latency, active users (approx), orders, failed,
   pending, delivered, drivers online, merchants online, storage usage, build. Auto-refreshes
   every 30s; **Refresh** forces it.
3. **AI Assistant — Repair Prompt** — auto-collected from logs, stack traces, browser errors,
   failed requests, and the deployed build. It generates a structured prompt containing **root
   cause candidate · degraded subsystems · affected files (parsed from stack traces) · logs ·
   stack trace · deployed sha · a minimal-patch request (no refactor, no redesign)**.
   - **Copy Prompt** → clipboard.
   - **Open in Claude** → opens `claude.ai/new` pre-filled (paste if the query is truncated).
4. **Regression** — the three existing suites (`npm run test:website` = 178, `e2e_runner.cjs`
   = 24, `ops_simulation.cjs` = 20) with their commands and last-verified pass counts. The
   browser cannot run node tests; run them locally/CI with the commands shown.
5. **Recent Audit Log** — the latest audit rows (reused from `adminService.auditLogs`).

**Approval gate:** a banner states — and the design enforces — that Launch Guardian **never
applies a fix automatically**. The AI prompt is copy-only; every patch requires Super Admin
review and approval.

---

## Future Expansion Plan (post-V1, not built)

- **V1.1 — Live probes:** when `HAAT_LIVE_BACKEND=1`, add real Supabase/Realtime/Edge-Function
  health probes and true DB/Realtime latency (via existing services, still no direct client import).
- **V1.2 — Sentry/analytics drill-in:** when `VITE_SENTRY_DSN`/`VITE_ANALYTICS_URL` are set,
  link each red subsystem to its recent events in the configured backend.
- **V1.3 — Uptime history:** persist a rolling health snapshot (localStorage/DB) to draw a
  24h status timeline per subsystem.
- **V1.4 — One-click regression trigger:** a CI webhook (e.g. GitHub Actions dispatch) so
  Super Admin can *trigger* the existing suites and see results, without running node in the browser.
- **V1.5 — Alerting:** push a notification (reusing `NotificationCenter`) when a subsystem
  flips to 🔴.
- **Out of scope (by design):** building a monitoring server, a test runner, or any
  auto-remediation. Fixes always route through human approval + the normal PR flow.

---

**Status:** V1 complete. tsc/lint clean, architecture boundary respected (0 `lib/supabase`
imports in feature code), 178/178 tests, build ✓. Reuse-only — no duplicate services or
rendering pipelines introduced.
