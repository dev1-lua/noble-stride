import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { LuaPopWidget, type LuaAgentChoice } from "@/components/shell/lua-pop-widget";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import { unreadFor, unreadCountFor } from "@/server/services/notifications";

// CRM pages read live data from Postgres per request — never prerender them at
// build time (that needs the DB at build and would freeze data into static HTML).
// Set on the layout so it cascades to every (crm)/* route.
export const dynamic = "force-dynamic";

// Staff-facing Lua webchat agents. The summarizer is the default assistant;
// the investor tracker appears as a second switcher option once its env pair
// is set (internal testing rollout — see agent-info.md for the runbook).
function configuredLuaAgents(): LuaAgentChoice[] {
  const agents: LuaAgentChoice[] = [];
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

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const luaAgents = configuredLuaAgents();
  // External viewpoints never see the internal shell (spec §6) — they land on
  // their portal. The visibility engine gates everything they read there.
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role === "investor") redirect("/portal/investor");
  if (vp.role === "partner") redirect("/portal/partner");

  const [pendingReview, auth] = await Promise.all([
    prisma.investor.count({ where: { onboardingStatus: "PendingReview" } }),
    getCurrentAuth(),
  ]);

  // Task 14 bell: server-rendered per request, no polling, keyed on the real
  // signed-in user (no lens to fall back on now).
  const userId = auth?.user?.id;
  const [unreadNotifications, unreadCount] = userId
    ? await Promise.all([unreadFor(userId, 15), unreadCountFor(userId)])
    : [[], 0];
  const notifications = unreadNotifications.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    href: n.href,
    createdAt: n.createdAt.toISOString(),
  }));

  // Task 7: sidebar profile block — name falls back to account displayName,
  // then to email; email is the account's login email.
  const userName = auth?.user?.name ?? auth?.account.displayName ?? auth?.account.email ?? "";
  const userEmail = auth?.account.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed-width sidebar, full height */}
      <Sidebar
        pendingReview={pendingReview}
        isAdmin={auth?.user?.role === "Admin"}
        userName={userName}
        userEmail={userEmail}
      />

      {/* Main content region */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Sticky topbar */}
        <Topbar notifications={notifications} notificationCount={unreadCount} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-secondary)] p-6">{children}</main>
      </div>

      {luaAgents.length > 0 ? <LuaPopWidget agents={luaAgents} /> : null}
    </div>
  );
}
