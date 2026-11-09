# Share a document

A contractor sends a client a link to a quote or invoice. The client opens it with no account. On a quote they can approve or decline. The page is the existing print layout. There is no new email provider and no new PDF engine.

## What the contractor sees

On a draft or sent quote or invoice:

- **Copy link**
- **Email link**, when the client has an email. This is the existing mailto, with the link in the body.
- **Turn off link.** A turned-off link is a not-found page.

## What the client sees

`/d/[token]` shows the business, the client, the lines, and the totals already stored on the document. Nothing is recomputed.

A quote has Approve and Decline. Approve marks the quote approved and moves the job from quoted to active, using the existing status rules. Decline marks the quote declined. Doing either again shows the result and does not change it a second time.

An invoice shows the amount due and the contractor's e-transfer details. It has no approve button and no pay button.

## What is stored

`document_links`: id, contractor_id, document_id, token (unguessable), revoked_at, created_at. The migration enables Row Level Security.

The public page looks up by token only. It does not trust a document id from the browser. Signed-in queries that create or revoke a link are scoped by `contractor_id`.

## Out of scope

- Resend, welcome mail, or a cron
- Replacing the print view with a generated PDF
- Card payments, or a client marking an invoice paid
- The phone app

## Done when

Open a quote link while signed out, approve it, and see the quote approved and the job active after signing in. A turned-off link is not found. An invoice link shows the invoice and has no approve button. A token cannot be used to open a different document.
