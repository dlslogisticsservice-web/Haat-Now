# VERCEL_ENV_SETUP.md — HAAT NOW

Every environment variable for production. Set **frontend `VITE_` vars in Vercel** (Project → Settings → Environment Variables, **Production** scope). Set **server-side payment secrets in Supabase** (Edge Function secrets), never in Vercel/frontend.

`.env*` is gitignored, so Vercel must hold these at build time. Vercel inlines `VITE_` vars into the bundle at build.

## A. Vercel — frontend build vars (Production)
| Variable | Value | Required | Purpose |
|---|---|---|---|
| `VITE_AUTH_MODE` | `supabase` | ✅ **critical** | Disables sandbox/demo OTP in prod |
| `VITE_SUPABASE_URL` | `https://umwbzradvbsirsybfxfb.supabase.co` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_R8uXSgCyxFK-TpZsFMnIrg_Mkm-MGOD` | ✅ | Publishable anon key (public) |
| `VITE_GOOGLE_MAPS_API_KEY` | _your Maps JS key_ | ⚠️ recommended | Interactive map; absent → static fallback |
| `VITE_STRIPE_PUBLIC_KEY` | _pk_live_…_ | ⚠️ if cards | Stripe publishable |
| `VITE_PAYMOB_PUBLIC_KEY` | _…_ | ⚠️ if cards | Paymob public |
| `VITE_MADA_PUBLIC_KEY` | _…_ | ⚠️ if cards | mada public |
| `VITE_APPLE_PAY_MERCHANT_ID` | _merchant.com.…_ | optional | Apple Pay |
| `VITE_GOOGLE_PAY_MERCHANT_ID` | _…_ | optional | Google Pay |

> Minimum to deploy a **COD soft-launch**: the first three (`VITE_AUTH_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Add Maps + payment keys when enabling those features.

## B. Supabase — Edge Function secrets (server-side payments)
Set with `supabase secrets set KEY=value` (or Dashboard → Edge Functions → Secrets). **Never** put these in Vercel/frontend.
```
PAYMENT_MODE=production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYMOB_API_KEY=...
PAYMOB_INTEGRATION_ID=...
PAYMOB_IFRAME_ID=...
PAYMOB_MERCHANT_ID=...
PAYMOB_WEBHOOK_SECRET=...
MADA_SECRET_KEY=...
MADA_WEBHOOK_SECRET=...
APPLE_PAY_MERCHANT_ID=...
APPLE_PAY_MERCHANT_DOMAIN=...
APPLE_PAY_MERCHANT_CERTIFICATE=...
GOOGLE_PAY_MERCHANT_ID=...
```
(Only the providers you actually enable are required.)

## C. Scope & hygiene
- Set vars for **Production** (and Preview, if you want preview deploys to hit Supabase — they will share the same DB; consider a separate project for true staging).
- After changing any `VITE_` var, **redeploy** (they're build-time inlined).
- Do **not** commit real secret values; keep `.env*` gitignored (already is).
- The publishable anon key is safe to expose; the **service-role key and payment secret keys must never** reach the frontend/Vercel.

## D. Verification after setting
- Vercel build log shows the build succeeded.
- In the deployed app, demo `123456` is rejected for a non-provisioned phone (proves `VITE_AUTH_MODE=supabase` took effect).
