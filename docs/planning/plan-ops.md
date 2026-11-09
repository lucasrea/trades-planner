# See a failure, and stop a public link from being hammered

Three small holes. No new vendor and no new dependency.

## Capture off switch

`AI_CAPTURE_ENABLED=false` makes `POST /api/captures/text`, `/voice`, and `/receipt` return 503 with "Capture is turned off." They do not call the model and do not write a capture. Unset or any other value leaves capture on.

## A plan-thread failure does not hide the capture

Text, voice, and receipt already store the capture, then write the plan thread. If that second write throws, the route today returns 500 and the capture is stranded.

Catch that error. Log one line: event `plan_turn_failed`, the capture id, and the contractor id. Do not log the transcript, the photo, or the model output. Return the capture result anyway, with `planId` null, so the review page still opens.

## Approve link limit

A public quote link can be posted without a limit. Add `attempt_count` and `attempt_window_start` on `document_links`. Each approve or decline counts. More than 30 attempts in an hour on that token returns a validation error and does not change the quote. The public page shows that message. A settled quote still returns the stored answer and still counts toward the limit.

The migration only adds columns. Row Level Security is already on. Do not edit an applied migration.

## Out of scope

- Sentry or any new package
- Rate limiting signed-in document actions
- Retrying a failed receipt upload

## Done when

The off switch returns 503 and writes nothing. A thrown plan-thread write still returns the capture id and logs the event without the transcript. The 31st approve attempt in an hour on one token changes nothing. Another token is unaffected.
