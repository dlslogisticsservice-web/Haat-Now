# Phase E4 — Growth Engine — Completion Report

**Date:** 2026-06-24 · Growth features comparable to Talabat / HungerStation: referrals, cashback,
loyalty tiers, affiliates/influencers, and marketing (segments + multi-channel campaigns).
Applied live + verified. Commits: `e9b0d2c` (DB) · `0867dbc` (service) · `ec76dfd` (UI).

---

## What was delivered

### M1 — Database (`20260614000033_growth_engine.sql`, applied live + recorded)
**9 tables (all 6 required + 3 supporting):** `referral_codes`, `referrals` (referee unique),
`cashback` (unique per customer+order), `cashback_campaigns`, `loyalty_tiers` (seeded), `affiliates`,
`influencers`, `audience_segments`, `message_campaigns`. Plus `credit_customer_wallet` helper.

**11 SECURITY DEFINER RPCs:** `generate_referral_code`, `apply_referral_code` (guards self-referral /
duplicate / exhausted), `qualify_referral` (credits referee + referrer wallet; tallies affiliate/
influencer earnings), `award_cashback` (resolves active campaign, caps, **idempotent**, credits wallet),
`cashback_balance`, `resolve_loyalty_tier`, `create_affiliate` / `create_influencer` (auto-issue a
referral code), `estimate_segment`, `create_audience_segment`, `send_message_campaign`.

**Loyalty tiers seeded:** Bronze (0 pts, ×1.0) · Silver (500, ×1.25) · Gold (2000, ×1.5) · Platinum
(5000, ×2.0) — each with `perks` (free-delivery threshold, priority support, exclusive offers).

**RLS:** customers read own (codes/referrals/cashback); tier + cashback-campaign catalogs public-read;
affiliates/influencers/segments/campaigns admin-managed; writes via DEFINER RPCs.

### M2 — Service (`src/services/growth.service.ts`)
Customer (referral code, apply, my referrals, cashback balance, tier, tiers) + admin (cashback campaigns,
affiliates/influencers create+list, segment estimate/create/list, campaign create/send).

### M3 — UI — Growth Center (new "محرّك النمو" tab in OperationsCenter)
6 panels: **Cashback** (create/toggle campaigns), **Affiliates** (create + leaderboard: code/referred/
earned), **Influencers** (create + list), **Segments** (build with **live size estimate**), **Campaigns**
(create push/SMS/email + send to a segment), **Loyalty Tiers** (catalog).

## Feature coverage
| Feature | Status | Backing |
|---|---|---|
| Referral engine / codes / rewards | ✅ | `referral_codes`, `referrals`, apply/qualify RPCs, wallet credit |
| Cashback campaigns / wallet | ✅ | `cashback_campaigns`, `cashback`, `award_cashback`, `cashback_balance` |
| Loyalty tiers / membership levels | ✅ | `loyalty_tiers` (4 levels) + `resolve_loyalty_tier` |
| Affiliate tracking | ✅ | `affiliates` + auto code + earnings tally on conversion |
| Influencer tracking | ✅ | `influencers` + auto code + earnings tally |
| Audience segmentation | ✅ | `audience_segments` + `estimate_segment` (order-count/registration rules) |
| Push / SMS / Email campaigns | 🟡 | `message_campaigns` + send (recipients resolved) — **delivery needs provider** |
| Dynamic promotions | 🟡 | cashback + campaign rules engine; not a standalone promo-rules builder |

## Verification (live, cleaned up)
| Flow | Result |
|---|---|
| referral: apply + qualify | referee wallet **+10**, referrer wallet **+15** ✅ |
| cashback: 200 order @ 10% (cap 50) | **20**; balance 20; **idempotent** re-award (still 20, 1 row) ✅ |
| loyalty tier (0 pts) | **Bronze** ✅ |
| affiliate conversion | `total_referred` 1, `total_earned` **20** ✅ |
| audience segment | estimated_size **4** ✅ |
| message campaign send | **4 recipients** resolved ✅ |
| RLS / guards | self-referral, duplicate, exhausted-code all rejected ✅ |

Build ✅ · Lint ✅ · E2E 24/24 ✅ (no regression).

## Honest scope notes (not inflated)
- **Marketing campaign DELIVERY is not real.** `send_message_campaign` records the campaign and resolves
  the recipient count from the segment, but **no push/SMS/email is actually sent** — there is no FCM/APNs,
  Twilio, or email provider wired (consistent with prior audits). The UI says so explicitly. Real delivery
  needs provider integration + the device-push work from the mobile phase.
- **Referral qualification + cashback award are not auto-invoked on order completion yet** — `qualify_
  referral` and `award_cashback` are callable RPCs; hooking them into the order-complete path (or a
  trigger on `orders.status='delivered'`) is the fast-follow that makes referrals/cashback fire
  automatically. Today they're admin/integration-triggered.
- **Customer-facing referral/cashback UI** (a "refer a friend" card, cashback balance in the wallet, tier
  badge) is **not mounted** — the engine + service exist (`growthService.myReferralCode/cashbackBalance/
  myTier`); a profile/wallet entry is a small fast-follow.
- **Affiliate/influencer payouts** tally `total_earned` but are **not yet wired into the E2 settlement
  engine** — a generalize-payee step.
- **Segmentation rules** cover order-count + registration window; richer rules (geography, tier,
  recency/RFM) are extensible via the `definition` jsonb but not all surfaced in the UI.

## Result
A real growth engine is live: referrals with wallet rewards, cashback campaigns crediting the customer
wallet (idempotent), 4-tier loyalty, affiliate + influencer tracking with conversion earnings, audience
segmentation with live sizing, and multi-channel campaign management. The remaining work is **wiring**
(auto-trigger on order completion, customer-facing UI, real message delivery, affiliate payout into
settlements) — not core engine logic, which is built, balanced against the wallet, and verified live.
