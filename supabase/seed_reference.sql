-- ─────────────────────────────────────────────────────────────────────────────
-- HAAT NOW — Immutable GLOBAL production reference data.
--
-- The repository is the single source of truth. This file is idempotent
-- (ON CONFLICT DO NOTHING) and REUSABLE for every deployment. It contains
-- ONLY immutable global reference data:
--   • NO demo/test/business data (no merchants, products, orders, users, wallets…)
--   • NO cities, NO zones, NO delivery areas  (those are operational, per-market data)
--   • NO demo UUIDs — ids are DETERMINISTIC UUIDv5 derived from the ISO code, so they
--     are stable and identical across every deployment.
--
-- WHERE EACH REFERENCE TYPE LIVES (by design — the public schema is intentionally minimal):
--   • Countries + ISO 3166-1 alpha-2 codes  → public.countries (seeded below).
--   • Static service / product categories    → seeded by the migrations
--       (role/catalog migrations); NOT duplicated here to avoid name collisions.
--   • Currency, language/locale, timezone/dial (phone) prefix, and country metadata
--     → committed application reference `src/config/countries.ts` (COUNTRIES map).
--       The public schema has no columns/tables for this metadata, and the app reads
--       it from that committed config — so `src/config/countries.ts` IS the repository
--       source of truth for it. It is deliberately NOT mirrored into dead DB tables.
--
-- Run: applied to a provisioned project after `supabase db push` (schema) completes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Supported markets (must mirror src/config/countries.ts → CountryCode union).
-- Names are canonical ISO English names (locale-neutral); the app renders localized
-- names (nameAr/nameEn) from src/config/countries.ts.
insert into countries (id, name, code) values
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.EG'), 'Egypt',                'EG'),
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.SA'), 'Saudi Arabia',         'SA'),
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.AE'), 'United Arab Emirates', 'AE'),
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.KW'), 'Kuwait',               'KW'),
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.QA'), 'Qatar',                'QA'),
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.BH'), 'Bahrain',              'BH'),
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.OM'), 'Oman',                 'OM'),
  (uuid_generate_v5(uuid_ns_dns(), 'haat.country.JO'), 'Jordan',               'JO')
on conflict (id) do nothing;
