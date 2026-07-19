import { describe, it, expect } from "vitest";
import { loginNotice } from "./messages";

describe("loginNotice", () => {
  it("maps known slugs to copy", () => {
    expect(loginNotice("password-updated")).toMatch(/sign in/i);
    expect(loginNotice("session-expired")).toMatch(/expired/i);
  });
  it("returns a generic fallback for unknown/arbitrary input (no reflection)", () => {
    expect(loginNotice("<script>alert(1)</script>")).toBe("Please sign in to continue.");
    expect(loginNotice("Call this number 555-0100")).toBe("Please sign in to continue.");
  });
  it("returns null when no slug is present", () => {
    expect(loginNotice(undefined)).toBeNull();
  });
  it("maps the invite-complete slug", () => {
    expect(loginNotice("invite-complete")).toMatch(/access is set up/i);
  });
});
