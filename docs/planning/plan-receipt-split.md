# One receipt, more than one job

This is already shipped. No further work.

After a receipt photo, `/app/captures/[id]` lets each line point at a job, including a job started from that screen. Confirm writes unbilled materials onto those jobs and does not create an invoice. Totals and markup stay in `lib/money.ts`.

The integration test "writes unbilled material lines on each assigned job and creates no invoice" covers two jobs from one capture.

Leave this file as the record. Do not rebuild the review screen.
