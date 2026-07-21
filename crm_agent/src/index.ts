import { LuaAgent } from "lua-cli";
import { summarySkill } from "./skills/summary.skill";
import { writeSkill } from "./skills/write.skill";
import { analysisSkill } from "./skills/analysis.skill";
import { weeklyDigestJob } from "./jobs/weekly-digest.job";
import { passphraseGate } from "./processors/passphrase-gate";
import { formatNormalizer } from "./processors/format-normalizer";
import { CRM_PERSONA } from "./persona";

const agent = new LuaAgent({
  name: "crmAgent",
  persona: CRM_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [summarySkill, writeSkill, analysisSkill],
  jobs: [weeklyDigestJob],
  preProcessors: [passphraseGate],
  postProcessors: [formatNormalizer],
});

export default agent;
