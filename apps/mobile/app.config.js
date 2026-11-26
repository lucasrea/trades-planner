// Adds to app.json. Source maps are uploaded to Sentry only from a build that has all three
// settings, so builds without them don't need a Sentry account.
module.exports = ({ config }) => {
  const { SENTRY_ORG: organization, SENTRY_PROJECT: project, SENTRY_AUTH_TOKEN } = process.env;
  if (!organization || !project || !SENTRY_AUTH_TOKEN) return config;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ["@sentry/react-native/expo", { organization, project }]],
  };
};
