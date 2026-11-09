# Capture checks

Black-box checks for the signed-in Plan flows: typed text, a voice clip, and a receipt photo. They talk to a running app. They do not replace `npm test` or `npm run test:integration`, and they never call the database directly.

Localhost uses the fake model (the default when the server is not in production), so the expected client, action, transcript, and receipt vendor are fixed. Production calls the live models. A production confirm also requires `--job`, and that job should be a throwaway.

## Run

Sign in once in the browser, copy the request `Cookie` header, and put that single line in `tools/e2e/.session`. The file is gitignored. `TP_COOKIE` works instead.

```bash
node tools/e2e/run.mjs --self-check
node tools/e2e/run.mjs --target local
node tools/e2e/run.mjs --target prod --job <throwaway-job-id>
node tools/e2e/run.mjs --target prod --job <throwaway-job-id> --confirm
```

`--target local` uses `http://127.0.0.1:3000`. `--target prod` uses `https://trades-planner-bay.vercel.app`. `--base` overrides either.

| Flag | Effect |
| --- | --- |
| `--speech` | Record the voice clip with macOS `say`. Production always does this. |
| `--job <id>` | Attach voice and receipt to that job. |
| `--confirm` | Confirm the voice preview onto `--job`. Text that would create a job is not confirmed. |
| `--allow-create` | Also allow a confirm that creates a job or document. |
| `--keep` | Leave the captures in place instead of discarding them. |

Generated files go in `tools/e2e/out/`.

## What a pass covers

- No session returns 401. A cross-origin post returns 403.
- A file that is not a photo or a recording returns 400.
- Text returns a preview. Locally that preview follows `apps/web/lib/ai/fake.ts`. On production, the probe sentence comes back as "create a job".
- Voice returns a transcript and a preview. Locally the transcript is the fake one. On production it has to hear "valve".
- The receipt review page shows the vendor and the lines. Locally those are the fake receipt. On production the page shows Home Depot, the copper line, and 12.50. A bitmap "VALVE" may be read as "VALUE".
- Without `--confirm` or `--keep`, the captures are discarded. A receipt discard uses the review screen's discard action.

## What this does not do

The microphone button and the photo picker are browser UI. This posts the same APIs those controls post. Confirming a receipt, or clicking Confirm on the Plan card, still needs the signed-in page when the action id cannot be found in the shipped JavaScript.

Do not point `npm run test:integration` at a live `DATABASE_URL`. Those tests drop the schema.
