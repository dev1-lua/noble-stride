import { describe, it, expect } from "vitest";
import { isDocDownloadable } from "../authz";
import type { Viewpoint } from "@/lib/viewpoint";

const admin: Viewpoint = { role: "admin", orgRole: "Admin" };
const investor: Viewpoint = { role: "investor", recordId: "inv1" };
const partner: Viewpoint = { role: "partner", recordId: "p1" } as Viewpoint;

describe("isDocDownloadable", () => {
  it("admin (internal) can download anything", () => {
    expect(isDocDownloadable(admin, { id: "d1", partnerId: null }, new Set())).toBe(true);
  });
  it("investor can download a doc the engine projects to them", () => {
    expect(isDocDownloadable(investor, { id: "d1", partnerId: null }, new Set(["d1"]))).toBe(true);
  });
  it("investor cannot download a doc not in their projection", () => {
    expect(isDocDownloadable(investor, { id: "d2", partnerId: null }, new Set(["d1"]))).toBe(false);
  });
  it("partner can download only their own referred docs", () => {
    expect(isDocDownloadable(partner, { id: "d1", partnerId: "p1" }, new Set())).toBe(true);
    expect(isDocDownloadable(partner, { id: "d1", partnerId: "pX" }, new Set())).toBe(false);
  });
});
