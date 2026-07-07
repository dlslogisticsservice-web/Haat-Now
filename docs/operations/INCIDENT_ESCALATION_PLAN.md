# Incident Escalation Plan — HaaT Now

Purpose: a clear, fast path from "something is wrong" to resolution during and after launch.

## Severity levels
| Sev | Definition | Examples | Response target | Who |
|---|---|---|---|---|
| **SEV-1** | Platform down / revenue blocked / data or security breach | Site down, login broken, no COD orders can be placed, RLS/data leak | Ack ≤ 5 min · Mitigate ≤ 30 min | On-call eng → Eng lead → Founder |
| **SEV-2** | Major degradation, workaround exists | Tracking realtime down, settlements not running, high error rate (<2%) | Ack ≤ 15 min · Fix ≤ 4 h | On-call eng → Eng lead |
| **SEV-3** | Minor / cosmetic / single-user | UI glitch, one merchant misconfig | Next business day | On-call eng |

## Roles
- **Incident Commander (IC):** on-call engineer (first responder); owns coordination + comms.
- **Eng Lead:** deep-fix authority; approves rollback.
- **Ops Lead:** merchant/driver/customer comms; manual ops (e.g. reassign dispatch).
- **Founder/Business:** SEV-1 awareness + external comms decisions.

## Flow
1. **Detect** — alert (uptime/Sentry) or human report.
2. **Declare** — IC sets severity, opens the incident channel, starts a timeline log.
3. **Mitigate first** — stop the bleeding before root-cause. Preferred mitigations:
   - Bad deploy → **Rollback** (`../deployment/ROLLBACK_RUNBOOK.md`).
   - Auth/SMS failure → switch Supabase Auth to Test-OTP (controlled) or alternate provider.
   - Card gateway failure → unset `MOYASAR_SECRET_KEY` → COD-only continues.
   - Dispatch/realtime → manual dispatch via Ops console.
4. **Escalate** if not mitigated within the Sev target — page the next role in the chain.
5. **Resolve & verify** — confirm via smoke tests + `/health.json`.
6. **Post-incident** — within 48 h: blameless write-up (timeline, root cause, action items).

## Contacts (fill before launch)
| Role | Name | Channel | Phone |
|---|---|---|---|
| On-call engineer | _TBD_ | _TBD_ | _TBD_ |
| Eng lead | _TBD_ | _TBD_ | _TBD_ |
| Ops lead | _TBD_ | _TBD_ | _TBD_ |
| Founder | _TBD_ | _TBD_ | _TBD_ |
| Supabase support | — | dashboard/support | plan-dependent |
| Vercel support | — | dashboard/support | plan-dependent |
| SMS provider (Twilio) | _TBD_ | console | — |

## Standing mitigations that require no code
- **Rollback** web deploy (Vercel promote previous).
- **COD-only fallback** (unset gateway secret).
- **Test-OTP** controlled auth (limit to known numbers).
- **Maintenance mode** per-tenant (website `status`/`maintenance` flags).

## Related
`../deployment/ROLLBACK_RUNBOOK.md` · `FIRST_WEEK_MONITORING_PLAN.md` · `PRODUCTION_RECOVERY_EXECUTION_PLAN.md`
