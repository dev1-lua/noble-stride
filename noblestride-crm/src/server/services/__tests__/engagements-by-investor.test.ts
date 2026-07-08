import { describe, it, expect } from "vitest";
import { stageCountsFor } from "@/server/services/engagements";

describe("stageCountsFor", () => {
  it("counts by stage in vocab order, omitting zero-count stages", () => {
    const rows = [
      { engagementStage: "NDASigned" },
      { engagementStage: "NDASigned" },
      { engagementStage: "TeaserSent" },
    ];
    const counts = stageCountsFor(rows);
    expect(counts).toEqual([
      { stage: "TeaserSent", label: expect.any(String), count: 1 },
      { stage: "NDASigned", label: expect.any(String), count: 2 },
    ]);
  });
});
