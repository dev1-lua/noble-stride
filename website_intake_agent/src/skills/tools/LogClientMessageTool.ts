import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { LOG_CLIENT_MESSAGE } from "../../lib/queries";

const inputSchema = z.object({
  companyName: z.string().min(1).describe("The company the visitor claims to represent"),
  contactEmail: z.string().email().describe("The visitor's email — used server-side to verify the claim"),
  messageSummary: z.string().min(1).describe("Concise summary of what the visitor said / asked for"),
  requestType: z
    .enum(["status_update", "question", "document", "other"])
    .describe("What kind of request this is"),
});

export class LogClientMessageTool implements LuaTool {
  name = "log_client_message";
  description =
    "Log an inbound message from someone claiming an existing Noblestride relationship. The server verifies the claim (email vs registered contacts), files the message for the team, and returns only ok/verified. Never tell the visitor whether the company is in the CRM.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ logInboundClientMessage: { ok: boolean; verified: boolean } }>(
      LOG_CLIENT_MESSAGE,
      { input },
    );
    return { status: "ok" as const, verified: data.logInboundClientMessage.verified };
  }
}
