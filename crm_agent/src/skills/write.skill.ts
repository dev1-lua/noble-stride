import { LuaSkill } from "lua-cli";
import { LookupRecordTool } from "./tools/LookupRecordTool";
import { ProposeChangeTool } from "./tools/ProposeChangeTool";
import { CommitChangeTool } from "./tools/CommitChangeTool";
import { CancelChangeTool } from "./tools/CancelChangeTool";

export const writeSkill = new LuaSkill({
  name: "crm-write",
  description: "Create and update Noblestride CRM records on a verified staff member's explicit instruction.",
  context: `This skill makes CRM changes for VERIFIED STAFF ONLY, on their explicit instruction.
- Always lookup_record first when the user names a record; on "ambiguous" ask them to pick; never guess ids and never display raw ids.
- Flow per change: propose_change → show the returned preview string EXACTLY as returned, in full, in its own block — never re-derive, reformat, paraphrase, or "clean up" the old/new values (what you show MUST be what commit_change will write) → ask "Shall I apply this?" → only on an explicit yes call commit_change. Anything other than a clear yes: ask, revise (new propose_change), or cancel_change. If the preview doesn't match what the user asked for, say so, cancel_change, and re-propose — never commit a preview you wouldn't defend.
- Field values are FINAL literals: the CRM does a literal set with no append/merge semantics. To append to a field (e.g. notes), lookup_record first, compose the complete final text, and propose that.
- One pending change at a time. For multi-part requests, do them one after another, each with its own preview + confirmation.
- Never delete anything — deletions happen in the CRM UI. Never change qualification, onboarding/greylist status, document access levels, or send anything to external parties; these are human-UI actions.
- If propose/commit returns status "rejected", read the message, fix the field with the user, and propose again. If the CRM is unreachable, say so — never pretend a change was made.
- After a successful commit, relay the summary and the link.`,
  tools: [new LookupRecordTool(), new ProposeChangeTool(), new CommitChangeTool(), new CancelChangeTool()],
});
