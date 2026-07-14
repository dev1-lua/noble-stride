// Pure tests for the agent-write preview/diff builder — no DB.

import { describe, it, expect } from "vitest";
import { buildCreatePreview, buildUpdatePreview } from "../agent-write-preview";

describe("buildUpdatePreview", () => {
  it("lists only actually-changing fields", () => {
    const { preview, changedKeys } = buildUpdatePreview(
      "updateMandate",
      { name: "Acme Fundraising", stage: "Qualification", dealSize: 1000000 },
      { stage: "Proposal", dealSize: 1000000 },
    );
    expect(changedKeys).toEqual(["stage"]);
    expect(preview).toContain("stage: Qualification → Proposal");
    expect(preview).not.toContain("dealSize");
  });

  it("skips undefined payload fields entirely", () => {
    const { preview, changedKeys } = buildUpdatePreview(
      "updateClient",
      { name: "Acme" },
      { name: "Acme", hqCity: undefined },
    );
    expect(changedKeys).toEqual([]);
    expect(preview).not.toContain("hqCity");
  });

  it("treats a field absent from `current` as changed when present in payload", () => {
    const { changedKeys } = buildUpdatePreview("updateClient", {}, { hqCity: "Nairobi" });
    expect(changedKeys).toEqual(["hqCity"]);
  });

  it("compares dates at calendar-date granularity, not exact instant", () => {
    const { changedKeys } = buildUpdatePreview(
      "updateMandate",
      { dateOpened: new Date("2026-07-14T00:00:00.000Z") },
      { dateOpened: "2026-07-14" },
    );
    expect(changedKeys).toEqual([]);
  });

  it("flags a real calendar-date change", () => {
    const { changedKeys, preview } = buildUpdatePreview(
      "updateMandate",
      { dateOpened: new Date("2026-07-14T00:00:00.000Z") },
      { dateOpened: "2026-07-15" },
    );
    expect(changedKeys).toEqual(["dateOpened"]);
    expect(preview).toContain("dateOpened:");
  });

  it("renders array values via join(', ')", () => {
    const { preview, changedKeys } = buildUpdatePreview(
      "updateInvestor",
      { sectorFocus: ["Fintech"] },
      { sectorFocus: ["Fintech", "Healthcare"] },
    );
    expect(changedKeys).toEqual(["sectorFocus"]);
    expect(preview).toContain("sectorFocus: Fintech → Fintech, Healthcare");
  });
});

describe("buildCreatePreview", () => {
  it("lists provided fields and skips undefined", () => {
    const p = buildCreatePreview("createTask", { title: "Call Acme", dueAt: "2026-07-20", assigneeId: undefined });
    expect(p).toContain("Create task");
    expect(p).toContain("title: Call Acme");
    expect(p).not.toContain("assigneeId");
  });

  it("renders array values via join(', ')", () => {
    const p = buildCreatePreview("createClient", { name: "Acme", sector: ["Fintech", "Agritech"] });
    expect(p).toContain("sector: Fintech, Agritech");
  });
});
