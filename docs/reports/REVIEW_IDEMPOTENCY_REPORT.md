# Review Idempotency — Pre-E5B Hardening Report

**Date:** 2026-06-24 · Closes risk #3 from `E5A_FINAL_AUDIT.md` (duplicate reviews per (order,target)).
Migration `20260614000035_review_idempotency.sql` — applied live + recorded.

---

## 1. Unique constraint
```sql
alter table public.reviews
  add constraint reviews_order_target_uniq unique (order_id, target_type, target_id);
```
Added via a guarded `DO` block (idempotent re-run). Standard `UNIQUE` (NULLS DISTINCT) so any legacy
NULL-`target_id` rows never conflict.
**Live:** constraint `reviews_order_target_uniq` present on `public.reviews`. ✅

## 2. `submit_review` made idempotent
Rewritten as an **upsert** on the unique key — re-submitting the same (order, target) now **updates** the
existing review instead of erroring or inserting a duplicate:
```sql
insert into public.reviews(order_id, customer_id, target_type, target_id, rating, comment, status)
  values (p_order_id, auth.uid(), p_target_type, p_target_id, p_rating, p_comment, 'approved')
on conflict (order_id, target_type, target_id) do update
  set rating = excluded.rating, comment = excluded.comment, status = 'approved';
```
Still `SECURITY DEFINER`, still maintains the `drivers.rating` running average.

## 3. Existing-data verification (pre-apply)
| Check | Result |
|---|---|
| Total reviews | 1 |
| Rows with `target_id` / NULL `target_id` | 1 / 0 |
| Duplicate `(order_id, target_type, target_id)` groups (non-null) | **0** |
| Pre-existing unique constraints | only `reviews_pkey` |

→ No existing data violates the new constraint; the migration applied cleanly (HTTP 201).

## 4. Idempotency proof (live, cleaned up)
| Step | Result |
|---|---|
| 1st `submit_review(order, merchant, 3, 'ok')` | rating **3** |
| 2nd `submit_review(order, merchant, 5, 'great')` (same target) | rating **5** |
| Final state | **exactly 1 row**, rating **5**, comment **"great"** |

Re-submitting updates in place — no duplicate row. ✅

## 5–6. Build / Lint / E2E
- **Build:** ✅ passes
- **Lint:** ✅ clean
- **E2E:** ✅ 24/24 (no regression)

## Result
`reviews` now enforces one review per (order, target), and `submit_review` is idempotent (safe to call
repeatedly — e.g. a customer editing their rating, or a retry). Risk #3 from the final audit is closed.

**READY FOR E5B = YES** (unchanged) — this was the optional pre-E5B hardening; no blockers remain.
