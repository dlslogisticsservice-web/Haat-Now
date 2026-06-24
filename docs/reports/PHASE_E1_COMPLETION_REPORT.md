# Phase E1 — Trust, KYC & Supply Onboarding — Completion Report

**Date:** 2026-06-24 · Goal: onboard merchants and drivers **without manual DB seeding** — self-
registration, document upload, KYC review, and approve/reject/suspend/ban with a full audit trail.
Implemented production-grade (real backend, RLS, audit logs, no mock data). Applied live + verified.

Commits: `8002cdb` (DB) · `f9d99de` (services) · `133383d` (UI).

---

## What was delivered

### M1 — Database (`20260614000030_trust_kyc_onboarding.sql`, applied live + recorded)
**7 entities (all requested):**
| Table | Purpose |
|---|---|
| `account_status` | per-entity lifecycle: pending / under_review / approved / rejected / suspended / banned (UNIQUE per entity) |
| `kyc_reviews` | the review queue (pending → approved/rejected, reviewer, notes) |
| `merchant_documents` | CR / tax cert / business license / owner ID (+ per-doc review status) |
| `driver_documents` | driver license / national ID / vehicle registration / insurance |
| `approval_history` | **immutable audit trail** of every transition (from→to, action, actor, reason) |
| `suspensions` | suspension records (reason, by, lifted_at, is_active) |
| `bans` | ban records (reason, by, is_active) |

**Entity columns added:** `merchants` (+owner_user_id, contact_email/phone, tax_number, commercial_
registration_number, business_type, address, submitted_at); `drivers` (+owner_user_id, national_id_number,
license_number, license_expiry, vehicle_plate, submitted_at).

**Private storage:** `kyc-documents` bucket (non-public) with folder-scoped storage RLS
(`<auth.uid()>/…`; admins read all).

**8 SECURITY DEFINER RPCs** (every state change logs `approval_history`):
`submit_merchant_application`, `submit_driver_application`, `review_kyc`, `suspend_entity`,
`lift_suspension`, `ban_entity`, `review_document`, `log_approval`. Admin actions gated by `is_ops_admin()`.

**RLS:** applicants read/own their application + documents (`owner_user_id = auth.uid()`); ops-admins
manage all; state writes only via DEFINER RPCs. `authenticated` table grants added. Existing seeded
merchants/drivers backfilled to `approved` (no disruption).

### M2 — Services (`src/services/onboarding.service.ts`)
Applicant: `submitMerchant`, `submitDriver`, `uploadDocument` (private bucket), `recordMerchant/DriverDocument`,
`myEntityId`, `myStatus`. Admin: `kycQueue` (with entity-name resolution), `documents`, `signedDocUrl`,
`history`, `reviewDocument`, `reviewKyc`, `suspend`, `liftSuspension`, `ban`, `complianceStats`.

### M3 — UI
- **Admin KYC / Compliance Center** (`KycCenter.tsx`, new "التحقق والامتثال" tab in OperationsCenter):
  compliance dashboard (status counts per merchant/driver), review queue (pending/approved/rejected),
  per-applicant document viewer (signed URLs) with per-doc approve/reject, KYC approve/reject,
  suspend/lift/ban, and the decision audit trail.
- **Applicant onboarding** (`OnboardingForm.tsx`, reusable merchant|driver): self-registration form +
  document upload + live status. Driver variant mounted into DriverApp's not-registered screen
  (replaces the old "contact admin" dead-end with real self-onboarding).

## Verification (live, evidence)
Full lifecycle on the live DB with simulated JWTs (test rows cleaned up afterward):
| Step | Result |
|---|---|
| applicant `submit_merchant_application` | merchant created, `account_status=pending`, `kyc_reviews=pending` ✅ |
| applicant uploads document (RLS-own) | insert allowed for owner ✅ |
| admin `review_document` (approve) | doc status → approved ✅ |
| admin `review_kyc` (approve) | `account_status=approved` ✅ |
| admin `suspend_entity` | `suspended` + active suspension row ✅ |
| admin `lift_suspension` | back to `approved` ✅ |
| admin `ban_entity` | `banned` + active ban row ✅ |
| **audit trail** | `submitted → approved → suspended → lifted → banned` ✅ |
| **RLS negative** | applicant calling `review_kyc` → **BLOCKED** "not authorised" ✅ |

Build ✅ · Lint ✅ · E2E 24/24 ✅ (no regression).

## Honest scope notes (not inflated)
- **Wired end-to-end:** driver self-registration (mounted in DriverApp). **Merchant self-registration form
  is built** (`OnboardingForm entityType="merchant"`) but **not yet mounted to a route** — it needs an
  entry point in the customer/merchant shell (one-line mount, same as the driver case). This is the only
  remaining wiring gap for full self-serve merchant onboarding.
- **Document review is manual** (admin views signed URL + approve/reject) — no automated KYC/OCR/identity-
  provider integration (out of scope for E1; that's a future "automated KYC" phase).
- **No notification** is sent to the applicant on approval/rejection yet (device push doesn't exist; status
  is visible in-app via `OnboardingForm`). Wire to push when the notification phase lands.
- Suspension/ban set `account_status` but do **not** yet force-logout an active session or hard-block
  order/dispatch flows — enforcement hooks (e.g., gate `auto_dispatch_order` on `status='approved'`) are a
  fast follow.

## Result
Merchants and drivers can now be onboarded through a **real self-registration → document upload → KYC
review → approve/reject/suspend/ban** pipeline with a complete audit trail and proper RLS — **no manual
database seeding required.** The admin Compliance Center and driver self-onboarding are live; merchant
self-onboarding needs a single mount point to be fully end-to-end.
