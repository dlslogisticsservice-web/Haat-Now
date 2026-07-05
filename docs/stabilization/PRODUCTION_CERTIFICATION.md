# Production Certification — Phase 9.5

> Status of production certification for the HaaT Now Phase 9 P0 remediation.
> Date: 2026-07-05. Certifier: Independent CTO audit (read-only staging validation).

## Certification statement

**I CANNOT issue an unconditional production certification from this environment, and I will
not fabricate one.** Certification of runtime behavior requires applying the migrations,
deploying the edge functions, and running the live E2E — none of which are possible here
(read-only tooling, no DB password, dev project 21 migrations behind with no test data; see
`LIVE_VALIDATION_REPORT.md` §1).

What I **can** certify, and do, is a **CONDITIONAL / STATIC certification** based on real
read-only validation against the live `haat-now-dev` project plus the green repo gates.

---

## A. Certified NOW (evidence-backed)

| Item | Certified? | Basis |
|---|---|---|
| Phase 9 migrations are **syntactically sound & dependency-valid** against the real schema (7/8; `000001` needs the `tenants` prerequisite) | ✅ | Live dependency probe (`LIVE_VALIDATION_REPORT` §2.3) |
| Migrations are **additive, idempotent, guarded** (no destructive DDL) | ✅ | Source review of all 8 |
| `pg_cron` **available** on the target project | ✅ | `pg_available_extensions` = true |
| Repo gates **green**: lint, build, build:live, architecture guard, E2E sandbox 24/24 | ✅ | CI-equivalent local runs |
| Sandbox demo **unchanged** by Phase 9 (no regression) | ✅ | E2E 24/24 identical |
| **2 real P0-8 defects + 1 hardening gap** found and **fixed** | ✅ | `LIVE_VALIDATION_REPORT` §3 |
| Edge-function changes **type-safe** | ✅ | CI `deno check` job (Deno absent locally) |

## B. NOT certified (requires runtime on a write-capable, seeded staging)

| Item | Why not | Where to verify |
|---|---|---|
| RPC transactional behavior (`create_order`, refund saga, `post_ledger` balancing) | not executed | runbook steps 3–6 |
| Order triggers fire (auto-dispatch, workload accounting) | not executed | runbook step 7 |
| pg_cron jobs actually registered & running | not applied | runbook step 8 |
| RBAC `auth_has_permission` end-to-end enforcement | not executed | runbook step 9 |
| Updated edge functions live behavior | still v5 on project | runbook step 2 |
| **Live E2E `HAAT_LIVE_BACKEND=1`** | no demo/test accounts on project | runbook steps 10–11 |
| PII lockdown effective on live data (S-4) | not applied | runbook step 12 |
| Multi-role / country permission matrix on real users | no seeded roles | runbook step 9 |
| Website provisioning end-to-end (needs `tenants` + `20260627*`) | prerequisites unapplied | runbook step 1 |

---

## C. Certification gates (must ALL pass on staging before production sign-off)

1. **Migration head** — staging brought to repo head (apply the 21 pending migrations, incl.
   `20260626*`,`20260627*`,`20260705*`); `list_migrations` shows `20260705000008`.
2. **Advisor clean-up** — `get_advisors(security)` re-run; the 87 anon-executable SECURITY
   DEFINER RPCs revoked (Phase 9.5 revokes cover the *new* functions; the ~80 pre-existing ones
   remain a P1 hardening batch); 3 always-true INSERT policies tightened.
3. **PII** — confirm `"Public read merchants"` dropped and `SELECT(contact_phone)` revoked;
   `pg_policies` shows no `using(true)` PII exposure on drivers/merchants.
4. **Money paths** — a scripted test proves: no duplicate order on double-submit; no
   over-refund under concurrent partial refunds; refund posts a balanced ledger txn; a second
   `payment-initiate` for one order does not create a second charge.
5. **Dispatch** — an accepted order auto-offers; `active_orders` increments on assignment and
   returns to 0 (driver `available`) after delivery/cancel.
6. **RBAC** — a non-`finance.pay` admin is rejected by `pay_merchant_settlement`; a super_admin
   succeeds.
7. **Scheduler** — `cron.job` lists the 4 HaaT jobs (or the scheduled-edge fallback is wired).
8. **Live E2E** — `HAAT_LIVE_BACKEND=1` suite green against seeded staging.

Until gates 1–8 pass, the production status is **CONDITIONAL — NOT CERTIFIED**.

---

## D. Honest bottom line

Phase 9 is **well-formed and staging-ready code** — live read-only validation *increased*
confidence (dependencies check out, and it caught + fixed real bugs). But "certified for
production" is a statement about **runtime behavior on staging**, which this environment cannot
produce. The certification is therefore **CONDITIONAL**, and the exact path to unconditional
sign-off is the runbook in `GO_NO_GO_FINAL.md`.
