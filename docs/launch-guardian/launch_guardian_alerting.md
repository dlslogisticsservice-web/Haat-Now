# Launch Guardian — Alert Center

Goal: **the right human, once, with enough context to act — and silence when it doesn't matter.**
An alerting system that cries wolf is worse than none: it trains people to ignore SEV1.

---

## 1. Alert lifecycle

```
Incident opened/escalated
        │  match rules (severity · service · plane · check · mode)
        ▼
   Silenced? ──yes──► record suppressed, no page
        │no
        ▼
   Dedup/throttle (fingerprint + channel + step)
        ▼
   Route → step 0 targets ──► deliver (Slack/Email/SMS/Push/Webhook)
        │  no ack within `delay`
        ▼
   Escalate step 1 → step 2 … → fallback (whole on-call)
        │
        ▼
   Ack → escalation stops · Resolve → resolution notice to the same thread
```

---

## 2. Severity → response policy

| Sev | Definition | Channels | Ack SLA | Escalation |
|---|---|---|---|---|
| **SEV1** | money/data loss, or all users blocked | **SMS + Push + Slack + Email** | 5 min | 5m → secondary, 10m → eng lead, 20m → CTO/CEO |
| **SEV2** | segment blocked, or revenue-affecting degradation | Slack + Push + Email | 15 min | 15m → secondary, 30m → lead |
| **SEV3** | degraded, workaround exists | Slack + Email | 4 h | next business hour |
| **SEV4** | cosmetic / informational | Slack digest | — | none (daily digest) |

**Floors that cannot be lowered by AI or config:** any `biz.*` invariant breach
(`ledger.balanced`, `wallet.nonneg`, `affiliate.once`, `inventory.oversell`) is **SEV1**.
Guardian may *raise* severity; it may never lower an invariant floor.

---

## 3. Rule model (`guardian_alert_rules`)

| Field | Meaning |
|---|---|
| `match` | jsonb predicate: `{severity:[..], service_key:[..], plane:.., check_key:.., mode:'live'}` |
| `channels` | ordered `['slack','sms',...]` |
| `escalation` | `[{after_s:300, targets:[...]}, {after_s:600, targets:[...]}]` |
| `throttle_s` | min seconds between pages for the same fingerprint |
| `group_window_s` | batch related incidents into one message |
| `active_hours` | e.g. SEV3 business-hours only |
| `enabled` | |

Evaluation: **first matching rule by specificity** (check > service > plane > severity), then
channel fan-out. Rules are data — changing routing is not a deploy.

---

## 4. Deduplication & storm control

| Control | Rule |
|---|---|
| Fingerprint dedup | one page per `(fingerprint, generation)` regardless of occurrence count |
| Delivery uniqueness | DB unique `(incident_id, channel, target, escalation_step)` — **structurally impossible to double-page** |
| Throttle | subsequent pages for the same fingerprint suppressed for `throttle_s` |
| Grouping | N incidents in `group_window_s` on one service ⇒ one "service degraded (N issues)" message |
| Flap damping | status must hold `hysteresis` samples before alerting |
| Dependency suppression | if `db` is red, suppress its dependents (`orders`, `payments`…) and page **the cause**, not the symptoms — topology from `guardian_services` |
| Deploy correlation | incidents within 10 min of a deploy are tagged `post-deploy` and routed to the deployer first |

> Dependency suppression is what separates a real alerting system from a noise machine: one
> Supabase outage should be **one** page, not seventeen.

---

## 5. Channels (adapters)

| Channel | Transport | Use | Notes |
|---|---|---|---|
| **Slack** | Incoming webhook (secret in Edge Function) | primary team channel | rich block: sev, title, impact, evidence link, Ack button (deep-link) |
| **Email** | product's transactional provider (once configured) | records, digests | reuses the provider being provisioned for the product |
| **SMS** | product's SMS provider (Supabase Auth provider account) | **SEV1 only** — cost + fatigue | one message, link to incident |
| **Push** | FCM/APNs (once implemented) | on-call mobile | reuses `push_tokens` + `NotificationCenter` |
| **Webhook** | signed POST | PagerDuty/Opsgenie/custom bridge | lets the org adopt a pager later without re-architecting |

All adapters share one contract: `deliver(notification) → {provider_id, state}`; failures retry with
backoff and are recorded in `guardian_notifications` (never silently dropped).

---

## 6. On-call & escalation

- **Rotation** stored as data (primary/secondary per role: engineering, ops, finance).
- **Ownership routing:** a check declares `owner_role` → incidents route to that rotation
  (finance invariants page Finance, dispatch failures page Ops) instead of "everyone".
- **Ack** = one click (Slack button or Incident console) → writes `acked_by/at`, stops escalation,
  starts MTTR clock.
- **Handoff:** unacked at final step ⇒ broadcast to the full on-call channel + CEO for SEV1.
- **Escalation is time-based, not retry-based** — re-sending the same message is not escalation.

---

## 7. Silences & maintenance windows

`guardian_silences`: `match` + `starts_at`/`ends_at` + **mandatory `reason`** + `created_by`.
- Used for planned cutovers (e.g. the production cutover window), vendor maintenance, known noise.
- **Silences are audited and time-boxed** — no permanent silence; max 7 days, then re-justify.
- A silenced incident is still **recorded** (status `suppressed`) so post-incident review sees it.
- SEV1 invariant breaches **cannot** be silenced by a non-super-admin (`guardian.silence` +
  super_admin for tier-1 finance checks).

---

## 8. Alert content standard

Every page must contain, in this order:
1. **Severity + one-line impact** ("SEV1 · COD orders not reconciling — ~40 orders, ~SAR 3.2k at risk")
2. **Since** (first_seen) + occurrences
3. **Probable cause + confidence** (if RCA ready; otherwise "analysis pending")
4. **Deep link** to the incident (evidence, timeline, artifacts)
5. **Suggested first action** (from the Rollback/Validation checklist when post-deploy)

A page without an action is a notification, not an alert.

---

## 9. Quality metrics for the alerting system itself

| KPI | Target |
|---|---|
| False-positive rate | < 5% of pages |
| Pages per on-call shift | < 5 (else tune, don't endure) |
| MTTA (SEV1) | < 5 min |
| Ack-before-escalation rate | > 90% |
| Dependency-suppressed pages | tracked (proves noise reduction) |
| Silence usage | reviewed weekly; a recurring silence = a bug to fix |

Guardian alerts on **its own** health too: if ingest stalls, probes go stale, or the alert queue
backs up, that is an incident (`guardian.self.*`) — a monitoring system that can fail silently is
a liability.
