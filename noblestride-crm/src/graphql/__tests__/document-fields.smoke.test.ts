// Document GraphQL type — file-field exposure smoke test.
// NOTE: deliberately avoids `printSchema`/`graphql` package imports here — with two
// `graphql` versions present in node_modules (16.x pinned by the app, 17.x pulled in
// transitively by codegen tooling), `printSchema`'s internal `instanceof` checks throw
// "Cannot use GraphQLObjectType ... from another module or realm" in vitest. Instead,
// inspect the already-built schema object's fields directly (plain method calls, no
// cross-realm instanceof), matching the workaround documented in schema.smoke.test.ts.

import { describe, it, expect } from "vitest";

describe("Document GraphQL type", () => {
  it("exposes the new file fields", async () => {
    const { schema } = await import("@/graphql/schema");
    const documentType = schema.getType("Document") as
      | { getFields: () => Record<string, unknown> }
      | undefined;
    expect(documentType).toBeTruthy();

    const fieldNames = Object.keys(documentType!.getFields());
    for (const f of ["mimeType", "sizeBytes", "originalFilename", "isCurrent", "downloadHref"]) {
      expect(fieldNames).toContain(f);
    }
  });
});
