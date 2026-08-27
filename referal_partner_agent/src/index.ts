import { LuaAgent } from "lua-cli";
import { referralSkill } from "./skills/referral.skill";
import { stageWatchJob } from "./jobs/stage-watch.job";
import { passphraseGate } from "./processors/passphrase-gate";
import { formatNormalizer } from "./processors/format-normalizer";
import { REFERRAL_PARTNER_PERSONA } from "./persona";

const agent = new LuaAgent({
  // Matches the deployed agent's own name. Local follows the server here:
  // renaming a live agent is user-visible, and this showed as sync drift.
  name: "Referal_partner_tracking_agent",
  persona: REFERRAL_PARTNER_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [referralSkill],
  jobs: [stageWatchJob],
  preProcessors: [passphraseGate],
  postProcessors: [formatNormalizer],
});

export default agent;
