import { describe, expect, it } from "vitest";
import { RBAC_ENTITIES, can, canDeleteRecord, canUpdateRecord, ownsRecord } from "@/server/rbac/matrix";

describe("RBAC matrix (§7.2)", () => {
  it("Admin has full CRUD everywhere", () => {
    for (const entity of RBAC_ENTITIES)
      for (const perm of ["C", "R", "U", "D"] as const) expect(can("Admin", entity, perm)).toBe(true);
  });

  it("Deal Lead: CRU on deal entities, read-only partners/providers, never delete", () => {
    expect(can("DealLead", "Transactions", "C")).toBe(true);
    expect(can("DealLead", "Transactions", "U")).toBe(true);
    expect(can("DealLead", "Transactions", "D")).toBe(false);
    expect(can("DealLead", "Partners", "U")).toBe(false);
    expect(can("DealLead", "Partners", "R")).toBe(true);
    expect(can("DealLead", "Service Providers", "R")).toBe(true);
    expect(can("DealLead", "Service Providers", "C")).toBe(false);
    for (const entity of RBAC_ENTITIES) expect(can("DealLead", entity, "D")).toBe(false);
  });

  it("Team Member: read all, update only engagements/tasks", () => {
    for (const entity of RBAC_ENTITIES) expect(can("TeamMember", entity, "R")).toBe(true);
    expect(can("TeamMember", "Clients", "U")).toBe(false);
    expect(can("TeamMember", "Engagements", "U")).toBe(true);
    expect(can("TeamMember", "Tasks", "U")).toBe(true);
    expect(can("TeamMember", "Tasks", "C")).toBe(false);
    for (const entity of RBAC_ENTITIES) {
      expect(can("TeamMember", entity, "C")).toBe(false);
      expect(can("TeamMember", entity, "D")).toBe(false);
    }
  });
});

describe("own-record scoping", () => {
  it("ownsRecord matches ownerId / leadId / assigneeId", () => {
    expect(ownsRecord("u1", { ownerId: "u1" })).toBe(true);
    expect(ownsRecord("u1", { leadId: "u1" })).toBe(true);
    expect(ownsRecord("u1", { assigneeId: "u1" })).toBe(true);
    expect(ownsRecord("u1", { assigneeId: "u2" })).toBe(false);
    expect(ownsRecord(undefined, { ownerId: "u1" })).toBe(false);
    expect(ownsRecord("u1", {})).toBe(false);
  });

  it("Admin updates anything; Deal Lead updates own deals but not others'", () => {
    expect(canUpdateRecord("Admin", "Transactions", "u1", { ownerId: "u2" })).toBe(true);
    expect(canUpdateRecord("DealLead", "Transactions", "u1", { ownerId: "u1" })).toBe(true);
    expect(canUpdateRecord("DealLead", "Transactions", "u1", { ownerId: "u2" })).toBe(false);
    expect(canUpdateRecord("DealLead", "Mandates", "u1", { leadId: "u1" })).toBe(true);
    expect(canUpdateRecord("DealLead", "Mandates", "u1", { leadId: "u2" })).toBe(false);
    expect(canUpdateRecord("DealLead", "Clients", "u1", {})).toBe(true); // non-ownable entity
    expect(canUpdateRecord("DealLead", "Partners", "u1", {})).toBe(false); // no U perm at all
  });

  it("Team Member updates only own engagements/tasks and nothing else", () => {
    expect(canUpdateRecord("TeamMember", "Engagements", "u1", { ownerId: "u1" })).toBe(true);
    expect(canUpdateRecord("TeamMember", "Engagements", "u1", { ownerId: "u2" })).toBe(false);
    expect(canUpdateRecord("TeamMember", "Tasks", "u1", { assigneeId: "u1" })).toBe(true);
    expect(canUpdateRecord("TeamMember", "Transactions", "u1", { ownerId: "u1" })).toBe(false);
  });

  it("only Admin deletes", () => {
    expect(canDeleteRecord("Admin", "Clients")).toBe(true);
    expect(canDeleteRecord("DealLead", "Clients")).toBe(false);
    expect(canDeleteRecord("TeamMember", "Tasks")).toBe(false);
  });
});
