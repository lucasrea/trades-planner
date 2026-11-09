# One quote in one message

A quote or an invoice stated in one message is one confirm. Hours and materials in that message stay on the same draft. Logging work onto a job that is already open stays one kind of line per message, as it is today.

## What the contractor sees

"Quote for Chen, kitchen, four hours and a valve at $45" previews **Make a draft quote** with both lines. Confirm creates one draft quote. It does not ask them to send the hours in a second message.

The same for an invoice: every line in the message is on that one draft invoice.

If a job is already selected in Plan and the message is a quote or an invoice, the draft still includes every line. Selecting a job does not turn a quote into "add materials only".

"Add a valve and log an hour on the kitchen", with no quote or invoice, still does one of those and says what was left out.

## What changes

`chooseAction` returns `make_quote` or `make_invoice` from the intent even when a job is selected. `buildProposal` already keeps every line for those two actions. Do not drop labour or materials on a quote or invoice.

Client and job matching stay as they are. A new client or job is still created on confirm when the message names one that does not exist. Totals stay in `lib/money.ts`.

## Out of scope

- A second document from the same message
- Changing the log-hours / add-materials split for messages that are not a quote or an invoice
- Editing the model prompt, unless a test shows the fake provider cannot return both lines

## Done when

A quote message with one labour line and one material line previews both and confirm writes one draft quote with both lines. An invoice does the same. A selected job does not strip the labour line off a quote. A log message that mixes hours and materials still keeps one kind and names the rest.
