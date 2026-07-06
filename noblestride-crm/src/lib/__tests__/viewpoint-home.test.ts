import { describe, it, expect } from "vitest";
import { viewpointHome, parseViewpoint } from "@/lib/viewpoint";

describe("viewpointHome", () => {
  it("routes admin to the CRM dashboard", () => {
    expect(viewpointHome({ role: "admin" })).toBe("/dashboard");
  });

  it("routes investor and partner to their portals", () => {
    expect(viewpointHome({ role: "investor", recordId: "x" })).toBe("/portal/investor");
    expect(viewpointHome({ role: "partner", recordId: "y" })).toBe("/portal/partner");
  });

  it("composes with parseViewpoint: missing cookie parses as admin → dashboard", () => {
    expect(viewpointHome(parseViewpoint(undefined))).toBe("/dashboard");
  });
});
