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

  it("exposes Document CRUD + access level field", async () => {
    const { schema } = await import("@/graphql/schema");
    const mut = Object.keys(schema.getMutationType()?.getFields() ?? {});
    expect(mut).toContain("createDocument");
    const doc = schema.getTypeMap()["Document"] as { getFields?: () => Record<string, unknown> };
    expect(Object.keys(doc.getFields?.() ?? {})).toContain("accessLevel");
  });

  it("exposes investor classification + ndaStatus", async () => {
    const { schema } = await import("@/graphql/schema");
    const inv = schema.getTypeMap()["Investor"] as { getFields?: () => Record<string, unknown> };
    const fields = Object.keys(inv.getFields?.() ?? {});
    expect(fields).toContain("engagementClassification");
    expect(fields).toContain("ndaStatus");
  });

  it("exposes partner fee-sharing + internalOnly", async () => {
    const { schema } = await import("@/graphql/schema");
    const p = schema.getTypeMap()["Partner"] as { getFields?: () => Record<string, unknown> };
    const fields = Object.keys(p.getFields?.() ?? {});
    expect(fields).toContain("feeSharingAgreement");
    expect(fields).toContain("internalOnly");
    expect(fields).toContain("advisorType");
  });
});
