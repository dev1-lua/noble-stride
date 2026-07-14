// Local end-to-end smoke for the crm-write surface: drives the four write
// tools against the running local CRM exactly as the deployed agent would
// (same GraphQL documents, same x-agent-key header) — without the Lua cloud
// in the loop. Identity comes from a fake getUser (the gate is Lua-side).
//
// Usage: CRM_API_URL=http://localhost:3000/api/graphql CRM_AGENT_KEY=<key> \
//        SMOKE_ADMIN_EMAIL=<active admin email> \
//        SMOKE_MEMBER_EMAIL=<active TeamMember email, optional> \
//        npx tsx scripts/write-smoke.ts
//        (or set SMOKE_ALLOW_REMOTE=1 to explicitly opt into a non-local target)
import { makeCrmClient } from "../src/lib/crm-client";
import { LookupRecordTool } from "../src/skills/tools/LookupRecordTool";
import { ProposeChangeTool } from "../src/skills/tools/ProposeChangeTool";
import { CommitChangeTool } from "../src/skills/tools/CommitChangeTool";
import { CancelChangeTool } from "../src/skills/tools/CancelChangeTool";

// Production-write guard: importing the tools above side-loads crm_agent/.env
// via lua-cli's dotenv, which points CRM_API_URL at the production Vercel
// deployment. Without this guard, running this script with no env set (as
// documented) would silently write smoke-test data to production.
const resolvedApiUrl = process.env.CRM_API_URL ?? "http://localhost:3000/api/graphql";
const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
if (!isLocalUrl(resolvedApiUrl) && process.env.SMOKE_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to run: CRM_API_URL resolves to a non-local target (${resolvedApiUrl}).\n` +
      `Importing the write tools side-loads crm_agent/.env (via lua-cli's dotenv), which points\n` +
      `CRM_API_URL at the production deployment, so this script would write real data there.\n` +
      `Set CRM_API_URL=http://localhost:3000/api/graphql, or SMOKE_ALLOW_REMOTE=1 to override.`,
  );
  process.exit(1);
}

const crm = makeCrmClient({
  apiUrl: resolvedApiUrl,
  agentKey: process.env.CRM_AGENT_KEY ?? "dev-agent-key-change-me",
});

const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
const memberEmail = process.env.SMOKE_MEMBER_EMAIL; // optional: RBAC-denial probe
if (!adminEmail) {
  console.error("SMOKE_ADMIN_EMAIL is required");
  process.exit(1);
}

const asUser = (email: string) => ({
  crm,
  getUser: async () => ({ staffEmail: email }),
});

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const mark = cond ? "PASS" : "FAIL";
  if (!cond) failures += 1;
  console.log(`[${mark}] ${label}${detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""}`);
}

async function main() {
  const stamp = Date.now().toString(36);
  const title = `ZZTest agent smoke task ${stamp}`;

  // 0. lookup a client to link the task to (tasks require >=1 linked record)
  const lookup = new LookupRecordTool({ crm });
  const l1 = await lookup.execute({ recordType: "client", query: "a" });
  check("lookup returns something for clients", l1.status === "match" || l1.status === "ambiguous", l1.status);
  const clientId =
    l1.status === "match"
      ? (l1 as { id: string }).id
      : ((l1 as { candidates: Array<{ id: string }> }).candidates ?? [])[0]?.id;
  check("lookup produced a client id", !!clientId);

  // 1. propose createTask → preview
  const propose = new ProposeChangeTool(asUser(adminEmail!));
  const p1 = await propose.execute({ operation: "createTask", fields: { title, clientId } });
  check("propose createTask returns preview", p1.status === "preview" && !!(p1 as { writeToken?: string }).writeToken, p1.status);
  const token1 = (p1 as { writeToken: string }).writeToken;
  check("preview mentions title", String((p1 as { preview?: string }).preview).includes(title));

  // 1b. business-rule rejection surfaces actionably (unlinked task)
  const pBad = await propose.execute({ operation: "createTask", fields: { title: `${title} unlinked` } });
  check("unlinked task rejected with actionable message", pBad.status === "rejected" && /at least one record/i.test(String((pBad as { message?: string }).message)), pBad.status);

  // 2. commit → ok
  const commit = new CommitChangeTool(asUser(adminEmail!));
  const c1 = await commit.execute({ writeToken: token1 });
  check("commit createTask ok", c1.status === "ok", c1);

  // 4. propose + CANCEL, then commit the cancelled token → rejected
  const p2 = await propose.execute({ operation: "createTask", fields: { title: `${title} cancel-me`, clientId } });
  check("second propose ok", p2.status === "preview");
  const token2 = (p2 as { writeToken: string }).writeToken;
  const cancel = new CancelChangeTool(asUser(adminEmail!));
  const x1 = await cancel.execute({ writeToken: token2 });
  check("cancel ok", x1.status === "ok", x1);
  const c2 = await commit.execute({ writeToken: token2 });
  check("commit of cancelled token rejected", c2.status === "rejected", c2);

  // 5. double-commit replay of token1 → rejected
  const c3 = await commit.execute({ writeToken: token1 });
  check("replay commit rejected", c3.status === "rejected", c3);

  // 6. RBAC denial at prepare: TeamMember may not update clients
  if (memberEmail) {
    const p3 = await new ProposeChangeTool(asUser(memberEmail)).execute({
      operation: "updateClient",
      targetId: clientId,
      fields: { description: "should be denied" },
    });
    check("TeamMember updateClient denied", p3.status === "rejected", p3);
  } else {
    console.log("[SKIP] TeamMember RBAC probe (no SMOKE_MEMBER_EMAIL)");
  }

  // 7. not_identified guard: no staffEmail → no call
  const p4 = await new ProposeChangeTool({ crm, getUser: async () => ({}) }).execute({
    operation: "createTask",
    fields: { title: "never", clientId },
  });
  check("missing identity → not_identified", p4.status === "not_identified", p4.status);

  // 8. unknown actor email → rejected at prepare
  const p5 = await new ProposeChangeTool(asUser("zz.nobody@nowhere.example")).execute({
    operation: "createTask",
    fields: { title: "never", clientId },
  });
  check("unknown actor email rejected", p5.status === "rejected", p5);

  console.log(failures === 0 ? "\nALL WRITE-SMOKE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("SMOKE CRASHED:", err);
  process.exit(1);
});
