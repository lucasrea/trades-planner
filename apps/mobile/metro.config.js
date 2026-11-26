const path = require("node:path");
// Expo's default config, plus the debug ids Sentry needs to match stack traces to source maps.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getSentryExpoConfig(projectRoot);
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
