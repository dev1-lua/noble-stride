import { describe, it, expect } from "vitest";

describe("CRUD schema", () => {
  it("exposes create/update/delete mutations for all 5 entities", async () => {
    const { schema } = await import("@/graphql/schema");
    const mutationType = schema.getMutationType();
    expect(mutationType).toBeTruthy();
    const mutationFields = Object.keys(mutationType?.getFields() ?? {});
    for (const op of ["create", "update", "delete"]) {
      for (const ent of ["Investor", "Client", "Mandate", "Transaction", "Partner"]) {
        expect(mutationFields).toContain(`${op}${ent}`);
      }
    }
  });

  it("exposes createdSource on the entity types", async () => {
    const { schema } = await import("@/graphql/schema");
    const typeMap = schema.getTypeMap();
    for (const typeName of ["Investor", "Client", "Mandate", "Transaction", "Partner"]) {
      const type = typeMap[typeName];
      expect(type).toBeTruthy();
      const fields = (type as { getFields?: () => Record<string, unknown> }).getFields?.() ?? {};
      expect(Object.keys(fields)).toContain("createdSource");
    }
  });
});
