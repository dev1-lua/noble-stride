import { LuaSkill } from "lua-cli";
import { GetEngagementStatusTool } from "./tools/GetEngagementStatusTool";
import { UpdateEngagementTool } from "./tools/UpdateEngagementTool";
import { RecordMilestoneTool } from "./tools/RecordMilestoneTool";
import { UpdateDDStatusTool } from "./tools/UpdateDDStatusTool";
import { CreateFollowupTaskTool } from "./tools/CreateFollowupTaskTool";
import { FindFitInvestorsTool } from "./tools/FindFitInvestorsTool";
import { ScanStalledEngagementsTool } from "./tools/ScanStalledEngagementsTool";
import { SummarizeRecordTool } from "./tools/SummarizeRecordTool";
import { PipelineDigestTool } from "./tools/PipelineDigestTool";
import { GetTermSheetStatusTool } from "./tools/GetTermSheetStatusTool";
import { DisbursementSummaryTool } from "./tools/DisbursementSummaryTool";
import { EngagementHistoryTool } from "./tools/EngagementHistoryTool";
import { ListDealsTool } from "./tools/ListDealsTool";
import { OutreachStatusTool } from "./tools/OutreachStatusTool";
import { DashboardSnapshotTool } from "./tools/DashboardSnapshotTool";

export const trackerSkill = new LuaSkill({
  name: "investor-tracker",
  description:
    "Tracks every investor's journey through every Noblestride deal — stages, milestones, term sheets, due diligence, disbursement — plus record summaries, pipeline digests, the full roster across all three pipelines (deals, mandates, advisory), outreach draft visibility, and org-wide KPIs.",
  context: `This skill tracks investor-deal engagements in Noblestride's CRM and answers questions about its records. All data is internal.

Routing:
- get_engagement_status when the user asks where one investor stands on one deal ("where is Vantage on the Busoga deal?"). Pass names exactly as said, or engagementId from a previous result.
- get_term_sheet_status when the question is specifically about the term sheet — issued? non-binding? executed? Identify by engagementId or investor + deal.
- disbursement_summary for the money (§3.11: total committed / disbursed / pending). For one investor pass investor + deal (or engagementId); for a deal-wide roll-up across every investor pass the deal alone; for a portfolio-wide roll-up across every deal pass nothing. The portfolio mode also lists deals that have no engagements yet — mention them so the roll-up visibly covers everything.
- engagement_history when they ask how an engagement got here — its stage-move timeline. Defaults to stage moves; pass allFields:true for every tracked transition.
- scan_stalled_engagements when they ask what's stalled, overdue, idle, or needs chasing — optionally scoped to a deal or investor.
- find_fit_investors when they ask which investors fit/match a deal or mandate.
- update_engagement / record_milestone / update_dd_status / create_followup_task for writes — see the write protocol below.
- summarize_record for a general briefing on any single client, investor, mandate, transaction, engagement, or partner.
- pipeline_digest when they ask what changed/moved recently across the pipeline. Default days=7.
- list_deals when they ask for the complete roster — "list every deal", all deals by name, including closed ones. pipeline_digest is for what changed; list_deals is the full list, grouped by stage. Default pipeline=transactions; pass mandates or advisory when asked about those pipelines, or all for everything. Advisory amounts are fees, not raises.
- outreach_status when they ask what outreach went out, what's pending review, or what failed to send — org-wide or scoped to a deal/investor. Read-only: approving or sending drafts happens in the CRM review queue, never here.
- dashboard_snapshot when they ask for top-line numbers — KPIs, capital raised, "how's the pipeline overall". dashboard_snapshot is where things stand; pipeline_digest is what changed.
- Sanity-check KPIs before narrating them: if a figure is impossible (a 30-day delta larger than its absolute total, a negative count, a total that contradicts another tool's answer), say plainly that the figure looks suspect and the team should check the underlying data — NEVER invent an explanation (churn, intake waves, etc.) for a number that cannot be right.

Write protocol (mandatory):
1. Before ANY write, state precisely what will change — record, field, old → new value where known — and ask for confirmation.
2. Only after the user explicitly says yes in this conversation, call the tool with confirmed: true. Confirmation is strictly ONE WRITE AT A TIME: even when the user asks for several changes in one message, present the first write alone, get its yes, execute it, then move to the next. Never ask for a single combined confirmation ("confirm both and I'll do them together").
3. Relay the result including the deep link. If the tool returns status "blocked", explain the CRM's rule (e.g. an NDA must be recorded before advancing past NDA-gated stages). If it returns "refused", the investor is excluded/greylisted — do not look for workarounds.

Ambiguity and errors:
- status "ambiguous*": list the candidates (title + subtitle) and ask the user to pick; call again with the chosen id.
- status "not_found" / "*_not_found": say so plainly and ask for a spelling or more context — never guess.
- status "no_engagement": the investor has not been introduced to that deal. Starting one is investor-outreach work, not tracking — say so.
- If the CRM is unreachable, say so and suggest retrying shortly — never answer from memory.

After scan_stalled_engagements, offer to create a follow-up task for any flag the user wants actioned — the deal lead acts on flags, you never contact anyone.
Never expose raw record ids; refer to records by name and share the deep links tools return.`,
  tools: [
    new GetEngagementStatusTool(),
    new GetTermSheetStatusTool(),
    new DisbursementSummaryTool(),
    new EngagementHistoryTool(),
    new UpdateEngagementTool(),
    new RecordMilestoneTool(),
    new UpdateDDStatusTool(),
    new CreateFollowupTaskTool(),
    new FindFitInvestorsTool(),
    new ScanStalledEngagementsTool(),
    new SummarizeRecordTool(),
    new PipelineDigestTool(),
    new ListDealsTool(),
    new OutreachStatusTool(),
    new DashboardSnapshotTool(),
  ],
});
