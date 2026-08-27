// F1.1: the login page names who it is for. The tabs are COPY-ONLY — they never
// gate a sign-in and never reveal which kind an email belongs to, so
// parseLoginRole exists to keep an arbitrary ?as= value from reaching the page.

import { describe, it, expect } from "vitest";
import { parseLoginRole, LOGIN_ROLES, LOGIN_ROLE_COPY } from "../role-tabs";

describe("parseLoginRole", () => {
  it("accepts the four roles", () => {
    for (const r of LOGIN_ROLES) expect(parseLoginRole(r)).toBe(r);
  });

  it("rejects anything else, so ?as= can never be reflected into the page", () => {
    for (const bad of [undefined, "", "admin", "Investor", "<script>", "client "]) {
      expect(parseLoginRole(bad as never)).toBeNull();
    }
  });

  it("has copy for every role", () => {
    for (const r of LOGIN_ROLES) {
      expect(LOGIN_ROLE_COPY[r].title).toBeTruthy();
      expect(LOGIN_ROLE_COPY[r].subtitle).toBeTruthy();
    }
  });

  it("only the client tab offers application tracking; staff gets no sign-up link", () => {
    expect(LOGIN_ROLE_COPY.client.footer?.href).toBe("/apply/status");
    expect(LOGIN_ROLE_COPY.staff.footer).toBeNull();
    expect(LOGIN_ROLE_COPY.investor.footer?.href).toBe("/register?path=fund");
    expect(LOGIN_ROLE_COPY.partner.footer?.href).toBe("/register?path=partner");
  });
});
