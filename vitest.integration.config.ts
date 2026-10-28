import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // next-auth imports "next/server" without an extension; Node's ESM loader needs the file.
      "next/server": path.resolve(__dirname, "node_modules/next/server.js"),
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
