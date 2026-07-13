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
});
