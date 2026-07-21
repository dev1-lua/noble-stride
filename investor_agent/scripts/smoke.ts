// Local end-to-end smoke: drives the three tools + the draft-outreach runner
// against a running local CRM exactly as the deployed agent would (same
// GraphQL documents, same x-agent-key header) — without the Lua cloud in the
// loop and without calling out to AI.generate.
//
// Prereqs: noblestride-crm dev server on :3000 with AGENT_API_KEY set, plus
// at least one Approved+Active investor with a contact email and one
// transaction to match against.
//
// Usage: CRM_API_URL=http://localhost:3000/api/graphql CRM_AGENT_KEY=<key> \
//        npx tsx scripts/smoke.ts <transactionId> <knownInvestorEmail>
//        (or set SMOKE_ALLOW_REMOTE=1 to explicitly opt into a non-local target)
import { makeCrmClient } from "../src/lib/crm-client";
import IdentifyInvestorTool from "../src/skills/tools/IdentifyInvestorTool";
import CaptureInvestorUpdateTool from "../src/skills/tools/CaptureInvestorUpdateTool";
import LogCommunicationTool from "../src/skills/tools/LogCommunicationTool";
import { runDraftOutreach } from "../src/lib/draft-runner";

// Production-write guard: importing the tools above side-loads investor_agent/.env
// via lua-cli's dotenv, which may point CRM_API_URL at a deployed environment.
// Without this guard, running this script with no env set (as documented) could
// silently write smoke-test data to a shared or production CRM.
const resolvedApiUrl = process.env.CRM_API_URL ?? "http://localhost:3000/api/graphql";
const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
if (!isLocalUrl(resolvedApiUrl) && process.env.SMOKE_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to run: CRM_API_URL resolves to a non-local target (${resolvedApiUrl}).\n` +
      `Importing the tools side-loads investor_agent/.env (via lua-cli's dotenv), which may\n` +
      `point CRM_API_URL at a deployed environment, so this script could write real data there.\n` +
      `Set CRM_API_URL=http://localhost:3000/api/graphql, or SMOKE_ALLOW_REMOTE=1 to override.`,
  );
  process.exit(1);
}

const crm = makeCrmClient({
  apiUrl: resolvedApiUrl,
  agentKey: process.env.CRM_AGENT_KEY ?? "dev-agent-key-change-me",
});

async function main() {
  const [transactionId, knownEmail] = process.argv.slice(2);
  if (!transactionId || !knownEmail) {
    console.error("Usage: npx tsx scripts/smoke.ts <transactionId> <knownInvestorEmail>");
    process.exit(1);
    return;
  }

  console.log("1) identify unknown sender...");
  console.log(await new IdentifyInvestorTool({ crm }).execute({ senderEmail: "stranger@nowhere.example" }));

  console.log("2) identify known sender...");
  const id = await new IdentifyInvestorTool({ crm }).execute({ senderEmail: knownEmail });
  console.log(id);
  if (!id.matched || !id.investorId) throw new Error("expected a match — seed an investor contact with that email");

  console.log("3) capture a criteria update (goes to review, not the record)...");
  console.log(
    await new CaptureInvestorUpdateTool({ crm }).execute({
      investorId: id.investorId,
      changes: { feedback: `Smoke test note ${new Date().toISOString()}` },
      summary: "Smoke: investor left a note about their preferences",
    }),
  );

  console.log("4) log the communication...");
  console.log(
    await new LogCommunicationTool({ crm }).execute({
      investorId: id.investorId,
      direction: "Inbound",
      interactionType: "Email",
      subject: "Smoke test",
      summary: "Investor emailed a preferences note (smoke test).",
    }),
  );

  console.log("5) draft outreach (deterministic fallback generator)...");
  console.log(
    await runDraftOutreach(
      {
        crm,
        generate: async () => {
          throw new Error("skip AI in smoke");
        },
      },
      transactionId,
    ),
  );

  console.log("SMOKE OK — now check /outreach and /investors/proposed-changes in the CRM.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
