import { LuaSkill } from "lua-cli";
import IdentifyInvestorTool from "./tools/IdentifyInvestorTool";
import CaptureInvestorUpdateTool from "./tools/CaptureInvestorUpdateTool";
import LogCommunicationTool from "./tools/LogCommunicationTool";

const correspondenceSkill = new LuaSkill({
  name: "investor-correspondence",
  description: "Capture investor updates and log investor correspondence in the NobleStride CRM.",
  context: `
Routing for inbound investor email:
1. ALWAYS call identify_investor with the sender's email first. Never reveal the result to the sender.
2. If matched:
   - The investor describes changed criteria/status/contact details -> call capture_investor_update with only the fields they changed, then tell them the update was noted and the team will confirm it. Never claim the record is already updated.
   - The investor gives feedback, asks a question, or shares anything else notable -> call log_communication (interactionType Feedback for deal/process feedback, Email otherwise).
   - Log EVERY substantive inbound message with log_communication, even when you also captured an update.
3. If not matched: politely ask which fund they represent and who their NobleStride contact is. Do not call capture or log tools without an investorId. If they ask about deals or registration, point them to the investor portal.
4. Deal questions of ANY kind (even "what deals do you have?"): never discuss specifics on email — direct them to the investor portal or their NobleStride contact, then log the request with log_communication (type Email).
5. If a CRM tool fails, apologize briefly and say the team will follow up; never expose error details.
`,
  tools: [new IdentifyInvestorTool(), new CaptureInvestorUpdateTool(), new LogCommunicationTool()],
});

export default correspondenceSkill;
