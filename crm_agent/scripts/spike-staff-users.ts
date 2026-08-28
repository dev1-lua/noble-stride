// SPIKE (Task 6 gate, 2026-07-31): is the LuaPop webchat `sessionId` recoverable
// agent-side as `user._luaProfile.userId`? The staff_users Data collection rows
// were written from exactly that field at markVerified (passphrase-gate.ts), so
// if verified webchat users show up here with the CRM-minted `web-<uuid>` shape,
// the assumption holds. Read-only probe; auth = ~/.lua-cli credentials + agentId
// from lua.skill.yaml (run from crm_agent/ with `npx tsx scripts/spike-staff-users.ts`).
import { Data } from "lua-cli";

const WEB_ID = /^web-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const rows: Array<{ id: string; data: Record<string, unknown>; createdAt?: number }> = [];
  for (let page = 1; page <= 10; page++) {
    const res = await Data.get("staff_users", {}, page, 50);
    const batch = (res as { data: typeof rows }).data ?? [];
    rows.push(...batch);
    if (batch.length < 50) break;
  }
  console.log(`staff_users rows: ${rows.length}`);
  let webShaped = 0;
  for (const row of rows) {
    const userId = String((row.data as { userId?: unknown }).userId ?? "");
    const shape = WEB_ID.test(userId) ? "WEB-UUID (CRM-minted sessionId)" : "other";
    if (shape.startsWith("WEB")) webShaped++;
    const created = row.createdAt ? new Date(row.createdAt).toISOString() : "?";
    console.log(`  ${userId}  [${shape}]  created=${created}`);
  }
  console.log(
    `\nVERDICT: ${webShaped}/${rows.length} rows carry the CRM webchat sessionId shape.`,
  );
  console.log(
    webShaped > 0
      ? "Assumption A SUPPORTED: user._luaProfile.userId == LuaPop sessionId for webchat users."
      : "No web-shaped ids found - inconclusive from data alone; sandbox probe needed.",
  );
}

main().catch((err) => {
  console.error("SPIKE FAILED:", err);
  process.exit(1);
});
