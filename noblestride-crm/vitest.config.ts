import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", globals: true, include: ["src/**/*.test.ts"], fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
