import { describe, it, expect, vi } from "vitest";
import { RecordIntroductionTool } from "../RecordIntroductionTool";
import { CreateReferredMandateTool } from "../CreateReferredMandateTool";
import { LinkPartnerToDealTool } from "../LinkPartnerToDealTool";
import { UpdatePartnerTool } from "../UpdatePartnerTool";
import { UpdateFeeStatusTool } from "../UpdateFeeStatusTool";
import type { CrmClient } from "../../../lib/crm-client";

/** Hermetic staff stub — without it the in-tool guard calls the live Lua API. */
const STAFF = async () => true;

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

// Valid-but-unconfirmed input per write tool. EVERY write tool must appear here.
const CASES: Array<{ name: string; make: (crm: CrmClient) => { execute: (input: never) => Promise<{ status: string }> }; input: Record<string, unknown> }> = [
  {
    name: "record_introduction",
    make: (crm) => new RecordIntroductionTool({ isStaff: STAFF, crm }),
    input: { partner: "Acme", partnerAction: "create_new", introduced: "Busoga Foods", reason: "test" },
  },
  {
    name: "create_referred_mandate",
    make: (crm) => new CreateReferredMandateTool({ isStaff: STAFF, crm }),
    input: { client: "Busoga Foods", partner: "Acme", mandateName: "Busoga raise", reason: "test" },
  },
  {
    name: "link_partner_to_deal",
    make: (crm) => new LinkPartnerToDealTool({ isStaff: STAFF, crm }),
    input: { partner: "Acme", deal: "Busoga raise", dealType: "mandate", reason: "test" },
  },
  {
    name: "update_partner",
    make: (crm) => new UpdatePartnerTool({ isStaff: STAFF, crm }),
    input: { partnerId: "p1", set: { status: "Preferred" }, reason: "test" },
  },
  {
    name: "update_fee_status",
    make: (crm) => new UpdateFeeStatusTool({ isStaff: STAFF, crm }),
    input: { transaction: "Busoga raise", set: { partnerFeeStatus: "Due" }, reason: "test" },
  },
];

describe("runtime confirmed gate (schema bypass)", () => {
  for (const { name, make, input } of CASES) {
    it(`${name} rejects confirmed:false without touching the CRM`, async () => {
      const crm = explodingCrm();
      const out = await make(crm).execute({ ...input, confirmed: false } as never);
      expect(out.status).toBe("rejected");
      expect(crm.query).not.toHaveBeenCalled();
    });

    it(`${name} rejects a missing confirmed field entirely`, async () => {
      const crm = explodingCrm();
      const out = await make(crm).execute({ ...input } as never);
      expect(out.status).toBe("rejected");
      expect(crm.query).not.toHaveBeenCalled();
    });
  }
});
