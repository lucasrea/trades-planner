# Saved plans

The Plan screen keeps every conversation. A contractor can start a new one, leave, and come back to any of them.

## What the contractor sees

- **New plan** sits on the Plan screen. It starts an empty thread and that thread becomes the current plan.
- Their plans are listed, newest first. Each row shows the title and when it was last used. Opening one loads that thread.
- The open plan shows the messages already saved: what they typed, the voice transcript, a one-line receipt note, and what the preview did (waiting, confirmed, or cancelled).
- A typed message, a recording, or a receipt is added to the open plan. If none is open, the first message creates one.
- The title is the first message, shortened. There is no rename screen.

Refreshing the page shows the same plan and the same messages.

## What is stored

Two tables. Every row has `contractor_id`. The migration enables Row Level Security. Every query is scoped by `contractor_id`. A plan id from another contractor is not found.

`plans`: id, contractor_id, title, created_at, updated_at.

`plan_messages`: id, plan_id, contractor_id, role (`user` or `plan`), body, capture_id (nullable), created_at.

The user body is the typed text, the voice transcript, or a one-line receipt note. Audio is still not stored. The photo stays on the capture.

The plan reply stores the preview title and whether it was confirmed or cancelled. It does not store a second copy of totals. Confirm still calls the existing services. Totals stay in `lib/money.ts`.

## Out of scope

- Renaming or deleting a plan
- Sharing a plan
- Search
- The phone app
- Keeping audio

## Done when

Start a plan, send two messages, refresh, and see both. New plan leaves the old one in the list. Opening the old one shows its messages and not the new plan's. Another contractor's plans never appear. Voice and a receipt still preview and confirm as they do now, and both show up in the plan after a refresh.
