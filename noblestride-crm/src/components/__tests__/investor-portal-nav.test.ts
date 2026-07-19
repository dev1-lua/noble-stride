import { describe, expect, it } from "vitest";
import {
  isInvestorNavActive,
  deriveInvestorPageMeta,
} from "../portal/investor-portal-nav";

describe("isInvestorNavActive", () => {
  it("marks Opportunities active on the root and on deal pages", () => {
    expect(isInvestorNavActive("/portal/investor", "/portal/investor")).toBe(true);
    expect(isInvestorNavActive("/portal/investor/deals/abc", "/portal/investor")).toBe(true);
  });

  it("does not mark Opportunities active on sibling tabs", () => {
    expect(isInvestorNavActive("/portal/investor/pipeline", "/portal/investor")).toBe(false);
    expect(isInvestorNavActive("/portal/investor/profile", "/portal/investor")).toBe(false);
  });

  it("marks siblings active on their own routes only", () => {
    expect(isInvestorNavActive("/portal/investor/pipeline", "/portal/investor/pipeline")).toBe(true);
    expect(isInvestorNavActive("/portal/investor", "/portal/investor/pipeline")).toBe(false);
  });
});

describe("deriveInvestorPageMeta", () => {
  it("maps each nav route to its title", () => {
    expect(deriveInvestorPageMeta("/portal/investor").title).toBe("Opportunities");
    expect(deriveInvestorPageMeta("/portal/investor/pipeline").title).toBe("My Pipeline");
    expect(deriveInvestorPageMeta("/portal/investor/profile").title).toBe("Fund Profile");
  });

  it("keeps deal detail pages under Opportunities", () => {
    expect(deriveInvestorPageMeta("/portal/investor/deals/xyz").title).toBe("Opportunities");
  });

  it("falls back for unknown routes", () => {
    expect(deriveInvestorPageMeta("/portal/investor/unknown").title).toBe("Investor Portal");
  });

  it("maps the Team route", () => {
    expect(deriveInvestorPageMeta("/portal/investor/team").title).toBe("Team");
  });
});
