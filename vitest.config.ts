import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next's "server-only" guard throws outside React Server Components.
      "server-only": fileURLToPath(new URL("./tests/fixtures/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/dealhoi_test",
      DEALHOI_DEMO_DATA: "true",
      OPENAI_API_KEY: "",
    },
  },
});
