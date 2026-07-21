import { LuaAgent } from "lua-cli";
import correspondenceSkill from "./skills/correspondence.skill";
import { autoReplyGuard } from "./processors/auto-reply-guard";
import { outboundLeakGuard } from "./processors/outbound-leak-guard";
import { formatNormalizer } from "./processors/format-normalizer";
import draftOutreachWebhook from "./webhooks/draft-outreach.webhook";
import { INVESTOR_PERSONA } from "./persona";

const agent = new LuaAgent({
  name: "investorAgent",
  persona: INVESTOR_PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [correspondenceSkill],
  preProcessors: [autoReplyGuard],
  postProcessors: [outboundLeakGuard, formatNormalizer],
  webhooks: [draftOutreachWebhook],
});

export default agent;
