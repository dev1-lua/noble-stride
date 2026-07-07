import { describe, expect, it } from "vitest";
import { ADMIN_VIEWPOINT, parseViewpoint, serializeViewpoint } from "@/lib/viewpoint";

describe("viewpoint org-role lens (§7.2 demo lens)", () => {
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
    expect(parseViewpoint(JSON.stringify({ role: "investor" }))).toEqual(ADMIN_VIEWPOINT);
    expect(parseViewpoint("not-json")).toEqual(ADMIN_VIEWPOINT);
  });
});

describe("viewpoint impersonation flag (BLOCKER-A gate)", () => {
  it("round-trips impersonating=true for a portal role", () => {
    const raw = serializeViewpoint({ role: "investor", recordId: "i1", impersonating: true });
    expect(parseViewpoint(raw)).toEqual({ role: "investor", recordId: "i1", impersonating: true });
  });

  it("a real login (no flag) has no impersonating key", () => {
    const raw = serializeViewpoint({ role: "investor", recordId: "i1" });
    expect(parseViewpoint(raw)).toEqual({ role: "investor", recordId: "i1" });
  });
});
