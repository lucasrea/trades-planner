// No default on purpose: falling back to production would let a development build write real rows.
// Keep the full `process.env.EXPO_PUBLIC_API_URL` expression, which is what Expo replaces at build time.
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!apiUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to apps/mobile/.env.local, set the web app's URL, and restart Expo. See apps/mobile/README.md.",
  );
}
export const API_URL = apiUrl;

export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";
