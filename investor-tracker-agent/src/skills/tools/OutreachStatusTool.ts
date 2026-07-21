import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { OUTREACH_DRAFTS } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";

export interface OutreachStatusDeps {
  crm: CrmClient;
}

const inputSchema = z.object({
  deal: z.string().optional().describe("Transaction/deal name (or exact id) to scope drafts to one deal"),
  investor: z.string().optional().describe("Investor name (or exact id) to scope drafts to one investor"),
});

interface DraftsResult {
  outreachDrafts: Array<{
    id: string;
    subject: string;
    status: string;
    matchRationale: string;
    error?: string | null;
    sentAt?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    investor: { id: string; name: string };
    transaction: { id: string; name: string };
    person?: { firstName: string; lastName?: string | null; email?: string | null } | null;
  }>;
}

export class OutreachStatusTool implements LuaTool {
  name = "outreach_status";
  description =
    "Outreach draft status from the investor-outreach workflow: what's drafted, approved, sent, rejected, or failed — org-wide, or filtered to a deal and/or investor. Read-only; approving and sending stays in the CRM review queue.";
  inputSchema = inputSchema;

  constructor(private deps?: OutreachStatusDeps) {}

  private getDeps(): OutreachStatusDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm } = this.getDeps();

    let transactionId: string | undefined;
    if (input.deal) {
      const res = await resolveByNameOrId(crm, "transaction", input.deal);
      if (res.kind === "none") {
        return { status: "deal_not_found" as const, message: "No matching deal was found in the CRM." };
      }
      if (res.kind === "ambiguous") {
        return {
          status: "ambiguous_deal" as const,
          message: "Multiple deals match — ask the user to pick one, then call again with the chosen id.",
          candidates: res.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
        };
      }
      transactionId = res.result.id;
    }

    let investorId: string | undefined;
    if (input.investor) {
      const res = await resolveByNameOrId(crm, "investor", input.investor);
      if (res.kind === "none") {
        return { status: "investor_not_found" as const, message: "No matching investor was found in the CRM." };
      }
      if (res.kind === "ambiguous") {
        return {
          status: "ambiguous_investor" as const,
          message: "Multiple investors match — ask the user to pick one, then call again with the chosen id.",
          candidates: res.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
        };
      }
      investorId = res.result.id;
    }

    const result = await crm.query<DraftsResult>(OUTREACH_DRAFTS, { transactionId, investorId });

    const byStatus: Record<string, number> = {};
    for (const d of result.outreachDrafts) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    }

    const drafts = result.outreachDrafts.map((d) => ({
      subject: d.subject,
      status: d.status,
      investor: d.investor.name,
      deal: d.transaction.name,
      contact: d.person ? [d.person.firstName, d.person.lastName].filter(Boolean).join(" ") : null,
      matchRationale: d.matchRationale,
      error: d.error ?? null,
      sentAt: d.sentAt ?? null,
      createdAt: d.createdAt,
    }));

    return {
      status: "ok" as const,
      draftCount: drafts.length,
      byStatus,
      drafts,
      link: `${crm.baseUrl}/outreach`,
    };
  }
}
