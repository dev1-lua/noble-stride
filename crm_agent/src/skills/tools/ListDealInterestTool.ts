import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { GLOBAL_SEARCH, AGENT_DEAL_INTEREST } from "../../lib/queries";
import { resolveRecord, type SearchResult } from "../../lib/resolve";
import { engagementActivity, mostRecentTouch, hasExpressedInterestViaStage, type EngagementActivity } from "../../lib/analysis";

export interface DealInterestDeps {
  crm: CrmClient;
  /** Injectable clock for testability; defaults to the real current time. */
  now?: Date;
}

interface Milestone {
  key: string;
  completedAt: string | null;
}

interface EngagementRow {
  status: string;
  engagementStage: string | null;
  interestLevel: string | null;
  lastContact: string | null;
  updatedAt: string;
  investor: { id: string; name: string; investorType: string | null };
  conversation: { status: string; lastMessageAt: string | null } | null;
  milestones: Milestone[];
}

interface TransactionData {
  id: string;
  name: string;
  stage: string;
  engagements: EngagementRow[];
}

type SinceBasis = "eoi_milestone" | "stage_implied" | "last_update";
type RowCategory = "interested" | "withdrawn" | "contacted";

interface InterestRow {
  investor: string;
  investorType: string | null;
  interestLevel: string | null;
  /** Raw engagement status, kept visible even when the row lands under
   * `withdrawn` via engagementStage=Declined, so a status/stage conflict
   * (e.g. status Committed but stage Declined) stays visible rather than
   * silently resolved. */
  status: string;
  stage: string | null;
  /** When interest began, only meaningful for `interested` rows; null for
   * withdrawn/contacted rows (there is no "interest date" to report there). */
  since: string | null;
  sinceBasis: SinceBasis | null;
  lastTouch: string | null;
  /** Recency of the last touch on EITHER side (a staff outbound message counts
   * the same as an investor reply) — a contact-recency signal, not proof the
   * investor themselves is engaging. */
  contactRecency: EngagementActivity;
  /** True when the open conversation's status is Pending — i.e. we are the
   * side who owes the next reply. This is the one real investor-side signal
   * available here. */
  awaitingOurReply: boolean;
  link: string;
}

// Status values that on their own mean "this investor has registered interest",
// independent of whether stage or milestones also say so.
const INTERESTED_STATUSES = new Set(["Interested", "Committed"]);

const inputSchema = z.object({
  deal: z.string().describe("Deal name or codename"),
  includeAll: z.boolean().default(false).describe("Also list contacted-but-not-yet-interested investors"),
});

export class ListDealInterestTool implements LuaTool {
  name = "list_deal_interest";
  description =
    "List which investors have registered interest on a specific deal (transaction) and which have withdrawn (passed or declined). Each row shows contactRecency (active/cooling/dormant/never_contacted based on the newer of lastContact and the conversation's lastMessageAt) and awaitingOurReply (true when a reply is pending on our side) — contactRecency reflects a touch from EITHER side, so it is not proof the investor themselves is engaging; awaitingOurReply is the one real investor-side signal here. Set includeAll to also get a third list of investors who've been contacted, or are mid-conversation, but haven't shown interest yet, plus a count. Use for phrasings like 'who registered interest on X', 'who's interested in X', 'who are we talking to on X', 'has anyone passed on X'. Read-only; never exposes raw record ids.";
  inputSchema = inputSchema;

  constructor(private deps?: DealInterestDeps) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const now = this.deps?.now ?? new Date();

    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, { query: input.deal, limit: 10 });
    const resolution = resolveRecord(search.globalSearch, "transaction", input.deal);
    if (resolution.kind === "none") {
      return { status: "not_found" as const, message: `No deal matching "${input.deal}" was found.` };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: `Multiple deals match "${input.deal}" — ask the user to pick one, then call again with the chosen id.`,
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const data = await crm.query<{ transaction: TransactionData | null }>(AGENT_DEAL_INTEREST, { id: resolution.result.id });
    const transaction = data.transaction;
    if (!transaction) return { status: "not_found" as const, message: `The deal could not be loaded.` };

    const engagements = transaction.engagements ?? [];
    if (engagements.length === 0) {
      return { status: "empty" as const, deal: transaction.name, message: `No engagements have been logged yet for ${transaction.name}.` };
    }

    const interested: InterestRow[] = [];
    const withdrawn: InterestRow[] = [];
    const contacted: InterestRow[] = [];

    for (const eng of engagements) {
      const lastTouch = mostRecentTouch(eng.lastContact, eng.conversation?.lastMessageAt ?? null);
      const withdrew = eng.status === "Passed" || eng.engagementStage === "Declined";
      const milestoneKeys = (eng.milestones ?? []).map((m) => m.key);
      const expressedInterest = INTERESTED_STATUSES.has(eng.status) || hasExpressedInterestViaStage(eng.engagementStage, milestoneKeys);

      if (withdrew) {
        withdrawn.push(buildRow(eng, lastTouch, now, crm, "withdrawn"));
      } else if (expressedInterest) {
        interested.push(buildRow(eng, lastTouch, now, crm, "interested"));
      } else if (eng.status !== "NotContacted") {
        contacted.push(buildRow(eng, lastTouch, now, crm, "contacted"));
      }
    }

    const allBucketsEmpty = interested.length === 0 && withdrawn.length === 0 && (!input.includeAll || contacted.length === 0);
    if (allBucketsEmpty) {
      return {
        status: "empty" as const,
        deal: transaction.name,
        message: `No investor has expressed interest or withdrawn on ${transaction.name} yet.`,
        othersContacted: contacted.length,
      };
    }

    return {
      status: "ok" as const,
      deal: transaction.name,
      interested,
      withdrawn,
      ...(input.includeAll ? { contacted, othersContacted: contacted.length } : {}),
    };
  }
}

function buildRow(eng: EngagementRow, lastTouch: string | null, now: Date, crm: CrmClient, category: RowCategory): InterestRow {
  const { since, sinceBasis } = computeSince(eng, category);
  return {
    investor: eng.investor.name,
    investorType: eng.investor.investorType ?? null,
    interestLevel: eng.interestLevel ?? null,
    status: eng.status,
    stage: eng.engagementStage ?? null,
    since,
    sinceBasis,
    lastTouch,
    contactRecency: engagementActivity(lastTouch, now),
    awaitingOurReply: eng.conversation?.status === "Pending",
    link: `${crm.baseUrl}/investors/${eng.investor.id}`,
  };
}

/**
 * When interest began — only meaningful for `interested` rows. Withdrawn and
 * contacted-only rows get null/null: there is no interest date to report, and
 * `updatedAt` must never be presented as an interest date on a withdrawn row.
 */
function computeSince(eng: EngagementRow, category: RowCategory): { since: string | null; sinceBasis: SinceBasis | null } {
  if (category !== "interested") return { since: null, sinceBasis: null };

  const milestone = (eng.milestones ?? []).find((m) => m.key === "ExpressionOfInterest");
  if (milestone) return { since: milestone.completedAt ?? null, sinceBasis: "eoi_milestone" };

  // No explicit milestone row: if the stage itself implies EOI, we don't have a
  // precise "when the stage crossed that line" date (no stageChanges selected
  // here), so updatedAt is the best available proxy, distinguished from the
  // plain status-only case by its basis.
  if (hasExpressedInterestViaStage(eng.engagementStage, [])) {
    return { since: eng.updatedAt ?? null, sinceBasis: "stage_implied" };
  }

  return { since: eng.updatedAt ?? null, sinceBasis: "last_update" };
}
