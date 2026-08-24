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

Open [http://localhost:3000](http://localhost:3000).

- Sign up with any email + password (8+ characters)
- Finish onboarding (business, tax, rates, e-transfer)
- Add a client → quote → Print / Save as PDF → Create invoice

Data is stored in `data/sitebook.db` (gitignored). Delete that file to reset.

## What’s in / not in

**In:** marketing pages, signup/login, onboarding, dashboard, clients, jobs, quotes, invoices, print-to-PDF, sequential `Q-0001` / `INV-0001`.

**Stubbed:** Stripe Checkout (every local account is Pro). Emailing clients. Voice-to-quote. Live material pricing.

## Later deploy

Same Next.js app. Swap SQLite for Supabase Postgres, wire Stripe to `/pricing`, host on Vercel. No rewrite required for the screens.
