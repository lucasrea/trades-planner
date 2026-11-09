# The phone can sign in and send a plan

The Expo app has the screens and stops at "isn't connected yet." This connects sign-in and one text message through to confirm. Voice, receipts, and offline stay out.

## API

New table `mobile_sessions`: id, contractor_id, user_id, token_hash, created_at, expires_at. The migration enables Row Level Security with no policies. The raw token is returned once. Only the SHA-256 hash is stored. A session lasts 30 days.

`POST /api/mobile/session` takes a Google ID token. Verification is a function the route calls. Production checks the token with Google. Tests pass a fake verifier and never call Google. A known user gets `{ token }`. An unknown email gets 401.

`POST /api/v1/captures/text` takes `Authorization: Bearer` and `{ text }`. It uses the same describe-capture service as the web. It does not take a plan id.

`POST /api/v1/captures/[id]/confirm` confirms that capture for the bearer session's contractor, through the existing confirm path. Another contractor's capture is not found.

## App

New dependencies, each because the app cannot sign in or store a secret without them: `expo-auth-session`, `expo-web-browser`, `expo-secure-store`.

Sign in uses the Google client id in `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. The bearer is stored in SecureStore. If that env var is missing, the button says the client id is not set.

Home send posts the text and shows the preview title and lines, then Confirm. Confirm calls the confirm route and shows the job or document id that came back. Cancel stays on the web.

## Out of scope

- Voice, camera, jobs list, documents list
- Apple sign-in
- A plan thread on the phone

## Done when

A fake Google verifier signs in a seeded user, a text capture returns a preview, and confirm writes the same rows the web confirm would. A bearer for contractor A cannot confirm contractor B's capture. The phone screens call those routes. Tests do not call Google.
