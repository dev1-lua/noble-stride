import { describe, it, expect, vi } from "vitest";
import { UpdateEngagementTool } from "../UpdateEngagementTool";
import { RecordMilestoneTool } from "../RecordMilestoneTool";
import { UpdateDDStatusTool } from "../UpdateDDStatusTool";
import { CreateFollowupTaskTool } from "../CreateFollowupTaskTool";
import type { CrmClient } from "../../../lib/crm-client";

// The platform validates tool inputs against the zod schema, but direct
// invocations (`lua test`, harness bugs) call execute() straight — the
// confirmed gate must hold at runtime too, with zero CRM calls made.
function explodingCrm(): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async () => {
      throw new Error("CRM must not be called for unconfirmed writes");
    }) as CrmClient["query"],
  };
}

describe("runtime confirmed gate (schema bypass)", () => {
  it("update_engagement rejects confirmed:false without touching the CRM", async () => {
    const crm = explodingCrm();
    const out = await new UpdateEngagementTool({ crm }).execute({
      engagementId: "e1",
      set: { probability: 50 },
      reason: "test",
      confirmed: false,
    } as never);
    expect(out.status).toBe("rejected");
    expect(crm.query).not.toHaveBeenCalled();
  });

  it("record_milestone rejects confirmed:false", async () => {
    const crm = explodingCrm();
    const out = await new RecordMilestoneTool({ crm }).execute({
      engagementId: "e1",
      action: "record",
      key: "NdaExecuted",
      confirmed: false,
    } as never);
    expect(out.status).toBe("rejected");
    expect(crm.query).not.toHaveBeenCalled();
  });

  it("update_dd_status rejects confirmed:false", async () => {
    const crm = explodingCrm();
    const out = await new UpdateDDStatusTool({ crm }).execute({
      deal: "busoga",
      track: "Legal",
      status: "InProgress",
      confirmed: false,
    } as never);
    expect(out.status).toBe("rejected");
    expect(crm.query).not.toHaveBeenCalled();
  });

  it("create_followup_task rejects confirmed:false", async () => {
    const crm = explodingCrm();
    const out = await new CreateFollowupTaskTool({ crm }).execute({
      title: "Chase",
      confirmed: false,
    } as never);
    expect(out.status).toBe("rejected");
    expect(crm.query).not.toHaveBeenCalled();
  });

  it("update_engagement also rejects a missing confirmed field entirely", async () => {
    const crm = explodingCrm();
    const out = await new UpdateEngagementTool({ crm }).execute({
      engagementId: "e1",
      set: { probability: 50 },
      reason: "test",
    } as never);
    expect(out.status).toBe("rejected");
  });
});
