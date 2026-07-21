import { LuaAgent } from "lua-cli";
import { websiteIntakeSkill } from "./skills/website-intake.skill";
import { WEBSITE_INTAKE_PERSONA } from "./persona";
import { probeGuard } from "./processors/probe-guard";
import { outboundLeakGuard } from "./processors/outbound-leak-guard";
import { formatNormalizer } from "./processors/format-normalizer";

const agent = new LuaAgent({
  name: "websiteIntakeAgent",
  persona: WEBSITE_INTAKE_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [websiteIntakeSkill],
  preProcessors: [probeGuard],
  postProcessors: [outboundLeakGuard, formatNormalizer],
});

export default agent;
