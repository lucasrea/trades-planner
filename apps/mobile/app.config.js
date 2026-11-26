// Extends app.json. Google's config plugin needs the iOS client id reversed, as a URL scheme, so it
// is derived from the variable the app signs in with instead of being typed a second time.
const SUFFIX = ".apps.googleusercontent.com";

module.exports = ({ config }) => {
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
};
