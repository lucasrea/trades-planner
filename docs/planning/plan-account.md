# Account export, deletion, and the legal pages

Before anyone else signs up, a contractor can take their data and delete the account. The public legal pages say what the AI does. Pages send basic security headers.

## What the contractor sees

Settings, under the business form:

- **Download my data.** One JSON file of the rows they own: contractor, clients, jobs, documents, lines, plans, plan messages, and captures (transcript, status, extraction). No audio. Receipt rows include the storage path, not the image bytes.
- **Delete account.** They type the business name. The account's rows and receipt objects are deleted, then they are signed out. A wrong name does nothing.

The Privacy page says typed text, voice transcripts, and receipt photos are sent to the model provider to draft lines, are stored for the account, and are removed when the account is deleted. Audio files are not kept.

The Terms page says they must check totals, tax, and names before sending a document, and that deleting the account removes their data.

Every HTML response includes:

- `Strict-Transport-Security` (production only is fine)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy` allowing microphone and camera for this origin only

## What is stored

No new table. Export only reads. Deletion removes their rows in one transaction, deletes their receipt objects, then signs them out. Another contractor's rows stay.

## Out of scope

- Sign in with Apple
- Sentry, analytics, or a new error vendor
- Stripe, billing, or a deletion email
- CSV or a zip

## Done when

Export contains only that contractor's rows. Delete with the right business name removes their rows and receipt objects and signs them out. The wrong name deletes nothing. Privacy mentions the model. A page response includes the headers above.
