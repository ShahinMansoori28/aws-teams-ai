import { defineConfig } from "vitest/config";

// Unit tests only. Integration tests (*.int.test.ts) need Floci and arrive in step 3.
export default defineConfig({
  test: { exclude: ["**/node_modules/**", "**/*.int.test.ts"], env: { LOG_LEVEL: "SILENT" } },
});
