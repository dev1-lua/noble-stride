// Local end-to-end smoke: drives the tracker tools against the running local
// CRM exactly as the deployed agent would (same GraphQL documents, same
// x-agent-key header) — without the Lua cloud in the loop.
//
// Prereqs: noblestride-crm dev server on :3000 with a seeded DB.
// Run: CRM_AGENT_KEY=<key> npx tsx scripts/smoke.ts
import { makeCrmClient } from "../src/lib/crm-client";
import { ENGAGEMENTS_BY_DEAL_SCAN } from "../src/lib/queries";
import { DEFAULT_STALE_DAYS } from "../src/lib/staleness";
import { GetEngagementStatusTool } from "../src/skills/tools/GetEngagementStatusTool";
import { ScanStalledEngagementsTool } from "../src/skills/tools/ScanStalledEngagementsTool";
import { FindFitInvestorsTool } from "../src/skills/tools/FindFitInvestorsTool";
import { UpdateEngagementTool } from "../src/skills/tools/UpdateEngagementTool";
import { RecordMilestoneTool } from "../src/skills/tools/RecordMilestoneTool";
import { UpdateDDStatusTool } from "../src/skills/tools/UpdateDDStatusTool";
import { CreateFollowupTaskTool } from "../src/skills/tools/CreateFollowupTaskTool";

const crm = makeCrmClient({
  apiUrl: process.env.CRM_API_URL ?? "http://localhost:3000/api/graphql",
  agentKey: process.env.CRM_AGENT_KEY ?? "dev-agent-key-change-me",
});

const deps = { crm, thresholds: DEFAULT_STALE_DAYS };

async function main() {
  // Pick a real seeded engagement to exercise.
  const scan = await crm.query<{
    engagementsByDeal: Array<{
      transaction: { id: string; name: string };
      engagements: Array<{ id: string; interestLevel: string | null; investor: { id: string; name: string } }>;
    }>;
  }>(ENGAGEMENTS_BY_DEAL_SCAN);
  const deal = scan.engagementsByDeal.find((d) => d.engagements.length > 0);
  if (!deal) throw new Error("No engagements in the CRM — seed the database first (npm run seed).");
  const engagement = deal.engagements[0];
  console.log(`Using engagement ${engagement.id}: ${engagement.investor.name} × ${deal.transaction.name}\n`);

  // ── Read path ──────────────────────────────────────────────────────────────
  const status = await new GetEngagementStatusTool(deps).execute({ engagementId: engagement.id });
  console.log("get_engagement_status:", status.status, status.status === "ok" ? status.engagement.staleness : status);

  const stalled = await new ScanStalledEngagementsTool(deps).execute({});
  console.log("scan_stalled_engagements:", stalled.status, stalled.status === "ok" ? `${stalled.flagged} flags` : stalled);

  const fits = await new FindFitInvestorsTool({ crm }).execute({ deal: deal.transaction.id });
  console.log("find_fit_investors:", fits.status, fits.status === "ok" ? `${fits.matches.length} matches` : fits);

  // ── Write round-trip ───────────────────────────────────────────────────────
  const newLevel = engagement.interestLevel === "High" ? "Medium" : "High";
  console.log(
    "update_engagement (interestLevel flip):",
    await new UpdateEngagementTool({ crm }).execute({
      engagementId: engagement.id,
      set: { interestLevel: newLevel as "High" | "Medium" },
      reason: "Smoke test — interest level flip",
      confirmed: true,
    }),
  );

  console.log(
    "record_milestone (TeaserReview):",
    await new RecordMilestoneTool({ crm }).execute({
      engagementId: engagement.id,
      action: "record",
      key: "TeaserReview",
      notes: "Smoke test",
      confirmed: true,
    }),
  );
  console.log(
    "record_milestone (unrecord):",
    await new RecordMilestoneTool({ crm }).execute({
      engagementId: engagement.id,
      action: "unrecord",
      key: "TeaserReview",
      confirmed: true,
    }),
  );

  console.log(
    "update_dd_status:",
    await new UpdateDDStatusTool({ crm }).execute({
      deal: deal.transaction.id,
      track: "Legal",
      status: "InProgress",
      notes: "Smoke test",
      confirmed: true,
    }),
  );

  console.log(
    "create_followup_task:",
    await new CreateFollowupTaskTool({ crm }).execute({
      title: `ZZTest smoke follow-up ${Date.now().toString(36)}`,
      body: "Smoke-test task — safe to delete.",
      engagementId: engagement.id,
      confirmed: true,
    }),
  );

  console.log("\nSmoke complete.");
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
