# Trades Planner

MVP for a solo Canadian trades contractor: clients, jobs, quotes, invoices, GST/HST PDFs.

**Live:** [trades-planner-bay.vercel.app](https://trades-planner-bay.vercel.app)  
**Repo:** [github.com/lucasrea/trades-planner](https://github.com/lucasrea/trades-planner)  
**Planning:** [docs/planning/trades-planner-scope.md](./docs/planning/trades-planner-scope.md)

npm workspaces. The Next.js app (marketing site and logged-in product) is `apps/web`. The Expo app in `apps/mobile` is the same signed-in product on a phone, without the marketing site. **Supabase Postgres** for local and production (via Drizzle). Vercel’s root directory is `apps/web`.

## Run locally

Node 20+ required.

```bash
git clone https://github.com/lucasrea/trades-planner.git
cd trades-planner
npm install
cp apps/web/.env.example apps/web/.env.local
# Fill in .env.local (see Supabase setup below)
npm run dev
npm run dev:mobile
```

Set in `.env.local`:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Long random string |
| `AUTH_URL` | `http://localhost:3000` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth Web client |
| `DATABASE_URL` | Supabase Postgres connection string |

Google OAuth redirect URI (local):

`http://localhost:3000/api/auth/callback/google`

Open [http://localhost:3000](http://localhost:3000), sign in with Google, finish onboarding, then add a client → quote → print PDF → invoice.

## Supabase setup

### 1. Create project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** (e.g. `trades-planner`)
2. Save the database password

### 2. Connection strings

**Project Settings → Database → Connection string → URI**

| Use | Pooler | Port | Notes |
|-----|--------|------|--------|
| App (local + Vercel) | Transaction | **6543** | Add `?pgbouncer=true` — use for `DATABASE_URL` |
| Migrations (`db:push`) | Direct | **5432** | Use temporarily in `.env.local` for `./scripts/db-push.sh` |

### 3. Apply schema

**Option A — SQL editor:** paste and run `supabase/migrations/20250824200000_initial.sql`

**Option B — Drizzle:**

```bash
# DATABASE_URL = direct connection (port 5432) in .env.local
./scripts/db-push.sh
```

Then switch `DATABASE_URL` back to the **transaction pooler** URL (port 6543) for `npm run dev`.

### 4. Sync env vars to Vercel

Auth vars are likely already on Vercel. After `DATABASE_URL` is in `.env.local`:

```bash
./scripts/sync-vercel-env.sh
npx vercel --prod
```

This pushes `AUTH_*` + `DATABASE_URL` to production and preview, and removes legacy Turso vars.

## Production (Vercel)

| | |
|---|---|
| **URL** | https://trades-planner-bay.vercel.app |
| **Host** | [Vercel](https://vercel.com) (auto-deploys from `master`) |
| **Database** | [Supabase](https://supabase.com) Postgres |

### Environment variables (Production + Preview)

| Variable | Production value |
|----------|------------------|
| `AUTH_SECRET` | Same as local |
| `AUTH_URL` | `https://trades-planner-bay.vercel.app` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `DATABASE_URL` | Supabase **transaction pooler** URI (port 6543) |

### Google OAuth (production)

Add authorized redirect URI:

`https://trades-planner-bay.vercel.app/api/auth/callback/google`

### CD loop

```
git push origin master  →  Vercel auto-deploys  →  app uses Supabase via DATABASE_URL
```

### Architecture

```
Browser → Vercel (Next.js)
              ├── Server Components + Server Actions (CRUD)
              ├── NextAuth (Google) → /api/auth/[...nextauth]
              └── Drizzle ORM → Supabase Postgres
```

No separate backend service — all API logic lives in this repo under `apps/web/lib/` and `apps/web/app/api/`.

## What’s in / not in

**In:** marketing pages, Google signup/login, onboarding, dashboard, clients, jobs, quotes, invoices, print-to-PDF, sequential `Q-0001` / `INV-0001`.

**Stubbed:** Stripe Checkout (every account is Pro). Emailing clients. Voice-to-quote. Live material pricing.
