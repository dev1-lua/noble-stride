import { describe, it, expect } from "vitest";
import type { GraphQLObjectType } from "graphql";
import { schema } from "../schema";

// NOTE: we intentionally avoid `printType` from the `graphql` package here — in this
// repo's vitest setup it triggers a "Cannot use GraphQLObjectType ... from another
// module or realm" error (duplicate-module instanceof check inside graphql-js
// internals). Reading fields directly off the type object (as the existing
// engagement-milestones.test.ts does) sidesteps that entirely.
function fieldNames(typeName: string): string[] {
  const type = schema.getType(typeName) as GraphQLObjectType | undefined;
  if (!type || typeof (type as GraphQLObjectType).getFields !== "function") {
    throw new Error(`type ${typeName} not found or not an object type`);
  }
  return Object.keys(type.getFields());
}

describe("agent read surface — newly exposed relations", () => {
  it("Investor exposes tasks", () => {
    expect(fieldNames("Investor")).toContain("tasks");
  });
  it("Client exposes tasks", () => {
    expect(fieldNames("Client")).toContain("tasks");
  });
  it("Mandate exposes tasks", () => {
    expect(fieldNames("Mandate")).toContain("tasks");
  });
  it("Transaction exposes tasks + stageChanges", () => {
    const fields = fieldNames("Transaction");
    expect(fields).toContain("tasks");
    expect(fields).toContain("stageChanges");
  });
  it("Engagement exposes stageChanges", () => {
    expect(fieldNames("Engagement")).toContain("stageChanges");
  });
});

describe("agent read surface — document bytes stay hidden", () => {
  it("Document type never exposes storage internals", () => {
    const fields = fieldNames("Document");
    for (const banned of ["storageKey", "storageProvider", "boxFileId", "boxSharedLinkUrl", "checksum"]) {
      expect(fields).not.toContain(banned);
    }
  });
});
