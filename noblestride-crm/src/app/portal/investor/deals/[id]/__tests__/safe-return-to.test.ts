// F6b.1: express-interest can be submitted from the browse grid, the pipeline or
// the deal page, so the action takes a returnTo. It is allow-listed rather than
// shape-validated — an open redirect out of a signed-in portal form is exactly
// what a phishing link wants.
//
// The helper lives outside actions.ts because a "use server" module may only
// export async functions; exporting this from there broke the dev build.

import { describe, it, expect } from "vitest";
import { safeReturnTo } from "../return-to";

const DEAL = "txn-1";

describe("safeReturnTo", () => {
  it("accepts the three legitimate targets", () => {
    for (const target of ["/portal/investor", "/portal/investor/pipeline", `/portal/investor/deals/${DEAL}`]) {
      expect(safeReturnTo(target, DEAL)).toBe(target);
    }
  });

  it("falls back to the deal page for anything else", () => {
    for (const hostile of [
      "https://evil.test",
      "//evil.test",
      "/dashboard",
      "/portal/investor/deals/some-other-deal",
      "/portal/investor?x=1",
      undefined,
      null,
      42,
    ]) {
      expect(safeReturnTo(hostile, DEAL)).toBe(`/portal/investor/deals/${DEAL}`);
    }
  });
});
