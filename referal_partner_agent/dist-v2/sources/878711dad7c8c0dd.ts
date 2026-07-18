// Local READ-ONLY smoke: drives the referral tools against the running local
// CRM exactly as the deployed agent would (same GraphQL documents, same
// x-agent-key header) — without the Lua cloud in the loop. Proves the Phase-1
// CRM schema additions (stageChanges, referredTransactions, byPartner.id) are
// live. No writes.
//
// Prereqs: noblestride-crm dev server on :3000 with a seeded DB.
// Run: CRM_AGENT_KEY=<key> npx tsx scripts/smoke.ts
import { makeCrmClient } from "../src/lib/crm-client";
import { REFERRED_DEALS_SCAN, PARTNER_REFERRAL_DETAIL, MANDATE_REFERRAL_STATUS } from "../src/lib/queries";
import { GetPartnerProfileTool } from "../src/skills/tools/GetPartnerProfileTool";
import { GetReferralStatusTool } from "../src/skills/tools/GetReferralStatusTool";
import { ReferralPipelineDigestTool } from "../src/skills/tools/ReferralPipelineDigestTool";
import { PartnerPerformanceTool } from "../src/skills/tools/PartnerPerformanceTool";
import { scanReferredDeals } from "../src/lib/referral-scan";

const crm = makeCrmClient({
  apiUrl: process.env.CRM_API_URL ?? "http://localhost:3000/api/graphql",
  agentKey: process.env.CRM_AGENT_KEY ?? "dev-agent-key-change-me",
});

async function main() {
  // Pick a real referring partner to exercise.
  const scan = await crm.query<{
    partners: Array<{ id: string; name: string; referredMandates: Array<{ id: string; name: string }>; referredTransactions: Array<{ id: string }> }>;
  }>(REFERRED_DEALS_SCAN);
  const partner = scan.partners.find((p) => p.referredMandates.length > 0 || p.referredTransactions.length > 0);
  if (!partner) throw new Error("No partner with referrals in the CRM — seed the database first (npm run seed).");
  console.log(`Using partner ${partner.id}: ${partner.name}\n`);

  // ── Raw Phase-1 fields ─────────────────────────────────────────────────────
  const detail = await crm.query<{ partner: { stageChanges: unknown[]; referredTransactions: unknown[] } }>(
    PARTNER_REFERRAL_DETAIL,
    { id: partner.id },
  );
  console.log(
    "PARTNER_REFERRAL_DETAIL: ok —",
    `${detail.partner.referredTransactions.length} referredTransactions, ${detail.partner.stageChanges.length} stageChanges`,
  );

  const mandate = partner.referredMandates[0];
  if (mandate) {
    const ms = await crm.query<{ mandate: { stageChanges: unknown[]; referredBy: { name: string } | null } }>(
      MANDATE_REFERRAL_STATUS,
      { id: mandate.id },
    );
    console.log(
      "MANDATE_REFERRAL_STATUS: ok —",
      `referredBy ${ms.mandate.referredBy?.name ?? "(none)"}, ${ms.mandate.stageChanges.length} stageChanges`,
    );
  }

  // ── Read tools ─────────────────────────────────────────────────────────────
  const profile = await new GetPartnerProfileTool({ crm }).execute({ partner: partner.name });
  console.log(
    "get_partner_profile:",
    profile.status,
    profile.status === "ok" ? `${profile.referrals.totals.referred} referred, agreement recorded: ${profile.partner.agreement.recorded}` : profile,
  );

  if (mandate) {
    const status = await new GetReferralStatusTool({ crm }).execute({ deal: mandate.id, dealType: "mandate" });
    console.log(
      "get_referral_status:",
      status.status,
      status.status === "ok" ? `originator ${status.originator?.name}, ${status.stageTimeline.length} timeline entries` : status.status,
    );
  }

  const digest = await new ReferralPipelineDigestTool({ crm }).execute({});
  console.log(
    "referral_pipeline_digest:",
    digest.status,
    digest.status === "ok" ? `${digest.totals.referredDeals} deals across ${digest.totals.partners} partners` : digest,
  );

  const perf = await new PartnerPerformanceTool({ crm }).execute({});
  console.log(
    "partner_performance:",
    perf.status,
    perf.status === "ok" && perf.totals ? `${perf.totals.dealsReferred} referred, conversion ${(perf.totals.conversionRate * 100).toFixed(0)}%` : perf,
  );

  const single = await new PartnerPerformanceTool({ crm }).execute({ partner: partner.id });
  console.log("partner_performance (single, proves byPartner.id):", single.status);

  const deals = await scanReferredDeals(crm);
  console.log("referral-scan:", `${deals.length} referred deals flattened`);

  console.log("\nSmoke complete (read-only).");
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
