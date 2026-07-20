import { describe, expect, it } from "vitest";
import { nextStepLabel } from "../next-step";

describe("nextStepLabel", () => {
  it("maps early stages to Request NDA", () => {
    expect(nextStepLabel("Shared")).toBe("Request NDA");
    expect(nextStepLabel("TeaserSent")).toBe("Request NDA");
  });
  it("walks the ladder: IM → VDR → meeting → update", () => {
    expect(nextStepLabel("NDASigned")).toBe("Request IM");
    expect(nextStepLabel("IMShared")).toBe("Request VDR access");
    expect(nextStepLabel("VDRAccess")).toBe("Request a meeting");
    expect(nextStepLabel("Meeting")).toBe("Request an update");
    expect(nextStepLabel("InfoRequest")).toBe("Request an update");
    expect(nextStepLabel("DueDiligence")).toBe("Request an update");
    expect(nextStepLabel("TermSheet")).toBe("Request an update");
    expect(nextStepLabel("Offer")).toBe("Request an update");
  });
  it("offers nothing on terminal stages", () => {
    expect(nextStepLabel("Invested")).toBeNull();
    expect(nextStepLabel("Declined")).toBeNull();
  });
});
