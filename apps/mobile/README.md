# Trades Planner mobile

Expo app for the signed-in product: Home, Jobs, Documents, and Settings. There is no marketing site.

Phone sign-in and saving wait on the mobile API. Until then, describe, new job, and settings keep what you typed and do not send it.

## Run

From the repo root, create the local env file once, then start Expo:

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

```bash
npm run dev:mobile
```

## Environment

| Variable | Required | Meaning |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | Base URL of the web app the phone talks to, with no trailing slash. There is no default: the app throws at startup without it. |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | For sign-in | Google OAuth client ID. |

Which API URL to use with a local web app (`npm run dev`):

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| iOS simulator | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| A real phone | `http://<your computer's LAN IP>:3000`, with both on the same network |

Pointing it at production writes real rows. Expo builds these values into the app, so restart Expo after changing them, and set them for every build that does not read your local env files (such as an EAS build). `EXPO_PUBLIC_` values are readable by anyone who has the app, so never put a secret in one.
