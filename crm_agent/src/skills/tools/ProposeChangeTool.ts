import { User, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, CrmError } from "../../lib/crm-client";
import { AGENT_PREPARE_WRITE } from "../../lib/queries";
import type { WriteDeps } from "../../lib/write-deps";

const OPERATIONS = [
  "createClient", "updateClient", "createMandate", "updateMandate", "setMandateStage",
  "createTransaction", "updateTransaction", "setTransactionStage", "createEngagement", "updateEngagement",
  "logActivity", "createInvestor", "updateInvestor", "createPerson", "updatePerson",
  "createPartner", "updatePartner", "createTask", "updateTask", "createDocument",
  "updateDocument", "recordMilestone", "unrecordMilestone", "recordOpenNda", "recordClosedNda",
] as const;

const inputSchema = z.object({
  operation: z
    .enum(OPERATIONS)
    .describe("What to do — create<Entity>, update<Entity>, set<Entity>Stage, logActivity, record/unrecordMilestone, recordOpen/ClosedNda"),
  targetId: z.string().optional().describe("Record id from lookup_record — REQUIRED for updates, omit for creates"),
  fields: z.record(z.unknown()).describe("The fields to set, exactly as the user stated them"),
});

export class ProposeChangeTool implements LuaTool {
  name = "propose_change";
  description =
    "Prepare a CRM change and get back a human-readable preview + writeToken. NEVER commits anything. Show the preview to the user verbatim and ask them to confirm before calling commit_change.";
  inputSchema = inputSchema;

  constructor(private deps?: WriteDeps) {}

  private async staffEmail(): Promise<string | undefined> {
    if (this.deps) return (await this.deps.getUser())?.staffEmail;
    const u = await User.get(); // lua-cli
    return (u?.data as { staffEmail?: string } | undefined)?.staffEmail;
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const email = await this.staffEmail();
    if (!email)
      return {
        status: "not_identified" as const,
        message: "The user must complete staff verification (CRM email) before any change.",
      };
    const crm = this.deps?.crm ?? crmClientFromEnv();
    try {
      const data = await crm.query<{ agentPrepareWrite: { writeToken: string; preview: string; warnings: string[] } }>(
        AGENT_PREPARE_WRITE,
        {
          operation: input.operation,
          targetId: input.targetId ?? null,
          payloadJson: JSON.stringify(input.fields),
          actorEmail: email,
        },
      );
      return { status: "preview" as const, ...data.agentPrepareWrite };
    } catch (err) {
      if (err instanceof CrmError && err.message.startsWith("The CRM rejected") && !err.message.includes("Unexpected error"))
        return { status: "rejected" as const, message: err.message };
      throw err;
    }
  }
}
