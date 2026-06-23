# Critical Security Findings — HAAT NOW

**Date:** 2026-06-24 · Definition: direct path to privilege escalation, account/data compromise, or
financial loss.

---

## CR-1 — `app_config` writable by ANY authenticated user — **FIXED ✅**

**Finding:** RLS policy `"Authenticated users can write config"` on `public.app_config` was
`FOR ALL USING (true) WITH CHECK (true)`. Any logged-in customer could **insert/update/delete global
application configuration** (feature flags, settings) affecting all users — a privilege-escalation /
integrity vector.

**Exploitability:** trivial — `supabase.from('app_config').update(...)` with any authenticated session.

**Fix (`migrations/20260614000026_security_hardening.sql`, applied live):**
- Dropped the permissive `ALL` policy.
- `app_config_read` — public `SELECT` (the app needs to read config).
- `app_config_super_write` — `ALL` restricted to `admin_users.scope = 'super'` only.

**Breakage check:** no `src/` code writes `app_config` (grep-verified), so locking writes to super-admins
breaks nothing. Verified the new policies are live.

---

## Result: **0 Critical security issues outstanding** (1 found, 1 fixed).
