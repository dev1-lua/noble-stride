import { describe, it, expect } from "vitest";
import { ADMIN_VIEWPOINT, viewpointHome, parseViewpoint } from "@/lib/viewpoint";

describe("viewpointHome", () => {
  it("routes admin to the CRM dashboard", () => {
    expect(viewpointHome({ role: "admin" })).toBe("/dashboard");
  });

  it("routes investor and partner to their portals", () => {
    expect(viewpointHome({ role: "investor", recordId: "x" })).toBe("/portal/investor");
    expect(viewpointHome({ role: "partner", recordId: "y" })).toBe("/portal/partner");
  });

  it("composes with parseViewpoint: missing cookie parses as null, no default identity (real-auth)", () => {
    expect(parseViewpoint(undefined)).toBeNull();
    expect(viewpointHome(parseViewpoint(undefined) ?? ADMIN_VIEWPOINT)).toBe("/dashboard");
  });
});
