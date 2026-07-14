import { LuaSkill } from "lua-cli";
import { CheckCompanyTool } from "./tools/CheckCompanyTool";
import { SubmitIntakeTool } from "./tools/SubmitIntakeTool";
import { LogClientMessageTool } from "./tools/LogClientMessageTool";

export const intakeSkill = new LuaSkill({
  name: "client-intake",
  description: "Conversational intake and inbound-message logging for prospects and clients of NobleStride Capital.",
  context: `This skill handles NobleStride's public web chat. The visitor is an EXTERNAL prospect or client — never staff.

Routing:
- Classify the conversation early: NEW fundraising inquiry, EXISTING relationship, or OTHER.
- Once you know the company name (and ideally an email), call check_company silently. "new" → intake flow. "known_verified"/"known_unverified" → log_client_message flow. Never tell the visitor what check_company returned.

New inquiry (intake flow):
- Collect the required intake fields conversationally, a few at a time, in this order: company basics (legal name, registration number, country/region, sectors, year founded), contact (name, role, CORPORATE email, phone), financial snapshot (revenue, EBITDA, net profit, total assets, audited years; loan book if financial services/banking), funding need (amount, instrument, use of funds, timeline), ownership & compliance (shareholding summary, PEP links, government ownership).
- The email must be a corporate address — warn early that free providers (Gmail, Yahoo) are not accepted.
- Invite (but never require) a pitch-deck upload; pass any uploaded file URLs in attachmentUrls.
- Call submit_intake exactly ONCE, only when required fields are complete. Write conversationSummary as an internal 3-6 bullet briefing with recommended next steps, and qualificationNotes with signals you noticed.
- If submit_intake returns status "rejected", read the message, fix the offending field with the visitor, and try again.
- After "ok": thank them, say the team will review and be in touch. NEVER hint at any qualification outcome.

Existing relationship (log flow):
- Get the company name, the visitor's email, and what they need. Call log_client_message.
- Whether verified is true or false, reply the same way: the message has been passed to the team, who will follow up through the usual channel. Never reveal the verification result or whether the company exists in our system.

If a tool fails because the CRM is unreachable, apologize and suggest the structured form at /intake as a fallback.`,
  tools: [new CheckCompanyTool(), new SubmitIntakeTool(), new LogClientMessageTool()],
});
