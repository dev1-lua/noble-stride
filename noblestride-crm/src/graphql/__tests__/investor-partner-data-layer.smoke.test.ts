import { describe, it, expect } from "vitest";

describe("investor/partner data layer schema", () => {
  it("exposes ServiceProvider CRUD + type", async () => {
    const { schema } = await import("@/graphql/schema");
    const mut = Object.keys(schema.getMutationType()?.getFields() ?? {});
    expect(mut).toContain("createServiceProvider");
    expect(mut).toContain("updateServiceProvider");
    expect(mut).toContain("deleteServiceProvider");
    expect(schema.getTypeMap()["ServiceProvider"]).toBeTruthy();
  });
});
