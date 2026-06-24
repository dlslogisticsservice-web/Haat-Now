# Push Notification Architecture (Task F)

**Date:** 2026-06-24 · Design only. Builds on the existing `push_tokens` table + in-app realtime.

## Transport options
| Provider | Role | Recommendation |
|---|---|---|
| **Firebase Cloud Messaging (FCM)** | Android + iOS(APNs via FCM) + Web push | **primary** — single token model |
| **OneSignal** | wraps FCM/APNs + segmentation/UI | optional later (faster campaigns; map to same `push_tokens`) |
| Apple APNs | iOS native | reached via FCM, no direct integration needed |

## Token lifecycle (client)
1. On login (per role), request permission (`@capacitor/push-notifications` native; web `Notification` API).
2. On `registration` event → upsert into **`push_tokens`** (`user_id`, `token`, `device_type`
   `ios|android|web`, `provider`, `updated_at`). The table + `notificationService.registerPushToken`
   already exist — wire the **real** call (today only a sandbox stub runs).
3. On logout → soft-delete / mark token inactive.

## Send path (server — new edge function `push-send`)
`supabase/functions/push-send`:
- Input: `{ user_ids[] | role | segment, type, title, body, data }`.
- Resolve `push_tokens` for recipients → POST to FCM HTTP v1 (`FCM_SERVICE_ACCOUNT` secret) /
  OneSignal REST.
- Idempotency key per (event, user) to avoid dupes; prune tokens FCM reports as unregistered.
- Triggered by DB events (pg_cron/trigger → function) or directly by services.

## Audience × event matrix
| Event | Customer | Merchant | Driver | Admin | Source |
|---|---|---|---|---|---|
| Order Created | — | ✅ | — | (dashboard) | order.service create |
| Order Accepted | ✅ | — | — | — | merchant accept |
| Driver Assigned | ✅ | ✅ | ✅ (offer) | — | dispatch `respond/auto` |
| Driver Arrived | ✅ | — | — | — | driver status update |
| Order Delivered | ✅ | ✅ | — | — | `complete_delivery` |
| Wallet Update | ✅ / ✅ / ✅ | by owner | by owner | — | wallet/payout/cashback |
| Promotion | ✅ (segment) | — | — | (compose) | E4 `message_campaigns` |

## Deep-link payload
Every push carries `data.url` (e.g. `https://haatnow.app/tracking/<id>`) → tap opens the right screen via
the deep-link router (Task E).

## Implementation steps (future, ~1.5 days)
1. Firebase project → `google-services.json` (Android) + APNs key (iOS) + `GoogleService-Info.plist`.
2. `npm i @capacitor/push-notifications`; wire real token registration on login per role.
3. Build `push-send` edge function + `FCM_SERVICE_ACCOUNT` secret.
4. Hook events (start with Order Accepted / Driver Assigned / Delivered) to the send path.
5. Web push (VAPID) reuses the same `push_tokens` + service worker.

## Current state
In-app realtime notifications work (post-E3 realtime publication). **Device push: not yet wired** (tokens
unused, no send function) — this doc is the production blueprint; no provider is integrated yet.
