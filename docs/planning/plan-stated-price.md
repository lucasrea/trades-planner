# A stated price stays on the line

Logging hours with no rate still uses the contractor's labour rate. That part stays. The bug is the other case: the contractor named a price, the model left `unit_price` empty, and Confirm saved the labour rate instead.

## What the contractor sees

On the proposal card, a labour line with no price still shows the labour rate and the note "Using your labour rate" when the message did not name a price. Confirm stays available.

When the message itself names a price (`$80`, `80 dollars`, `at 80`) and a labour line came back with no price, Confirm is off. The card says the named price was not put on the labour line, and Change is the way to set it. Confirm cannot be forced from the server either.

Materials with a missing price already block Confirm. Leave that as it is.

## How to tell

A small pure function reads the transcript. It matches a dollar sign, the word "dollars", or "at" plus a number. It does not treat "1 hour" or "four hours" as a price. No model call. The function lives next to the other pure plan helpers and has tests.

`previewProposal` and `toConfirmPlan` take the transcript. A named price plus a labour line whose `unit_price` is null adds a blocker. The labour rate is not written onto that line.

## Out of scope

- Calling the live model, or running the paid eval script
- Changing tax, totals, or rounding
- Receipt photos (those already warn when a line total does not match)
- Guessing a price from words like "eighty"

## Done when

"Log 1 hour on the kitchen" still previews at the labour rate and can be confirmed. "Log 1 hour at 80 dollars" with an empty labour `unit_price` cannot be confirmed, and the saved line is not $85. A quote line that already has `unit_price` 80 confirms at 80.
