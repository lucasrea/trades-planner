# After confirm

Confirm already saves and opens the job or the document. This makes the next paperwork step obvious on a phone. It does not add a new way to save.

## What the contractor sees

When confirm opens a draft quote or invoice, the top of that page shows, in one column on a narrow screen:

- Print, as the primary action
- Email, when the client has an email (the existing mailto link)
- Mark sent

The labels are fully visible at 390px wide. The line editor stays below those actions.

When confirm opens a job that has unbilled lines (materials, hours, or a receipt), the top of that job shows:

- The unbilled total
- **Create invoice from tracked lines** as the primary action
- New quote and New invoice, still available, as secondary actions

A job with nothing unbilled keeps New quote and New invoice as they are today.

## Out of scope

- Share links, a public client page, or a server-side PDF
- Changing what confirm writes, or any total, tax, or rounding
- Rewriting the line editor

## Done when

Confirm a draft quote and the document page leads with Print, Email when there is an address, and Mark sent, readable at 390px. Confirm logged materials and the job page leads with the unbilled total and Create invoice from tracked lines. A job with no unbilled lines does not show that invoice button as the primary action.
