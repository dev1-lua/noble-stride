import { AssistantChat, type StaffAgentChoice } from "./assistant-chat";

// Staff-facing Lua webchat agents. The summarizer is the default assistant;
// the investor tracker appears as a second tab once its env pair is set
// (internal testing rollout — see agent-info.md for the runbook).
function configuredStaffAgents(): StaffAgentChoice[] {
  const agents: StaffAgentChoice[] = [];
  if (process.env.NEXT_PUBLIC_LUA_AGENT_ID) {
    agents.push({
      key: "assistant",
      label: "Assistant",
      chatTitle: "Noblestride CRM Assistant",
      agentId: process.env.NEXT_PUBLIC_LUA_AGENT_ID,
      channelId: process.env.NEXT_PUBLIC_LUA_CHANNEL_ID,
    });
  }
  if (process.env.NEXT_PUBLIC_LUA_TRACKER_AGENT_ID) {
    agents.push({
      key: "tracker",
      label: "Investor Tracker",
      chatTitle: "Noblestride Investor Tracker",
      agentId: process.env.NEXT_PUBLIC_LUA_TRACKER_AGENT_ID,
      channelId: process.env.NEXT_PUBLIC_LUA_TRACKER_CHANNEL_ID,
    });
  }
  return agents;
}

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const { agent } = await searchParams;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Assistant</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Chat with the CRM assistant. Staff verification happens in the chat.
        </p>
      </div>
      <AssistantChat
        agents={configuredStaffAgents()}
        initialAgentKey={agent === "tracker" ? "tracker" : undefined}
      />
    </div>
  );
}
