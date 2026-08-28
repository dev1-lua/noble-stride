// F6b.2 (image28). The client's ask was "restrict the details until the
// investor has expressed interest and been granted access"; SOW §06 adds that
// nothing unlocks without an NDA. These tests pin the seam between the two.

import { describe, it, expect } from "vitest";
import { accessState, portalStatusLabel } from "@/server/domain/access-state";
import { EngagementStage } from "@prisma/client";
import type { PortalDealStatusLabel } from "@/server/domain/access-state";

describe("accessState", () => {
  it("interest_received while pre-NDA and interested", () => {
    expect(accessState({ engagementStage: "Shared", status: "Interested" })).toBe("interest_received");
    expect(accessState({ engagementStage: "TeaserSent", status: "Interested" })).toBe("interest_received");
    expect(accessState({ engagementStage: "Shared", status: "InConversation" })).toBe("interest_received");
  });

  it("granted once the stage has moved past the NDA gate", () => {
    expect(accessState({ engagementStage: "NDASigned", status: "Interested" })).toBe("granted");
    expect(accessState({ engagementStage: "VDRAccess", status: "Committed" })).toBe("granted");
    expect(accessState({ engagementStage: "Invested", status: "Committed" })).toBe("granted");
  });

  it("none before any interest, and none once declined", () => {
    expect(accessState({ engagementStage: "Shared", status: "NotContacted" })).toBe("none");
    expect(accessState({ engagementStage: "TeaserSent", status: "Contacted" })).toBe("none");
    expect(accessState({ engagementStage: "Declined", status: "Passed" })).toBe("none");
  });

  // The guard, not a timestamp, is the source of truth (see the module header).
  it("agrees with stageRequiresNda on every stage except Declined", async () => {
    const { stageRequiresNda } = await import("@/server/domain/nda-guard");
    for (const stage of Object.values(EngagementStage)) {
      if (stage === "Declined") continue;
      expect(accessState({ engagementStage: stage, status: "Committed" }) === "granted").toBe(
        stageRequiresNda(stage),
      );
    }
  });
});

describe("portalStatusLabel", () => {
  it("maps every state the pipeline can show", () => {
    expect(portalStatusLabel({ stage: "Declined", status: "Passed" })).toBe("Declined");
    expect(portalStatusLabel({ stage: "Invested", status: "Committed" })).toBe("Closed");
    expect(portalStatusLabel({ stage: "Shared", status: "NotContacted" })).toBe("Shared with you");
    expect(portalStatusLabel({ stage: "TeaserSent", status: "Contacted" })).toBe("Shared with you");
    expect(portalStatusLabel({ stage: "Shared", status: "Interested" })).toBe("Awaiting access");
    expect(portalStatusLabel({ stage: "TeaserSent", status: "Interested" })).toBe("Awaiting access");
    expect(portalStatusLabel({ stage: "NDASigned", status: "Interested" })).toBe("Access granted");
    expect(portalStatusLabel({ stage: "IMShared", status: "Interested" })).toBe("Information shared");
    expect(portalStatusLabel({ stage: "Meeting", status: "Interested" })).toBe("In discussion");
    expect(portalStatusLabel({ stage: "TermSheet", status: "Interested" })).toBe("In discussion");
  });

  // Reviewer finding: IMShared used to read "NDA signed", which sent the chip
  // BACKWARDS from "Access granted" the moment staff shared the IM — it read as
  // losing access. The labels must only ever move forward.
  it("never moves backwards as the stage advances", () => {
    const order: PortalDealStatusLabel[] = [
      "Shared with you",
      "Awaiting access",
      "Access granted",
      "Information shared",
      "In discussion",
      "Closed",
    ];
    const progression: EngagementStage[] = [
      "Shared",
      "TeaserSent",
      "NDASigned",
      "IMShared",
      "VDRAccess",
      "Meeting",
      "DueDiligence",
      "TermSheet",
      "Offer",
      "Invested",
    ];
    let seen = -1;
    for (const stage of progression) {
      const at = order.indexOf(portalStatusLabel({ stage, status: "Interested" }));
      expect(at, `${stage} produced an unranked label`).toBeGreaterThanOrEqual(0);
      expect(at, `${stage} went backwards`).toBeGreaterThanOrEqual(seen);
      seen = at;
    }
  });

  it("has a label for every stage, so a new one cannot fall through", () => {
    for (const stage of Object.values(EngagementStage)) {
      expect(portalStatusLabel({ stage, status: "Interested" })).toBeTruthy();
    }
  });
});
