# DATA_AUDIT.md

## Live catalog counts (anon REST, `Prefer: count=exact`)
| Table | Count | Loads via API |
|---|---|---|
| merchants | 5 | ✅ 200 |
| merchant_branches | 5 | ✅ 200 |
| products | 21 | ✅ 200 |
| product_variants | 12 | ✅ 200 |
| offers | 4 | ✅ 200 |
| banners | 3 | ✅ 200 |
| zones | 3 | ✅ 200 |
| categories | 5 | ✅ 200 |

`countries` = 1, `cities` = 1, `coupons` = 3 (existence confirmed; `countries`/`cities` are anon-blocked at the table-GRANT level — the app uses the local `countries.ts` config, so the homepage is unaffected).

## Loading / API responses
- Public catalog tables return **HTTP 200** to anon with RLS public-read; the HomeScreen `merchant_branches` (with `merchants`+`zones` embeds) and `offers` queries return real rows.
- **No empty homepage:** runtime screenshot `screenshots/UX_02_home.png` shows the 5 real branches + 4 offers + 3 banner imagery + 8 categories rendering. Restaurant menu loads 4 products/branch.

## Status: ✅ data present, loads correctly, homepage populated
Minor: `countries`/`cities` not granted to anon (DB-side; non-blocking for the app).
