# Enterprise Operations Audit — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Evidence cited `file:line`. Rating: **Enterprise-Ready / Manual / Weak / Missing / High-Risk**.

| Capability | Rating | Evidence & note |
|---|---|---|
| **Refunds** | 🔴 High-Risk | No in-app trigger; edge `payment-refund` non-atomic + TOCTOU + refund-before-gateway; no ledger posting (`payment-refund:131-213`). |
| **Chargebacks** | 🔴 Missing | No chargeback/dispute-from-gateway handling; webhook parses only paid/failed/cancelled (`payment-webhook:291-297`). |
| **Fraud detection** | 🔴 Missing | No velocity checks, no device/IP signals, no anomaly rules anywhere. |
| **Risk monitoring** | 🔴 Missing | No risk engine; `monitoring.service.ts` is app health, not transaction risk. |
| **Driver suspension** | 🟡 Manual | `suspend_entity`/`ban_entity`/`lift_suspension` RPCs + audit exist (`20260614000030`), **but not enforced** — suspended drivers can still be assigned/deliver (no `account_status` gate). |
| **Merchant suspension** | 🟡 Manual | Same — flag exists, not a gate. |
| **KYC** | 🟡 Manual | Full submit/review workflow + immutable `approval_history`; UI `KycCenter.tsx`. Not wired as a transaction gate. |
| **Compliance** | 🟠 Weak | Audit trail exists for KYC/ops; no GDPR export beyond account deletion (`20260627000001`); no data-retention policy; no PCI scope doc (card data handled by Moyasar — good). |
| **Audit logs** | 🟡 Partial | `operation_events` timeline for ops/provisioning (`ops-execution.service.ts:15-17`); `approval_history` for KYC. **No global audit log** of admin actions on finance/RBAC/config; `SystemLogs.tsx` reads app logs. |
| **Disputes** | 🟠 Weak | Support tickets exist (`cx.service.ts`) but manual; no structured dispute/resolution SLA lifecycle tied to orders/payments. |
| **Incident management** | 🟡 Manual | `OpsIncidentLog.tsx` + `operation_events`; manual entry, no alerting/paging. |
| **Escalations** | 🟠 Weak | No escalation engine; SLA monitor is display-only. |
| **SLA** | 🟠 Weak | `OpsSlaMonitor.tsx` shows SLA metrics; sandbox stats fabricated (`cx.service.ts:149`); no SLA breach automation. |
| **Operations Console** | 🟢 Enterprise-ish | Genuinely the strongest module: real RPCs + realtime on live `orders`/`drivers`, persisted actions with event log (`command.service.ts:73-114`, `ops-execution.service.ts:26-62`). |
| **Broadcast / mass comms** | 🟡 Partial | `broadcast_notification` RPC real (`20260627000003`), but delivery is in-app only (no push/SMS/email). |

## Cross-cutting operational gaps (the real story)

1. **No scheduler / background jobs.** No pg_cron, no scheduled edge functions. Every time-based operational task — dispatch offer expiry, reassignment, segment recompute, settlement runs, trial expiry, payment reconciliation — requires an **admin to click a button**. This is the dominant operational weakness for a logistics platform that must run 24/7 without a human in the loop.
2. **No alerting / on-call.** No paging, no threshold alerts, no error aggregation to an external system. `monitoring.service.ts` is in-app only.
3. **Suspension/KYC are flags, not gates** — the compliance controls exist but do not actually stop bad actors from transacting.
4. **Refund/chargeback/fraud** — the three operational muscles an enterprise payments operation depends on are High-Risk/Missing.
5. **Audit coverage is uneven** — ops and KYC are audited; finance payouts, RBAC changes, and config edits are not comprehensively logged.

## Verdict

Operations tooling is **visually complete and, for live dispatch/ops, genuinely functional**, but the **enterprise operational safety net — refunds, chargebacks, fraud, enforced suspensions, scheduled automation, alerting** — is **Manual-to-Missing**. A real 20-country operation could not run this without a large manual ops team and would carry unmanaged financial-loss exposure on the refund/fraud side.
