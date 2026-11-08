# Plan agent

First of the three features. Text only. The microphone and receipt photos use this same preview later.

## What it is

Plan is where the contractor talks to the business. A typed message becomes a proposal. The proposal names one action and shows the details. Nothing is written until they confirm.

The model does not call the database. It fills a proposal. Confirm calls the services that already create jobs, lines, quotes, and invoices.

## Actions

The first version proposes one of these:

| Action | What the preview shows | What confirm writes |
|---|---|---|
| Create a job | Title, client, site | A job. New client only if the name does not match one they have. |
| Add materials | Job, each material, quantity, cost or price | Tracked material lines on that job. Unbilled. |
| Log hours | Job, description, hours | Tracked labour lines on that job, using their labour rate when they did not name a price. |
| Make a quote | Job, lines, notes | A draft quote on that job. |
| Make an invoice | Job, lines, notes | A draft invoice on that job. |

If they already picked a job in Plan, the proposal uses that job. If the words ask to bill someone, the action is Make an invoice. Otherwise work on an existing job is Add materials or Log hours. A message with no job yet is Create a job, or Make a quote when they are pricing new work.

One message, one action. A request that needs two actions is split: the preview says what it will do now, and what is left for the next message.

## What the contractor sees

The message stays in the Plan thread. Under it, a preview card:

- The action name, in plain language ("Add these materials to kitchen").
- The job, client, and lines.
- A warning on any line missing a price or a quantity.
- Confirm, Change, and Cancel.

Confirm saves and opens the job or the document. Change opens the fields already on the review screen. Cancel drops the proposal and leaves the message in the thread.

If the model cannot read the message, the text stays and the card says it could not tell what to do.

## What is stored

No new table. The proposal is the existing `captures` row:

- `type = text`
- `transcript` is the message
- `extraction` is the proposal, including the action
- `status = needs_review` until confirm or cancel

Confirm uses the current confirm service. Totals, tax, and rounding stay in `lib/money.ts`. The model never supplies a document total.

## Out of scope

- Microphone and photos
- Chat history across visits
- Editing a sent quote, marking paid, or changing settings
- More than one action from a single confirm

## Done when

Type "add a valve at $45 to the kitchen" and the preview says it will add that material to kitchen. Confirm creates one unbilled line and does not create an invoice. Type a new quote and the preview says it will make a draft quote. Cancel writes nothing.

## How it is built

- The model still fills the existing describe extraction (intent, names, lines). App code in `lib/plan-proposal.ts` picks the one action, matches the job and client the contractor already has, and keeps only the lines that action writes. The result is stored in `captures.extraction` with `action`, `job_id` and `client_id`.
- Confirm (`lib/services/plan-proposals.ts`) reads the stored proposal, not anything the browser sends, and calls `confirmCapture` (materials, hours, quotes, invoices) or `createJobWithClient` (create a job).
- Labour with no spoken price takes the contractor labour rate. Materials with no price block Confirm. No total is shown or supplied by the model.
- A job already selected in Plan is always used, so a selected job never becomes a quote. A job only named in the words becomes a quote when the message prices work.
