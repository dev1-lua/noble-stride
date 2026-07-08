// e-sign mutation schema smoke test.
// Verifies sendEsignEnvelope(input: SendEsignInput!): EsignEnvelopeResult! is
// registered on the code-first Pothos schema (Task 6 exposes the service;
// this task exposes it as a GraphQL mutation).
//
// Note: this intentionally introspects `schema` directly (matching the
// pattern in schema.smoke.test.ts) instead of using graphql's `printSchema`.
// `printSchema` triggers a "Cannot use GraphQLObjectType ... from another
// module or realm" crash under this repo's vitest setup — graphql@16.14.2's
// dev-mode `instanceOf` guard trips because the package's ESM (`module`)
// and CJS (`main`) entry points get loaded as separate instances when a
// test file imports directly from "graphql" (pothos never does, so the
// existing smoke tests never hit this). Direct schema introspection avoids
// importing "graphql" altogether and sidesteps the issue.

import { describe, it, expect } from "vitest";
import { schema } from "@/graphql/schema";

describe("esign mutation", () => {
  it("is present in the schema", () => {
    const mutationType = schema.getMutationType();
    expect(mutationType).toBeTruthy();
    const mutationFields = Object.keys(mutationType?.getFields() ?? {});
    expect(mutationFields).toContain("sendEsignEnvelope");
  });

  it("exposes the expected input and result shapes", () => {
    const field = schema.getMutationType()?.getFields()["sendEsignEnvelope"];
    expect(field).toBeTruthy();
    expect(String(field?.type)).toBe("EsignEnvelopeResult!");

    const inputArg = field?.args.find((a) => a.name === "input");
    expect(inputArg).toBeTruthy();
    expect(String(inputArg?.type)).toBe("SendEsignInput!");

    // Result type shape.
    const resultType = schema.getType("EsignEnvelopeResult");
    expect(resultType).toBeTruthy();

    // Input type shape.
    const inputType = schema.getType("SendEsignInput");
    expect(inputType).toBeTruthy();
  });
});
