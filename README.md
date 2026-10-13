# TaskFlow SaaS (React + Supabase)

A Todo List with email/password authentication and private, cloud-stored tasks. Uses **Vite + React + Supabase Auth + PostgreSQL + Row Level Security (RLS)**. Intended as a small multi-user MVP (not subscription billing).

## 1. Create a Supabase project

1. Open https://supabase.com/dashboard and choose **New project**.
2. Wait until the project database is ready.
3. Go to **SQL Editor > New query**.
4. Paste and execute the entire contents of `supabase/schema.sql` (on a fresh project). It creates the `public.tasks` table, an index, grants, and separate RLS policies for SELECT, INSERT, UPDATE, DELETE.
5. Check under **Table Editor > tasks** that **RLS is enabled**.

Supabase Auth already manages user accounts in `auth.users`; do not create your own `users` table for this MVP.

## 2. Configure environment variables

Run `cp .env.example .env.local` (or copy the file in Explorer), then edit `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Find both in your project's **Connect** dialog / **Project Settings > API Keys** (the location can vary as the dashboard changes). Use the **publishable** key, never a `secret`/`service_role` key; Vite exposes `VITE_` vars publicly to browsers. `.env.local` is ignored by git.

## 3. Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open http://localhost:5173 and try **Inscription**. If Supabase email confirmation is enabled, check your inbox and click the confirmation link before signing in. Configure **Authentication > URL Configuration** if necessary:
- **Site URL:** `http://localhost:5173` during local development (update to production domain for deployment).
- **Redirect URLs:** add `http://localhost:5173/**` and later your Vercel deployment URL(s).

If local confirmation emails fail, check **Authentication > Providers > Email** and whether Supabase's development email quota or SMTP settings apply.

## 4. Test that each user sees only their own tasks

1. Register account A and add `Task A`.
2. Sign out, register account B, and add `Task B`.
3. B must see only `Task B`.
4. Sign back in as A: A must still see only `Task A`.
5. Add/edit/delete/toggle tasks and refresh the page: updates should persist.

**Important:** UI filtering by `user_id` is *not* what makes this secure. The RLS database policies in `supabase/schema.sql` are the actual access controls. For production hardening, additionally run policy tests with Supabase CLI/pgTAP.

## 5. Import tasks from the previous localStorage-only version (optional)

If you run this app in the **same browser and origin** as the old TaskFlow, existing tasks in `localStorage` will be detected. While signed in, click **Importer dans mon compte** to copy them into your account. The old localStorage entry is deleted **only after** a successful insert. If you already moved to a different origin, the old browser storage cannot be read automatically.

Note: the old demo tasks may also be in the saved list, so check what you're importing. Imports can create duplicates if repeated across different browsers.

## 6. Deploy to Vercel

1. Push this project to GitHub, but never push `.env.local`.
2. Import the repository in https://vercel.com/new . Choose **Vite**, build `npm run build`, output `dist`.
3. In **Project Settings > Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with your own values.
4. Deploy/redeploy and open your `.vercel.app` URL.
5. In Supabase **Authentication > URL Configuration** update **Site URL** to your Vercel production URL and add it to **Redirect URLs**. Also keep `http://localhost:5173/**` for local dev.

## What you get

- Register, login, logout via Supabase Auth.
- Each task has an owner (`user_id` referencing `auth.users`).
- Real PostgreSQL persistence for create, list, update, toggle, and delete.
- RLS policies for authenticated users only, plus explicitly scoped DB queries.
- Current filters, counters, priorities, deadlines, and responsive interface kept.
- Optional explicit migration of same-origin localStorage tasks.
- Helpful configuration screen when `.env.local` is absent.

## Files

```text
src/App.jsx             # Auth UI + cloud-backed Todo UI
src/lib/supabase.js     # Supabase browser client (public key)
src/styles.css          # Existing UI + Auth styles
supabase/schema.sql     # Table, permissions, and RLS policies
.env.example            # Example, safe to commit
.env.local              # Your actual values, never commit
```

## Troubleshooting

- **Configurer Supabase screen**: missing or badly named `.env.local` vars; restart `npm run dev` after changing them.
- **relation public.tasks does not exist**: run the SQL file in the **correct Supabase project**.
- **permission denied for table tasks**: verify grants and RLS policies from the SQL file.
- **Email not confirmed**: check confirmation email and Auth URL Configuration.
- **Failed to fetch / network error**: check project URL and that the Supabase project is active.

*Note: external Supabase configuration, actual Auth/DB round trips, and Vercel deployment must be tested against a real user-created Supabase project.*
