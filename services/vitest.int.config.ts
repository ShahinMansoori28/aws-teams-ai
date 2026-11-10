import { defineConfig } from "vitest/config";

// Integration tests only: they talk to Floci (npm run floci:up && npm run deploy:local first).
export default defineConfig({
  test: { include: ["src/**/*.int.test.ts"], testTimeout: 30_000, env: { LOG_LEVEL: "SILENT" } },
});
