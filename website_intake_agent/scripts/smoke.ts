// Local end-to-end smoke for the Website Intake & Qualification Agent (SOW
// §10): drives the tools against the running local CRM exactly as the
// deployed agent would (same GraphQL documents, same x-agent-key header) —
// without the Lua cloud in the loop.
//
// Usage: CRM_API_URL=http://localhost:3000/api/graphql CRM_AGENT_KEY=<key> \
//        npx tsx scripts/smoke.ts
//        (or set SMOKE_ALLOW_REMOTE=1 to explicitly opt into a non-local target)
import { makeCrmClient } from "../src/lib/crm-client";
import { CheckCompanyTool } from "../src/skills/tools/CheckCompanyTool";
import { SubmitIntakeTool } from "../src/skills/tools/SubmitIntakeTool";
import { LogClientMessageTool } from "../src/skills/tools/LogClientMessageTool";

// Production-write guard: importing the tools above side-loads this agent's
// .env via lua-cli's dotenv, which may point CRM_API_URL at the production
// Vercel deployment. Without this guard, running this script with no env set
// (as documented) could silently write smoke-test data to production.
const resolvedApiUrl = process.env.CRM_API_URL ?? "http://localhost:3000/api/graphql";
const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
if (!isLocalUrl(resolvedApiUrl) && process.env.SMOKE_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to run: CRM_API_URL resolves to a non-local target (${resolvedApiUrl}).\n` +
      `Set CRM_API_URL=http://localhost:3000/api/graphql, or SMOKE_ALLOW_REMOTE=1 to override.`,
  );
  process.exit(1);
}

const crm = makeCrmClient({
  apiUrl: resolvedApiUrl,
  agentKey: process.env.CRM_AGENT_KEY ?? "dev-agent-key-change-me",
});

async function main() {
  const stamp = Date.now().toString(36);

  // ── 1. Required-only submission (§10.1 "Y" fields; lands NeedsReview) ──
  const minimalName = `ZZTest WebIntake Min ${stamp}`;
  console.log(
    "check_company (new):",
    await new CheckCompanyTool({ crm }).execute({ companyName: minimalName }),
  );
  console.log(
    "submit_intake (required-only):",
    await new SubmitIntakeTool({ crm }).execute({
      legalName: minimalName,
      yearFounded: 2016,
      hqCity: "Nairobi",
      countries: ["EastAfrica"],
      sectors: ["Technology"],
      coreProduct: "B2B payments platform",
      description: "Payments infrastructure for East African SMEs.",
      founderGenders: ["Female"],
      foundersNationality: "Kenyan",
      targetClients: "SMEs and SACCOs",
      contactName: "Smoke Tester",
      role: "CEO",
      email: `ceo@zztestwebintakemin${stamp}.example`,
      ndaAccepted: false, // declined NDA must still submit cleanly
      raiseUsd: 1_200_000,
      instruments: ["Equity"],
      conversationSummary: "- Smoke: required-only intake\n- NDA declined\n- Next: none",
    }),
  );

  // ── 2. Full submission (all optionals; lands Qualified) ──
  const fullName = `ZZTest WebIntake Full ${stamp}`;
  const fullEmail = `cfo@zztestwebintakefull${stamp}.example`;
  console.log(
    "submit_intake (full):",
    await new SubmitIntakeTool({ crm }).execute({
      legalName: fullName,
      yearFounded: 2014,
      hqCity: "Mombasa",
      countries: ["EastAfrica", "SouthernAfrica"],
      sectors: ["Manufacturing"],
      coreProduct: "Construction materials manufacturing",
      description: "Manufactures cement products for the regional market.",
      founderGenders: ["Mixed"],
      foundersNationality: "Kenyan / Tanzanian",
      targetClients: "Regional construction firms",
      contactName: "Smoke CFO",
      role: "CFO",
      email: fullEmail,
      ndaAccepted: true,
      raiseUsd: 3_000_000,
      instruments: ["Debt", "Mezzanine"],
      postMoneyValuationUsd: 20_000_000,
      raisedToDateRoundUsd: 500_000,
      raisedToDateTotalUsd: 2_000_000,
      existingInvestors: "Family office (equity), IFC (debt)",
      revenueUsd: 5_000_000,
      revenueForecastUsd: 6_500_000,
      profitability: "Profitable",
      ebitdaUsd: 900_000,
      auditedYears: "5",
      pepExposure: "no",
      governmentOwned: "no",
      useOfFunds: "CAPEX — second production line",
      proposedTimeline: "Q2 2027",
      originationSource: "Website",
      applicantNotes: "Board approval already obtained.",
      phone: "+254700000010",
      conversationSummary: "- Smoke: full intake\n- Strong financials\n- Next: intro call",
      qualificationNotes: "Revenue $5M, 5y audited, profitable, SSA, clean sector.",
      attachmentUrls: ["https://files.example/smoke-deck.pdf"],
    }),
  );

  console.log(
    "check_company (after):",
    await new CheckCompanyTool({ crm }).execute({ companyName: fullName, contactEmail: fullEmail }),
  );

  console.log(
    "log_client_message (verified):",
    await new LogClientMessageTool({ crm }).execute({
      companyName: fullName,
      contactEmail: fullEmail,
      messageSummary: "Smoke: any update?",
      requestType: "status_update",
    }),
  );

  console.log("WEBSITE INTAKE SMOKE: DONE — verify verdicts in the CRM NewLead queue");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
