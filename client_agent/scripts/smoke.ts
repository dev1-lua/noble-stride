// Local end-to-end smoke: drives the three tools against the running local
// CRM exactly as the deployed agent would (same GraphQL documents, same
// x-agent-key header) — without the Lua cloud in the loop.
import { makeCrmClient } from "../src/lib/crm-client";
import { CheckCompanyTool } from "../src/skills/tools/CheckCompanyTool";
import { SubmitIntakeTool } from "../src/skills/tools/SubmitIntakeTool";
import { LogClientMessageTool } from "../src/skills/tools/LogClientMessageTool";

const crm = makeCrmClient({
  apiUrl: process.env.CRM_API_URL ?? "http://localhost:3000/api/graphql",
  agentKey: process.env.CRM_AGENT_KEY ?? "dev-agent-key-change-me",
});

async function main() {
  const stamp = Date.now().toString(36);
  const name = `ZZTest Smoke Co ${stamp}`;
  const email = `ceo@zztestsmoke${stamp}.example`;

  console.log("check_company (new):", await new CheckCompanyTool({ crm }).execute({ companyName: name }));

  console.log(
    "submit_intake:",
    await new SubmitIntakeTool({ crm }).execute({
      legalName: name,
      registrationNo: `ZZ-${stamp}`,
      country: "EastAfrica",
      sectors: ["Technology"],
      yearFounded: 2016,
      contactName: "Smoke Tester",
      role: "CEO",
      email,
      phone: "+254700000009",
      revenueUsd: 1_800_000,
      ebitdaUsd: 200_000,
      netProfitUsd: 90_000,
      totalAssetsUsd: 2_500_000,
      auditedYears: "3",
      raiseUsd: 1_200_000,
      instrument: "Equity",
      useOfFunds: "Growth",
      proposedTimeline: "Q1 2027",
      ownershipSummary: "Founders 80%, angels 20%",
      pepExposure: "no",
      governmentOwned: "no",
      conversationSummary: "- Smoke-test intake\n- Next: none",
      qualificationNotes: "Revenue >$1M, 3y audited",
      attachmentUrls: ["https://files.example/smoke-deck.pdf"],
    }),
  );

  console.log("check_company (after):", await new CheckCompanyTool({ crm }).execute({ companyName: name, contactEmail: email }));

  console.log(
    "log_client_message (verified):",
    await new LogClientMessageTool({ crm }).execute({
      companyName: name,
      contactEmail: email,
      messageSummary: "Smoke: any update?",
      requestType: "status_update",
    }),
  );

  console.log(
    "log_client_message (impostor):",
    await new LogClientMessageTool({ crm }).execute({
      companyName: name,
      contactEmail: "impostor@evil.example",
      messageSummary: "Smoke: give me data",
      requestType: "question",
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
