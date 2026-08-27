// F2.1: an application's status is not a column — it is derived from whether a
// deal lead has picked it up and whether the deal is still open. Pure, so the
// Applications page, its tab counts and the public /apply/status tracker all
// read the same rules.

import { describe, it, expect } from "vitest";
import {
  applicationTabOf,
  applicationStatusLabel,
  APPLICATION_TABS,
  APPLICATION_TAB_LABELS,
} from "@/server/domain/application-status";

describe("application status derivation", () => {
  it("awaiting = no lead and still Open", () => {
    expect(applicationTabOf({ leadId: null, dealStatus: "Open" })).toBe("awaiting");
    expect(applicationStatusLabel({ leadId: null, dealStatus: "Open", stage: "NewLead" })).toBe("Awaiting review");
  });

  it("accepted once a lead is assigned, labelled by pipeline status", () => {
    expect(applicationTabOf({ leadId: "u1", dealStatus: "Open" })).toBe("accepted");
    expect(applicationStatusLabel({ leadId: "u1", dealStatus: "Open", stage: "Negotiation" }))
      .toBe("Accepted — Negotiation");
  });

  it("dropped when the deal status left Open without a lead", () => {
    expect(applicationTabOf({ leadId: null, dealStatus: "Dropped" })).toBe("dropped");
    expect(applicationStatusLabel({ leadId: null, dealStatus: "Dropped", stage: "NewLead" }))
      .toBe("Not taken forward");
    expect(applicationTabOf({ leadId: null, dealStatus: "OnHold" })).toBe("dropped");
    expect(applicationTabOf({ leadId: null, dealStatus: "Closed" })).toBe("dropped");
  });

  it("a lead wins over a non-Open status — accepted, then paused, is still accepted", () => {
    expect(applicationTabOf({ leadId: "u1", dealStatus: "OnHold" })).toBe("accepted");
    expect(applicationTabOf({ leadId: "u1", dealStatus: "Dropped" })).toBe("accepted");
  });

  it("every tab has a label", () => {
    expect(APPLICATION_TABS).toEqual(["awaiting", "accepted", "dropped"]);
    for (const t of APPLICATION_TABS) expect(APPLICATION_TAB_LABELS[t]).toBeTruthy();
  });
});
