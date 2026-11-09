# Email the document

From a draft or sent quote or invoice, the contractor can email the client the document. The message is the number, the total already stored on the document, and the share link. It is not a PDF file. Print stays as it is.

## What the contractor sees

On the document page, next to the existing Email link:

- When the client has an email and `EMAIL_PROVIDER` is `resend` or `fake`, a button **Email client**.
- The button creates a share link when the document is draft or sent and does not have one yet. It uses the existing link service. It does not create a link on an approved, declined, or paid document.
- Success says the email was sent. Failure says it was not, and nothing about the provider key.
- When `EMAIL_PROVIDER` is unset, the button is absent and the current mailto link stays.

## Sending

`lib/email.ts` is the only sender. `EMAIL_PROVIDER=fake` records `{ to, subject, text }` in memory for tests. `EMAIL_PROVIDER=resend` POSTs to `https://api.resend.com/emails` with `RESEND_API_KEY` and `EMAIL_FROM`. No new npm package. Tests never call Resend.

The body uses `cad(document.total)` for the figure already on the row. It does not recompute tax. The link is the existing public `/d/[token]` URL, built from `AUTH_URL`.

The service checks the document belongs to the session's contractor before it sends.

## Out of scope

- A generated PDF attachment
- Welcome, trial, or payment emails
- Emailing anyone who is not the document's client

## Done when

With the fake provider, Email client on a draft quote sends one recorded message to the client, containing the number, the total, and a working share path. A second contractor cannot send it. With the provider unset, the button is absent. No test calls Resend.
