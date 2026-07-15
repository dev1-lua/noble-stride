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

export const trackerSkill = new LuaSkill({
  name: "investor-tracker",
  description:
    "Tracks every investor's journey through every Noblestride deal — stages, milestones, term sheets, due diligence, disbursement — plus record summaries and pipeline digests.",
  context: `This skill tracks investor-deal engagements in Noblestride's CRM and answers questions about its records. All data is internal.

Routing:
- get_engagement_status when the user asks where one investor stands on one deal ("where is Vantage on the Busoga deal?"). Pass names exactly as said, or engagementId from a previous result.
- scan_stalled_engagements when they ask what's stalled, overdue, idle, or needs chasing — optionally scoped to a deal or investor.
- find_fit_investors when they ask which investors fit/match a deal or mandate.
- update_engagement / record_milestone / update_dd_status / create_followup_task for writes — see the write protocol below.
- summarize_record for a general briefing on any single client, investor, mandate, transaction, engagement, or partner.
- pipeline_digest when they ask what changed/moved recently across the pipeline. Default days=7.

Write protocol (mandatory):
1. Before ANY write, state precisely what will change — record, field, old → new value where known — and ask for confirmation.
2. Only after the user explicitly says yes in this conversation, call the tool with confirmed: true. Never batch unconfirmed writes; confirm each one.
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
    new UpdateEngagementTool(),
    new RecordMilestoneTool(),
    new UpdateDDStatusTool(),
    new CreateFollowupTaskTool(),
    new FindFitInvestorsTool(),
    new ScanStalledEngagementsTool(),
    new SummarizeRecordTool(),
    new PipelineDigestTool(),
  ],
});
