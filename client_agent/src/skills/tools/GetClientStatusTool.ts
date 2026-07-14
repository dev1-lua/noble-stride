import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, CrmError, type CrmClient } from "../../lib/crm-client";
import { CLIENT_STATUS } from "../../lib/queries";

const inputSchema = z.object({
  token: z.string().min(1).describe("The opaque verification token returned by verify_status_code — pass it through exactly as received, never display it"),
});

interface ClientStatusPayload {
  companyName: string;
  applicationState: string;
  coarseStage: string | null;
  stageMessage: string;
  ndaStatus: string | null;
  engagementAgreementStatus: string | null;
  preparedDocuments: string[];
  submittedRaise: string | null;
  nextStep: string;
  lastUpdated: string;
}

export class GetClientStatusTool implements LuaTool {
  name = "get_client_status";
  description =
    "Fetch the verified client's own status summary. Present ONLY what this returns — never elaborate beyond it. Never show the token.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    try {
      const data = await crm.query<{ clientStatus: ClientStatusPayload }>(CLIENT_STATUS, { token: input.token });
      return { status: "ok" as const, ...data.clientStatus };
    } catch (err) {
      if (err instanceof CrmError && /verification expired/i.test(err.message)) {
        return { status: "verification_expired" as const };
      }
      throw err;
    }
  }
}
