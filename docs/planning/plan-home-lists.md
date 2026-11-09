# Unfinished work on Home

Home stays the plan thread. Under the thread, Home also shows the paperwork that is still open. The query for this already exists: `getHomeForContractor`.

## What the contractor sees

Three short lists, omitted when empty:

- **Quotes waiting.** Sent quotes. Each row is the number, the client, and the total, and it opens that document.
- **Open jobs.** Quoted and active jobs. Each row is the title, the client, and the unbilled total, and it opens that job.
- **Unpaid invoices.** Sent invoices. Each row is the number, the client, the total, and "Overdue" when the existing overdue rule says so. It opens that document.

On a wide screen the lists sit beside the thread. On a phone they sit under it. Ten jobs, ten quotes, twenty invoices, matching the query limits.

The unbilled figure is the sum already stored on the tracked lines. Display it with `cad`. Do not recompute tax.

## Out of scope

- A new dashboard route
- Marking sent, paid, or approved from these lists
- Changing the plan sidebar

## Done when

A sent quote, an active job with an unbilled line, and a sent invoice each show on Home and open the right page. A second contractor's rows do not. An empty account shows no empty headings. Drafts and paid invoices do not appear in these lists.
