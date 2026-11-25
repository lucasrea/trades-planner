# Production plan: the phone, and what production still needs

Written 2026-11-25 against `master` at `2cc8675` (after PR #130) plus the Plan hardening branch (`task/harden-plan-loop`). It covers what already exists. It adds no new product.

## Where things stand

**Web.** The loop works end to end. Typed and spoken messages become cards, a card confirms through the existing services, receipts split across jobs, and quotes can be approved from a link. After the hardening branch, typed text, voice and phone text all go through one interpreter (`runPlanAgent`).

**Phone.** It is a shell with the web's look (PR #130). It can sign in, send one text message, show a text reply, and confirm the first card. Jobs, Documents and Settings are placeholders. Cancel only clears the screen; the capture stays waiting on the server. After Confirm it says "Document saved" with no way to open it. Log out clears the token on the phone only; the server session stays valid for 30 days.

## Phase 0: merge what is in flight

The hardening branch is rebased on `master` and has lint, typecheck, unit, integration and build green locally. It still needs the Sonnet review and a signed-in browser pass, per `.cursor/rules/01-pr-review.mdc`. `/api/v1/captures/text` now also returns `cards`; the phone reads only the first until Phase 3.

**Done when** it is on `master` and production still passes `node tools/e2e/run.mjs --target prod --job <throwaway>`.

## Phase 1: cheap production checks (web)

None of these add a feature.

- **Verify production config.** Every file in `supabase/migrations/` is applied. The `receipts` bucket exists and is private. Row Level Security is on for every table. Vercel has `OPENAI_API_KEY`, `EXTRACTION_MODEL`, `TRANSCRIPTION_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and, if email is on, `EMAIL_PROVIDER`, `RESEND_API_KEY` and `EMAIL_FROM`. *Read-only Supabase and Vercel access makes this a 10-minute check.*
- **Complete `apps/web/.env.example`** with every variable above, plus `AI_PROVIDER`, `AI_CAPTURE_ENABLED`, `AI_FAKE_MODE` and `EXTRACTION_MODEL_FALLBACK`.
- **Integration tests must not fall back to `DATABASE_URL`.** They drop the `public` schema. Require `DATABASE_URL_TEST` (CI already sets it) and refuse a host that is not local or CI.
- **Eval the path users actually hit.** `scripts/eval-extraction.ts` scores `run-describe`, which production no longer uses. Build the same fixture eval against `runPlanAgent`. Cover a greeting in front of a request, a follow-up that uses an earlier price, hours plus materials, invoicing unbilled work, and a question. Gate model and prompt changes on it, per decision D22.
- **Error tracking.** Production has `console.error` lines and Vercel logs only. Pick one vendor and justify the dependency. Log the event names already used (`plan_loop_failed`, `plan_turn_failed`, `transcribe_failed`, `describe_failed`) with ids only, never message text.
- **Backups.** Confirm the Supabase plan's backup and point-in-time recovery window before real customer data goes in.
- **Say the tax scope.** The app supports a single tax rate per document. Onboarding should say GST/HST single-rate provinces only. Two-tax provinces and Quebec are out until D20 is done.

**Done when** the production check passes, the env template is complete, the integration tests refuse a remote database, and the Plan eval runs and has a baseline score.

## Phase 2: phone sign-in that works on a real device

- **Replace the deprecated Google provider.** `expo-auth-session/providers/google` has been deprecated since SDK 49. Use the native Google Sign-In library with the web client ID set as the server client ID, so the ID token's audience is `AUTH_GOOGLE_ID`, which is what `verifyGoogleIdToken` checks. If tokens arrive with the iOS or Android client ID as the audience instead, accept a short list from an env var. Check the current Expo and Google guides before building.
- **Add `jose` to `apps/web/package.json`.** `verify-google-id-token.ts` imports it, but it is only installed because `next-auth` depends on it.
- **Sign out on the server.** Log out (PR #130) only clears SecureStore. Add `DELETE /api/mobile/session` so the bearer is revoked too.
- **Expired or revoked tokens.** Any 401 from the API sends the phone to sign-in. Today it shows "Request failed."
- **An unknown email.** The phone cannot create an account. Today it shows "Sign in failed." Show "Sign up at trades-planner-bay.vercel.app first." Alternatively, support signup and onboarding on the phone; then App Store rules also need account deletion in the app (Phase 5).
- **Do not default to production.** `EXPO_PUBLIC_API_URL` falls back to the production URL, so a development build writes real rows. Make it required in every build profile.
- **Sign in with Apple.** App Store guideline 4.8 expects a privacy-focused sign-in option next to Google. That needs an Apple provider on the web, an `apple_id` column (migration plus schema), and an Apple ID-token verifier with a fake for tests.

**Done when** a TestFlight build on a real iPhone signs in with Google and with Apple, signs out, and is sent back to sign-in after the server revokes its session. Tests never call Google or Apple.

## Phase 3: the Plan loop on the phone

The server half matters most here. Each phone route must call the same service as its web route; the only difference is how the contractor is found (bearer instead of cookie). Two interpreters for the same words is what made voice inconsistent before.

API, all bearer-authenticated and scoped by `contractor_id`:

| Route | Calls |
|---|---|
| `POST /api/v1/captures/text` with `planId` | `runPlanAgent` plus `recordAgentTurn` (today it takes no plan, so a follow-up has no context) |
| `POST /api/v1/captures/voice` | `runVoicePlan`. The phone records m4a, which the server already accepts. |
| `POST /api/v1/captures/receipt` | `createReceiptCapture` |
| `POST /api/v1/captures/[id]/cancel` | `cancelPlanProposal` |
| `PATCH /api/v1/captures/[id]/lines` | `updatePlanProposalLines` |
| `POST /api/v1/captures/[id]/receipt-confirm` | `confirmCapture` with each line's job |
| `GET /api/v1/plans`, `GET /api/v1/plans/[id]` | `listPlans`, `getPlanThread` |
| `GET /api/v1/jobs?open=1` | open jobs for the job picker |

App:

- Show every card in `cards`, the `reply` text, and each card's blockers and warnings. Each card has its own Confirm. Confirm stays off while `canConfirm` is false.
- Cancel calls the server.
- Editing a line on the card uses the PATCH route. An `invoice_tracked` card is read-only.
- After Confirm, open the job or document instead of only saying "Document saved".
- The Record button uses the native microphone, capped at two minutes. Receipts take a photo or pick one, resized to a 1600 px JPEG before upload.
- `app.json` gets the microphone, camera and photo library permission strings.

**Done when** the same five sentences give the same cards on the web, on web voice, on phone text and on phone voice, checked by an integration test per route. A receipt can be split across two jobs from the phone. Cancel on the phone leaves the capture discarded on the server.

## Phase 4: Jobs, Documents and Settings on the phone

- **Read routes** for jobs, a job with its tracked lines and documents, documents with type and status filters, a document, and settings. Use `lib/queries-v2.ts` and the services, not new queries.
- **On a job:** Create invoice from tracked lines, New quote and New invoice (existing services).
- **On a document:** Mark sent, Mark approved or declined, Mark paid (`setDocumentStatus`). **Share link** creates a `/d/[token]` link (`createDocumentLink`) and opens the native share sheet. That is the phone's way to send a quote. It needs no PDF engine.
- **Settings** reads and saves the same fields as the web form, using the same validation schema.

**Done when** a contractor can run the main loop from the phone alone: describe a job, confirm the quote, share it, have the client approve it, invoice it, and mark it paid.

## Phase 5: store readiness

- `app.json`: `ios.bundleIdentifier`, `android.package`, build numbers and an icon set.
- `eas.json` with development, preview and production profiles, each with its own API URL and Google client IDs.
- Account deletion from the phone. Add a `DELETE /api/v1/account` route that calls `deleteAccount`, with the same business-name check as the web.
- App Store privacy answers. Typed text, voice and receipt photos go to OpenAI and are stored for the account. Audio is not kept. Deleting the account removes everything; as of the hardening branch, that includes phone sessions.
- Crash reporting, using the same vendor as the web.
- Private beta on TestFlight with the first five contractors.

**Done when** a TestFlight build passes Apple's review for external testing.

## Before charging money (not before the beta)

- Stripe billing as designed in `v2-design.md` section 14, enforced only in `requireActiveAccess()`.
- Business entity, bank account, GST/HST registration and an Apple Developer account (D24).

## Known gaps left on purpose

- **"Invoice the approved quote" in Plan** goes to the model, which can retype the quote's lines into a new invoice without `source_quote_id`. That repeats the double-billing risk that `invoice_tracked` now closes for tracked lines. Add the same kind of action, confirming through `createInvoiceFromQuote`.
- **Rule-based routes before the model** (greetings, questions, plain adds, tracked invoices) are English-only regexes. That is fine for the Ontario prototype. Revisit for French.
