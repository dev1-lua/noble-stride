import { describe, it, expect } from "vitest";
import { generateDigestMarkdown, weekOf } from "../digest-runner";
import type { CrmClient } from "../crm-client";

const NOW = new Date("2026-07-13T09:00:00Z"); // a Monday
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const crm: CrmClient = {
  baseUrl: "https://crm.example",
  query: (async () => ({
    mandatesByStage: [
      {
        stage: "OUTREACH",
        label: "Outreach",
        items: [{ id: "m1", name: "Busoga Mandate", stageEnteredAt: daysAgo(1), createdAt: daysAgo(20), updatedAt: daysAgo(1) }],
      },
    ],
    transactionsByStage: [],
  })) as CrmClient["query"],
};

describe("weekOf", () => {
  it("returns the ISO date of the week's Monday", () => {
    expect(weekOf(new Date("2026-07-13T09:00:00Z"))).toBe("2026-07-13"); // Monday itself
    expect(weekOf(new Date("2026-07-16T22:00:00Z"))).toBe("2026-07-13"); // Thursday
    expect(weekOf(new Date("2026-07-19T12:00:00Z"))).toBe("2026-07-13"); // Sunday → PREVIOUS Monday
    expect(weekOf(new Date("2026-08-02T12:00:00Z"))).toBe("2026-07-27"); // Sunday across month boundary
  });
});

describe("generateDigestMarkdown", () => {
  it("feeds computed digest into the generator", async () => {
    let seenPrompt = "";
    const md = await generateDigestMarkdown(
      { crm, generate: async (p) => { seenPrompt = p; return "## Movement\nBusoga moved."; }, now: () => NOW },
      7,
      "both",
    );
    expect(md).toBe("## Movement\nBusoga moved.");
    expect(seenPrompt).toContain("Busoga Mandate");
  });

  it("falls back to raw digest markdown when the generator fails", async () => {
    const md = await generateDigestMarkdown(
      { crm, generate: async () => { throw new Error("boom"); }, now: () => NOW },
      7,
      "both",
    );
    expect(md).toContain("Busoga Mandate");
    expect(md).toContain("Outreach");
  });
});
