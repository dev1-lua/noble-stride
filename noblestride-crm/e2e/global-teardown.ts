// global-teardown.ts — remove the `zz-` fixtures unless E2E_KEEP=1 (handy when
// debugging a failing spec against the seeded data).
import { cleanupE2E } from "./fixtures/cleanup";

export default async function globalTeardown() {
  if (process.env.E2E_KEEP === "1") {
    console.log("E2E_KEEP=1 — leaving zz- fixtures in place");
    return;
  }
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  await cleanupE2E();
}
