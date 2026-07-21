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
  fields: z
    .record(z.unknown())
    .describe(
      "The FINAL literal values to store, exactly as they should be saved in the CRM. The write is a literal set — there are no append/merge semantics. NEVER pass an instruction as a value (e.g. \"APPEND: '…' to end of existing notes\"); to append, read the record's current value first and pass the full final text.",
    ),
});

// 2026-07-21 QA: the model once staged fields:{notes:"APPEND: '…' to end of existing notes"}
// — a free-text directive that a literal write would have stored verbatim — while showing the
// operator a clean preview. Directive-shaped values are rejected before they reach the CRM.
const DIRECTIVE_VALUE = /^\s*(append|prepend|add|remove|delete|insert)\s*:|\bto (the )?(end|start|beginning) of (the )?(existing|current)\b/i;

function directiveField(fields: Record<string, unknown>): string | undefined {
  return Object.entries(fields).find(([, v]) => typeof v === "string" && DIRECTIVE_VALUE.test(v))?.[0];
}

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
    const badField = directiveField(input.fields);
    if (badField)
      return {
        status: "rejected" as const,
        message: `The value for "${badField}" looks like an edit instruction, not the final text. The CRM stores values literally — read the record's current value (lookup_record), compose the full final text yourself, and propose that.`,
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
