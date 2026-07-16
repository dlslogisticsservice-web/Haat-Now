# Launch Guardian — Database Design

Target: Supabase `umwbzradvbsirsybfxfb`, schema `public`, prefix **`guardian_`** (no collision with
the 143 existing tables). Design doc — migrations are authored in the implementation phase and must
follow the house rules already proven: **additive, idempotent (`IF NOT EXISTS`), RLS-on, no
expression inside a `UNIQUE` constraint** (that exact bug bit `website_feature_flags`).

---

## 1. Table map

| Table | Grain | Retention |
|---|---|---|
| `guardian_services` | one row per monitored service/subsystem | permanent |
| `guardian_checks` | one row per check definition | permanent |
| `guardian_check_status` | current status per check (1 row/check) | permanent (mutable) |
| `guardian_signals` | raw datapoint (append-only, high volume) | **14 days** |
| `guardian_rollups_1m` | per check/minute aggregate | 90 days |
| `guardian_rollups_1h` | per check/hour aggregate | 13 months |
| `guardian_incidents` | the human work unit | permanent |
| `guardian_incident_events` | incident timeline | permanent |
| `guardian_analyses` | AI RCA output | permanent |
| `guardian_artifacts` | generated artifacts (immutable, versioned) | permanent |
| `guardian_test_runs` | QA suite executions | 180 days |
| `guardian_test_results` | per-test outcome | 90 days |
| `guardian_releases` | deploy records | permanent |
| `guardian_approvals` | human approvals (tamper-evident) | permanent |
| `guardian_alert_rules` | routing/escalation config | permanent |
| `guardian_notifications` | alert deliveries | 180 days |
| `guardian_silences` | maintenance windows / mutes | 90 days |
| `guardian_slos` | objective + error budget per service | permanent |
| `guardian_ingest_dedup` | idempotency keys | 7 days |

---

## 2. Core tables (column specs)

### `guardian_services`
| col | type | notes |
|---|---|---|
| `key` | text **PK** | `web.public`, `db`, `payments`, `biz.finance` |
| `name` | text | display |
| `plane` | text | `health` \| `infra` \| `business` |
| `owner_role` | text | maps to dashboard + on-call (`engineering`, `finance`, …) |
| `tier` | int | 1 = revenue-critical … 3 = cosmetic (drives severity) |
| `enabled` | bool | default true |

### `guardian_checks`
| col | type | notes |
|---|---|---|
| `key` | text **PK** | `web.public.home`, `biz.ledger.balanced` |
| `service_key` | text FK→services | |
| `probe` | text | `http`\|`tls`\|`dns`\|`rpc`\|`sql`\|`sdk`\|`synthetic`\|`webhook`\|`vendor_status` |
| `config` | jsonb | url/query/expectation — **never secrets** |
| `interval_s` | int | 30 / 60 / 300 / 900 / 3600 |
| `thresholds` | jsonb | `{yellow, red, comparator, min_samples, hysteresis}` |
| `severity_floor` | text | invariants pin to `critical` |
| `mode_scope` | text | `any`\|`live_only`\|`sandbox_only` (demo honesty) |
| `enabled` | bool | |

### `guardian_check_status` (current state; 1 row per check)
| col | type | notes |
|---|---|---|
| `check_key` | text **PK** FK | |
| `status` | text | `green`\|`yellow`\|`red`\|`unknown` |
| `since` | timestamptz | transition time (drives MTTR) |
| `last_value` | numeric | |
| `last_ok_at` / `last_error` | timestamptz / text | |
| `streak` | int | consecutive same-status samples (hysteresis) |
| `stale_after` | timestamptz | if now() > this ⇒ render **stale**, not green |

### `guardian_signals` (append-only, the firehose)
| col | type | notes |
|---|---|---|
| `id` | bigint identity **PK** | |
| `at` | timestamptz | **partition/index key** |
| `kind` | text | `metric`\|`event`\|`log`\|`probe`\|`test`\|`webhook` |
| `check_key` | text NULL | when probe-originated |
| `service_key` | text NULL | |
| `level` | text | `info`\|`warn`\|`error`\|`fatal` |
| `message` | text | **scrubbed** |
| `value` | numeric NULL | latency/count |
| `fingerprint` | text | `hash(kind, service, normalized_message\|check)` |
| `release_sha` | text | grounds every signal to a build |
| `mode` | text | `sandbox`\|`live` |
| `meta` | jsonb | stack frames, route, vendor ids — scrubbed |
| `incident_id` | uuid NULL | set on correlation |

**Indexes:** `(at desc)`, `(fingerprint, at desc)`, `(check_key, at desc)`, `(incident_id)`,
`(release_sha, at desc)`. **Partition by month** on `at` (drop-partition = O(1) retention).

### `guardian_incidents`
| col | type | notes |
|---|---|---|
| `id` | uuid **PK** | |
| `fingerprint` | text | correlation key |
| `generation` | text | `release_sha` at first occurrence |
| `severity` | text | `sev1..sev4` |
| `status` | text | `open`\|`acked`\|`mitigated`\|`resolved`\|`suppressed` |
| `title` | text | |
| `service_keys` | text[] | blast radius |
| `impact` | jsonb | `{users_est, orders_est, revenue_est, confidence}` |
| `first_seen` / `last_seen` | timestamptz | |
| `occurrences` | int | |
| `owner_user_id` | uuid NULL | |
| `acked_by/at`, `resolved_by/at` | | MTTA / MTTR |
| `root_cause_id` | uuid NULL FK→analyses | |

**Unique:** one open incident per `(fingerprint, generation)` — enforced by a **partial unique
index** `WHERE status IN ('open','acked','mitigated')` (not a UNIQUE constraint — expression/partial
must be an index).

### `guardian_analyses` (AI RCA)
| col | type |
|---|---|
| `id` uuid PK · `incident_id` uuid FK · `model` text · `prompt_version` text |
| `probable_cause` text · `affected_services` text[] · `recommended_fix` text |
| `confidence` numeric(3,2) `CHECK 0..1` · `evidence` jsonb (signal ids, commits, checks) |
| `input_tokens`/`output_tokens`/`cost_usd` · `created_at` |

### `guardian_artifacts` (immutable, versioned)
| col | type |
|---|---|
| `id` uuid PK · `incident_id` uuid · `analysis_id` uuid |
| `type` text — `developer_report`\|`technical_analysis`\|`git_diff`\|`claude_prompt`\|`codex_prompt`\|`regression_checklist`\|`validation_checklist`\|`deployment_checklist`\|`rollback_checklist` |
| `version` int · `body` text · `format` text (`md`\|`diff`\|`json`) · `created_at` |
| **Unique:** `(incident_id, type, version)` · **never updated** — regenerate ⇒ version+1 |

### `guardian_releases`
| col | type |
|---|---|
| `id` uuid PK · `sha` text · `short_sha` text · `env` text · `provider` text (`vercel`) |
| `state` text — `building`\|`preview`\|`canary`\|`promoted`\|`rolled_back`\|`failed` |
| `preview_url` · `promoted_at` · `rolled_back_at` · `previous_sha` (rollback target) |
| `readiness` jsonb (gate results) · `qa_run_ids` uuid[] |

### `guardian_approvals` (tamper-evident)
| col | type |
|---|---|
| `id` uuid PK · `subject_type` text (`release`\|`artifact`\|`silence`) · `subject_id` uuid |
| `decision` text (`approved`\|`rejected`) · `actor_user_id` uuid · `reason` text · `at` timestamptz |
| dual-written to `audit_logs` |

### `guardian_alert_rules` / `guardian_notifications` / `guardian_silences`
Rules: `match` jsonb (severity/service/plane/check), `channels` text[], `escalation` jsonb
(steps + delays), `throttle_s`, `enabled`.
Notifications: `incident_id`, `channel`, `target`, `state` (`queued|sent|failed|acked`), `attempts`,
`provider_id`, `sent_at` — **unique `(incident_id, channel, target, escalation_step)`** so a page is
never duplicated.
Silences: `match` jsonb, `starts_at`/`ends_at`, `reason`, `created_by`.

### `guardian_slos`
`service_key` · `objective` numeric (e.g. 99.9) · `window_days` int · `budget_consumed` numeric ·
`burn_rate` numeric — drives "are we allowed to ship?" in the Release Center.

---

## 3. Rollups & retention

```
guardian_signals (14d, monthly partitions)
   │  pg_cron: every 1 min
   ├─► guardian_rollups_1m  (count, sum, avg, p50, p95, p99, err_count)  90d
   │      │ pg_cron: hourly
   │      └─► guardian_rollups_1h                                        13mo
   └─► pg_cron nightly: DROP old partition   ← O(1), no bulk DELETE
```
Dashboards read **rollups**, never the firehose. Incident evidence reads raw within 14d.

---

## 4. RLS policy model

Every `guardian_*` table: **RLS enabled**, no `USING (true)`.

| Operation | Policy |
|---|---|
| SELECT | `to authenticated using (public.auth_has_permission('guardian.view'))` |
| INSERT (signals/rollups/notifications) | **service_role only** (the ingest/probe/alert functions). No client insert. |
| UPDATE incidents (ack/resolve) | `auth_has_permission('guardian.incident.ack' \| '.resolve')` |
| INSERT approvals | `auth_has_permission('guardian.release.approve')`, `actor_user_id = auth.uid()` enforced |
| INSERT silences | `auth_has_permission('guardian.silence')` |
| artifacts/analyses | SELECT by `guardian.view`; INSERT service_role only (AI function) |

New permission keys are seeded into the **existing** `role_permissions` catalog (42 rows today) and
resolve through `auth_has_permission()` — no parallel RBAC.

---

## 5. RPCs (server-side contracts)

| RPC | Purpose | Guard |
|---|---|---|
| `guardian_ingest(batch jsonb)` | single write path; validate, scrub, fingerprint, dedup, persist | service_role |
| `guardian_correlate(signal_id)` | attach to open incident or open a new one | service_role |
| `guardian_ack_incident(id, note)` | ack + timeline + audit | `guardian.incident.ack` |
| `guardian_resolve_incident(id, note)` | resolve + MTTR | `guardian.incident.resolve` |
| `guardian_health_snapshot()` | one round-trip for the health grid | `guardian.view` |
| `guardian_dashboard(role)` | pre-shaped widget payload per role | `guardian.view` |
| `guardian_record_release(payload)` | webhook → release row | service_role |
| `guardian_approve(subject_type, id, decision, reason)` | approval + audit | `guardian.release.approve` |
| `guardian_prune()` | retention (partitions + rollups) | cron |

All are `SECURITY DEFINER` + `SET search_path=public` with an **internal permission check** — the
pattern already used by `pay_*_settlement` / `issue_compensation`, and `REVOKE`d from `anon`/`public`.

---

## 6. Idempotency & integrity

- **Ingest dedup:** `guardian_ingest_dedup(key text PK, at)` — same pattern as `webhook_events`
  (already proven for payments). Replayed webhook ⇒ no duplicate signal.
- **One open incident per fingerprint/generation** — partial unique index.
- **Artifacts immutable** — unique `(incident_id, type, version)`; no UPDATE grant.
- **Notifications never double-paged** — unique `(incident_id, channel, target, escalation_step)`.
- **Approvals append-only** — no UPDATE/DELETE grant to any role.

---

## 7. Capacity estimate (sizing the firehose)

| Source | Rate (est.) | 14d raw |
|---|---|---|
| edge probes (~40 checks avg 60s) | ~58k/day | ~800k rows |
| in-app errors/vitals (sampled 10%) | ~20k/day | ~280k rows |
| QA runs | ~2k/day | ~28k rows |
| webhooks | ~200/day | ~3k rows |
| **total** | **~80k/day** | **~1.1M rows** ≈ low hundreds of MB with monthly partitions |

Comfortably inside Supabase Postgres. Growth is bounded by sampling + partition drop, not by hope.

---

## 8. Migration plan (implementation phase)

1. `guardian_foundation` — services, checks, check_status, signals (+partitions), dedup, RLS, perms.
2. `guardian_rollups` — rollup tables + `pg_cron` jobs (**requires `pg_cron`+`pg_net`**).
3. `guardian_incidents` — incidents, events, partial unique index.
4. `guardian_ai` — analyses, artifacts.
5. `guardian_qa` — test_runs, test_results.
6. `guardian_release` — releases, approvals.
7. `guardian_alerting` — rules, notifications, silences, slos.

Each: additive, `IF NOT EXISTS`, RLS-on, verified with `get_advisors(security)` = 0 critical.
