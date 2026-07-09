// Every GraphQL document embedded in the UI must validate against the schema.
// Kills a recurring bug class: a component selects a field the Pothos types
// never exposed, and the button fails at runtime with
// GRAPHQL_VALIDATION_FAILED (seen three times: onboardingStatus on
// approve/reject, the greylist input, openNdaSignedAt/ndaSignedAt on the NDA
// buttons). No DB required — this always runs.

import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Same-realm graphql (pothos loads the CJS build; a bare ESM import here
// would be a second instance and validate() rejects the schema).
const { parse, validate } = createRequire(import.meta.url)("graphql") as typeof import("graphql");

const SRC = join(__dirname, "..", "..");
const SCAN_DIRS = [join(SRC, "components"), join(SRC, "app")];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\./.test(entry.name)) yield p;
  }
}

/** Template literals whose content starts with `mutation`/`query`/`fragment`. */
function extractDocuments(source: string): string[] {
  const docs: string[] = [];
  const re = /`(\s*(?:mutation|query|fragment)\s[\s\S]*?)`/g;
  for (const match of source.matchAll(re)) {
    const body = match[1];
    if (body.includes("${")) continue; // interpolated — can't validate statically
    docs.push(body);
  }
  return docs;
}

describe("embedded client GraphQL documents", () => {
  it("every document in src/components and src/app validates against the schema", async () => {
    const { schema } = await import("@/graphql/schema");

    const failures: string[] = [];
    let count = 0;
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        for (const doc of extractDocuments(readFileSync(file, "utf8"))) {
          count++;
          const where = relative(SRC, file);
          try {
            const errors = validate(schema, parse(doc));
            for (const e of errors) failures.push(`${where}: ${e.message}`);
          } catch (e) {
            failures.push(`${where}: parse error — ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }

    // Sanity: the scan must actually find the known documents, or the regex
    // has rotted and the test is vacuously green.
    expect(count).toBeGreaterThanOrEqual(30);
    expect(failures).toEqual([]);
  });
});
