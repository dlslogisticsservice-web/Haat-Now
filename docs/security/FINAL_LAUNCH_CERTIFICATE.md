# FINAL Launch Certificate

**System:** HAAT NOW — production `haat-now-prod` (`ckmqxhjdrfztkunqprax`)
**Assessment:** Final Independent Security Certification (verification by exploitation, read-only)
**Full report:** `FINAL_SECURITY_CERTIFICATION_REPORT.md`

## Certification result: 🟡 **PASS WITH CONDITIONS**

### Measured against the hard gate (all must hold for a non-FAIL)

| Gate | Status | Evidence |
|---|---|---|
| Every previous exploit remains closed | ✅ | B1–B8, RT-1/2, F-1…F-8, N-1, N-2 re-attacked live → all BLOCKED |
| No new Critical | ✅ | none found |
| No new High | ✅ | new findings are Medium/Low |
| No financial manipulation | ✅ | referral mint (N-2) closed; no wallet/ledger gain possible |
| No privilege escalation | ✅ | admin_users/user_roles not client-writable; role RPCs admin-gated |
| No tenant isolation failure | ✅ | `auth_tenant()` DB-derived; website_* scoped |
| No wallet manipulation | ✅ | direct write + adjust/credit RPCs blocked |
| No payment manipulation | ✅ | order money immutable; payment INSERT scoped |

The FAIL triggers (a Critical, a High, or a reproduced previous exploit) **did not occur**.
A *clean* PASS is withheld only because two genuine **Medium** business-logic findings were
reproduced. These are the launch **conditions**.

### Conditions (must be remediated; none blocks launch on severity, but all should be fixed)

1. **C-1 (Medium) — Driver shift/presence manipulation.** `start_shift`/`end_shift`/`start_break`/
   `end_break` accept an arbitrary driver/shift with no ownership check and toggle that driver's
   `status`/`is_online` (proven: forced a victim driver online+available + phantom shift). Fix:
   enforce caller-owns-driver / caller-owns-shift (or ops).
2. **C-2 (Medium) — Review/rating manipulation.** `submit_review` auto-approves and does not verify
   the order belongs to the caller or that the target was part of it (proven: dropped an
   un-ordered driver's rating 5.0→1.00). Fix: validate order ownership + target participation.
3. **C-3 (Low) — `set_default_address`** lacks an `auth.uid()` ownership check (latent; not
   currently exploitable — address UUIDs aren't discoverable). Add the check.
4. **C-4 (Low) — Unauthenticated maintenance compute** (`recalc_merchant_performance`,
   `recalc_all_merchant_performance`, `recompute_customer_segments`). Revoke anon/public; gate to
   service/ops.

### Recommendation
- **Closed Beta (COD):** acceptable to proceed **with** the conditions scheduled — C-1/C-2 are
  operational/reputation-integrity issues with no financial, escalation, tenant, wallet, or payment
  impact. Prioritize C-1 and C-2 in the next (small) hardening pass.
- **Public Launch:** remediate C-1–C-4 and re-run this certification (also cover the areas not
  fully exercised: deep-links, SMS/push abuse, app-layer rate limiting).

### Attestation
Independent, read-only assessment. No previous report was trusted; every conclusion rests on
reproducible live evidence with zero residue. No code, migration, deployment, or infrastructure
was modified during this certification.

**Verdict: PASS WITH CONDITIONS** — 2026-08-02.
