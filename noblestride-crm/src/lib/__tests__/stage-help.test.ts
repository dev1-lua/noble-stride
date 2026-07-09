import { describe, it, expect } from "vitest";
import { MandateStage, TransactionStage, EngagementStage } from "@prisma/client";
import { STAGE_HELP } from "@/lib/vocab";

describe("STAGE_HELP", () => {
  it("has a one-liner for every MandateStage value", () => {
    for (const v of Object.values(MandateStage)) {
      expect(STAGE_HELP.MandateStage[v]).toBeTruthy();
    }
    expect(Object.keys(STAGE_HELP.MandateStage)).toHaveLength(7);
  });

  it("has a one-liner for every TransactionStage value", () => {
    for (const v of Object.values(TransactionStage)) {
      expect(STAGE_HELP.TransactionStage[v]).toBeTruthy();
    }
    expect(Object.keys(STAGE_HELP.TransactionStage)).toHaveLength(7);
  });

  it("has a one-liner for every EngagementStage value", () => {
    for (const v of Object.values(EngagementStage)) {
      expect(STAGE_HELP.EngagementStage[v]).toBeTruthy();
    }
    expect(Object.keys(STAGE_HELP.EngagementStage)).toHaveLength(12);
  });

  it("gives distinct tooltips for TermSheet/DueDiligence across enums", () => {
    expect(STAGE_HELP.TransactionStage.TermSheet).not.toBe(STAGE_HELP.EngagementStage.TermSheet);
    expect(STAGE_HELP.TransactionStage.DueDiligence).not.toBe(STAGE_HELP.EngagementStage.DueDiligence);
  });
});
