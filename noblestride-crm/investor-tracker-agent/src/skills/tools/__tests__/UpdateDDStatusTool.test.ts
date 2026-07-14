import { describe, it, expect, vi } from "vitest";
import { UpdateDDStatusTool } from "../UpdateDDStatusTool";
import type { CrmClient } from "../../../lib/crm-client";

const DEAL_HIT = { id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/transactions/t1" };

function crmStub() {
  const calls: Array<{ document: string; variables?: Record<string, unknown> }> = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      calls.push({ document, variables });
      if (document.includes("globalSearch")) return { globalSearch: [DEAL_HIT] };
      if (document.includes("upsertDueDiligenceTrack")) {
        return { upsertDueDiligenceTrack: { id: "dd1", track: "Legal", status: "InProgress" } };
      }
      if (document.includes("logActivity")) return { logActivity: { id: "a1" } };
      if (document.includes("TrackerDdTracks")) {
        return {
          transaction: {
            id: "t1",
            ddTracks: [
              { track: "Legal", status: "InProgress", notes: null, startedAt: null, completedAt: null },
              { track: "Financial", status: "Complete", notes: null, startedAt: null, completedAt: null },
            ],
          },
        };
      }
      throw new Error(`unexpected: ${document.slice(0, 50)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const INPUT = { deal: "busoga", track: "Legal" as const, status: "InProgress" as const, confirmed: true as const };

describe("UpdateDDStatusTool", () => {
  it("schema rejects unconfirmed calls", () => {
    expect(new UpdateDDStatusTool().inputSchema.safeParse({ ...INPUT, confirmed: false }).success).toBe(false);
  });

  it("upserts the track, logs the audit note against the transaction, returns all tracks", async () => {
    const { crm, calls } = crmStub();
    const out = await new UpdateDDStatusTool({ crm }).execute(INPUT);
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.ddTracks).toHaveLength(2);
    expect(out.auditLogged).toBe(true);
    const audit = calls.find((c) => c.document.includes("logActivity"));
    expect((audit?.variables?.input as Record<string, unknown>).transactionId).toBe("t1");
  });

  it("reports not_found for an unknown deal", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async () => ({ globalSearch: [] })) as CrmClient["query"],
    };
    const out = await new UpdateDDStatusTool({ crm }).execute(INPUT);
    expect(out.status).toBe("not_found");
  });
});
