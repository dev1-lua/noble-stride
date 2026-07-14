import { User, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, CrmError } from "../../lib/crm-client";
import { AGENT_CANCEL_WRITE } from "../../lib/queries";
import type { WriteDeps } from "../../lib/write-deps";

const inputSchema = z.object({
  writeToken: z.string().min(1).describe("The writeToken to discard, from propose_change"),
});

export class CancelChangeTool implements LuaTool {
  name = "cancel_change";
  description = "Discard a previously proposed CRM change without applying it.";
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
      await crm.query<{ agentCancelWrite: { ok: boolean } }>(AGENT_CANCEL_WRITE, {
        writeToken: input.writeToken,
        actorEmail: email,
      });
      return { status: "ok" as const };
    } catch (err) {
      if (err instanceof CrmError && err.message.startsWith("The CRM rejected") && !err.message.includes("Unexpected error"))
        return { status: "rejected" as const, message: err.message };
      throw err;
    }
  }
}
