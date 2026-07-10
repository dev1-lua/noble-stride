import { describe, expect, it } from "vitest";
import { ADMIN_VIEWPOINT, parseViewpoint, serializeViewpoint } from "@/lib/viewpoint";

describe("viewpoint org-role serialization (§7.2 in-org roles)", () => {
  it("round-trips an org-role lens", () => {
    const raw = serializeViewpoint({ role: "admin", orgRole: "DealLead", userId: "u1" });
    expect(parseViewpoint(raw)).toEqual({ role: "admin", orgRole: "DealLead", userId: "u1" });
  });

  it("plain admin round-trips to the Admin lens", () => {
    expect(parseViewpoint(serializeViewpoint({ role: "admin" }))).toEqual(ADMIN_VIEWPOINT);
  });

  it("falls back to Admin for unknown orgRole", () => {
    expect(parseViewpoint(JSON.stringify({ role: "admin", orgRole: "SuperUser" }))).toEqual(ADMIN_VIEWPOINT);
  });

  it("keeps investor/partner behaviour unchanged", () => {
    expect(parseViewpoint(JSON.stringify({ role: "investor", recordId: "i1" }))).toEqual({
      role: "investor",
      recordId: "i1",
    });
    expect(parseViewpoint(JSON.stringify({ role: "investor" }))).toBeNull();
    expect(parseViewpoint("not-json")).toBeNull();
  });

  it("returns null for missing or malformed input (real-auth: no default identity)", () => {
    expect(parseViewpoint(undefined)).toBeNull();
    expect(parseViewpoint(null)).toBeNull();
    expect(parseViewpoint("")).toBeNull();
    expect(parseViewpoint("not-json")).toBeNull();
    expect(parseViewpoint(JSON.stringify({ role: "investor" }))).toBeNull(); // external without recordId
  });

  it("a real login round-trips a portal role with no impersonation flag (lens removed)", () => {
    const raw = serializeViewpoint({ role: "investor", recordId: "i1" });
    expect(parseViewpoint(raw)).toEqual({ role: "investor", recordId: "i1" });
  });
});
