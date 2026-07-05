# Feature Gap Analysis
**HaaT Now — Phase 7 (companion to FEATURE_COMPLETENESS_MATRIX.md)**
Date: 2026-07-05. Per-module **missing features, limitations, technical debt, blocking issues, priority.** Measured from code.

## Cross-cutting gaps (affect most modules)
| Gap | Impact | Priority | Owner phase |
|---|---|---|---|
| **No per-tenant data isolation** (foundation only) | Every data module capped at "not multi-tenant"; cannot onboard a 2nd real tenant | **Critical** | Multi-tenancy Stage B/C |
| **Ships in sandbox/demo mode** (localStorage; no live backend) | "Production Ready %" gap vs demo; live path never exercised in the shipped artifact | **Critical** | Cutover |
| **In-product apps single global brand** (H4) | White-label incomplete for customer/merchant/driver/admin | High | Multi-tenancy Stage B |
| **Website/design content localStorage-only** | Publishing not durable/shared | **Critical** | Cutover + server persistence |
| **Delivery integrations unwired** (push FCM/APNs, transactional email) | Notifications/marketing can't reach users off-app | High | Integrations |
| **Two i18n systems** (inline `L()` vs react-i18next) | Localization un-extractable/un-auditable at scale | Medium | Code-quality R3 |

## Per-module missing features
| Module | Missing / limitation | Debt | Priority |
|---|---|---|---|
| Authentication | Live SMS provider not wired; fine-grained RBAC client-side only | sandbox OTP `123456` | Critical |
| Payments | Multi-provider (Stripe/Paymob/Mada/Apple/Google Pay) are catalog placeholders; `payment_idempotency` unapplied live; single live provider (Moyasar) | webhook secret must be set (fail-closed already) | Critical |
| Fleet | No real `fleet_vehicles` table; fleet CRUD writes localStorage; duplicate `vehicles` schema | Phase-1 DB3 | Medium |
| Finance | RLS coverage on some money tables unverified; no external accounting export pipeline live | Phase-1 DB7 | High |
| Billing | Actual charging/dunning/invoicing **not implemented** (subscription model exists, billing engine doesn't); no PDF invoices | — | High (if in scope) |
| Notifications | Push (FCM/APNs) + email delivery not wired; unbranded; per-tenant branding pending | — | High |
| Marketing/Campaigns | No delivery channel; segmentation basic | — | Medium |
| Growth | Duplicate A/B engines + consoles | audit D1 | Medium |
| White Label | In-product per-tenant theming; emails/PDF/invoices absent (asset slots are placeholders) | H4 | High |
| CMS/Website | Server persistence; custom-domain DNS/SSL (external); public site not code-split | Phase-1 C4, perf P2 | High |
| Platform Registry | Production Supabase path is a documented seam (localStorage default) | — | Medium |
| Integrations | Twilio/WhatsApp/email/etc. are config entries, not wired | — | Medium |
| Analytics/Reports | No GA/measurement wiring; no scheduled report export | — | Medium |
| AI | Entire module unimplemented (dep removed) | — | Low (out of launch scope?) |
| Storage | Live-gated; no CDN/image-resize pipeline | — | Medium |
| RBAC | Fine-grained perms not mirrored in RLS (UI-only gating) | audit S3 | High |
| Compliance/KYC | Document verification is manual; no automated identity checks | — | Medium |
| Subscriptions | Usage metering present; enforcement + billing linkage partial | — | Medium |
| 23 low-traffic services | Still call Supabase directly (not behind repositories) | Phase-2 backlog | Low |
| 6 oversized components | God objects (maintainability) | Phase-2 backlog | Low |

## Known limitations (by design, documented)
- The shipped build is **sandbox-forced** (`vite.config.ts`) — a deliberate self-contained demo; live requires `HAAT_LIVE_BACKEND=1`.
- Realtime/edge/payments/storage are **live-gated** — inactive in the demo.
- Country-level admin scoping stands in for tenant isolation until Multi-tenancy Stage C.

## What is NOT a gap (verified complete)
Orders, Wallet (atomic RPC), Coupons (validate RPC), Loyalty (RPCs), Inventory (adjust RPC), Catalog, Website visual builder + runtime + versioning, Theme engine, Zones/Countries/Branches geo, System Logs (audit + RLS), Localization (bilingual + RTL), CI/CD (guard + E2E + Deno check), Security code hygiene (no client secrets, HMAC webhooks, gated dev hooks, 0 XSS).

## Priority rollup
- **Critical (launch-gating):** multi-tenancy Stage B/C, live cutover (auth/SMS/payments secrets), website server persistence.
- **High:** in-product white-label (H4), notification delivery, RBAC-in-RLS, finance RLS verification, billing engine (if in scope).
- **Medium:** fleet_vehicles, integrations wiring, platform-registry backend, growth de-dup, analytics wiring.
- **Low:** remaining service→repo migration, god-object splits, AI, `as any` reduction.
