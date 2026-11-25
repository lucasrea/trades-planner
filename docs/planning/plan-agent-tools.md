# Plan agent tools

**Status:** built in the pull request that adds this file's tools (branch `task/agent-tools-plan`). Each "Done when" item has a scripted-model test in `apps/web/tests/integration/plan-tools.test.ts`. The live-model conversation eval (Tests, last item) is not built yet.

The Plan agent can read three things today: the job list, one job's paperwork, and unbilled work. It can write one kind of card. Most questions a contractor asks about their own business fall outside that, so the agent dead-ends ("Which job?") or ends with nothing and shows "I couldn't read that. Add it yourself."

This plan gives the agent tools that cover the whole paperwork loop: finding things, answering about money, changing paperwork, sending it, and undoing a mistake. It also fixes the places a conversation can dead-end. Every write still goes through a card the contractor confirms, and every card confirms through an existing service. Two small services are new and are named below. It ships as **one pull request**.

## The failure this fixes

> how many open quotes do i have
> *Which job? I see kitchen, Water heater replacement, E2E probe, new bathroom.*
> for all of them
> *I couldn't read that. Your message is saved. Add it yourself*

1. The rule-based question layer answered first. It only knows one job's paperwork, so it returned "Which job?" instead of handing the question to the model.
2. On the follow-up, the model's only quote tool (`lookup paperwork`) needs one job and returned the same "Which job?" text.
3. The model ended with no card and no reply. The fallback treats that as a failed attempt to add work.

## Principles

- **Read tools return data, not sentences.** Each returns rows plus a `count`. Any money total is computed by the app with `lib/money.ts`, so the model repeats numbers and never adds them up.
- **Ids, not titles.** Read tools return each row's `id`. Tools that act on a row take that `id`, and the server checks it belongs to this contractor; otherwise it is "not found". Fuzzy title matching stays only as the fallback for words the contractor typed.
- **Grouped by object.** One read tool per kind of thing and one proposal tool per kind of change, with an `action` field where a change has variants. That makes 17 tools in all. Each description says when to use it and when not to.
- **Writes are proposals.** Each `propose_*` call stores a card. Nothing changes until Confirm, and Confirm calls the service named below. The card shows exactly what will change, and shows old and new values when something is edited.
- **Prices come from the contractor.** A price on a card must be one they said (today's rule) or one copied from their own records through `search_lines`. In the second case the card names the source ("$780, from Q-0003, 12 Mar") and the server checks that the record has that price.
- **Every tool is scoped by `contractor_id`, and results are capped** at 20 rows, with `more: N` when there are more.
- **Every turn ends with something useful:** a card, an answer, or a question with choices. Never an empty turn.

## Status words

The model maps the contractor's words onto these filters. The app owns the definitions.

| Word | Means |
|---|---|
| open quote | quote, `draft` or `sent` (the result counts each) |
| waiting quote | quote, `sent` (matches Home's "Quotes waiting") |
| approved, declined | quote with that status |
| unpaid invoice | invoice, `sent` |
| overdue | invoice, `sent`, past `due_date` (`isOverdue`) |
| paid | invoice, `paid` |
| draft | either type, `draft` |
| open job | job `quoted` or `active` |

## Read tools (7)

| Tool | Use it for | Input | Returns | Backed by |
|---|---|---|---|---|
| `find_jobs` | "my jobs", "which jobs have unbilled work", "the Patel job" | `query?`, `status?`, `client_id?`, `has_unbilled?` | `count`, then rows: `id`, title, client, status, site, `unbilled_total`, open quote count, unpaid invoice count, updated | `listJobs`, plus the unbilled sum from `queries-v2` |
| `get_job` | "what's on the kitchen job" | `job_id` | The job and its client; its unbilled lines with `unbilled_total`; its documents (number, type, status, total); receipt cost against billed amount | `requireJob`, `getTrackedLinesForContractor`, `getJobDocumentsForContractor` |
| `find_documents` | "how many open quotes", "who owes me", "what's overdue", "Q-0003" | `type?`, `status?` (a status word), `job_id?`, `client_id?`, `number?`, `since?`, `until?` | `count`, a count per status, `total` for the matched rows, then rows: `id`, number, type, status, job, client, total, sent date, due or valid-until date, overdue | `getDocumentsForContractor`, extended with filters, and `isOverdue` |
| `get_document` | "what's in Q-0003", "can I still edit it" | `document_id` or `number` | The document, its lines (with ids) and totals, whether a share link is active, and the changes allowed next | `getDocumentWithLines`, `documentActions`, `getActiveLinkToken` |
| `find_clients` | "Patel's email", "do I have a client called Chen" | `query` | `count`, then rows: `id`, name, email, phone, address, open job count | `listClients` |
| `search_lines` | "what did I charge for a water heater last time", "when did I buy the PEX crimper", "what did I spend at Home Depot this month" | `query?`, `kind?`, `job_id?`, `source?` (quoted, invoiced, tracked, receipt), `since?`, `until?` | `count`, the last price, the lowest and highest price, a total cost and a total sell, then rows: `id`, description, quantity, unit, unit cost, unit price, job, document number or "receipt from vendor", date | `line_items` and `captures`, a new read in `queries-v2` |
| `business_snapshot` | "how am I doing", "what do I need to do today", "what's owed to me" | `period?` (today, week, month) | Owed (unpaid total and count), of which overdue; quotes waiting (count and total); unbilled across jobs; paid in the period; and a to-do list: cards waiting for Confirm, unsent drafts, receipts not reviewed, overdue invoices, and quotes waiting more than 7 days | `getHomeForContractor`, extended |

`lookup` is removed. Its unbilled-across-all-jobs case becomes `find_jobs` with `has_unbilled: true`.

## Proposal tools (8)

Each call creates one card. Several calls in one turn give several cards.

| Tool | `action` | Card says | Confirm calls |
|---|---|---|---|
| `propose_work` (today's `propose`, renamed) | quote, invoice, log, create a job | "Make a draft quote for Kitchen", and so on. Accepts `job_id`, `client_id`, and an optional `price_source` line id per line. | `confirmCapture` or `createJobWithClient` |
| `propose_invoice` | from unbilled work (`job_id`), from an approved quote (`quote_id`) | "Invoice the unbilled work on Kitchen" or "Invoice approved quote Q-0003" | `createInvoiceFromTrackedLines`, `createInvoiceFromQuote` |
| `propose_document_change` | mark sent, approved, declined or paid; add lines; change a line; remove a line; set dates and notes; add unbilled work to a draft invoice; delete a draft | "Mark INV-0004 paid ($1,265.60)", "Add a $50 disposal fee to Q-0004", "Change labour on Q-0004 from 4 to 5 h" | `setDocumentStatus`, `saveDocumentLine`, `deleteLine`, `saveDocumentMeta`, `addTrackedLinesToInvoice`, `deleteDraftDocument`. The preview refuses what `canTransition` or `isLocked` forbids. |
| `propose_job_change` | set status; edit title, site or notes; move unbilled lines to another job | "Mark Kitchen done", "Move 2 receipt lines from Kitchen to Bathroom" | `setJobStatus`, `updateJob`, **new** `moveTrackedLines` (unbilled lines only, one transaction) |
| `propose_client` | create; update email, phone or address | "Update Patel's email to …" | `saveClient` |
| `propose_send` | email the document link; copy the link; send a payment reminder for an unpaid invoice | "Email Q-0003 to Patel (patel@…)", "Remind Chen INV-0004 is 12 days overdue" | `createDocumentLink`, then `sendDocumentEmailToClient` (reminder wording for invoices). Copy-link only when the client has no email or email is off. |
| `propose_settings` | labour rate, material markup, tax label and rate, e-transfer details | "Labour rate $85 → $95/h. Applies to new lines only." | **new** `saveSettings`, pulled out of `updateSettingsAction` so the form and Plan share it |
| `propose_undo` | undo a card confirmed earlier in this plan | "Undo: delete draft Q-0005", "Undo: remove 3 hours from Kitchen" | `deleteDraftDocument` for an unsent draft it created, `deleteLine` for unbilled lines it added. Refused once the draft was sent or the lines were billed. |

Sending and reminders are outward-facing, so they are always cards and never automatic. The share-link attempt limit and the email settings apply as they do today.

## Conversation tools (2)

| Tool | Input | What the contractor sees |
|---|---|---|
| `reply` (today's) | `text` | Plain text |
| `ask` | `question`, `options` (up to 6: `label`, plus an optional `job_id`, `client_id` or `document_id`) | The question with tappable choices. A tap sends the label as the next message, with the chosen id as the selected job when there is one. |

`ask` replaces every "Which job? I see …" dead end, including the rule-based one.

## Loop changes

- **No empty turns.** If the loop ends with no card, reply or ask, run one more step that may only call `reply` or `ask`. If that fails, reply: "I couldn't work that out. Name the job or the document and try again." Show "Add it yourself" only when the message asked to add, quote or invoice and the drafting failed.
- **Rules answer only what they can finish.** Plain adds, `invoice_tracked` and greetings stay. A question the rules cannot fully answer goes to the model with tools instead of "Which job?". Questions then call the model, so they count toward the hourly limit again. Raise the limit from 30 to 60.
- **Steps.** Raise `PLAN_LOOP_MAX_STEPS` from 4 to 6 inside the existing 40 s budget, so find, get, propose and reply fit in one turn.
- **Context.** The context note adds today's date and the time zone (`America/Toronto` until a setting exists) for "this week" and "overdue". It also adds the material markup and tax label next to the labour rate.
- **Follow-ups.** Thread history stores reply text only, so a follow-up such as "for all of them" re-runs a find. That is cheap and avoids stale ids.
- **Trace.** Each turn logs one line, `plan_turn_finished`: the tools called, each one's ok or error and milliseconds, the step count, the outcome (card, reply, ask, or failed) and the total time. Ids only, never message text. That answers "why did it fail" from the Vercel logs.
- **Prompt.** Bump `PLAN_LOOP_VERSION`. Describe the status words; "find first, then act on ids"; "ask when more than one row matches"; "never add numbers, use `count` and `total`"; "a price comes from the contractor or from `search_lines` with `price_source`".

## Cards and screens

- **A change card** for the status, job, client, settings, send and undo actions. It has no line table: one sentence, old and new values when something is edited, then Confirm and Cancel.
- **The line card** for `propose_work`, with a "from Q-0003" note on lines priced from records. The `invoice_tracked` card stays read-only.
- **`ask` choices** on the web Plan screen. The phone gets them in Phase 3 of `plan-production.md`.

## Out of scope

- Deleting a sent document, a job, a client, or a billed line.
- Editing a sent or locked document.
- Payments, Stripe, scheduling, or messages sent later on a timer.
- Duplicating a whole document (out of scope in `v2-design.md`). `search_lines` plus `propose_work` covers "same price as last time".
- Free-form database queries or a model-written SQL tool.

## Done when

One pull request, merged when CI is green and the read-only review passes:

1. The conversation above answers "3 open quotes: 2 waiting on the client, 1 draft", and "for all of them" after a question also answers.
2. "What's on the kitchen job", "what's in Q-0003", "Patel's email", "who owes me", "what's overdue" and "what do I need to do today" answer from data. Contractor A never sees contractor B's rows.
3. "Patel approved, invoice it" gives the status card and the invoice card. Both confirm through the services, and nothing is ever billed twice.
4. "Add a $50 disposal fee to Q-0004" edits the draft. The same message for a sent quote is refused on the card with the reason.
5. "Same price as the last water heater" puts the recorded price on the card, citing its source. A price that is in neither the message nor the records is still blocked.
6. "Send Patel the quote" and "remind Chen to pay" preview the recipient, and Confirm sends exactly once.
7. "Undo that" reverses the last confirmed card while it is still a draft or unbilled, and refuses after that.
8. No turn ends empty, and every turn logs `plan_turn_finished`.

## Tests

- **Every tool's arguments:** lenient where safe (missing optional fields), with a clear error the model can act on otherwise.
- **Every read tool against Postgres:** scoped by `contractor_id`; an id from another contractor is not found; `count` and `total` match what `lib/money.ts` computes from the rows.
- **Every proposal tool:** preview, confirm, a second confirm (idempotent), a confirm after the data changed, a confirm the status rules forbid, and cancel.
- **Scripted-model conversations:** a fake client calls the tools in a fixed order, so whole turns run in CI without a real model. They cover each "Done when" case and this page's conversation.
- **A conversation eval** against the live model, run on demand and not in CI. It uses the same multi-turn fixtures, scores the tools called, the final card or answer, and empty turns, and gates prompt and model changes.
