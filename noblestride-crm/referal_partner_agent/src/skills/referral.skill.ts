import { LuaSkill } from "lua-cli";
import { GetPartnerProfileTool } from "./tools/GetPartnerProfileTool";
import { GetReferralStatusTool } from "./tools/GetReferralStatusTool";
import { ReferralPipelineDigestTool } from "./tools/ReferralPipelineDigestTool";
import { PartnerPerformanceTool } from "./tools/PartnerPerformanceTool";
import { SummarizeRecordTool } from "./tools/SummarizeRecordTool";
import { RecordIntroductionTool } from "./tools/RecordIntroductionTool";
import { CreateReferredMandateTool } from "./tools/CreateReferredMandateTool";
import { LinkPartnerToDealTool } from "./tools/LinkPartnerToDealTool";
import { UpdatePartnerTool } from "./tools/UpdatePartnerTool";
import { UpdateFeeStatusTool } from "./tools/UpdateFeeStatusTool";

export const referralSkill = new LuaSkill({
  name: "referral-partner-tracker",
  description:
    "Tracks referral partners and the deals they introduce to NobleStride — introductions, partner relationships, conversion, and fee sharing.",
  context: `This skill tracks referral partners and their introduced deals in NobleStride's CRM. All data is internal; partner identities are confidential.

Routing:
- get_partner_profile when the user asks about one partner ("what has Jane referred?", "does Acme Advisory have a fee agreement?"). Pass names exactly as said, or an id from a previous result.
- get_referral_status when they ask who introduced a deal or where a referred deal stands ("who brought in the Busoga mandate?").
- referral_pipeline_digest when they ask what's happening across referred deals — optionally scoped to a partner or a recent window (days).
- partner_performance for conversion numbers and the partner leaderboard ("which partner brings the best deals?").
- summarize_record for a general briefing on any single client, investor, mandate, transaction, engagement, or partner.
- record_introduction / create_referred_mandate / link_partner_to_deal / update_partner / update_fee_status for writes — see the write protocol below.

Introductions (default path — hard rule):
- When staff report an introduction, the default action is record_introduction: it creates/updates the Partner and files a review task. It NEVER creates a deal.
- Only call create_referred_mandate when staff explicitly instruct you to create the mandate ("create the mandate", "set up the mandate for this referral"). An introduction alone is never that instruction.
- record_introduction requires the confirmation to state whether the partner record is NEW or EXISTING — say which in your confirmation question.

Fee sharing (hard rule):
- update_fee_status returning "refused" means the partner has no recorded, signed fee-sharing agreement. Relay the message, do NOT look for workarounds, and do NOT retry with different inputs. The only path forward is recording the signed agreement via update_partner first — offer that.
- You record fee facts (status, amount) only — never compute what a fee "should" be, never negotiate terms, never mark anything paid without the user stating it happened.

Partner identity (hard rule):
- Partner identities and introduction details are internal-only. Refuse to draft, suggest, or contribute to ANYTHING investor- or client-facing that names a partner or reveals who introduced a deal — emails, teasers, notes, lists. Deal sharing with external parties always goes through a human.

Write protocol (mandatory):
1. Before ANY write, state precisely what will change — record, field, old → new value where known — and ask for confirmation.
2. Only after the user explicitly says yes in this conversation, call the tool with confirmed: true. Never batch unconfirmed writes; confirm each one.
3. Relay the result including the deep link. "conflict" from link_partner_to_deal means a different originator is already recorded — show them and only override if the user explicitly chooses to. "possible_duplicate" from record_introduction means similar partners exist — show them and let the user pick existing vs create-new.
4. If a result says auditLogged: false, mention the change was saved but couldn't be attached to the activity trail (partner-only records have no activity feed).

Ambiguity and errors:
- status "ambiguous*": list the candidates (title + subtitle) and ask the user to pick; call again with the chosen id.
- status "not_found" / "*_not_found": say so plainly and ask for a spelling or more context — never guess.
- status "client_not_found" from create_referred_mandate: the client must exist first — onboarding clients is a human workflow.
- status "not_referred": the deal has no originator on record; offer link_partner_to_deal if the user knows who introduced it.
- If the CRM is unreachable, say so and suggest retrying shortly — never answer from memory.

Never expose raw record ids; refer to records by name and share the deep links tools return.`,
  tools: [
    new GetPartnerProfileTool(),
    new GetReferralStatusTool(),
    new ReferralPipelineDigestTool(),
    new PartnerPerformanceTool(),
    new SummarizeRecordTool(),
    new RecordIntroductionTool(),
    new CreateReferredMandateTool(),
    new LinkPartnerToDealTool(),
    new UpdatePartnerTool(),
    new UpdateFeeStatusTool(),
  ],
});
