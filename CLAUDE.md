# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Trades Planner is an app for a solo Canadian trades contractor: clients, jobs, quotes, invoices with GST/HST, and "Plan", where typed, spoken or photographed input becomes a proposal the contractor confirms. npm workspaces, Node 20. This file describes `master`; several task branches live in sibling worktrees (`git worktree list`), so check that your checkout is current.

## Commands

Run from the repo root.

```bash
npm install
npm run dev                # web, http://localhost:3000
npm run dev:mobile         # Expo
npm run lint               # web only
npm run typecheck          # web (next typegen + tsc) and mobile
npm test                   # web unit tests (Vitest)
npm run test:integration   # needs a disposable Postgres, see below
npm run build

# one test file, or one test by name
npm test -w trades-planner-web -- lib/money.test.ts
npm test -w trades-planner-web -- -t "part of the test name"
npm run test:integration -w trades-planner-web -- tests/integration/services.test.ts
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, integration tests and build, in that order. The mobile app has no tests.

**Integration tests drop the `public` schema** of `DATABASE_URL_TEST` (falling back to `DATABASE_URL`), then apply every file in `supabase/migrations/`. Never point them at a real database. A throwaway one matching CI:

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=ci postgres:16
DATABASE_URL_TEST=postgres://ci:ci@127.0.0.1:5432/ci npm run test:integration
```

End-to-end capture checks against a running app are in `tools/e2e` (`npm run e2e -- --target local`). They need a session cookie; read `tools/e2e/README.md` first. `--target prod` with `--confirm` writes real rows.

## Environment

The web app reads `apps/web/.env.local` (template: `apps/web/.env.example`). Several variables are not in the template:

| Variable | Behaviour |
|---|---|
| `AI_PROVIDER` | `fake` or `live`. Unset means fake outside production, live in production. |
| `EXTRACTION_MODEL`, `TRANSCRIPTION_MODEL` | Required when live, along with `OPENAI_API_KEY`. |
| `AI_FAKE_MODE` | `ok`, `slow`, `error`, `malformed`, `empty`. |
| `AI_CAPTURE_ENABLED` | Exactly `false` makes the web capture routes and mobile text capture return 503. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Receipt photo storage. In-memory fake in dev; required in production. |
| `EMAIL_PROVIDER` | `fake` or `resend` (with `RESEND_API_KEY`, `EMAIL_FROM`). Unset means email is not configured. |

Mobile uses `EXPO_PUBLIC_API_URL` (**defaults to production**) and `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

## Architecture

Paths below are relative to `apps/web`.

### Layers

- `lib/services/*`: business logic, taking `{ db, contractorId }`. They throw the typed errors in `lib/services/context.ts`.
- `lib/actions/*` (Server Actions) and `app/api/**` (route handlers): thin adapters that authenticate, validate with Zod and call services.
- `lib/queries.ts` resolves the session for pages; `lib/queries-v2.ts` holds the same kind of reads taking `db` and `contractorId`, so tests can call them.
- Pure modules (`lib/money.ts`, `lib/line-items.ts`, `lib/documents.ts`, `lib/plan-*.ts`, `lib/ai/schemas.ts`) must not import Next, React or the DB.

Actions report most failures by redirecting with `?error=<code>`. `lib/action-errors.ts` maps service errors to codes **by exact message string**, so a new or reworded service error needs its entry there.

### Auth, by entry point

- Pages and actions: NextAuth v5 with Google and JWT sessions; `getContractor()` / `requireSession()` from `lib/auth.ts`. `proxy.ts` only redirects page routes and does not protect `app/api`.
- `app/api/captures/*`: session cookie plus `assertSameOrigin`.
- `app/api/v1/*` (mobile): bearer token via `contractorFromBearer`. `app/api/mobile/session` exchanges a Google or Apple ID token for it (`DELETE` revokes it); only the hash is stored. Apple sign-in never creates an account: it links by verified email, then matches `users.apple_id`.
- `app/d/[token]`: public share page where a client can approve or decline a quote. The contractor and document come from the link row, never from a browser-supplied id.

### Captures and Plan

Input becomes a `captures` row holding a proposal. Lines and documents are written only when the contractor confirms (`lib/services/captures.ts`, `plan-proposals.ts`). Confirming a Plan proposal uses only the stored extraction.

Typed text (web and phone) and voice share one interpreter, `runPlanAgent` in `lib/services/plan-agent.ts`; voice transcribes first through `runVoicePlan`. Rule-based handling in `lib/plan-message.ts` runs before the model: greetings are stripped, paperwork questions are answered from the books, plain adds are parsed, and "invoice the unbilled work on X" becomes an `invoice_tracked` card that confirms through `createInvoiceFromTrackedLines` so tracked lines are never retyped or billed twice. The rules answer only questions they can finish; anything else goes to the model tool loop (`lib/ai/plan-loop.ts`, up to 6 steps in a 40 s budget inside the routes' 60 s limit, one retry for transient provider errors). Receipts are separate (`lib/services/receipt-capture.ts`); their confirm only adds unbilled material lines.

The model's 17 tools are defined and parsed in `lib/ai/plan-tools.ts` and run in `runPlanAgent` (spec: `docs/planning/plan-agent-tools.md`):

- **Read** (`lib/services/plan-reads.ts`): `find_jobs`, `get_job`, `find_documents`, `get_document`, `find_clients`, `search_lines`, `business_snapshot`. They return rows with ids plus counts and totals computed with `lib/money.ts`; status words ("open", "waiting", "unpaid", "overdue") are defined in `documentStatusFilter` (`lib/plan-lookup.ts`).
- **Propose** (each stores a card; nothing changes until Confirm): `propose_work` (new quotes, invoices, logged lines, jobs; `propose` is an alias), `propose_invoice`, and the change cards `propose_document_change`, `propose_job_change`, `propose_client`, `propose_send`, `propose_settings`, `propose_undo`. Change cards are `action: "change"` with a `PlanChange` (`lib/plan-changes.ts`); `lib/services/plan-changes.ts` previews them against current data and confirms them through the existing services, storing the result so a second confirm returns it.
- **Talk**: `reply`, and `ask` (a question with choices, saved in `plan_messages.options`). If the model ends a turn with nothing, the loop takes one final step limited to `reply` and `ask`.

Each turn logs `plan_turn_finished` with the tools called, their outcome and timing, and ids only. Never log message text.

`lib/plan-proposal.ts` turns an extraction into an action, a preview and the confirm input. A price on a card must appear in what the contractor said, in this message or an earlier one in the same plan (`evidence` on the stored proposal); otherwise Confirm is blocked. `recordAgentTurn` in `lib/services/plans.ts` saves each message and its cards to the thread (`plans`, `plan_messages`). The single-shot describe extraction (`lib/ai/run-describe.ts`) now serves only the paid eval script.

After changing `lib/ai/fake.ts`, update the expected values in `tools/e2e/run.mjs`. Prompt changes are snapshot tested (`lib/ai/prompts.test.ts`).

### Data

Supabase Postgres through Drizzle and postgres.js. Quotes and invoices are one `documents` table. A `line_items` row with neither `documentId` nor `billedDocumentId` is unbilled work on a job. Timestamps are epoch milliseconds.

Schema changes need both a new SQL file in `supabase/migrations/` and the matching edit to `lib/db/schema.ts`. Integration tests check that every Drizzle column exists and that every table has Row Level Security. README references to `./scripts/*.sh` mean `apps/web/scripts/`.

## Rules

From `.cursor/rules/` and `docs/planning/`:

- Scope every query by `contractor_id`, and verify ownership of every id received from a client.
- The AI never does arithmetic that appears on a document; totals, tax and rounding come from `lib/money.ts`.
- The AI never writes business records directly; the contractor reviews and confirms.
- Quotes and invoices share one set of components and routes.
- Billing is not built yet. When it is, enforce it only in `requireActiveAccess()`; add no plan checks elsewhere.
- Every migration that creates a table enables Row Level Security. Migrations are forward-only; never edit an applied one.
- Tests never call paid or external providers (AI, Stripe, email, Google); use the fakes or injected clients.
- New dependencies need a one-line justification. Prefer deleting code over adding abstractions, and stay within the task.
- Feature specs are in `docs/planning/`. For v2 work, `agent-tasks.md` wins over `v2-design.md`.
- Before merging a PR: CI green and an independent read-only review (`.cursor/rules/01-pr-review.mdc`).

`master` auto-deploys to Vercel (root directory `apps/web`).
