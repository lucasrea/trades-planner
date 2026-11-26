# Trades Planner mobile

Expo app for the signed-in product: Home, Jobs, Documents, and Settings. There is no marketing site.

Saving a new job or settings from the phone is not connected yet.

```bash
npm run dev:mobile
```

## Sign-in needs a development build

The phone signs in with Google (`@react-native-google-signin/google-signin`) and, on iPhone, Sign in with Apple (`expo-apple-authentication`). Google's library is native code that Expo Go does not include, so use a development build. Expo Go no longer works for this app.

The build is configured by:

- `app.json`: the iOS bundle ID (`com.tradesplanner.app`), `usesAppleSignIn`, and the Apple config plugin.
- `app.config.js`: adds Google's config plugin, with the URL scheme derived from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- `eas.json`: the `development` build profile.

Only iOS is set up. Android would also need a package name in `app.json` and an Android OAuth client with the signing certificate's SHA-1.

### Variables

| Where | Variable | Meaning |
|---|---|---|
| Phone | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | The **web** OAuth client ID, the same value as the web app's `AUTH_GOOGLE_ID`. Google addresses the phone's ID token to it. |
| Phone | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | The **iOS** OAuth client ID. Needed when building as well as when running. |
| Web | `AUTH_APPLE_BUNDLE_ID` | The iOS bundle ID. Apple sign-in is refused until it is set. |
| Web | `AUTH_GOOGLE_MOBILE_AUDIENCES` | Optional, comma separated. More of this app's client IDs to accept as a token's audience. Leave unset unless Google tokens from a device are refused for that reason. |

The web app also needs every file in `supabase/migrations/` applied to its database.

### One-time setup

1. Google Cloud console, in the project that holds the web client: create an OAuth client of type **iOS** with the bundle ID above.
2. Apple Developer (paid membership): register that bundle ID as an App ID with the **Sign in with Apple** capability. Change the ID in `app.json` first if you want a different one.

### Build and run

With Xcode 26.4 or later and the phone plugged in, from `apps/mobile`:

```bash
npx expo run:ios --device
```

After changing a client ID or `app.json`, regenerate the native project first with `npx expo prebuild --clean --platform ios`.

Without a suitable Xcode, build with EAS, from `apps/mobile`:

1. `npx eas-cli@latest login`, then `npx eas-cli@latest init`. If it cannot write to the dynamic config, add the `extra.eas.projectId` it prints to `app.json`.
2. Add `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to the `development` environment with `npx eas-cli@latest env:create`. Keep it in `apps/mobile/.env.local` too, for the local dev server.
3. `npx eas-cli@latest device:create` to register the phone.
4. `npx eas-cli@latest build --profile development --platform ios`, and install the result.
5. `npm run dev:mobile` from the repo root, and open the project from the installed app.

### Accounts

The phone cannot create an account; sign up on the web first. A Google sign-in finds the account by its email. The first Apple sign-in links to the account with the same verified email, and later ones are matched on the Apple ID. Someone who chose **Hide My Email**, or whose Apple ID uses a different address, cannot be linked.
