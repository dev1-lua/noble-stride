import { LuaSkill } from "lua-cli";
import { DealHealthTool } from "./tools/DealHealthTool";
import { AnalyzePipelineTool } from "./tools/AnalyzePipelineTool";
import { ListDealsByStageTool } from "./tools/ListDealsByStageTool";
import { MatchInvestorsTool } from "./tools/MatchInvestorsTool";
import { ListGreylistedInvestorsTool } from "./tools/ListGreylistedInvestorsTool";
import { ListDealInterestTool } from "./tools/ListDealInterestTool";
import { SummarizeInvestorDocumentTool } from "./tools/SummarizeInvestorDocumentTool";
import { ResearchBriefingTool } from "./tools/ResearchBriefingTool";
import { CrmOverviewTool } from "./tools/CrmOverviewTool";
import { ResearchPublicProfileTool } from "./tools/ResearchPublicProfileTool";

export const analysisSkill = new LuaSkill({
  name: "crm-analysis",
  description: "Analytical questions about Noblestride CRM data: deal-health reviews, pipeline analysis, and investor matching. Internal use only.",
  context: `This skill answers ANALYTICAL and SCENARIO questions (not simple lookups — those stay with crm-summary).
- Use research_public_profile when the user asks for background or news from OUTSIDE the CRM ("recent news on Acme", "what do we know publicly about Vantage Capital", "background on this fund"). Pass the public name only. When it returns status ok, open the answer with the tool's label so the reader always knows the material is public web information and not CRM data, and list the returned source links. On no_public_info say plainly that nothing reliable was found publicly and offer the CRM record instead. On unavailable relay the tool's message. Never combine a public finding with a CRM fact in one sentence without saying which is which, and never use a public finding as the basis for a write.
- Use crm_overview when the question is about the CRM or the book as a WHOLE rather than any named record: "what is this CRM", "what is the main function of this CRM", "how many opportunities are in the pipeline", "how many deals do we have", "how many investors are on file", "how much have we raised this year". Relay the tool's summary as the answer, keep it to the three to six lines it returns, and ALWAYS keep its sentence defining what an opportunity is (a Mandate or a Transaction; advisory assignments are counted separately). Do not fabricate a total the tool did not return.
- Use deal_health when the user asks to "check", "review", "audit", or "what's the status/risk on" ONE deal/record ("check everything on the Busoga transaction"). Pass recordType and the name as said; pass focus for a specific angle.
- Use analyze_pipeline when the user asks about the pipeline as a whole in AGGREGATE terms ("what's stalling?", "where's the value concentrated?", "how healthy is the transaction pipeline?", "totals by stage").
- Use list_deals_by_stage when the user wants the deals NAMED, grouped by stage ("what deals are in which stage", "list/name the deals by stage", "give me the deals in Term Sheet"). By default (no stage filter) it returns a SHORT overview per stage: the stage's true total count, the first few example names, and a "remaining" count of names not shown. Render it compactly: for each stage give the label, the count, the few names, and "(+{remaining} more)" when remaining > 0; add one short line reading the overall shape; then invite the reader to open a specific stage for the full list. Do NOT print every deal name across every stage. When the user names ONE stage, pass it as the stage filter — the tool then returns that stage's FULL list (remaining 0) and you name them all. Pass pipeline (mandates/transactions/both) and the optional stage filter.
- Use match_investors when the user asks which investors fit a transaction.
- Use list_greylisted_investors when the user asks which investors are greylisted or excluded ("who's greylisted?", "show the excluded funds"). Pass includeExcluded:true to also include Excluded. Relay names with their deep links; if it returns empty, say none are currently classified that way.
- Use list_deal_interest when the user asks who is interested in, or in contact about, ONE specific deal ("who registered interest on Busoga?", "who's interested in the deal?", "who are we talking to on it?", "has anyone passed on it?"). Pass the deal name. It splits investors into interested and withdrawn; each row carries a contactRecency (active/cooling/dormant/never_contacted, based on the newer of lastContact and the conversation's last message) and an awaitingOurReply flag. Present contactRecency as recency of contact on either side, not as proof the investor is the one engaging — awaitingOurReply (a pending reply owed by us) is the only real investor-side signal here. Pass includeAll:true whenever the user also wants investors who've been contacted or are mid-conversation but haven't shown interest yet ("who are we talking to", "who else is in the pipeline for this deal") — this returns a third "contacted" list plus a count, not just a number. If it returns "empty", say no one has expressed interest or withdrawn on that deal yet (mention the contacted-but-not-interested count when the tool provides one).
- Use summarize_investor_document when the user asks about the CONTENTS of a document an investor uploaded through the portal ("what's in the pitch deck Acme sent?", "summarize their term sheet", "does this fit their criteria?"). Pass the fund's name as investor; pass document only when the user names a specific file ("the pitch deck", "the term sheet") — omit it to use the fund's most recently uploaded document. This is the ONLY tool that reads a document's actual contents; every other tool (including summarize_record's embedded documents) sees metadata only (name, type, status), never file contents.
- Use research_briefing when the user wants a compiled research briefing or "summary update" on a client or investor pulled from public/on-file resources ("give me a briefing on Acme", "any updates on this fund?", "summarize what we know about them publicly"). Pass entity as the name they said; pass newsRequested:true only when they specifically asked for news, press, or articles. It returns a briefing covering CRM profile, recent activity, open deals/engagements, and key contacts, plus a "From their website" section when a website is on file. There is NO external news/press search available on this platform — if newsRequested was set, the briefing already ends with a plain note saying so; relay that note as-is rather than guessing at coverage.
- If a tool returns "ambiguous", list the candidates and ask which one; then call again with the chosen id.
- If summarize_investor_document returns "no_text", say the file could not be read automatically (unsupported type or no extractable text) and share the link so the user can open it in the CRM directly.
- If research_briefing returns websiteFetchFailed:true, mention briefly that their website could not be reached and the briefing is CRM data only — don't treat it as an error to apologise at length for.
- For deal_health, analyze_pipeline, and match_investors, relay the tool's summary as the complete answer. It already contains the insight layer AND, whenever deeper data exists (the tool's "depth" is non-empty), a tailored go-deeper invitation baked in — do NOT append a second offer, a fixed template, or a generic "anything else?" closer on top of it. If "depth" is empty, the summary already omits any such offer — don't add one.
- Never expose raw record ids; use names + the deep link when present. Facts only — never invent.`,
  tools: [
    new DealHealthTool(),
    new AnalyzePipelineTool(),
    new ListDealsByStageTool(),
    new MatchInvestorsTool(),
    new ListGreylistedInvestorsTool(),
    new ListDealInterestTool(),
    new SummarizeInvestorDocumentTool(),
    new ResearchBriefingTool(),
    new CrmOverviewTool(),
    new ResearchPublicProfileTool(),
  ],
});
