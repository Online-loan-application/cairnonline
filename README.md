# Cairn Bank concept

A React, TypeScript, and Vite banking-interface concept. The balances, cards, and transfers shown in the landing page are illustrative only; this project is not a bank and does not provide real financial services.

## Run locally

```powershell
npm ci
npm run dev
```

## Connect Supabase authentication

The app uses Supabase Auth for email/password account creation and login. Each profile uses the same UUID as its `auth.users` record and stores the email, display name, selected country, and that country's currency. Passwords are managed only by Supabase Auth and are never copied into `public.profiles`. No real bank accounts are connected; the dashboard ledger stores illustrative entries only.

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). It creates or updates and backfills the `public.profiles` table, enables row-level security, and syncs profiles when Auth users are created or updated.
3. Run [`supabase/activity_notifications.sql`](./supabase/activity_notifications.sql) in the Supabase SQL Editor. This separate migration records account creation, backfills existing users, and creates the user-owned activity history used by dashboard notifications.
4. Run [`supabase/account_ledger.sql`](./supabase/account_ledger.sql) in the SQL Editor. This separate migration creates the illustrative transaction ledger and the user-scoped function used to record deposits and transfers. Apply the activity migration first because ledger entries are also added to the activity history.
5. In Supabase **Authentication → URL Configuration**, set the Site URL to your local app URL (for the included Vite config, `http://localhost:3000`) and add it to the allowed redirect URLs.
6. In Supabase **Authentication → Providers → Email**, turn **Confirm email** off. This is a Supabase Auth project setting and cannot be changed by the profile SQL. With confirmation off, `signUp` should return a session and the app can log the user in immediately.
7. Copy `.env.example` to `.env.local` and replace the placeholders with your Supabase project URL and publishable key. The project's legacy `anon` key can also be used as the publishable key.
8. Restart the Vite server after editing `.env.local`.

Only the Supabase project URL and publishable/anon key belong in this frontend configuration. Never put a `service_role` key or database password in a `VITE_` variable or browser code.

Account creation and login are unavailable until the environment variables are configured. After signing in, the account overview starts with zero balances and formats displayed amounts using the currency selected at sign-up; these figures are not real funds or exchange-rate conversions. The Accounts, Activity, and Profile sections have separate dashboard routes. Deposits and transfers create persistent illustrative ledger entries; Money in and Money out show totals calculated from those entries, and transfers cannot exceed the selected account's recorded balance. These entries are not real payments. The notification feed reads the signed-in user's activity history, beginning with account creation; sign-ins, sign-out requests, deposits, and transfers are also recorded. Local transfers, Cash App, PayPal, USDT, Wise, Venmo, and other listed routes are illustrative choices only and are not connected to payment services. The profile section shows the user's saved name, email, country, and currency. The dashboard's live date and time use the viewer's local device clock.
