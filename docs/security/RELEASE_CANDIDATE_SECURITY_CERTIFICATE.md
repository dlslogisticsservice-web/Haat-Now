# Release Candidate — Independent Security Certificate

**System:** HAAT NOW production `haat-now-prod` (`ckmqxhjdrfztkunqprax`)
**Assessment:** Final independent Release-Candidate certification — verification by exploitation,
**strictly read-only** (no code, migration, deploy, or infrastructure change). Every result is
fresh, reproducible evidence from live impersonated attacks (`SET ROLE` + forged
`request.jwt.claims`) with read-back of the stored value/row; all probes self-cleaned to zero
residue. Nothing was trusted — not prior reports, not the regression suites.

## Certification result: 🔴 **FAIL**

Per the RC PASS bar (**no Critical, no High, and no Medium**), the certification **fails**: while
**every previously reported finding is closed**, a **new systemic Medium** was reproduced —
Broken Object Level Authorization (OWASP API1) on a family of read RPCs that leak cross-account
data (financial balances, delivery location, driver PII, order contents) by object id.

No Critical, no High, and **no** write-side financial/wallet/payment manipulation, privilege
escalation, or tenant-isolation failure was found. The failure is confidentiality (unauthorized
cross-account **reads**), not integrity/money.

---

## Part 1 — All previous findings re-tested: CLOSED (fresh evidence)

| Finding | Live re-attack | Result |
|---|---|---|
| B1 | client order payment/total tamper | CLOSED — `payment_status` stayed `unpaid` |
| B2 | `complete_delivery_payout` | CLOSED — revoked |
| B3 | loyalty award/redeem/mint | CLOSED — revoked |
| B4 | `redeem_advanced_coupon` | CLOSED — revoked |
| B5 | total/discount forgery | CLOSED — immutable |
| B6 | `driver_earnings` insert | CLOSED — no privilege |
| B7 | `set_driver_status` | CLOSED — revoked |
| B8 | `respond_dispatch` | CLOSED — revoked |
| RT-1 | driver self-GPS spoof | CLOSED — read-back unchanged |
| RT-2 | driver self-priority | CLOSED — `priority_score` stayed `7` |
| F-1 | customer forges `complete_delivery` | CLOSED — raised |
| F-2 | `finalize_driver_delivery` fake order | CLOSED — raised |
| F-3 | merchant KYC read | CLOSED — 0 rows |
| F-4 | anon dispatch/maintenance RPCs | CLOSED — anon revoked |
| F-5 | always-true INSERT policies | CLOSED — scoped |
| F-6 | public bucket listing | CLOSED — 0 policies |
| F-7 | mutable `search_path` | CLOSED — pinned |
| F-8 | `pg_trgm` in public | CLOSED — relocated |
| N-1 | driver KYC to ordering customer | CLOSED — base 0 rows; `drivers_public` safe |
| N-2 | referral wallet minting | CLOSED — arbitrary owner blocked; **0 minted** |
| C-1 | driver shift/presence manipulation | CLOSED — `start_shift(foreign)` raised |
| C-2 | review/rating manipulation | CLOSED — foreign/forged/pre-delivery rejected |
| C-3 | `set_default_address` ownership | CLOSED — foreign address rejected |
| C-4 | maintenance RPC authorization | CLOSED — non-admin/anon rejected |

Also re-verified: wallet direct write blocked; privilege escalation (`admin_users`/`user_roles`)
blocked; 0 RLS-disabled public tables. **24/24 prior findings closed.**

---

## Part 2 — NEW finding

### RC-1 — Broken Object Level Authorization (BOLA) on read RPCs (MEDIUM)
- **Category:** OWASP API1:2023 (BOLA) / IDOR — cross-account data disclosure.
- **Root cause:** a family of `SECURITY DEFINER` **read** functions accept an owner/object id
  parameter and **do not verify it against `auth.uid()`** (nor ops). Because they run as owner
  they bypass RLS, returning another account's data to any caller who supplies the id. Several are
  executable by **anon**.
- **Confirmed live (attacker = an unrelated account / anon; read-back):**
  | RPC | Leaked (cross-account) | Evidence |
  |---|---|---|
  | `loyalty_balance(p_customer_id)` | any customer's loyalty balance | returned victim balance **250** |
  | `order_tracking(p_order_id)` | order status + **driver name/phone/live GPS** + **delivery destination coords** + timeline | returned victim order (1) as a non-owner |
  | `reorder_items(p_order_id)` | any order's line items (product, qty, price) | returned victim order items (1 row) as a non-owner |
  | `driver_wallet_summary(p_driver_id)` | any driver's available payout balance | returned a row for a foreign driver (0 — no earnings seeded; structurally cross-driver) |
  | `cashback_balance(p_customer)` | any customer's cashback | returned a value for a foreign customer (0 — none seeded) |
  | `recently_ordered(p_customer)` | suspected: a customer's recent products | 0 with no items seeded — same pattern, unconfirmed |
- **Reproduction:** authenticated (or anon) → `rpc('loyalty_balance', {p_customer_id: <victim>})`
  / `rpc('order_tracking', {p_order_id: <victim order>})` / `rpc('reorder_items', {p_order_id:
  <victim order>})`.
- **Impact:** cross-account disclosure of financial balances (loyalty, cashback, driver payout),
  a customer's delivery **destination coordinates**, **driver phone** + live location, and order
  contents. No data is modified; no money moves.
- **Likelihood:** Medium — object ids are 128-bit UUIDs (not enumerable), but they routinely
  appear in the app, URLs, tracking links, referrers, and logs; `order_tracking` even returns the
  `driver_id`, and several of these RPCs are anon-reachable.
- **Business risk:** Medium — privacy/PDPL exposure (customer location, driver PII), competitive
  intelligence (order contents, balances). Not financial-manipulation, escalation, tenant, wallet,
  or payment.
- **Note on `order_tracking`:** if a *shareable tracking link* (UUID-as-capability) is the intended
  design, by-UUID access to status/ETA/map may be acceptable — but exposing the **driver's phone**
  and the customer's exact **destination** to anyone with the id is over-exposure regardless. The
  private `reorder_items`, `loyalty_balance`, `cashback_balance`, and `driver_wallet_summary`
  functions have no such justification.
- **Recommended fix (next sprint — do NOT fix in this read-only cert):** add an ownership guard to
  each (`p_* = auth.uid()` / caller-owns-driver, or ops), and for order-scoped ones require the
  order belong to `auth.uid()`; minimize `order_tracking`'s payload (drop driver phone; gate to
  the order's customer or a signed tracking token). Then re-run this battery.

---

## Part 3 — Coverage assessed with no additional finding

Authentication/OTP/JWT (GoTrue-managed, signature-verified; identity/tenant/admin DB-derived) ·
Authorization/RBAC (`assign_user_role`/`revoke_user_role` admin-gated; `admin_users` not
client-writable) · Privilege escalation (blocked) · **Write-side** IDOR/BOLA on
orders/wallets/addresses (isolated; C-1/C-2/C-3 closed) · Wallet/Settlement (adjust/credit/payout
RPCs revoked or ops-gated; direct write blocked) · Referral (N-2 closed; server-fixed rewards;
qualify service-only) · Coupons/Checkout (server-authoritative) · Payments (order money immutable;
payment INSERT scoped; refund ops/service-only) · Dispatch/Drivers (RT/F/C closed) ·
Merchants/Inventory (ownership-enforced; F-3 closed) · CMS/Website Builder (tenant-scoped) ·
Storage/Buckets (own-folder/admin; kyc private; non-listable) · RLS (0 disabled tables) ·
Edge Functions (none deployed) · Queues/Email/SMS/Push (no provider integration present —
`send_message_campaign` is admin-gated and delivery is a no-op) · Analytics/Audit Logs (writes are
self-attributed via `auth.uid()`; `g_audit`/`log_approval`/`track_banner` allow self-attributed
noise only — Low, not part of the FAIL) · Race/Replay/Double-spend (idempotency + unique + locks).

**Latent Low (not part of the FAIL, but track):** `add_ticket_message` writes to a ticket by id
without ownership (UUID-gated); `report_review`/`track_banner`/`g_audit`/`log_approval` allow
self-attributed analytics/audit noise.

---

## Decision
🔴 **FAIL** — a Medium BOLA (RC-1) is reproducible on the release candidate. All 24 prior
findings remain closed and no Critical/High/financial/escalation/tenant/wallet/payment exploit
exists, but the RC PASS bar admits **no Medium**. Remediate RC-1 (ownership guards on the read
RPCs + `order_tracking` minimization) and re-certify. See `RELEASE_CANDIDATE_SECURITY_SCORECARD.md`.
