import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // next-auth imports "next/server" without an extension; Node's ESM loader in Vitest needs the file.
      "next/server": path.resolve(__dirname, "node_modules/next/server.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    poolOptions: { threads: { singleThread: true } },
  },
});
