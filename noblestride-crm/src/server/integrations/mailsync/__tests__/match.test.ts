import { describe, it, expect } from "vitest";
import { matchMessageToRecord } from "../match";

describe("matchMessageToRecord", () => {
  const known = [{ investorId: "inv-1", emails: ["investor@x.com"] }];
  it("matches by participant email (from)", () => {
    expect(matchMessageToRecord({ externalId: "m", toAddresses: ["team@ns.com"], fromAddress: "investor@x.com" }, known))
      .toEqual({ investorId: "inv-1", matchedBy: "participant" });
  });
  it("matches by participant email (to)", () => {
    expect(matchMessageToRecord({ externalId: "m", toAddresses: ["investor@x.com"], fromAddress: "team@ns.com" }, known))
      .toEqual({ investorId: "inv-1", matchedBy: "participant" });
  });
  it("returns empty when no participant is known", () => {
    expect(matchMessageToRecord({ externalId: "m", toAddresses: ["x@y.com"], fromAddress: "z@y.com" }, known)).toEqual({});
  });
});
