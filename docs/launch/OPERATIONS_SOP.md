# HAAT NOW — Operations SOPs (Standard Operating Procedures)

Launch-ready runbooks for the Egypt market. Owners in brackets. Escalation
contacts and thresholds are business parameters — confirm before go-live.

---

## 1. Admin SOP (Super Admin / Country Admin)
**Goal:** keep the marketplace healthy, safe and compliant.

Daily:
- Review the operations dashboard: open orders, late orders, cancellations, refunds.
- Approve pending merchant and captain applications (see §2, §3 gates).
- Check payout/settlement queue is clear for the cycle.
- Scan support backlog for unresolved priority tickets.

Weekly:
- Run settlement for merchants and captains; verify statements reconcile.
- Review zone performance (ETA vs actual, cancellation rate) and tune delivery pricing/coverage in `config/egypt.ts` equivalents (Country Admin settings).
- Review top complaints and feed fixes to product/ops.

Controls:
- Only Super Admin may change commission %, plan limits, or country isolation.
- All privileged actions are audit-logged; never share admin credentials.

## 2. Merchant SOP (Onboarding → Live)
**Approval gate (Admin):** valid commercial registration + tax card, food-safety/operating licence where applicable, verified bank/settlement details, at least one menu category with items and prices, opening hours set.

Merchant daily:
- Go online at opening; keep menu availability accurate (mark sold-out items).
- Accept orders within the target acceptance window; prepare to food-safety standards.
- Hand orders to captains sealed/labelled with the order number.

Merchant weekly:
- Reconcile settlement statement; raise discrepancies to partners@haatnow.app within 3 days.

## 3. Driver / Captain SOP (Onboarding → Live)
**Approval gate (Admin):** legal working age, valid national ID, driving/vehicle licence where required, vehicle details, background check where mandated.

Captain per shift:
- Go online only when available to deliver; keep the app and GPS on.
- Accept an offer only if you can complete it; follow traffic laws.
- Verify handoff: confirm order number at pickup; collect exact cash for COD; deliver and confirm completion (delivery OTP where enabled).
- Remit collected cash per the settlement process; cash owed nets against earnings.

## 4. Support SOP
**Channels:** in-app support request, hello@haatnow.app.
**Response targets (business-tunable):** first response ≤ 15 min during operating hours; resolution of order issues ≤ 24h.

Triage priority:
1. Active order problem (missing/late/wrong/unsafe) — resolve live; refund/redeliver per Refund Policy.
2. Payment/refund query — verify order, issue remedy, confirm timing.
3. Account/access — verify identity, assist.
4. General/feedback — log and route.

Every refund/credit above the auto-approve threshold requires a note and links to the order.

## 5. Incident SOP
**Definition:** any event degrading service (checkout failure, dispatch outage, data/security concern, food-safety report).

Response:
1. **Detect & declare** — on-call acknowledges; classify severity (S1 outage → S3 minor).
2. **Contain** — S1: enable Maintenance mode on affected surface (Website Studio / settings) if customer-facing and broken; pause new orders in the affected zone if fulfilment is unsafe.
3. **Communicate** — post status to the team channel; for customer-facing S1, prepare a short bilingual notice.
4. **Resolve & verify** — deploy fix, confirm health check (`/health.json`) and version (`/version.json`) match the intended release.
5. **Review** — within 48h, write a blameless post-incident note: timeline, root cause, follow-ups.

Security specifics:
- Suspected credential/data exposure → rotate secrets in the deploy environment immediately; never commit secrets; review audit logs; notify the accountable owner.
- Do not disable CSP/HSTS headers (see `vercel.json`) as a “quick fix”.

---
*These SOPs reference platform capabilities that already exist (RBAC, audit logs, Maintenance mode, settlement, health/version endpoints). Keep them versioned with the product.*
