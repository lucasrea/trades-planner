# Trades Planner

MVP for a solo Canadian trades contractor: clients, jobs, quotes, invoices, GST/HST PDFs.

**Live:** [trades-planner-bay.vercel.app](https://trades-planner-bay.vercel.app)  
**Repo:** [github.com/lucasrea/trades-planner](https://github.com/lucasrea/trades-planner)

Next.js app — marketing site and logged-in app in one repo. Local dev uses SQLite; production on Vercel uses [Turso](https://turso.tech) (hosted libSQL).

## Run locally

Node 20+ required.

```bash
git clone https://github.com/lucasrea/trades-planner.git
cd trades-planner
npm install
cp .env.example .env.local
npm run dev
```

Set in `.env.local`:

- `AUTH_SECRET` — long random string
- `AUTH_URL` — `http://localhost:3000`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth Web client

In Google Cloud, add redirect URI:

`http://localhost:3000/api/auth/callback/google`

Open [http://localhost:3000](http://localhost:3000), sign in with Google, finish onboarding, then add a client → quote → print PDF → invoice.

Data is stored in `data/sitebook.db` (gitignored). Delete that file to reset.

## Production (Vercel)

| | |
|---|---|
| **URL** | https://trades-planner-bay.vercel.app |
| **Host** | [Vercel](https://vercel.com) (auto-deploys from `master`) |
| **Database** | [Turso](https://turso.tech) — required; Vercel cannot use local SQLite |

### Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview):

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Same long random string as local |
| `AUTH_URL` | `https://trades-planner-bay.vercel.app` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |

### Turso setup

```bash
# Install CLI: https://docs.turso.tech/cli
turso auth login
turso db create trades-planner
turso db show trades-planner --url
turso db tokens create trades-planner
```

Paste the URL and token into Vercel env vars, then **Redeploy**.

Schema tables are created automatically on first DB request (`ensureDb`).

### Google OAuth (production)

Add this authorized redirect URI in Google Cloud Console:

`https://trades-planner-bay.vercel.app/api/auth/callback/google`

### Deploy from Git

Pushes to `master` trigger a Vercel production deploy. To link the CLI locally:

```bash
npx vercel link
npx vercel env pull .env.vercel.local   # optional — inspect prod env locally
```

### Architecture

```
Browser → Vercel (Next.js)
              ├── Server Components + Server Actions (CRUD)
              ├── NextAuth (Google) → /api/auth/[...nextauth]
              └── Drizzle ORM → Turso (prod) or data/sitebook.db (local)
```

No separate backend service — all API logic lives in this repo under `lib/` and `app/api/`.

## What’s in / not in

**In:** marketing pages, Google signup/login, onboarding, dashboard, clients, jobs, quotes, invoices, print-to-PDF, sequential `Q-0001` / `INV-0001`.

**Stubbed:** Stripe Checkout (every account is Pro). Emailing clients. Voice-to-quote. Live material pricing.
