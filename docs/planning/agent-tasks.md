# Trades Planner v2 — Agent Task Packets

Companion to `docs/planning/v2-design.md` (the "design doc"). The design doc is the **contract** (what and why). This file is the **work queue**: 65 small tasks, each sized for one Cursor agent session, each with its own goal, steps, limits and acceptance checks.

Put this file at `docs/planning/agent-tasks.md`.

---

## 0. How to run this

### 0.1 One-time setup (you, ~20 minutes)
1. Put these files in the repo: `docs/planning/v2-design.md` and `docs/planning/agent-tasks.md`.
2. Split the design doc into per-section files so an agent can be given only the sections it needs (script in 0.5). Commit the result under `docs/planning/v2/`.
3. Create `.cursor/rules/00-project.mdc` containing the **universal preamble** (section 1). Set it to always apply, so you never have to paste it.
4. Do task **H0** (below).
5. Work on branch `v2-simplify`. Each task gets a branch `task/Txx-short-name`, merged back by squash when its "Done when" is true. Merge `v2-simplify` into `master` only at a **phase gate** (0.4).

### 0.2 How to run one task
1. Open a **fresh** Cursor chat (new context per task).
2. Attach (with `@`) the files listed under **Read** for that task, from `docs/planning/v2/`, plus any source files named in the packet. Do **not** attach the whole design doc.
3. Paste the whole packet (from its `###` heading to its **Commit** line) and add one line: *"Do only this task. Start with a short plan, then implement."*
4. Review the plan quickly. If it plans anything outside the packet, say so before it codes.
5. When the agent finishes, run the **Done when** commands yourself. Skim the diff for scope creep (files that are not in the packet).
6. Optional but recommended: open a second fresh chat and paste the **reviewer prompt** (0.6) with the diff.
7. Commit, merge, move on. If a task fails twice, split it further instead of re-prompting harder (0.7).

### 0.3 Sizes
- **S**: under about 150 changed lines or a deletion-only change. Roughly an hour.
- **M**: up to about 400 changed lines, a few files. Roughly half a day including review.
- No task is larger than M. If you find one that is, split it.

### 0.4 Phase gates
Do not start the next phase until the gate passes. Gates are manual checks by you.

| Gate | After | You verify |
|---|---|---|
| G1 | T05 | App runs on the old schema; sign in, create client, job, quote, invoice, print. No upgrade prompts. Landing page is minimal. |
| G2 | T15 | New services and actions exist, are tested against a real Postgres, and are not yet used by the UI. CI is green including integration tests. |
| G3 | T21 | Manual script: create job with new client → New quote → add lines → mark sent → approve → Create invoice → print → mark sent → mark paid. Tracked lines billed once. Old POC data visible. Old tables dropped. |
| G4 | T23 | Playwright smoke passes in CI. Provider fakes in place. |
| G5 | T26 | Seeded captures can be reviewed, edited and confirmed into a quote, an invoice, tracked lines. |
| G6 | T32 | The Patel demo works end to end by **text** against the live Claude API on staging, with failure fallback. Eval numbers recorded. |
| G7 | T34 | Same demo by voice, on a real iPhone and a real Android phone. |
| G8 | T37 | Receipt photo → lines assigned to one or more jobs, on a real phone. |
| G9 | T40 | Core product complete (design doc M7). **Safe to start a private beta only after T45, T47 and T48 as well** (security basics, account deletion, legal pages). |
| G10 | T54 | Production milestones M8–M11 done; "Before charging money" checklist (design §17) ticked. |
| G11 | T65 | Mobile app on TestFlight; App Store checklist ticked. |

### 0.5 Splitting the design doc (script)
Save as `scripts/split-design-doc.sh`, run from the repo root. It writes one file per numbered section into `docs/planning/v2/`.

```bash
#!/usr/bin/env bash
# Splits docs/planning/v2-design.md into one file per numbered section under docs/planning/v2/
set -euo pipefail
SRC="docs/planning/v2-design.md"
OUT="docs/planning/v2"
rm -rf "$OUT" && mkdir -p "$OUT"
awk -v out="$OUT" '
/^## [0-9]+\. / {
  n = $2; sub(/\./, "", n)
  title = $0; sub(/^## [0-9]+\. /, "", title)
  slug = tolower(title); gsub(/[^a-z0-9]+/, "-", slug); gsub(/^-+|-+$/, "", slug)
  file = sprintf("%s/%02d-%s.md", out, n, slug)
}
{ if (file == "") print > (out "/00-header.md"); else print > file }
' "$SRC"
ls -1 "$OUT"
```

Section → file names used in the **Read** lines below (an ellipsis in a name such as `14-billing…md` just abbreviates it; use the exact names from this table or from `ls docs/planning/v2/`):

| Design § | File |
|---|---|
| 0 Agent rules | `00-how-to-use-this-doc-with-agents.md` |
| 1 Scope | `01-product-thesis-and-scope.md` |
| 3 Product / screens / flows | `03-target-product.md` |
| 4 Data model | `04-data-model.md` |
| 5 API and modules | `05-api-and-module-design.md` |
| 6 Business rules | `06-business-rules.md` |
| 7 File map | `07-file-by-file-change-map.md` |
| 13 Production readiness | `13-production-readiness-saas-essentials.md` |
| 14 Billing | `14-billing-with-stripe-m8.md` |
| 15 Testing / QA | `15-testing-and-qa-strategy.md` |
| 16 Mobile | `16-mobile-readiness-and-the-iphone-app.md` |
| 18 SaaS essentials | `18-shippable-ai-saas-essentials-additions-from-the-plan-review.md` |

### 0.6 Reviewer prompt (second agent, fresh chat)
```
You are reviewing a change for the Trades Planner repo. Do not edit code.
Inputs: the task packet (pasted below) and the diff (git diff v2-simplify...HEAD).
Check: (1) every "Done when" item is satisfied, with evidence; (2) nothing outside the packet changed; (3) the agent rules in .cursor/rules/00-project.mdc were followed (tenant scoping, no AI arithmetic, services layer, no new deps, RLS on new tables); (4) tests exist for new logic and would fail if the logic broke; (5) any security problem (missing ownership check, trusting client input, logging PII).
Output: PASS or FAIL, then a short list of concrete problems with file and line.
```

### 0.7 When an agent struggles
- Re-run with the same packet but ask for **only the plan** first; fix the plan, then implement.
- If it breaks things: `git restore .`, split the packet into two, retry. Do not stack fixes on a bad attempt.
- If a packet conflicts with the code you see, tell the agent to prefer the packet's intent, make the smallest change that works, and report the conflict.
- Bug fixes outside a packet: use the **bugfix prompt**: *"Reproduce first with a failing test, then fix, then show the test passing. Change nothing else."*

---

## 1. Universal preamble (put in `.cursor/rules/00-project.mdc`, always applied)

```
---
description: Trades Planner project rules
alwaysApply: true
---
Project: Trades Planner (github.com/lucasrea/trades-planner). Next.js 16 App Router, React 19, Tailwind 4, NextAuth v5 (Google), Drizzle ORM + postgres.js on Supabase Postgres, Vitest. Default branch: master. Work branch: v2-simplify. Node 20.
Read AGENTS.md first. Next.js 16 has breaking changes; read node_modules/next/dist/docs/ before writing Next-specific code.
We are executing a planned rewrite described in docs/planning/v2-design.md (split into docs/planning/v2/*.md). You are doing ONE task from docs/planning/agent-tasks.md. Do only that task.

Rules:
- Every DB query is scoped by contractor_id. Every server action / route handler resolves the session (getContractor()/requireSession()) and verifies ownership of any id it receives.
- The AI never does arithmetic that appears on a document. Totals, tax and rounding come only from lib/money.ts (roundMoney, cad, computeTotals/documentTotals, applyMarkup, padNumber).
- The AI never writes to the DB directly: model output is stored on a captures row, shown for review, and only becomes lines/documents when the user confirms.
- Business logic lives in lib/services/* as functions taking { db, contractorId, ... }. Server Actions and API route handlers are thin adapters.
- Pure core modules (lib/money.ts, lib/line-items.ts, lib/documents.ts, lib/billing.ts, lib/ai/schemas.ts) must not import Next, React or the DB.
- Quotes and invoices share one documents table, one component set and one set of routes.
- Billing is enforced in exactly one place: requireActiveAccess(). Never add plan checks elsewhere.
- Every migration that creates a table also enables Row Level Security on it. Migrations are forward-only SQL in supabase/migrations/; never edit an applied migration.
- No new dependencies without a one-line justification in the report. Never call paid or external providers (AI, Stripe, email) from tests; use the provider fakes.
- Prefer deleting code over adding abstractions. If it is not in the task, do not build it. Do not refactor unrelated code.

Process: (1) read the listed docs and files; (2) reply with a short plan (files to change, risks, ambiguities) and proceed unless blocked; (3) implement; (4) run: npm run lint && npm run typecheck && npm test && npm run build (and npm run test:integration once it exists); (5) final report: what changed, files touched, tests added, commands run with results, deviations from the packet, follow-ups discovered.
If something is ambiguous: choose the simplest option consistent with the design doc, note it in the report, and do not expand scope.
```

---

## 2. Deviations from the design doc (read once)

These were found while turning the plan into tasks. Where the design doc and this file disagree, **this file wins**.

1. **Migrations are expand then contract**, not one destructive migration. T08 adds new tables and backfills while keeping old tables; T21 drops old tables after the UI has switched. (Design §4.3 is correct about the end state and the SQL.)
2. **New code is added alongside old code** (T08–T15) and the UI switches over in T16–T20. The app builds and runs at every step.
3. The repo's default branch is **`master`**, not `main`. CI already triggers on `master`.
4. **`jobs.updated_at` needs a DB default** in the expand migration (`DEFAULT (extract(epoch from now()) * 1000)::bigint`), otherwise the old code's job inserts break until T20.
5. **Baseline defect:** `npm run typecheck` currently fails on `master` (`LayoutProps` not found in `app/layout.tsx`), so CI's typecheck step is already red. Fixed first in T01.
6. Design milestone M2 is split into T08–T21; M2b into T09 and T22–T23; M3 into T24–T26; M4 into T27–T32; M5 into T33–T34; M6 into T35–T37; M7 into T38–T40.
7. `assertSameOrigin` appears minimally in T29 (first route handler) and is hardened in T45.
8. **Receipts split across jobs** (design D23, revision 5). One photo does not belong to one job. `defaultJobId` on upload is optional. Confirm assigns each line to an owned job. T25, T26, T35, and T37 follow that. A receipt never creates a quote or invoice.

---

## 3. Task index

| ID | Title | Size | Depends on | You provide |
|---|---|---|---|---|
| H0 | Safety net and environment | — | — | everything |
| T01 | Fix typecheck baseline | S | H0 | — |
| T02 | Remove plan gating | M | T01 | — |
| T03 | Minimal landing; delete marketing and pricing | S | T01 | — |
| T04 | Remove CSV export and duplication | S | T01 | — |
| T05 | Nav cleanup and Home stub | S | T02 | — |
| T06 | Pure module: line items | S | T01 | — |
| T07 | Pure module: documents | S | T06 | — |
| T08 | Expand migration and schema | M | T01 | local Postgres, sample data |
| T09 | Integration test harness, RLS, CI Postgres | M | T08 | — |
| T10 | Services: clients and jobs | M | T09 | — |
| T11 | Services: line items | M | T07, T10 | — |
| T12 | Services: documents | M | T11 | — |
| T13 | Services: invoice creation paths | M | T12 | — |
| T14 | Server actions (adapters) | M | T13 | — |
| T15 | Queries v2 | M | T13 | — |
| T16 | Documents list and detail view | M | T14, T15 | — |
| T17 | Draft editing and status actions | M | T16 | — |
| T18 | Job page and job form | M | T17 | — |
| T19 | Type-aware print view | S | T17 | — |
| T20 | Remove legacy code | M | T18, T19 | — |
| T21 | Contract migration | S | T20 | — |
| T22 | Playwright and smoke journey | M | T21 | — |
| T23 | Provider fakes | S | T21 | — |
| T24 | Capture review: seeded display | M | T21 | — |
| T25 | Capture confirm and discard services | M | T24 | — |
| T26 | Interactive review UI | M | T25 | — |
| T27 | Pure AI helpers | S | T07 | — |
| T28 | AI module (describe) | M | T23, T27 | Anthropic API key |
| T29 | Text capture route, ledger, rate limit | M | T26, T28 | — |
| T30 | Describe-it UI | M | T29 | — |
| T31 | Describe evals and fixtures | M | T28 | sample descriptions |
| T32 | Feedback and edit telemetry | S | T30 | — |
| T33 | Transcription and voice route | M | T29 | OpenAI key |
| T34 | Voice recorder UI | M | T33, T30 | real phones |
| T35 | Storage and receipt route (no AI) | M | T29 | Supabase bucket |
| T36 | Receipt extraction | M | T35, T28 | sample receipts |
| T37 | Receipt uploader UI | M | T36 | real phone |
| T38 | One-form settings and onboarding; tax scope | M | T21 | — |
| T39 | Home final and first-run experience | M | T30, T37 | — |
| T40 | Help pages, mailto send, docs | S | T39 | — |
| T41 | Billing model and access state | M | T40 | — |
| T42 | requireActiveAccess enforcement and banner | M | T41 | — |
| T43 | Stripe Checkout, Portal, billing page | M | T42 | Stripe test account |
| T44 | Stripe webhook | M | T43 | Stripe CLI |
| T45 | Security hardening | M | T40 | — |
| T46 | Observability and kill switches | M | T40 | Sentry, analytics |
| T47 | Account export and deletion | M | T40 | — |
| T48 | Legal pages and Sign in with Apple | M | T47 | Apple Developer, lawyer |
| T49 | Email and cron | M | T40 | Resend domain |
| T50 | Share links and client approval | M | T49 | — |
| T51 | Server-side PDF | M | T50 | — |
| T52 | Load test suite | M | T51 | staging env |
| T53 | Fault injection, workflows, restore drill | M | T52 | staging env |
| T54 | Runbooks | S | T53 | — |
| T55 | Architecture audit for mobile | S | T54 | — |
| T56 | API v1 foundation | M | T55 | — |
| T57 | API v1: resources | M | T56 | — |
| T58 | API v1: captures, billing, account, OpenAPI | M | T57 | — |
| T59 | Monorepo conversion | M | T58 | — |
| T60 | PWA | S | T59 | iPhone |
| T61 | Expo scaffold and sign-in | M | T59 | Apple dev, Google clients |
| T62 | Expo capture and review | M | T61 | — |
| T63 | Expo jobs, documents, share, settings | M | T62 | — |
| T64 | Expo offline queue and push | M | T63 | — |
| T65 | TestFlight, Maestro, store checklist | S | T64 | App Store Connect |

Tasks **T01–T40 are written in full detail**. **T41–T65 are outlines**: before running each, ask an agent to expand it into a full packet (same format) using the referenced design sections and the then-current code.

---

## 4. Packets: Phase 0 — Safety net

### H0 — Safety net and environment (you)
1. `git tag v0-poc && git push origin v0-poc`. Create branch `v2-simplify` from `master`.
2. Run local Postgres (Docker `postgres:16`, or `supabase start`). Create two databases: dev and test. Put `DATABASE_URL` (dev) and `DATABASE_URL_TEST` (test) in `.env.local`. The migrations in `supabase/migrations/` are applied in filename order by `scripts/db-push.sh` or by running the SQL files.
3. Take a `pg_dump` of any Supabase data you care about.
4. Create sample POC data in the dev DB by using the current app (a couple of clients, jobs, quotes, invoices with line items, some job costs).
5. Add the design doc, this file, the split script output, and `.cursor/rules/00-project.mdc` (section 1) to the repo and commit.

**Done when:** the app runs locally against the dev DB with sample data; tag and branch exist.

---

## 5. Packets: Phase 1 — Strip (design M1)

### T01 — Fix typecheck baseline
`Size S · Depends H0 · Read: 00-how-to-use-this-doc-with-agents.md`

**Goal:** `npm run lint`, `typecheck`, `test` and `build` all pass on a clean clone, so CI is trustworthy.

**Context:** `npm run typecheck` currently fails with `app/layout.tsx: Cannot find name 'LayoutProps'`. Next.js 16 provides global route helper types (`LayoutProps`, `PageProps`) that are generated by `next typegen` (also produced by `next dev` / `next build`). `tsc` runs before those exist.

**Do:**
1. Reproduce on a clean clone (`npm ci`).
2. Fix it the simplest way that works locally and in CI. Preferred: change the script to `"typecheck": "next typegen && tsc --noEmit"`. Verify the command name in `node_modules/next/dist/docs/` first.
3. Make sure generated type files are git-ignored.
4. Confirm `.github/workflows/ci.yml` still runs lint, typecheck, test, build on pull requests and pushes to `master`.

**Don't:** change app behaviour or upgrade dependencies.

**Done when:** from a fresh clone, `npm ci && npm run lint && npm run typecheck && npm test && npm run build` all succeed (build needs the dummy env vars already in `ci.yml`).

**Commit:** `fix(ci): generate Next route types before tsc`

### T02 — Remove plan gating
`Size M · Depends T01 · Read: 07-file-by-file-change-map.md (Delete/Edit rows), 14-billing…md §14.1 (why)`

**Goal:** no plans, limits or upgrade prompts anywhere. Everyone has every current feature. (Billing returns later as one plan and one gate, in T41–T42.)

**Do:**
1. Delete `lib/entitlements.ts`, `lib/entitlements.test.ts`, `lib/plan-usage.ts`, `components/upgrade-notice.tsx`.
2. Remove every `requireFeature`, `require*Slot`, `canUseFeature`, plan lookup and `?upgrade=` handling from `lib/actions/data.ts`, pages and components.
3. Remove plan/billing UI from `components/settings-form.tsx` and any plan display in the shell/user menu.
4. Keep DB columns untouched (dropped in T21).

**Don't:** change business behaviour of quotes, invoices, jobs or clients. Don't touch marketing/pricing (T03).

**Done when:** `grep -rniE "entitlements|plan-usage|UpgradeNotice|requireFeature|canUseFeature|upgrade=" app components lib` returns nothing; all four commands pass; manually create a client, job, quote and invoice with no upgrade prompts; net lines removed.

**Commit:** `refactor: remove plan gating and entitlements`

### T03 — Minimal landing; delete marketing and pricing
`Size S · Depends T01 · Read: 03-target-product.md (§3.1 `/` row)`

**Do:**
1. Delete `components/landing-product-demos.tsx`, `hero-product-showcase.tsx`, `voice-feature-section.tsx`, `blueprint-plans.tsx`, `landing-construction.tsx`, `marketing.tsx`, and `app/pricing/page.tsx`.
2. Rewrite `app/page.tsx` (≤ 80 lines): headline "Describe the job. Get the paperwork.", one sentence on what it does, the existing Google sign-in button, footer links to Terms and Privacy and a support email placeholder, basic metadata and Open Graph tags.
3. Remove all links to `/pricing` and to deleted components.

**Don't:** touch authenticated app pages.

**Done when:** build passes; `/`, `/login`, `/terms`, `/privacy` render; no dead links (`grep -rn "/pricing"` is empty); ≥ 1,500 lines removed.

**Commit:** `refactor: replace marketing site with minimal landing`

### T04 — Remove CSV export and duplication
`Size S · Depends T01 · Read: 07-file-by-file-change-map.md`

**Do:** delete `app/api/clients/export/route.ts`, `lib/csv.ts`, `lib/csv.test.ts`, `components/duplicate-button.tsx`; remove the duplicate actions from `lib/actions/data.ts` and every button or link that used them.

**Done when:** all four commands pass; `grep -rniE "duplicate|csv" app components lib` shows nothing relevant.

**Commit:** `refactor: remove CSV export and duplication`

### T05 — Nav cleanup and Home stub
`Size S · Depends T02 · Read: 03-target-product.md §3.1`

**Do:**
1. In `components/app-shell.tsx` nav: Home, Jobs, Quotes, Invoices, Settings. Remove Dashboard and Clients entries (keep the clients pages themselves until T20; the old forms link to them).
2. Replace the dashboard in `app/app/page.tsx` with a simple Home stub: heading plus links to Jobs, Quotes, Invoices. Remove `getDashboard` and its helpers if unused.
3. In `proxy.ts` remove the non-existent `/account` path from `isApp` and the matcher.

**Done when:** all four commands pass. **Gate G1** (section 0.4).

**Commit:** `refactor: simplify nav and home stub`

---

## 6. Packets: Phase 2 — Pure core modules

### T06 — Pure module: line items
`Size S · Depends T01 · Read: 05-api-and-module-design.md §5.4 (post-processing), 06-business-rules.md §6.1`

**Goal:** a pure, well-tested module for line validation and row calculation.

**Do:** create `lib/line-items.ts` (no imports from Next, React or the DB) exporting:
- `type LineInput = { kind: "labour"|"material"|"other"; description: string; quantity: number; unit: string; unitCost?: number|null; unitPrice: number|null }`.
- `validateLine(line): string[]` (errors: empty description, quantity ≤ 0, price missing or negative) and `validateLines(lines)`.
- `toLineRow(line)` → adds `lineTotal = roundMoney(quantity × unitPrice)` using `lib/money.ts`.
- `sumLines(rows)` → subtotal via existing money helpers.
Reuse `roundMoney`, `lineTotal`, `documentTotals` from `lib/money.ts`; do not reimplement rounding.

**Tests (`lib/line-items.test.ts`):** table-driven validation cases; rounding edge cases (e.g. 3 × 0.1 + 0.2 style floats, quantities like 1.5); a `fast-check` property test is optional (ask before adding the dependency).

**Done when:** tests pass; the module imports nothing outside `lib/money.ts`.

**Commit:** `feat(core): pure line-item validation and row helpers`

### T07 — Pure module: documents
`Size S · Depends T06 · Read: 06-business-rules.md §6.2, 03-target-product.md §3.2 D`

**Do:** create `lib/documents.ts` (pure; all time-dependent functions take `now` as a parameter):
- `type DocType = "quote"|"invoice"`; `statusesFor(type)`: quote `draft|sent|approved|declined`, invoice `draft|sent|paid`.
- `canTransition(type, from, to)`: quote `draft→sent→approved|declined`; invoice `draft→sent→paid`; everything else false.
- `isLocked(status)` → `status !== "draft"`.
- `isOverdue(doc, today)` → derived: invoice, `sent`, `dueDate < today`.
- `defaultValidUntil(now)` (+30 days), `defaultDueDate(now)` (+14 days) as ISO dates.
- `documentNumber(type, n)` → `Q-0001` / `INV-0001` via `padNumber`.
- `buildMailto({ businessName, type, number, clientEmail, total, dueOrValid, etransferInstructions })` → `mailto:` URL with encoded subject/body.

**Tests:** every legal and illegal transition; lock rule; overdue boundary (due today is not overdue); date defaults across month/year ends; mailto encoding with special characters.

**Done when:** tests pass; no imports from Next/React/DB.

**Commit:** `feat(core): pure document rules (status, locking, numbering, mailto)`

---

## 7. Packets: Phase 3 — Schema and services (new code alongside old)

### T08 — Expand migration and schema
`Size M · Depends T01 · Read: 04-data-model.md (all), plus §2 of this file`

**Goal:** new tables exist and old data is copied into them, **without dropping anything** the old UI still uses.

**Do:**
1. New file `supabase/migrations/<timestamp>_v2_expand.sql` containing: `documents`, `line_items`, `captures` tables exactly as in design §4.3 (with indexes and `ENABLE ROW LEVEL SECURITY` on each); `jobs.updated_at` added with default `(extract(epoch from now()) * 1000)::bigint` and backfilled; `UPDATE jobs SET status = 'done'` for `completed`/`archived`; "Imported" jobs for quotes/invoices that have no job; **idempotent** backfills (`INSERT … ON CONFLICT (id) DO NOTHING`) from `quotes`, `invoices`, `quote_line_items`, `invoice_line_items` and (only for jobs never invoiced) `job_costs`.
2. Do **not** drop tables or columns. Do not remove `jobs.target_date` yet.
3. Update `lib/db/schema.ts`: add `documents`, `lineItems`, `captures` and `jobs.updatedAt` per design §4.4. Keep all old tables.
4. Create `supabase/seed/poc-sample.sql` (a few clients, jobs, quotes, invoices, lines, costs) so the migration can be tested on a clean DB, and `scripts/verify-backfill.sql` that prints old-vs-new row counts and totals.
5. Check for id collisions across `quote_line_items`, `invoice_line_items`, `job_costs` before the backfill (design §4.3 notes); prefix ids in the backfill if any collide.

**Don't:** touch application code beyond `schema.ts`.

**Done when:** on an empty DB: apply all migrations, load the seed, re-run the migration's backfill (idempotent, no duplicates); `verify-backfill.sql` shows matching counts and equal `total` sums; old app still builds and runs; `npm run db:push` reports no diff for the new tables.

**Commit:** `feat(db): expand migration adding documents, line_items, captures`

### T09 — Integration test harness, RLS migration, CI Postgres
`Size M · Depends T08 · Read: 15-testing-and-qa-strategy.md §15.1–15.3, 13-production-readiness…md §13.1 (RLS)`

**Do:**
1. Add a Vitest `integration` project (separate config) that connects to `DATABASE_URL_TEST`, runs all files in `supabase/migrations/` in order against a freshly reset schema in global setup, and exposes `npm run test:integration`.
2. `tests/helpers/seed.ts`: create contractors **A** and **B** (user + contractor rows), each with a client and a job; return ids. `tests/helpers/db.ts` for a test `db` handle and cleanup.
3. Migration `<timestamp>_enable_rls.sql`: enable RLS on every table in the `public` schema (the `DO $$ … $$` block in design §13.1). Verify on local/staging that the role in `DATABASE_URL` bypasses RLS (`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user;`).
4. Tests: (a) a test that fails if any `public` table has `relrowsecurity = false`; (b) a **schema drift** test asserting every table and column in `lib/db/schema.ts` exists in the migrated database.
5. CI: add a Postgres 16 service container and a `test:integration` step to `.github/workflows/ci.yml`, with `DATABASE_URL_TEST` pointing at it.

**Don't:** write service tests (T10+).

**Done when:** `npm run test:integration` passes locally and in CI; deliberately creating a table without RLS makes (a) fail.

**Commit:** `test: integration harness, RLS migration and drift checks`

### T10 — Services: clients and jobs
`Size M · Depends T09 · Read: 05-api-and-module-design.md §5.2, 06-business-rules.md §6.3`

**Do:** create `lib/services/clients.ts` and `lib/services/jobs.ts`. Each function takes a context `{ db, contractorId }` first and verifies ownership of any id it receives:
- clients: `listClients`, `getClient`, `saveClient` (create/update).
- jobs: `getJob`, `listJobs(cursor, limit)` with tracked/unbilled totals computed by a SQL aggregate (no per-row queries), `createJobWithClient({ title, siteAddress, client: { id } | { new fields } })` in **one transaction**, `setJobStatus` (`quoted|active|done`), `touchJob` (bump `updated_at`).
Use the existing `id()` helper for ids and the existing timestamp conventions.

**Tests (integration):** happy paths; inline new client creates both rows atomically (force a failure and assert nothing persists); **tenant isolation**: contractor A calling each function with B's ids gets "not found" and no data change.

**Done when:** `npm run test:integration` and the four standard commands pass. Nothing in the UI imports these services yet.

**Commit:** `feat(services): clients and jobs services with tenant tests`

### T11 — Services: line items
`Size M · Depends T07, T10 · Read: 05-api-and-module-design.md §5.2 (line-items actions), 06-business-rules.md §6.2–6.3, 04-data-model.md §4.2`

**Do:** create `lib/services/line-items.ts`:
- `saveTrackedLine(ctx, { id?, jobId, … })` and `saveDocumentLine(ctx, { id?, documentId, … })`; `deleteLine(ctx, id)`.
- Document lines: the document must belong to the contractor and be `draft` (use `isLocked`); within the same transaction recompute and store the document's `subtotal/tax/total` using `lib/money.ts` and the contractor's `taxRate`.
- Tracked lines: `document_id IS NULL`; reject edits/deletes when `billed_document_id` is set.
- `lineTotal` is always computed via `lib/line-items.ts`/`lib/money.ts`; ignore any client-supplied total. New lines go at the end (`sort_order = max + 1`). Bump the job's `updated_at`.

**Tests (integration):** lock rule (sent/approved/declined/paid documents reject create, update and delete); totals recomputed correctly after create/update/delete; billed tracked line immutable; cross-tenant attempts rejected.

**Done when:** all tests pass; four standard commands pass.

**Commit:** `feat(services): line-item services with lock rule`

### T12 — Services: documents
`Size M · Depends T11 · Read: 06-business-rules.md §6.2, 05-api-and-module-design.md §5.2 (documents)`

**Do:** create `lib/services/documents.ts`:
- `createDraftDocument(ctx, jobId, type)`: allocate the number **atomically** in a transaction (`SELECT … FROM contractors WHERE id = $1 FOR UPDATE`, use `next_quote_number` or `next_invoice_number`, increment); set `valid_until`/`due_date` defaults from `lib/documents.ts`; client = the job's client.
- `saveDocumentMeta(ctx, { documentId, notes, validUntil?, dueDate? })` (draft only).
- `setDocumentStatus(ctx, documentId, next)`: validate with `canTransition`; set `sent_at` on `sent`, `closed_at` on `approved|declined|paid`; `approved` also moves the job `quoted → active`.
- `deleteDraftDocument(ctx, documentId)`: draft only; deletes owned lines; for an invoice also clears `billed_document_id` on tracked lines it consumed.
- `getDocumentWithLines(ctx, id)`.

**Tests (integration):** valid/invalid transitions; **50 parallel `createDraftDocument` calls** for one contractor yield 50 unique numbers with no errors; approve moves job to active; delete-draft semantics for quotes and invoices; cross-tenant rejection.

**Done when:** tests and four standard commands pass.

**Commit:** `feat(services): document drafts, status machine, atomic numbering`

### T13 — Services: invoice creation paths
`Size M · Depends T12 · Read: 03-target-product.md §3.2 D, 06-business-rules.md §6.2`

**Do:** in `lib/services/documents.ts` (or `invoices.ts`):
- `createInvoiceFromQuote(ctx, quoteId)`: quote must be `approved`; create a draft invoice with copies of the quote's lines as **owned** lines; set `source_quote_id`; if an invoice already exists for that quote return it instead of creating another.
- `createInvoiceFromTrackedLines(ctx, jobId)`: copy all unbilled tracked lines (`document_id IS NULL AND billed_document_id IS NULL`) into a new draft invoice and set their `billed_document_id`; friendly error when there are none. Lock the tracked rows (`FOR UPDATE`) so parallel calls cannot bill a line twice.
- `addTrackedLinesToInvoice(ctx, invoiceId)`: same copy into an existing draft invoice, recompute totals.

**Tests (integration):** copy correctness (descriptions, quantities, prices, totals); one invoice per quote; **parallel calls never double-bill a tracked line**; error when nothing to bill; deleting the draft invoice releases the tracked lines again.

**Done when:** tests and four standard commands pass.

**Commit:** `feat(services): invoice from quote and from tracked lines`

### T14 — Server actions (thin adapters)
`Size M · Depends T13 · Read: 05-api-and-module-design.md §5.2, 00-how-to-use-this-doc-with-agents.md`

**Do:** create new action files **without touching `lib/actions/data.ts`**: `lib/actions/jobs.ts`, `clients.ts`, `line-items.ts`, `documents.ts` with the action names in design §5.2 (`saveJobAction`, `setJobStatusAction`, `saveClientAction`, `saveLineItemAction`, `deleteLineItemAction`, `createDraftDocumentAction`, `saveDocumentAction`, `setDocumentStatusAction`, `createInvoiceFromQuoteAction`, `createInvoiceFromTrackedLinesAction`, `addTrackedLinesToInvoiceAction`, `deleteDraftDocumentAction`). Each: resolve contractor, validate input with zod using the helpers in `lib/actions/form-data.ts`, call the service, `revalidatePath`, return `ActionState` or `redirect`. No business logic inside actions. Add zod schemas next to each action file.

**Tests:** unit tests for the zod input schemas (valid/invalid cases, coercion, bounds).

**Done when:** four standard commands pass; nothing in the UI imports these yet.

**Commit:** `feat(actions): thin server actions over services`

### T15 — Queries v2
`Size M · Depends T13 · Read: 05-api-and-module-design.md §5.3, 06-business-rules.md §6.3`

**Do:** add to `lib/queries.ts` (do not remove old queries yet): `getDocuments(filter, cursor, limit)` (filter by type/status), `getDocument(id)` with lines, `getJobDocuments(jobId)`, `getTrackedLines(jobId)`, `getHome()` (quotes awaiting response, open jobs with unbilled totals, unpaid invoices incl. derived overdue). All scoped by contractor, with `LIMIT` and cursor pagination; totals via SQL aggregates.

**Tests (integration):** pagination boundaries, filters, tenant isolation, unbilled total correctness.

**Done when:** tests and four standard commands pass. **Gate G2.**

**Commit:** `feat(queries): paginated v2 queries for documents, lines and home`

---

## 8. Packets: Phase 4 — Switch the UI (design M2, UI half)

### T16 — Documents list and detail view
`Size M · Depends T14, T15 · Read: 03-target-product.md §3.1 (Documents rows), 07-file-by-file-change-map.md`

**Do:**
1. `app/app/documents/page.tsx`: one list of quotes and invoices with filter chips All / Quotes / Invoices and a status filter; pagination; status badge (derived overdue shown via `isOverdue`).
2. `app/app/documents/[id]/page.tsx` and `components/document-view.tsx`: type-aware **read-only** view: header (type, number, status, client, link to job), lines table, totals with tax label, notes, valid-until or due date.
3. Add a "Documents" nav entry next to the old Quotes/Invoices entries (old routes stay for now).

**Don't:** add editing or action buttons (T17).

**Done when:** four standard commands pass; backfilled POC quotes and invoices open correctly with right totals; unauthorized id → not found.

**Commit:** `feat(ui): unified documents list and read-only detail`

### T17 — Draft editing and status actions
`Size M · Depends T16 · Read: 03-target-product.md §3.1 (document detail), 06-business-rules.md §6.2`

**Do:** in `document-view.tsx`:
- Draft documents: edit lines with `components/line-editor.tsx` wired to `saveLineItemAction` / `deleteLineItemAction` (adapt the component's props; do not duplicate it), notes and valid-until/due-date form.
- Buttons by type and status: Mark sent; quote (sent) Approve / Decline; quote (approved) **Create invoice**; invoice (draft) **Add unbilled job lines (N)** when the job has unbilled tracked lines; invoice (sent) Mark paid; Delete draft; Email (`buildMailto`) and Print.
- Non-draft documents are fully read-only (the lock rule is enforced server-side; the UI just reflects it).

**Done when:** four standard commands pass; manually run the quote → approve → invoice → paid path on a new job; attempting to edit a sent document is impossible in the UI and rejected by the server (try it with a crafted action call).

**Commit:** `feat(ui): edit drafts and drive document status`

### T18 — Job page and job form
`Size M · Depends T17 · Read: 03-target-product.md §3.1 (jobs rows), 06-business-rules.md §6.3`

**Do:**
1. `app/app/jobs/[id]/page.tsx`: job header (status selector quoted/active/done, client, site address, notes), **tracked lines** table (editable via `line-editor.tsx` and `saveLineItemAction` without `documentId`), buttons **New quote**, **New invoice** (`createDraftDocumentAction`), **Create invoice from tracked lines**, and the list of this job's documents (`getJobDocuments`).
2. `components/job-form.tsx` and `app/app/jobs/new/page.tsx`: inline new-client fields (name, email, phone, billing address) or pick an existing client; remove the target date field.
3. Jobs list shows status and unbilled total.
Remove the old job-costs form usage from the page (the component itself is deleted in T20).

**Done when:** four standard commands pass; create a job with a new client in one step; add two tracked lines; Create invoice from tracked lines; the lines show as billed and become read-only.

**Commit:** `feat(ui): job page with tracked lines and document creation`

### T19 — Type-aware print view
`Size S · Depends T17 · Read: 07-file-by-file-change-map.md (print rows)`

**Do:** `app/app/documents/[id]/print/page.tsx` using `components/print-document.tsx` and `print-toolbar.tsx`, made type-aware: title Quote/Invoice, "Valid until" vs "Due date", e-transfer block only on invoices, business number and tax label as today, line items from `line_items`. Update "Print" links in `document-view.tsx`.

**Done when:** four standard commands pass; print views for a quote and an invoice are visually correct and totals match the detail view.

**Commit:** `feat(ui): unified print view for quotes and invoices`

### T20 — Remove legacy code
`Size M · Depends T18, T19 · Read: 07-file-by-file-change-map.md (Delete, Merge rows)`

**Do:**
1. Delete `app/app/quotes/**`, `app/app/invoices/**`, `app/app/clients/**`; `lib/actions/data.ts`; `lib/job-costs.ts` and its test; `components/job-costs-form.tsx`; `components/document-form.tsx` and `components/client-form.tsx` unless T17/T18 reused them; `components/expandable-list-table.tsx` if unused.
2. Remove old queries and old schema references from application code (the old tables stay in `schema.ts` until T21).
3. Nav becomes: Home, Jobs, Documents, Settings. Fix every link (`grep` for `/app/quotes`, `/app/invoices`, `/app/clients`).
4. Home page: link to Documents instead of Quotes/Invoices (full Home is T39).

**Done when:** four standard commands pass; `grep -rn "lib/actions/data\|job-costs\|app/quotes\|app/invoices\|app/clients" app components lib` is empty; the app still works end to end.

**Commit:** `refactor: remove legacy quote/invoice/client code`

### T21 — Contract migration
`Size S · Depends T20 · Read: 04-data-model.md §4.3 (drop section), §4.4`

**Do:**
1. Migration `<timestamp>_v2_contract.sql`: re-run the idempotent backfills (in case old code wrote data), then drop `quotes`, `invoices`, `quote_line_items`, `invoice_line_items`, `job_costs`, `job_receipts`; drop `jobs.target_date`; drop `contractors.plan` and `contractors.stripe_subscription_id` (**keep** `stripe_customer_id`); drop `users.password_hash` only if grep proves it is unused.
2. Update `lib/db/schema.ts` to exactly match design §4.4 (remove old tables and columns). Update every test/seed that referenced them.
3. The RLS test and drift test from T09 must still pass.

**Done when:** four standard commands plus `test:integration` pass on a freshly migrated DB; migration applies on the dev DB with sample data; **Gate G3** manual script passes.

**Commit:** `feat(db): contract migration dropping legacy tables`

---

## 9. Packets: Phase 5 — Test foundation, part 2 (design M2b)

### T22 — Playwright and smoke journey
`Size M · Depends T21 · Read: 15-testing-and-qa-strategy.md §15.5`

**Do:**
1. Add `@playwright/test` (approved dev dependency). Projects: desktop Chrome and iPhone 14.
2. `scripts/mint-session.ts`: mint a valid NextAuth session cookie for a seeded test contractor using the app's own `AUTH_SECRET` (via `next-auth/jwt` `encode`; confirm the cookie name and salt for the installed version). Save to `tests/.auth/contractor.json` as Playwright `storageState`. Must refuse to run when `NODE_ENV=production` or `VERCEL_ENV=production`.
3. `tests/seed-e2e.ts`: seeds the test contractor (business settings, a client).
4. Journey 1 (`tests/e2e/manual-quote-to-invoice.spec.ts`): create job with new client → New quote → add 3 lines → totals/HST correct → mark sent → approve → Create invoice → print view shows the right total → mark sent → mark paid.
5. CI: a job that starts the app and runs this single journey on PRs.

**Done when:** the journey passes locally on both projects and in CI; no test code path exists inside the app itself (no auth backdoor).

**Commit:** `test(e2e): Playwright setup with minted session and smoke journey`

### T23 — Provider fakes
`Size S · Depends T21 · Read: 15-testing-and-qa-strategy.md §15.2, 05-api-and-module-design.md §5.4`

**Do:** create `lib/ai/provider.ts` defining interfaces `ExtractionProvider` (`extractDescribe`, `extractReceipt`) and `TranscriptionProvider` (`transcribe`), plus `lib/ai/fake.ts` implementing them. `AI_PROVIDER=fake|live` selects the implementation (default `fake` outside production; **throw** if `live` is selected without the needed key). `AI_FAKE_MODE=ok|slow|error|malformed|empty` controls behaviour: `ok` returns fixture output keyed by a hash of the input or a default fixture, `slow` adds a delay (`AI_FAKE_DELAY_MS`, default 3000), `error` throws a provider error, `malformed` returns invalid JSON, `empty` returns no lines. Only the interfaces and the fake exist here; the live implementation arrives in T28/T33/T36.

**Tests:** each fake mode behaves as specified.

**Done when:** tests and four standard commands pass. **Gate G4.**

**Commit:** `feat(ai): provider interfaces and deterministic fakes`

---

## 10. Packets: Phase 6 — Capture review (design M3)

### T24 — Capture review: seeded display
`Size M · Depends T21 · Read: 03-target-product.md §3.2 A–B, §3.3`

**Do:**
1. `scripts/seed-captures.ts` (dev only; refuses in production): inserts `needs_review` captures with fixture extraction JSON: a describe-quote, a describe-invoice, a log, a receipt, plus one `failed` capture. Extraction shapes follow design §5.4 schemas (define TypeScript types locally; the zod schemas come in T28).
2. `app/app/captures/[id]/page.tsx` and `components/capture-review.tsx`: **display only** for now: transcript/typed text (or receipt image placeholder), suggested client and job, the line table (read-only), warnings list, the `failed` state ("Couldn't read that, add the lines manually" with a link to the manual path: opens the job page or a new quote draft). A seeded receipt shows each line with no job yet (assignment is T26).
3. `getCapture(id)` query scoped by contractor.

**Done when:** four standard commands pass; all five seeded captures render sensibly; another contractor's capture id is "not found".

**Commit:** `feat(ui): capture review screen (read-only) with seeded data`

### T25 — Capture confirm and discard services
`Size M · Depends T24 · Read: 05-api-and-module-design.md §5.2 (`confirmCaptureAction` contract), 06-business-rules.md §6.4`

**Do:**
1. `lib/services/captures.ts`: `confirmCapture(ctx, input)` implementing the contract in design §5.2 **in one transaction**: verify ownership and `status = needs_review`; create client/job if requested (new job status `quoted` for `createAs = quote`, otherwise `active`); for quote/invoice allocate the number via the document service, insert the document and its owned lines with `capture_id`, compute totals; for `log` insert tracked lines; set capture `confirmed`/`confirmed_at`; bump `updated_at` on every job that received a line. Server-side validation: every line has a price and quantity > 0; a client is chosen except for receipts. Idempotent for already-confirmed captures. `discardCapture(ctx, id)`.
2. Receipt confirm (design D23): `createAs` must be `log`; ignore top-level `client` and `job`; every line requires an owned `jobId`; a missing or foreign job rejects the whole transaction; do not create a document. Lines may land on different jobs.
3. `lib/actions/captures.ts`: `confirmCaptureAction`, `discardCaptureAction` (thin; redirect to the document page for quote/invoice, the job page for a single-job log, and a short per-job result when a receipt touched more than one job).

**Tests (integration):** each `createAs` path produces the expected rows and totals; invalid lines rejected with no partial writes; double confirm is a no-op; discard creates nothing; cross-tenant rejection; receipt-type captures reject `createAs ≠ log`; a receipt split across two owned jobs writes both and bumps both jobs; one foreign `jobId` writes nothing.

**Done when:** tests and four standard commands pass.

**Commit:** `feat(captures): confirm and discard services`

### T26 — Interactive review UI
`Size M · Depends T25 · Read: 03-target-product.md §3.2 A, §3.3`

**Do:** make `capture-review.tsx` interactive:
- **Create as** segmented control (Quote / Invoice / Just add to job), preselected from the extraction's intent (default Quote when null). Receipt captures hide this control and stay on "Just add to job".
- Describe/log: client section (suggested existing client or "New client: {name}" with inline fields) and one job (suggested open job or "New job: {title}" with address). Suggestions use a stub matcher now (exact/normalized name match); T27 supplies fuzzy matching.
- Receipt: no single client/job block. Each line has a job select of the contractor's open jobs, empty until chosen. Unassigned lines are listed first. Selecting lines and choosing **Assign to…** sets that job on the selection. A default job, when the capture has one, pre-fills every line.
- Editable line table reusing `line-editor.tsx`. Labour lines with no price show the contractor's default rate flagged "default rate". Lines with a missing price or a warning are highlighted. **Confirm is disabled** until every line has a price and quantity > 0, and (describe/log) a client is chosen, and (receipt) every line has a job.
- Confirm → `confirmCaptureAction`; Discard → `discardCaptureAction`.

**Done when:** four standard commands pass; with seeded captures confirm each of the four outcomes; a line with no price blocks Confirm; a seeded receipt split across two jobs confirms only when every line has a job. **Gate G5.**

**Commit:** `feat(ui): interactive capture review with create-as selector`

---

## 11. Packets: Phase 7 — Describe by text (design M4)

### T27 — Pure AI helpers
`Size S · Depends T07 · Read: 05-api-and-module-design.md §5.4 (post-processing)`

**Do:** add to `lib/line-items.ts` (pure): `describeToDraft(extraction, { labourRate })`; `receiptToDraft(extraction, { markupPct })` (kind `material`, `unitCost = unit_price`, `unitPrice = applyMarkup(...)`); `receiptWarnings(extraction)` (warn when `|Σ line_total − subtotal| > 0.02` or when `quantity × unit_price` differs from `line_total` by more than 0.02); `fuzzyMatchClient(name, clients)` and `fuzzyMatchJob(title, jobs)` (normalized token overlap, return `{ id, score } | null`, no external libraries). Define the input types structurally (do not import zod schemas; those arrive in T28).

**Tests:** labour default-rate fill and flag; null prices preserved for non-labour; markup rounding; receipt warning thresholds; fuzzy matching (case, punctuation, "Mrs. Patel" vs "Patel, Maria", near-miss returns null below threshold).

**Done when:** tests pass; module still imports only `lib/money.ts`.

**Commit:** `feat(core): describe/receipt draft helpers and fuzzy matching`

### T28 — AI module (describe)
`Size M · Depends T23, T27 · Read: 05-api-and-module-design.md §5.4, 18-shippable…md §18.3 (model governance)`
`Needs from you: ANTHROPIC_API_KEY and EXTRACTION_MODEL in .env.local`

**Do:**
1. Add `@anthropic-ai/sdk` (approved). `lib/ai/schemas.ts` (zod; pure): `DescribeExtraction` and `ReceiptExtraction` exactly as design §5.4.
2. `lib/ai/prompts.ts`: describe system prompt per the rules in design §5.4 (intent detection, spoken-number handling, labour defaults, never invent, CAD, no tax) with a `PROMPT_VERSION` constant. Receipt prompt stub is added in T36.
3. `lib/ai/client.ts` (server-only) and `lib/ai/extract-describe.ts`: live implementation of `ExtractionProvider.extractDescribe` using tool/structured output with `z.toJSONSchema()` from the same zod schema; validate the result with zod again; hard timeout (45 s), one retry with jitter on 429/5xx, none on validation failure; returns `{ extraction, model, latencyMs, inputTokens, outputTokens, promptVersion }`. Model ids come from `EXTRACTION_MODEL` (and optional `EXTRACTION_MODEL_FALLBACK` used after the retry).
4. Wire `AI_PROVIDER=live` to this implementation.

**Tests (no network):** schema accepts valid and rejects malformed output; fake provider modes feed the same parsing path; timeout and retry logic with a stubbed client; prompt snapshot test so accidental edits are visible.

**Done when:** tests and four standard commands pass; with a real key, a one-off script `scripts/try-describe.ts "<text>"` prints a valid extraction for the Patel example in design §1.

**Commit:** `feat(ai): describe extraction with Claude, schemas and prompts`

### T29 — Text capture route, ledger, rate limit
`Size M · Depends T26, T28 · Read: 05-api-and-module-design.md §5.1, §5.6, 13-production-readiness…md §13.6 (cost ledger)`

**Do:**
1. Migration `<timestamp>_captures_ledger.sql`: `captures` gains `latency_ms INTEGER`, `input_tokens INTEGER`, `output_tokens INTEGER`, `prompt_version TEXT`, `feedback TEXT`, `edit_summary JSONB`. Update `schema.ts`.
2. `lib/http/assert-same-origin.ts` (minimal: reject mutating cookie-authenticated requests whose `Origin` / `Sec-Fetch-Site` indicates another site; hardened in T45) and a consistent JSON error helper `{ error: { code, message } }`.
3. `lib/services/capture-rate-limit.ts`: max 30 captures per contractor per rolling hour counted from `captures`.
4. `app/api/captures/text/route.ts` (`runtime = "nodejs"`, `maxDuration = 60`): auth → same-origin → rate limit → validate `{ text (1–4000 chars), jobId? }` → verify job ownership → insert capture (`type = text`, `transcript = text`) → build context `{ labourRate, openJobs[≤50], clients[≤50] }` (names only) → `extractDescribe` via the selected provider → store extraction, model, ledger fields, `status = needs_review` (or `failed` + `error`) → return `{ captureId, status, reviewUrl }`. Extraction failure returns 200 with `status: "failed"`, not an HTTP error. Never log text or model output.
5. Swap T26's stub matcher for `fuzzyMatchClient` / `fuzzyMatchJob`, and apply `describeToDraft` when building the review's initial lines.

**Tests:** contract tests calling the handler with `Request` objects (fake provider): 401 unauthenticated, 400 bad input, 404 foreign job, 429 after the limit, 200 `needs_review`, 200 `failed` for each fake error mode, ledger fields stored, no row for another tenant.

**Done when:** tests and four standard commands pass (all with `AI_PROVIDER=fake`).

**Commit:** `feat(api): text capture endpoint with ledger and rate limit`

### T30 — Describe-it UI
`Size M · Depends T29 · Read: 03-target-product.md §3.1 (Home), §3.2 A, §3.3`

**Do:**
1. `components/capture-bar.tsx`: "Describe it" card with a textarea ("type instead" for now) and example chips; on submit POST to `/api/captures/text`, show a progress state, then navigate to `reviewUrl`. Failed status → review screen shows the fallback.
2. Use it on Home (job not preselected) and on the job page (job preselected via `jobId`).
3. Handle network errors, 429 ("You've hit the hourly limit"), and keep the typed text on any failure.

**Don't:** build the microphone (T34).

**Done when:** four standard commands pass; with the fake provider: type the Patel example → review screen → confirm as Quote → draft quote with correct lines and totals. **Playwright:** add journey 4 (`AI_FAKE_MODE=error` → fallback keeps input) and a "describe → confirm quote" journey.

**Commit:** `feat(ui): describe-it text capture on Home and job page`

### T31 — Describe evals and fixtures
`Size M · Depends T28 · Read: 15-testing-and-qa-strategy.md §15.1 (and §9 of the design doc, "AI extraction evals", in the split file for section 9)`
`Needs from you: 15–25 realistic example descriptions (or approve synthetic ones, clearly labelled)`

**Do:** `lib/ai/fixtures/describe/*.json` (input text, context, expected lines/intent) covering: quote vs invoice vs log phrasing, hours + parts, lump sums, ambiguous numbers ("four fifty"), multiple items per sentence, client named and not named, existing-client matches, trade jargon, and **prompt-injection** attempts. `scripts/eval-extraction.ts` runs them against `AI_PROVIDER=live`, prints: all-lines-correct rate, price accuracy, false-invention rate, intent accuracy, warning-when-uncertain rate, tokens and estimated cost; exits non-zero below thresholds in a config file. Not run in CI (paid).

**Done when:** the script runs against live Claude on staging and you record the baseline numbers in `docs/eval-results.md`. **Gate G6** (together with T30).

**Commit:** `test(ai): describe fixtures and extraction eval script`

### T32 — Feedback and edit telemetry
`Size S · Depends T30 · Read: 18-shippable…md §18.3`

**Do:** "Report a problem" control on the review screen (free text → `captures.feedback`); on confirm compute and store `edit_summary` (`{ added, removed, price_changed, qty_changed, desc_changed }`) by comparing the confirmed lines to the extraction; pure comparison function with unit tests; record `prompt_version` already stored at capture time.

**Done when:** tests and four standard commands pass; confirming an edited draft stores a correct summary.

**Commit:** `feat(captures): problem reports and edit telemetry`

---

## 12. Packets: Phase 8 — Voice (design M5)

### T33 — Transcription and voice route
`Size M · Depends T29 · Read: 05-api-and-module-design.md §5.1 (voice), §5.7`
`Needs from you: OPENAI_API_KEY (or your chosen speech-to-text provider)`

**Do:** `lib/ai/transcribe.ts` live implementation of `TranscriptionProvider` (one function, swappable; `TRANSCRIPTION_MODEL` from env; 30 s timeout; one retry); `app/api/captures/voice/route.ts` accepting multipart `audio` (webm/ogg/mp4/m4a/wav, ≤ 4 MB) and optional `jobId`: auth → same-origin → rate limit → validate size/type → insert capture (`type = voice`) → transcribe → store **transcript only (never the audio)** → same extraction path as text. Reuse shared code from the text route rather than duplicating.

**Tests (fake provider):** same contract matrix as text plus oversize/wrong type → 400/413, transcription failure → `failed` with no audio stored.

**Done when:** tests and four standard commands pass; a real small audio file transcribes with the live provider (manual check).

**Commit:** `feat(api): voice capture with transcription`

### T34 — Voice recorder UI
`Size M · Depends T33, T30 · Read: 05-api-and-module-design.md §5.5`
`Needs from you: a real iPhone and a real Android phone for manual testing`

**Do:** `components/voice-recorder.tsx`: `MediaRecorder` wrapper that picks a supported mime (`audio/webm;codecs=opus` on Chromium/Android, `audio/mp4` on iOS Safari), shows elapsed time, hard-stops at 120 s, clear Stop state, permission-denied and unsupported-browser messages, and keeps the recording for retry if upload fails. Add the Record button to `capture-bar.tsx` (Home and job page). Playwright: journey 2 using the fake mic flags in design §15.5 and the fake provider.

**Done when:** four standard commands pass; Playwright voice journey passes; manual test on a real iPhone (Safari) and Android (Chrome) records and reaches the review screen. **Gate G7.**

**Commit:** `feat(ui): microphone capture for describe-it`

---

## 13. Packets: Phase 9 — Receipts (design M6)

### T35 — Storage and receipt route (no AI yet)
`Size M · Depends T29 · Read: 05-api-and-module-design.md §5.1 (receipt), 13-production-readiness…md §13.1 (uploads)`
`Needs from you: private Supabase Storage bucket "receipts"; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`

**Do:** add `@supabase/supabase-js` (approved; **Storage only**). `lib/storage.ts` (server-only): `uploadReceipt(contractorId, captureId, bytes)` to `receipts/{contractorId}/{captureId}.jpg` and `signedUrl(path, ttl)`. `app/api/captures/receipt/route.ts`: auth → same-origin → rate limit → validate `image` (JPEG/PNG/WebP by **magic bytes**, ≤ 4 MB) and optional `defaultJobId` (ownership verified when present; omitted is valid) → insert capture (`type = receipt`, `job_id` = that default or null) → upload → for now store an empty extraction and `status = needs_review` (extraction arrives in T36). Review screen uses a signed URL for the image. The stored job is only the default for line assignment (D23).

**Tests:** contract tests (fake storage via an interface); wrong magic bytes rejected; foreign `defaultJobId` → 404; upload with no job → 200.

**Done when:** tests and four standard commands pass; a real upload lands in the bucket and the review screen shows the image.

**Commit:** `feat(api): receipt upload with private storage`

### T36 — Receipt extraction
`Size M · Depends T35, T28 · Read: 05-api-and-module-design.md §5.4 (receipt schema and prompt rules)`
`Needs from you: 10–20 redacted receipt photos for fixtures`

**Do:** receipt prompt in `lib/ai/prompts.ts` (extract only what is printed; pre-tax prices; tax separate; omit unreadable lines with a warning; copy printed `line_total`); `lib/ai/extract-receipt.ts` live implementation (vision input, same timeout/retry/validation as describe); wire into the receipt route; apply `receiptToDraft` and `receiptWarnings` when building the review lines (markup from the contractor's `defaultMarkupPct`). Receipt captures confirm only as `log`.

**Tests:** fake provider through the route; helper tests already exist (T27). Add receipt fixtures and extend `scripts/eval-extraction.ts` with a receipts mode.

**Done when:** tests and four standard commands pass; eval baseline for receipts recorded in `docs/eval-results.md`.

**Commit:** `feat(ai): receipt extraction with vision`

### T37 — Receipt uploader UI
`Size M · Depends T36 · Read: 05-api-and-module-design.md §5.5`
`Needs from you: a real phone`

**Do:** `components/receipt-uploader.tsx`: file input (`accept="image/*" capture="environment"`), **client-side downscale** (canvas, max 1600 px long edge, JPEG ≈ 0.8) so requests stay well under the ~4.5 MB serverless body limit, progress and error states. Do not ask for a job before upload. From a job page, send that job as `defaultJobId` so the review screen pre-fills it. Add "Snap receipt" to `capture-bar.tsx`. Playwright journey 3: upload via `setInputFiles` with the fake provider, assign two lines to two different jobs, confirm, and see each job's tracked lines.

**Done when:** four standard commands pass; a large phone photo uploads, its lines can be split across two jobs, and both jobs show the right lines. **Gate G8.**

**Commit:** `feat(ui): receipt photo capture with client-side downscale`

---

## 14. Packets: Phase 10 — Polish (design M7)

### T38 — One-form settings and onboarding; tax scope
`Size M · Depends T21 · Read: 18-shippable…md §18.1, 06-business-rules.md §6.1`

**Do:**
1. Migration adding `contractors.province TEXT` and `contractors.allow_eval_use BOOLEAN NOT NULL DEFAULT FALSE` (with RLS unaffected since the table exists).
2. Collapse `components/onboarding-form.tsx` and `components/settings-form.tsx` into one shared flat form component (fields: business name, address, phone, email, province, GST/HST number, tax rate and label, labour rate, material markup %, e-transfer email and note; settings also has the "allow my captures to improve accuracy" toggle, default off). Target ≤ ~200 lines combined. `saveSettingsAction` / `completeOnboardingAction` call a settings service.
3. Province selection prefills tax label/rate from a small table in `lib/tax.ts` (pure, tested). **Verify every preset against current CRA/provincial rates when implementing and note the sources in a comment**; the user can always edit. Two-tax provinces (BC, SK, MB, QC) show a notice that separate tax lines are not supported yet (design D20).
4. Non-registrants: tax rate `0` allowed; when `0`, the document and print views hide tax lines and the business-number row and no number is required; when > 0 a registration number is required.

**Done when:** tests (`lib/tax.ts`, validation) and four standard commands pass; print views correct for rate 13% and rate 0.

**Commit:** `feat(settings): single settings form, province presets, non-registrant tax`

### T39 — Home final and first-run experience
`Size M · Depends T30, T37 · Read: 18-shippable…md §18.2, 03-target-product.md §3.1`

**Do:** final Home: Describe-it card (text now, mic once T34 is merged), Snap receipt, "Quotes awaiting response", "Open jobs" with unbilled totals, "Unpaid invoices" (with overdue badges) from `getHome()`. First-run: a **"Try it now"** card with three tappable example descriptions that run the normal text capture against a seeded sample client; a dismissible activation checklist (business details saved, first capture confirmed, first document sent, first receipt snapped) derived from existing data (no new tables); one primary action in every empty state.

**Done when:** four standard commands pass; a brand-new account reaches a reviewed draft in under three minutes using only the Try-it card; Playwright first-run journey.

**Commit:** `feat(ui): final home screen and first-run experience`

### T40 — Help pages, mailto send, docs
`Size S · Depends T39 · Read: 18-shippable…md §18.2, 10-configuration…md`

**Do:** five static help pages under `/help/*` (describing a job well, quotes vs invoices, receipts, tax setup, billing placeholder); link them from Settings and the review screen; confirm the Email button (`buildMailto`) works for both document types; update `README.md` (what v2 is, local setup, env vars, scripts), `.env.example`, and `scripts/sync-vercel-env.sh` for the variables introduced so far.

**Done when:** four standard commands pass; README matches reality (no "every account is Pro"). **Gate G9** (core product complete).

**Commit:** `docs: help pages, README and env updates for v2 core`

---

## 15. Outlines: Phase 11 — Production (design M8–M11)

Before running each, ask an agent to expand the outline into a full packet in the same format.

| ID | Outline | Read |
|---|---|---|
| T41 | **Billing model and access state.** Migration `…_billing.sql` (design §14.2, with RLS), schema.ts, `contractors.trial_ends_at` set when the contractor row is created at first sign-in. Pure `lib/billing.ts` with `getAccessState` (`trial`, `active`, `past_due`, `ending`, `expired`; precedence per §14.3) and table-driven tests incl. boundary timestamps. | §14 |
| T42 | **`requireActiveAccess()`** called at the top of every create/modify service entry and capture route (402 JSON for routes); exemptions: view, PDF, export, settings, billing, delete account. Read-only UI states and a global status banner. Tests per exemption. | §14.3, §14.5 |
| T43 | **Stripe Checkout, Portal, `/app/billing`, landing pricing section.** `startCheckoutAction(interval)`, success-URL reconciliation (retrieve session, verify customer, upsert subscription immediately), `createPortalSessionAction`. You: Stripe test account, CAD prices, env vars, portal configuration. | §14.4–14.6 |
| T44 | **Stripe webhook** (`/api/stripe/webhook`): raw-body signature verification, `stripe_events` idempotency, re-fetch subscription from Stripe, handlers per §14.4, retries on 500. Signed-fixture tests: duplicate, out-of-order, unknown type, bad signature, handler error then retry. README: Stripe CLI instructions. | §14.4, §14.7 |
| T45 | **Security hardening:** headers (CSP report-only first, HSTS, nosniff, referrer, permissions-policy), harden `assertSameOrigin`, upload magic-byte checks everywhere, per-IP rate limits on auth and capture routes, set `max`/`idle_timeout`/`connect_timeout` in `lib/db/index.ts`, Dependabot + CodeQL + `npm audit` in CI, secret scanning notes. | §13.1, §13.8 |
| T46 | **Observability:** Sentry with PII scrubbing, `/api/health` (cheap DB query), analytics events from §13.6, kill switches `AI_CAPTURE_ENABLED` and `MAINTENANCE_MODE` (UI banners, capture routes respond with the manual-path message), AI cost query documented. | §13.6 |
| T47 | **Account export and deletion:** zip of JSON+CSV (clients, jobs, documents, lines) always available; deletion flow (type business name, cancel Stripe subscription if any, delete Storage objects, delete all rows in one transaction, confirmation email later via T49). Integration test: no rows with the contractor id remain. | §13.2 |
| T48 | **Legal pages and Sign in with Apple:** Terms, Privacy, subprocessors, refund/cancellation skeletons (lawyer review required), AI disclosure; NextAuth Apple provider alongside Google; runbook for the rotating Apple client secret. You: Apple Developer account, Services ID, keys; lawyer. | §13.2, §13.5 |
| T49 | **Email and cron:** Resend client behind `EMAIL_PROVIDER=fake|resend`, `email_log` with `dedupe_key`, emails (welcome, trial ending, payment failed, account deleted), `GET /api/cron/daily` secured by `CRON_SECRET` (trial reminders, purge of failed/discarded captures > 30 days including images), `vercel.json` cron. You: sending domain DNS (SPF/DKIM/DMARC). | §13.3 |
| T50 | **Share links and client approval:** `documents.share_token`, `closed_by`, `client_note` (migration), public `/d/[token]` (read-only, `noindex`, rate-limited) with Approve/Decline on quotes, contractor notification email, token regeneration; "Send" emails the client with link (PDF attached after T51); mailto remains fallback. | §13.4 |
| T51 | **Server-side PDF** with `@react-pdf/renderer`: `GET /api/documents/[id]/pdf` (authenticated) and share-link equivalent; delete the HTML print view and `/print` routes; "Print" opens the PDF; PDF text assertions in tests (totals, tax label, business number, e-transfer line). | §13.4 |
| T52 | **Load test suite:** `scripts/seed-load-data.ts` (N synthetic contractors with realistic volumes plus minted sessions), k6 scenarios (browse, work, capture with fake slow AI, share links, webhook burst, mixed) and profiles (smoke, load to 2,000 VUs, spike, soak, stress) with thresholds from §15.6; run **only on staging** with fakes enabled; write `docs/performance.md`. You: staging Supabase/Vercel, spend alerts. | §15.6 |
| T53 | **Fault injection and automation:** exercise fake modes `error/malformed/empty/slow` plus a 60 s hang end to end; Stripe replay/out-of-order tests; DB-connection-kill test on staging; restore drill script and recorded timings; synthetic production monitor; `nightly.yml` and `release-gate.yml` workflows per §15.8. | §15.7–15.8 |
| T54 | **Runbooks** in `docs/runbooks/`: Stripe webhook failing, AI outage, restore drill, secret rotation (incl. Apple secret), bad deploy rollback, migration failure. Tick the launch checklist items in design §17 that are now true. **Gate G10.** | §13.6, §17 |

---

## 16. Outlines: Phase 12 — Mobile (design M12–M14)

| ID | Outline | Read |
|---|---|---|
| T55 | **Architecture audit:** find any logic living only in Server Actions and move it to `lib/services`; add the ESLint `no-restricted-imports` rule that keeps `lib/money.ts`, `lib/line-items.ts`, `lib/documents.ts`, `lib/billing.ts`, `lib/ai/schemas.ts` free of Next/React/DB imports. | §16.2 |
| T56 | **API v1 foundation:** `getContractorFromRequest` (session cookie **or** `Authorization: Bearer`), consistent error shape, cursor pagination helper, `Idempotency-Key` table and helper (24 h), `mobile_sessions` migration, `/api/v1/auth/google|apple|refresh|logout` (verify native ID tokens with `jose`, rotate hashed refresh tokens). Contract tests. | §16.3–16.4 |
| T57 | **API v1 resources:** me/settings, clients, jobs, lines, documents (incl. status, send, invoice-from-quote), all thin over services, `requireActiveAccess` on mutations. Contract tests per endpoint. | §16.3 |
| T58 | **API v1 captures, billing, account, devices:** capture endpoints reuse the existing handlers' logic via shared services; `GET /billing`, checkout/portal URL endpoints; account export/delete; `POST /devices` (push token). Generate OpenAPI from the zod schemas; publish `docs/api/openapi.json`. | §16.3 |
| T59 | **Monorepo conversion:** npm workspaces `apps/web`, `packages/core` (money, line-items, documents, billing access state, zod schemas/API types), scaffold `apps/mobile`. Full CI and Playwright green after the move; no behaviour change. | §16.5 |
| T60 | **PWA:** manifest, icons, installable shell; verify mic and camera work from an iPhone home-screen install. You: iPhone. | §16.1 |
| T61 | **Expo scaffold and sign-in:** Expo Router app, EAS config, Google and Sign in with Apple, tokens in Keychain (`expo-secure-store`), API client generated from OpenAPI, Sentry. You: Apple Developer account, OAuth clients. | §16.4–16.5 |
| T62 | **Expo capture and review:** Home with Record (`expo-audio`), Snap (`expo-camera`/`expo-image-picker` with downscale), type-instead, and the review screen (create-as selector, client/job suggestion, line editor, confirm blocking). | §16.5 |
| T63 | **Expo jobs, documents, share, settings:** lists and detail, share PDF via the native share sheet from `GET /documents/:id/pdf`, billing state with the Apple-compliant approach chosen (design §16.6), export and in-app account deletion. | §16.5–16.6 |
| T64 | **Offline queue and push:** capture queue with idempotency keys (airplane-mode capture uploads exactly once on reconnect), optional push for quote decisions (`expo-notifications`, `push_tokens`). | §16.5 |
| T65 | **TestFlight, Maestro, store checklist:** Maestro flows, TestFlight internal then external beta, App Store Connect listing, privacy label, reviewer demo account, submission and iteration. You: everything account-related. **Gate G11.** | §16.7–16.8, §17 |

---

## 17. Human tasks by phase (things agents cannot do)

| Phase | You |
|---|---|
| Before T08 | Local Postgres and sample data (H0). |
| Before T28 | Anthropic Console account, prepaid credits, API key, `EXTRACTION_MODEL` (and fallback). |
| Before T31 | Real example descriptions (or approve synthetic ones). |
| Before T33 | Speech-to-text provider key. |
| Before T35 | Supabase project, private `receipts` bucket, service-role key; production vs staging projects. |
| Before T36 | 10–20 redacted receipt photos. |
| G7, G8 | Test on real iPhone and Android. |
| Before private beta | Final product name, domain, company mailbox; T45, T47, T48; recruit 5–10 contractors; apply to Claude Startups (design §19) once the landing page and the Patel demo exist (after G6). |
| Before T43 | Stripe account (test mode), CAD prices, portal configuration; accountant on GST/HST registration. |
| Before T48 | Apple Developer Program membership, Services ID/keys, Google OAuth consent screen published; lawyer review of legal pages. |
| Before T49 | Sending-domain DNS records for Resend. |
| Before T52 | Separate staging Supabase project and Vercel environment; spend alerts on all providers. |
| Before T65 | App Store Connect app, screenshots, reviewer demo account, payment-approach decision (design §16.6). |
