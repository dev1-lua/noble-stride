import { describe, it, expect } from "vitest";
import { ENGAGEMENT_STAGES, engagementStageOptions } from "@/lib/engagement-stage-colors";

describe("engagementStageOptions", () => {
  it("returns one {value,label} option per stage, in vocab order", () => {
    const options = engagementStageOptions();
    expect(options.map((o) => o.value)).toEqual(ENGAGEMENT_STAGES);
    expect(options).toHaveLength(12);
  });

  it("uses vocab display labels, not raw enum values", () => {
    const byValue = new Map(engagementStageOptions().map((o) => [o.value, o.label]));
    expect(byValue.get("TeaserSent")).toBe("Teaser Sent");
    expect(byValue.get("NDASigned")).toBe("NDA Signed");
    expect(byValue.get("VDRAccess")).toBe("VDR Access");
    expect(byValue.get("Shared")).toBe("Shared");
  });
});
