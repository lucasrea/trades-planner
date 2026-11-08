# Receipt photos

Third feature. Depends on the Plan agent preview.

## What it is

The contractor uploads or snaps a receipt. The photo is read into material lines. They choose a job for those lines, or start a new job. Confirm saves the lines on the job as unbilled materials.

A receipt does not create an invoice. The cost sits on the job until they use "Create invoice from tracked lines" on that job. That is a separate, explicit step. A supply run is often bought before anyone is billed, and one receipt can cover more than one job.

## What the contractor sees

An upload control on Plan, and the same control on a job page.

- They can take a photo or choose one. The phone image is reduced before upload (longest edge 1600 px, JPEG).
- No job is required to take the photo. From a job page, that job is the starting choice.
- The preview shows the photo, the vendor and date if printed, and each line: description, quantity, cost, and sell price. Sell price is cost plus their material markup.
- Each line has a job. They can pick an open job, or start a new one (title and client). Several lines can be assigned together.
- Confirm stays off until every line has a job, a price, and a quantity greater than zero.
- One job opens that job. More than one job shows a short result with a link to each.

## Where the image lives

The bytes go in a private Supabase Storage bucket named `receipts`, at `receipts/{contractorId}/{captureId}.jpg`. The database stores that path on `captures.image_path`, which already exists. Postgres does not store the image.

The review screen loads the photo through a short-lived signed URL. The bucket has to be created before this is built.

## What confirm writes

No new table. `captures.type = receipt`. Confirm inserts tracked material lines:

- `unit_cost` is the pre-tax price printed on the receipt
- `unit_price` is that cost plus markup
- `kind = material`
- the line is unbilled

## Out of scope

- Turning the receipt into an invoice in the same step
- Keeping the original full-size photo
- Reading a PDF statement
- The phone app's native camera

## Done when

Upload a receipt with two items, assign them to two jobs, confirm, and see each item as an unbilled material on its job. No invoice is created. The photo is visible on the preview and is not publicly readable.

## As built

- Upload control: `components/receipt-upload.tsx`, on Plan and on a job page (locked to that job). The photo is shrunk in the browser first (`lib/captures/downscale.ts`). An optional note can name the job ("add this to the kitchen"); `matchJobInText` picks a job only when exactly one open job matches, otherwise the contractor chooses.
- Route: `POST /api/captures/receipt` (multipart `image`, optional `jobId`, `note`). Same auth, same-origin, rate limit and job-ownership checks as the text route. Magic-byte check (JPEG/PNG/WebP), 4 MB cap.
- Storage: `lib/storage/receipts.ts` (interface, Supabase REST implementation, in-memory fake). Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server. The bucket is created by `supabase/migrations/20261108100000_receipts_bucket.sql`; it has no `storage.objects` policies, so only the service role can read or write.
- Review: `components/receipt-review-form.tsx`. Signed URL lifetime is 5 minutes.
- Confirm: `confirmCapture` receipt branch. Lines are forced to `material`, must carry a cost, and are written unbilled. New jobs started on the preview are created in the same transaction. No document is created.
