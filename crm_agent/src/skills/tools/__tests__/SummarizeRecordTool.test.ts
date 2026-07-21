import { describe, it, expect, vi } from "vitest";
import { SummarizeRecordTool } from "../SummarizeRecordTool";
import type { CrmClient } from "../../../lib/crm-client";

function crmStub(searchResults: unknown[], detail?: unknown, documents: unknown[] = []): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) return { globalSearch: searchResults };
      if (document.includes("AgentDocuments")) return { documents };
      return { client: detail, investor: detail, mandate: detail, transaction: detail, engagement: detail, partner: detail };
    }) as CrmClient["query"],
  };
}

const HIT = { id: "c1", type: "Client", title: "Acme Ltd", subtitle: null, href: "/clients/c1" };

describe("SummarizeRecordTool", () => {
  it("summarizes a uniquely-resolved record, embeds document metadata, returns the deep link", async () => {
    let seenPrompt = "";
    const tool = new SummarizeRecordTool({
      crm: crmStub([HIT], { id: "c1", name: "Acme Ltd", status: "Active" }, [
        { name: "NDA.pdf", type: "NDA", status: "APPROVED" },
      ]),
      generate: async (p) => { seenPrompt = p; return "## Headline\nAcme is active."; },
    });
    const out = await tool.execute({ recordType: "client", query: "acme ltd" });
    expect(out).toEqual({ status: "ok", summary: "## Headline\nAcme is active.", link: "https://crm.example/clients/c1" });
    expect(seenPrompt).toContain("NDA.pdf"); // document METADATA reaches the briefing
  });

  it("surfaces the resolved deal lead (owner.name) to the briefing instead of a raw ownerId", async () => {
    let seenPrompt = "";
    const txHit = { id: "t1", type: "Transaction", title: "Amos Fund", subtitle: null, href: "/transactions/t1" };
    const tool = new SummarizeRecordTool({
      crm: crmStub([txHit], {
        id: "t1", name: "Amos Fund", stage: "ClosedWon",
        owner: { id: "u1", name: "Amos" }, assistant: { id: "u2", name: "Jane" },
      }),
      generate: async (p) => { seenPrompt = p; return "## Headline\nAmos Fund is closed-won."; },
    });
    const out = await tool.execute({ recordType: "transaction", query: "Amos Fund" });
    expect(out.status).toBe("ok");
    expect(seenPrompt).toContain("Amos");   // resolved lead name reaches the prompt
    expect(seenPrompt).not.toMatch(/"ownerId"/); // no bare FK
  });

  it("returns candidates when ambiguous", async () => {
    const two = [HIT, { ...HIT, id: "c2", title: "Acme Ltd Kenya" }];
    const tool = new SummarizeRecordTool({ crm: crmStub(two), generate: async () => "unused" });
    const out = await tool.execute({ recordType: "client", query: "acm" });
    expect(out.status).toBe("ambiguous");
    if (out.status === "ambiguous") expect(out.candidates.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("returns not_found when nothing matches", async () => {
    const tool = new SummarizeRecordTool({ crm: crmStub([]), generate: async () => "unused" });
    const out = await tool.execute({ recordType: "partner", query: "nobody" });
    expect(out.status).toBe("not_found");
  });

  it("falls back to raw facts when AI generation fails", async () => {
    const tool = new SummarizeRecordTool({
      crm: crmStub([HIT], { id: "c1", name: "Acme Ltd", status: "Active" }),
      generate: async () => { throw new Error("model overloaded"); },
    });
    const out = await tool.execute({ recordType: "client", query: "acme ltd" });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.summary).toContain("Acme Ltd");
  });

  it("still summarizes when the documents metadata fetch fails or returns null", async () => {
    const failingDocs: CrmClient = {
      baseUrl: "https://crm.example",
      query: (async (document: string) => {
        if (document.includes("globalSearch")) return { globalSearch: [HIT] };
        if (document.includes("AgentDocuments")) throw new Error("documents unavailable");
        return { client: { id: "c1", name: "Acme Ltd" } };
      }) as CrmClient["query"],
    };
    const tool = new SummarizeRecordTool({ crm: failingDocs, generate: async () => "## Headline\nOK." });
    const out = await tool.execute({ recordType: "client", query: "acme ltd" });
    expect(out).toEqual({ status: "ok", summary: "## Headline\nOK.", link: "https://crm.example/clients/c1" });

    const nullDocs: CrmClient = {
      baseUrl: "https://crm.example",
      query: (async (document: string) => {
        if (document.includes("globalSearch")) return { globalSearch: [HIT] };
        if (document.includes("AgentDocuments")) return { documents: null };
        return { client: { id: "c1", name: "Acme Ltd" } };
      }) as CrmClient["query"],
    };
    const tool2 = new SummarizeRecordTool({ crm: nullDocs, generate: async () => "## Headline\nOK." });
    const out2 = await tool2.execute({ recordType: "client", query: "acme ltd" });
    expect(out2.status).toBe("ok");
  });
});
