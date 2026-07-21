import { LuaAgent } from "lua-cli";
import { referralSkill } from "./skills/referral.skill";
import { partnerSelfServiceSkill } from "./skills/partner-selfservice.skill";
import { stageWatchJob } from "./jobs/stage-watch.job";
import { passphraseGate } from "./processors/passphrase-gate";
import { REFERRAL_PARTNER_PERSONA } from "./persona";

const agent = new LuaAgent({
  name: "referral_partner_tracker",
  persona: REFERRAL_PARTNER_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [referralSkill, partnerSelfServiceSkill],
  jobs: [stageWatchJob],
  preProcessors: [passphraseGate],
});

export default agent;
