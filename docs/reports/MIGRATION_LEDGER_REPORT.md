# MIGRATION_LEDGER_REPORT.md — Phase A

Recorded the previously-untracked migrations in `supabase_migrations.schema_migrations` (live, via Management API). 

## Action
```sql
insert into supabase_migrations.schema_migrations (version, name) values
 ('20260614000018','admin_country_scoping'),('20260614000019','authenticated_grants'),
 ('20260614000020','feature_persistence'),('20260614000021','rls_recovery'),
 ('20260614000022','order_country_code_fix')
on conflict (version) do nothing;   -- HTTP 201
```

## Verification — ✅ PASS
| Check | Result |
|---|---|
| Consistency | ✅ `0000 … 0022` all present (23 rows) |
| No duplicates | ✅ `on conflict (version) do nothing`; each version unique |
| Chronological correctness | ✅ contiguous, monotonic by `version` |

Ledger now: `…0017` (init→webhook_events) + **0018 admin_country_scoping · 0019 authenticated_grants · 0020 feature_persistence · 0021 rls_recovery · 0022 order_country_code_fix**.

**Phase A = PASS.** Future `supabase db push` will not attempt to re-apply 0018–0022.
