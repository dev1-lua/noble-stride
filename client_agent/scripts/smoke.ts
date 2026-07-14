// Local end-to-end smoke: drives the three tools against the running local
// CRM exactly as the deployed agent would (same GraphQL documents, same
// x-agent-key header) — without the Lua cloud in the loop.
//
// Usage: CRM_API_URL=http://localhost:3000/api/graphql CRM_AGENT_KEY=<key> \
//        npx tsx scripts/smoke.ts
//        (or set SMOKE_ALLOW_REMOTE=1 to explicitly opt into a non-local target)
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCrmClient } from "../src/lib/crm-client";
import { CheckCompanyTool } from "../src/skills/tools/CheckCompanyTool";
import { SubmitIntakeTool } from "../src/skills/tools/SubmitIntakeTool";
import { LogClientMessageTool } from "../src/skills/tools/LogClientMessageTool";
import { RequestStatusCodeTool } from "../src/skills/tools/RequestStatusCodeTool";
import { VerifyStatusCodeTool } from "../src/skills/tools/VerifyStatusCodeTool";
import { GetClientStatusTool } from "../src/skills/tools/GetClientStatusTool";

// Production-write guard: importing the tools above side-loads client_agent/.env
// via lua-cli's dotenv, which points CRM_API_URL at the production Vercel
// deployment. Without this guard, running this script with no env set (as
// documented) would silently write smoke-test data to production.
const resolvedApiUrl = process.env.CRM_API_URL ?? "http://localhost:3000/api/graphql";
const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
if (!isLocalUrl(resolvedApiUrl) && process.env.SMOKE_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to run: CRM_API_URL resolves to a non-local target (${resolvedApiUrl}).\n` +
      `Importing the tools side-loads client_agent/.env (via lua-cli's dotenv), which points\n` +
      `CRM_API_URL at the production deployment, so this script would write real data there.\n` +
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

  // ---- status flow (OTP data-out) ----
  const assertEq = (label: string, actual: unknown, expected: unknown) => {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`FAIL ${label}: got ${a}, expected ${b}`);
    console.log(`PASS ${label}`);
  };

  const requested = await new RequestStatusCodeTool({ crm }).execute({ companyName: name, contactEmail: email });
  assertEq("request_status_code (real contact)", requested, { status: "ok" });

  const sink = JSON.parse(readFileSync(join(tmpdir(), "ns-dev-otp-sink.json"), "utf8")) as Record<
    string,
    { code: string; ts: number }
  >;
  const code = sink[email.toLowerCase()]?.code;
  if (!code) throw new Error(`FAIL dev sink: no code recorded for ${email}`);
  console.log("PASS dev sink has code for contact");

  const verified = await new VerifyStatusCodeTool({ crm }).execute({ companyName: name, contactEmail: email, code });
  if (verified.status !== "ok" || !verified.token) throw new Error(`FAIL verify_status_code: ${JSON.stringify(verified)}`);
  console.log("PASS verify_status_code (correct code) -> token");

  const status = await new GetClientStatusTool({ crm }).execute({ token: verified.token });
  if (status.status !== "ok") throw new Error(`FAIL get_client_status: ${JSON.stringify(status)}`);
  assertEq("clientStatus applicationState", status.applicationState, "received");
  const { status: _ok, ...payload } = status;
  assertEq(
    "clientStatus payload keys (spec whitelist)",
    Object.keys(payload).sort(),
    [
      "applicationState",
      "coarseStage",
      "companyName",
      "engagementAgreementStatus",
      "lastUpdated",
      "ndaStatus",
      "nextStep",
      "preparedDocuments",
      "stageMessage",
      "submittedRaise",
    ],
  );

  const impostor = await new RequestStatusCodeTool({ crm }).execute({
    companyName: name,
    contactEmail: "wrong@nowhere.example",
  });
  assertEq("request_status_code (impostor) shape-identical", impostor, { status: "ok" });
  const impostorVerify = await new VerifyStatusCodeTool({ crm }).execute({
    companyName: name,
    contactEmail: "wrong@nowhere.example",
    code: "000000",
  });
  assertEq("verify_status_code (impostor, any code) fails", impostorVerify, { status: "failed" });

  console.log("STATUS FLOW: ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
