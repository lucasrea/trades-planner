// Extends app.json with config plugins that need values from the environment.

// Google's config plugin needs the iOS client id reversed, as a URL scheme, so it is derived from the
// variable the app signs in with instead of being typed a second time.
const SUFFIX = ".apps.googleusercontent.com";

function withGoogleSignIn(config) {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  // Without it the app still runs, with the Google button off on iOS.
  if (!clientId) return config;
  if (!clientId.endsWith(SUFFIX)) {
    throw new Error(`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must end with ${SUFFIX}`);
  }
  const iosUrlScheme = `com.googleusercontent.apps.${clientId.slice(0, -SUFFIX.length)}`;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ["@react-native-google-signin/google-signin", { iosUrlScheme }]],
  };
}

// Source maps are uploaded to Sentry only from a build that has all three settings, so builds
// without them don't need a Sentry account.
function withSentryUpload(config) {
  const { SENTRY_ORG: organization, SENTRY_PROJECT: project, SENTRY_AUTH_TOKEN } = process.env;
  if (!organization || !project || !SENTRY_AUTH_TOKEN) return config;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ["@sentry/react-native/expo", { organization, project }]],
  };
}

module.exports = ({ config }) => withSentryUpload(withGoogleSignIn(config));
