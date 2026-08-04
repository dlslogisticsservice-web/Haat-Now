# LIVE RELEASE STATUS — HAAT NOW Closed Beta

_Cumulative launch tracker (RULE 6). Updated after every **completed** step. PASS requires a
Reality Check (RULE 7): configuration + tested + expected result observed + evidence — never
configuration alone._

| Field | Value |
|---|---|
| **Current phase** | Operator-Assisted Production Launch — **STEP 1 (Resend SMTP)** in progress |
| **Current git commit SHA** | `9e22721de0d1fad349d574d7612fc4643f293898` (`9e22721`) |
| **Branch** | `feat/website-platform-architecture` |
| **Current production version (live on haatnow.app)** | **Sandbox demo build** (pre-cutover — not yet the live backend) |
| **Pending live build** | `build:live` → `VITE_AUTH_MODE=supabase`, backend `haat-now-prod` (verified Phase A) |
| **Backend of record** | `haat-now-prod` (`ckmqxhjdrfztkunqprax`, Frankfurt) — 7 security migrations, bootstrapped, 0 orders |
| **Estimated remaining time** | ~45–60 min operator work |

## Completed steps (with evidence)
_None yet._ Foundation verified in prior phases: security certification (all findings closed),
backend activation (bundle targets prod), operational bootstrap (admin + geography + merchant +
catalog + driver), backend E2E (order→delivery, ledger balanced).

## Remaining steps
| # | Step | Reality-Check PASS criteria |
|---|---|---|
| 1 | Resend SMTP | SMTP enabled **+ OTP email received + password-reset received + From = Resend sender + real inbox** |
| 2 | Google Maps API key | key created **+ map tiles render live** with Maps JS + Places + Geocoding, restricted |
| 3 | Sentry | project/DSN created **+ a test event appears in Sentry** |
| 4 | Vercel env vars | all required vars set **+ check-env live passes** in the deploy context |
| 5 | Production deploy | deployed **+ `/version.json` sha matches + `/health.json` ok + no sandbox banner + live backend** |
| 6 | Smoke tests | full journey exercised on the **deployed app** (registration/OTP/login/browse/order/dashboards/dispatch/realtime/delivery/wallet/ledger) |
| 7 | LIVE_LAUNCH_VERIFICATION.md + decision | every subsystem PASS with evidence |

## Current blockers
- **STEP 1:** Resend SMTP not yet configured (built-in sender only — rate-limited). *Awaiting operator.*
- STEPS 2, 4, 5 require operator credentials (Google Cloud, Vercel). STEP 3 optional-but-recommended.
- STEP 6 depends on STEPS 1–5.

## Risks
- Email deliverability (Gmail spam-foldering) until Resend domain SPF/DKIM verified.
- DNS propagation delay on the Resend domain (minutes–hours).
- Maps quota/restrictions misconfig → blank map (STEP 2).
- Wrong Vercel build command → ships sandbox instead of live (mitigated: `HAAT_LIVE_BACKEND=1`).

## Rollback status
- **Frontend:** always revertible — promote the previous (sandbox) Vercel deployment, or set `VITE_AUTH_MODE=sandbox`. Non-destructive.
- **SMTP:** toggle Custom SMTP off → built-in sender. Non-destructive.
- **DB:** no schema change in cutover; migrations forward-only; seed additive. No destructive rollback needed.

## Decision
**NOT READY** — pending STEPS 1–6 with Reality-Check evidence.
