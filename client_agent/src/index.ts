import { LuaAgent } from "lua-cli";
import { intakeSkill } from "./skills/intake.skill";
import { CLIENT_PERSONA } from "./persona";
import { probeGuard } from "./processors/probe-guard";
import { outboundLeakGuard } from "./processors/outbound-leak-guard";
import { formatNormalizer } from "./processors/format-normalizer";

const agent = new LuaAgent({
  name: "clientAgent",
  persona: CLIENT_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [intakeSkill],
  preProcessors: [probeGuard],
  postProcessors: [outboundLeakGuard, formatNormalizer],
});

export default agent;
