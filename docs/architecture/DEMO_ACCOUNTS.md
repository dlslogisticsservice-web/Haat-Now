# HAAT NOW — Demo Accounts

> The app uses **real Supabase phone-OTP auth**. To make these usable you must:
> 1. Supabase → **Auth → Providers → Phone** → enable, and add each number below as a **Test OTP** number (fixed code, no real SMS).
> 2. Create the 6 auth users (Auth → Users → Add user) and note each `auth.users.id`.
> 3. Run [`supabase/seed_demo_accounts.sql`](../../supabase/seed_demo_accounts.sql) with the real uuids (assigns roles, admin scope, driver/merchant/wallet rows).
>
> I cannot perform steps 1–3 (no dashboard / service-role access). The table is the intended credential set.

| Role | Phone (login) | Test OTP | Resolved role | Portal |
|---|---|---|---|---|
| **Customer** | `+966500000001` | `123456` | `customer` | Customer app (home/cart/orders/wallet) |
| **Driver** | `+966500000007` | `123456` | `driver` | Driver portal |
| **Merchant** | `+966500000008` | `123456` | `merchant` | Merchant portal |
| **Super Admin** | `+966500000009` | `123456` | `admin` · scope `super` | Admin (all countries) |
| **Egypt Admin** | `+201000000009` | `123456` | `admin` · scope `country` · `EG` | Admin (Egypt only) |
| **Saudi Admin** | `+966500000019` | `123456` | `admin` · scope `country` · `SA` | Admin (Saudi only) |

**Notes**
- Role is resolved from the DB (`user_roles → roles`), not from the phone number — no sandbox/suffix logic remains.
- Phone numbers are normalized to **E.164** automatically (`toE164`), so `0501234567` → `+966501234567`, `01012345678` → `+201012345678`.
- Admin country scoping requires migration `20260614000018` (already applied per your confirmation) + the `admin_users` rows from the seed file.
- Email/password admins are also possible (email auth is enabled); the current login UI is phone-only.
