# Release-Candidate Implementation Plan (Demo Backend)

Goal: bring the platform to Tier-1 RC quality on the **current demo/sandbox backend** (no real Supabase
yet). Auth fixes already deployed and **frozen** — do not modify auth logic. Migration paused.

## Milestone 4 — Full demo lifecycle  ✅ VERIFIED WORKING (1 small gap)
Customer order → merchant accept → driver accept → pickup → delivery → wallet credit — all confirmed via a
role-switching run (`docs/testing/e2e_shots/rclife/`). Remaining:
- [ ] **M4.1** Customer post-delivery view shows `delivered` + enables rating (probe `s5` was false).
- [ ] **M4.2** Confirm admin **analytics + live map** reflect the delivered order in real time.
- [ ] **M4.3** Surface the **dispatcher auto-assign** path (OCC batch dispatch) as an explicit lifecycle option
      alongside driver self-pick.

## Milestone 1 — Customer App → Tier-1
- [ ] **M1.1** Per-restaurant **varied menus** (current sandbox menu is identical for every restaurant). *(in progress)*
- [ ] **M1.2** Order tracking screen: live status timeline + map for the active order.
- [ ] **M1.3** Ratings flow after delivery; reorder from history.
- [ ] **M1.4** Polish: skeletons, empty/error states, spacing parity with Talabat/HungerStation.

## Milestone 2 — Merchant Portal → Tier-1
- [ ] **M2.1** Kitchen-queue board (accept → preparing → ready) with prep timers.
- [ ] **M2.2** Per-order timeline component.
- [ ] **M2.3** Inventory cards redesign + low-stock auto-disable surfacing.
- [ ] **M2.4** Reports already shipped (sales/peak/customers/status) — verify on live demo data.

## Milestone 3 — Operations Control Center
- [ ] **M3.1** Live map already SVG-simulated + sandbox-aware — verify driver/order/merchant overlays from
      seeded data update as orders progress.
- [ ] **M3.2** Dispatch monitor + batch auto-dispatch wired to the demo store.
- [ ] **M3.3** Zone analytics + SLA/incident panels populated from demo data.

## Cross-cutting (RC gates)
- Typecheck/Lint 0 · Build · E2E 24/24 · unfiltered 0 console errors · mobile + desktop.
- Git workflow: feature → CI → `merge --no-ff` → main → verify production.

## Sequence
M4.1/M4.2 (close the lifecycle) → M1.1 (menu variety) → M2.1 (kitchen queue) → M1.2 (tracking) →
M3.1 (ops overlays) → remaining polish. Each shipped + verified before the next.
