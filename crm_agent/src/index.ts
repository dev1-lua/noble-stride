import { LuaAgent } from "lua-cli";
import { summarySkill } from "./skills/summary.skill";
import { writeSkill } from "./skills/write.skill";
import { analysisSkill } from "./skills/analysis.skill";
import { weeklyDigestJob } from "./jobs/weekly-digest.job";
import { passphraseGate } from "./processors/passphrase-gate";
import { formatNormalizer } from "./processors/format-normalizer";
import { CRM_PERSONA } from "./persona";

const agent = new LuaAgent({
  // Matches the deployed agent's own name ("CRMagent"). Kept in step with the
  // server rather than pushed the other way: renaming a live agent is a
  // user-visible change, and `lua sync --check` reported this as drift.
  name: "CRMagent",
  persona: CRM_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [summarySkill, writeSkill, analysisSkill],
  jobs: [weeklyDigestJob],
  preProcessors: [passphraseGate],
  postProcessors: [formatNormalizer],
});

export default agent;
