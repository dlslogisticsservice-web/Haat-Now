# DEPLOYMENT_PLAN.md — HAAT NOW

Deployment planning only — no code/DB changes. Stack: **Vite 6 + React 19 SPA** → static build. Supabase backend `umwbzradvbsirsybfxfb` (haat-now-dev) is live and verified.

## 1. Deployment readiness
| Item | State |
|---|---|
| Build command | `npm run build` (`vite build`) ✅ |
| Output directory | **`dist`** (Vite default; no custom `outDir`) ✅ |
| Build verified | `tsc` clean, `npm run build` exit 0 ✅ |
| Sandbox in prod | stripped (`import.meta.env.DEV=false` + `.env.production` `VITE_AUTH_MODE=supabase`) ✅ proven 0/6 |
| Committed deploy config | **none** (no `vercel.json`/`netlify.toml`/`wrangler.toml`) — target not yet chosen |
| SPA routing | state-based (no URL router); add catch-all rewrite for safety/404 |
| `package.json` name | `react-example` (scaffold default — cosmetic, optional rename) |

## 2. Deployment target — detected: **none committed**
Any static host fits a Vite SPA. **Recommended: Vercel** (best Vite DX). Netlify / Cloudflare Pages are equivalent — pick one:

**Vercel** (`vercel.json`):
```json
{ "buildCommand": "npm run build", "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
**Netlify** (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
**Cloudflare Pages**: Build command `npm run build` · Output dir `dist` · add `public/_redirects` → `/*  /index.html  200`.

> Set environment variables in the platform dashboard (NOT in committed files — `.env*` is gitignored). Platform env overrides `.env.production` at build time.

## 3. Required environment variables
### Build-time (frontend, `VITE_` — must exist at build on the platform)
| Var | Value | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://umwbzradvbsirsybfxfb.supabase.co` | ✅ |
| `VITE_SUPABASE_ANON_KEY` | project anon/publishable key | ✅ |
| `VITE_AUTH_MODE` | **`supabase`** | ✅ (critical — keeps sandbox off) |
| `VITE_GOOGLE_MAPS_API_KEY` | Maps JS API key (HTTP-referrer restricted to prod domain) | ⚠️ for interactive maps (graceful fallback if absent) |
| `VITE_STRIPE_PUBLIC_KEY` / `VITE_PAYMOB_PUBLIC_KEY` / `VITE_MADA_PUBLIC_KEY` | gateway **publishable** keys | ⚠️ for card checkout |
| `VITE_APPLE_PAY_MERCHANT_ID` / `VITE_GOOGLE_PAY_MERCHANT_ID` | wallet pay ids | optional |

### Server-side (Supabase **Edge Function** secrets — never in the frontend bundle)
`PAYMENT_MODE=production`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, `PAYMOB_MERCHANT_ID`, `PAYMOB_WEBHOOK_SECRET`, `MADA_SECRET_KEY`, `MADA_WEBHOOK_SECRET`, `APPLE_PAY_MERCHANT_*`, `GOOGLE_PAY_MERCHANT_ID` → set via `supabase secrets set …` for the payment edge functions.

## 4. Supabase production configuration
| Setting | Current | Action |
|---|---|---|
| Migrations | `0000–0022` applied + recorded ✅ | none |
| RLS / admin scoping / RPCs | live-verified ✅ | none |
| Phone provider | enabled, **Test OTP** | replace with real Twilio (see §7) |
| Auth users / RBAC | 6 users provisioned ✅ | optionally add real operator accounts |
| `site_url` | `http://localhost:3000` | **update to prod domain** (§5) |
| `uri_allow_list` | empty | add prod domain (+ any preview URLs) |
| Edge function secrets | unset | set payment secrets (§3 server-side) |

## 5. site_url update plan
After the prod domain is known (e.g. `https://app.haatnow.com`):
- Dashboard → Authentication → URL Configuration → set **Site URL** = prod domain; add it (and any preview domains) to **Redirect URLs** (`uri_allow_list`).
- Or via Management API (read/PATCH `config/auth`): `{ "site_url": "https://app.haatnow.com", "uri_allow_list": "https://app.haatnow.com,https://*.vercel.app" }`.
- Phone OTP login doesn't use redirects, but email/recovery/OAuth flows do — required before enabling those.

## 6. Google Maps key requirements
- Create a **Maps JavaScript API** key (Google Cloud), enable Maps JS API; restrict by **HTTP referrer** to the prod domain.
- Set `VITE_GOOGLE_MAPS_API_KEY` in the platform build env. Used by `LocationPicker` + order tracking; absent → graceful static fallback (no hard failure).

## 7. Payment gateway requirements
- Choose provider(s): **Paymob** (EG/MENA), **Stripe** (cards), **mada** (SA). The `payment.service` already models all.
- Frontend: set the `VITE_*_PUBLIC_KEY` build vars.
- Server: set the secret keys + webhook secrets as Supabase **Edge Function secrets**; set `PAYMENT_MODE=production`; configure each provider's **webhook → Supabase function** (the repo already has `webhook_events`/`payment_attempts`/`refunds` schema).
- Until configured, ship **Cash-on-Delivery only** (the COD path is complete).

## 8. SMS provider requirements
- Current: **Test OTP** (`123456`) — dev convenience, **not for public launch**.
- Production: Supabase Auth → Providers → Phone → configure **Twilio** (Account SID, Auth Token, Message Service SID / sender). Remove `sms_test_otp` test numbers.
- Verify rate limits (`rate_limit_otp`, `rate_limit_sms_sent` currently 30/h) suit expected volume.

## Deployment sequence (summary)
1. Pick host + commit its config (§2). 2. Set all `VITE_` build vars (§3) incl. `VITE_AUTH_MODE=supabase`. 3. Set Supabase Edge secrets for payments (§3/§7). 4. Update Supabase `site_url`/redirects (§5). 5. Configure Twilio (§8) + Maps key (§6). 6. Deploy → run `E2E_TEST_PLAN.md`. 7. Work `LAUNCH_CHECKLIST.md`.
