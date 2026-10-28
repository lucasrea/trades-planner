import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // next-auth imports "next/server" without an extension; Node's ESM loader needs the file.
      // In the workspace, next is hoisted to the repo root, so resolve it instead of assuming apps/web/node_modules.
      "next/server": require.resolve("next/server.js"),
    },
  },
  // Bundle next-auth so the alias applies. Left external, Node resolves "next/server" itself and fails.
  ssr: { noExternal: ["next-auth"] },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    poolOptions: { threads: { singleThread: true } },
  },
});
