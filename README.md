# Cairn Bank concept

A React, TypeScript, and Vite banking-interface concept. The balances, cards, and transfers shown in the landing page are illustrative only; this project is not a bank and does not provide real financial services.

## Run locally

```powershell
npm ci
npm run dev
```

## Connect Supabase authentication

The app uses Supabase Auth for email/password account creation and login. Each profile uses the same UUID as its `auth.users` record and stores the email, display name, selected country, and that country's currency. Passwords are managed only by Supabase Auth and are never copied into `public.profiles`. There are no real bank accounts or transaction tables.

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). It creates or updates and backfills the `public.profiles` table, enables row-level security, and syncs profiles when Auth users are created or updated.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to your local app URL (for the included Vite config, `http://localhost:3000`) and add it to the allowed redirect URLs.
4. In Supabase **Authentication → Providers → Email**, turn **Confirm email** off. This is a Supabase Auth project setting and cannot be changed by the profile SQL. With confirmation off, `signUp` should return a session and the app can log the user in immediately.
5. Copy `.env.example` to `.env.local` and replace the placeholders with your Supabase project URL and publishable key. The project's legacy `anon` key can also be used as the publishable key.
6. Restart the Vite server after editing `.env.local`.

Only the Supabase project URL and publishable/anon key belong in this frontend configuration. Never put a `service_role` key or database password in a `VITE_` variable or browser code.

Account creation and login are unavailable until the environment variables are configured. Successful email/password authentication does not unlock banking functionality; the landing page remains a non-financial demo.
