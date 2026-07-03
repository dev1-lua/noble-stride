import { describe, expect, it } from "vitest";
import { referralFunnel, referralsByStage } from "@/server/partner-portal";

describe("referralsByStage", () => {
  it("buckets referred deals by stage with size totals, in vocab stage order", () => {
    expect(
      referralsByStage([
        { stage: "Signed", dealSize: 5 },
        { stage: "NewLead", dealSize: 2 },
        { stage: "Signed", dealSize: null },
      ]),
    ).toEqual([
      { stage: "NewLead", count: 1, totalSize: 2 },
      { stage: "Signed", count: 2, totalSize: 5 },
    ]);
  });

  it("returns empty for no referrals", () => {
    expect(referralsByStage([])).toEqual([]);
  });
});

describe("referralFunnel stays intact", () => {
  it("counts introduced / in-progress / signed / lost", () => {
    expect(
      referralFunnel([
        { stage: "NewLead" },
        { stage: "Proposal" },
        { stage: "Signed" },
        { stage: "Lost" },
      ]),
    ).toEqual({ introduced: 4, inProgress: 1, signed: 1, lost: 1 });
  });
});
