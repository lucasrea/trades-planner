# Trades Planner

Local MVP for a solo Canadian trades contractor: clients, jobs, quotes, invoices, GST/HST PDFs.

This is a **git repo** that runs **on your machine**. Nothing is deployed to Vercel/Supabase/Stripe yet. When we add hosting, this app is already shaped for it (landing, pricing, onboarding, settings).

## Run locally

You need Node 20+ (this machine has 23).

```bash
cd ~/trades-planner
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`. In Google Cloud, create a Web OAuth client with redirect URI `http://localhost:3000/api/auth/callback/google`.

Open [http://localhost:3000](http://localhost:3000).

- Sign up or log in with Google
- Finish onboarding (business, tax, rates, e-transfer)
- Add a client → quote → Print / Save as PDF → Create invoice

Data is stored in `data/sitebook.db` (gitignored). Delete that file to reset.

## What’s in / not in

**In:** marketing pages, signup/login, onboarding, dashboard, clients, jobs, quotes, invoices, print-to-PDF, sequential `Q-0001` / `INV-0001`.

**Stubbed:** Stripe Checkout (every local account is Pro). Emailing clients. Voice-to-quote. Live material pricing.

## Deploy to Vercel

Vercel’s serverless runtime cannot persist a local SQLite file. Production uses **Turso** (hosted libSQL) with the same Drizzle schema — set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` on Vercel.

### 1. Turso database

```bash
# Install: https://docs.turso.tech/cli
turso auth login
turso db create trades-planner
turso db show trades-planner --url
turso db tokens create trades-planner
```

### 2. Vercel project

Import `lucasrea/trades-planner` at [vercel.com/new](https://vercel.com/new), or:

```bash
npx vercel link
npx vercel env add AUTH_SECRET
npx vercel env add AUTH_URL
npx vercel env add AUTH_GOOGLE_ID
npx vercel env add AUTH_GOOGLE_SECRET
npx vercel env add TURSO_DATABASE_URL
npx vercel env add TURSO_AUTH_TOKEN
npx vercel --prod
```

Set `AUTH_URL` to your production URL (e.g. `https://trades-planner.vercel.app`).

### 3. Google OAuth (production)

In Google Cloud Console, add an authorized redirect URI:

`https://YOUR-VERCEL-DOMAIN/api/auth/callback/google`

### 4. First deploy

Schema tables are created automatically on first request (`ensureDb`). Sign in with Google, finish onboarding, and add a client to confirm the remote DB works.

**Still stubbed in production:** Stripe Checkout (every account is Pro). Client email. Voice-to-quote.
