import { LuaAgent } from "lua-cli";
import { trackerSkill } from "./skills/tracker.skill";
import { followupCheckJob } from "./jobs/followup-check.job";
import { passphraseGate } from "./processors/passphrase-gate";
import { INVESTOR_TRACKER_PERSONA } from "./persona";

const agent = new LuaAgent({
  name: "investor_tracker",
  persona: INVESTOR_TRACKER_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [trackerSkill],
  jobs: [followupCheckJob],
  preProcessors: [passphraseGate],
});

export default agent;
