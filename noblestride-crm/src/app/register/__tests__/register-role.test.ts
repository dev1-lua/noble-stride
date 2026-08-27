// F1.1: /register now opens with four role cards (image1), mirroring Aika's
// role-first signup. Each card is a plain link — the routing is pure.

import { describe, it, expect } from "vitest";
import { registerRoleHref, REGISTER_ROLES, REGISTER_ROLE_COPY } from "../role-picker";

describe("registerRoleHref", () => {
  it("routes each role card", () => {
    expect(registerRoleHref("client")).toBe("/intake");
    expect(registerRoleHref("investor")).toBe("/register?path=fund");
    expect(registerRoleHref("partner")).toBe("/register?path=partner");
    expect(registerRoleHref("staff")).toBe("/register?path=internal");
  });

  it("describes all four roles", () => {
    expect(REGISTER_ROLES).toHaveLength(4);
    for (const r of REGISTER_ROLES) {
      expect(REGISTER_ROLE_COPY[r].title).toBeTruthy();
      expect(REGISTER_ROLE_COPY[r].description).toBeTruthy();
    }
  });

  it("says out loud that staff accounts are approved before first sign-in", () => {
    expect(REGISTER_ROLE_COPY.staff.description).toMatch(/approv/i);
  });
});
