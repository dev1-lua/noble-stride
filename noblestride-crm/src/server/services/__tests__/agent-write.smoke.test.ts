import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { prepareAgentWrite, commitAgentWrite, cancelAgentWrite } from "../agent-write";
import { AGENT_WRITE_REGISTRY } from "../agent-write-registry";

const ADMIN_EMAIL = "zztest.admin.agentwrite@noblestride.example";
const DEALLEAD_EMAIL = "zztest.deallead.agentwrite@noblestride.example";
const TEAMMEMBER_EMAIL = "zztest.teammember.agentwrite@noblestride.example";

const CLIENT_NAME = "ZZTest Agent Write Co";
const MANDATE_NAME = "ZZTest Agent Write Mandate";
const OTHER_MANDATE_NAME = "ZZTest Agent Write Mandate (Unled)";
const COMMIT_CLIENT_NAME = "ZZTest Agent Write Co (Commit)";
const TOCTOU_MANDATE_NAME = "ZZTest Agent Write Mandate (TOCTOU)";
const FAIL_MANDATE_NAME = "ZZTest Agent Write Mandate (Fail)";
const CANCEL_CLIENT_NAME = "ZZTest Agent Write Co (Cancel)";

let admin: { id: string };
let dealLead: { id: string };
let teamMember: { id: string };
let client: { id: string; name: string };
let mandate: { id: string; name: string; dateOpened: Date | null; leadId: string | null };
let otherMandate: { id: string };
let commitClient: { id: string; name: string };
let toctouMandate: { id: string };
let cancelClient: { id: string };

async function cleanup() {
  await prisma.agentPendingWrite.deleteMany({ where: { actorEmail: { in: [ADMIN_EMAIL, DEALLEAD_EMAIL, TEAMMEMBER_EMAIL] } } });
  await prisma.mandate.deleteMany({ where: { name: { startsWith: "ZZTest Agent Write Mandate" } } });
  await prisma.client.deleteMany({ where: { name: { in: [CLIENT_NAME, COMMIT_CLIENT_NAME, CANCEL_CLIENT_NAME] } } });
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, DEALLEAD_EMAIL, TEAMMEMBER_EMAIL] } } });
}

beforeAll(async () => {
  await cleanup();
  admin = await prisma.user.create({ data: { name: "ZZTest Admin AgentWrite", email: ADMIN_EMAIL, role: "Admin", isActive: true } });
  dealLead = await prisma.user.create({ data: { name: "ZZTest DealLead AgentWrite", email: DEALLEAD_EMAIL, role: "DealLead", isActive: true } });
  teamMember = await prisma.user.create({ data: { name: "ZZTest TeamMember AgentWrite", email: TEAMMEMBER_EMAIL, role: "TeamMember", isActive: true } });

  client = await prisma.client.create({ data: { name: CLIENT_NAME } });
  mandate = await prisma.mandate.create({
    data: { name: MANDATE_NAME, clientId: client.id, leadId: dealLead.id, dateOpened: new Date("2020-01-01T00:00:00.000Z") },
  });
  otherMandate = await prisma.mandate.create({
    data: { name: OTHER_MANDATE_NAME, clientId: client.id, leadId: null },
  });

  commitClient = await prisma.client.create({ data: { name: COMMIT_CLIENT_NAME } });
  toctouMandate = await prisma.mandate.create({
    data: { name: TOCTOU_MANDATE_NAME, clientId: client.id, leadId: dealLead.id },
  });
  cancelClient = await prisma.client.create({ data: { name: CANCEL_CLIENT_NAME } });
});

afterAll(cleanup);

describe("prepareAgentWrite", () => {
  it("happy path: admin prepares updateClient name change", async () => {
    const newName = `${CLIENT_NAME} Updated`;
    const out = await prepareAgentWrite({
      operation: "updateClient",
      targetId: client.id,
      payloadJson: JSON.stringify({ name: newName }),
      actorEmail: ADMIN_EMAIL,
    });
    expect(out.preview).toContain(`name: ${CLIENT_NAME} → ${newName}`);
    expect(out.warnings).toEqual([]);

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: out.writeToken } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe("Pending");
    expect(row!.actorUserId).toBe(admin.id);
    const expectedExpiry = Date.now() + 10 * 60 * 1000;
    expect(Math.abs(row!.expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);
  });

  it("unknown operation throws", async () => {
    await expect(
      prepareAgentWrite({ operation: "bogusOperation", payloadJson: "{}", actorEmail: ADMIN_EMAIL }),
    ).rejects.toThrow(/unknown operation/i);
  });

  it("malformed payloadJson throws", async () => {
    await expect(
      prepareAgentWrite({ operation: "updateClient", targetId: client.id, payloadJson: "{not json", actorEmail: ADMIN_EMAIL }),
    ).rejects.toThrow(/invalid json/i);
  });

  it("zod failure (createTask without title) throws with the zod message", async () => {
    await expect(
      prepareAgentWrite({ operation: "createTask", payloadJson: JSON.stringify({ mandateId: mandate.id }), actorEmail: ADMIN_EMAIL }),
    ).rejects.toThrow(/title/i);
  });

  it("RBAC at prepare: teamMember + updateClient is not authorized", async () => {
    await expect(
      prepareAgentWrite({
        operation: "updateClient",
        targetId: client.id,
        payloadJson: JSON.stringify({ name: "Whatever" }),
        actorEmail: TEAMMEMBER_EMAIL,
      }),
    ).rejects.toThrow(/not authorized/i);
  });

  it("RBAC at prepare: dealLead + updateMandate on a mandate they do NOT lead is not authorized", async () => {
    await expect(
      prepareAgentWrite({
        operation: "updateMandate",
        targetId: otherMandate.id,
        payloadJson: JSON.stringify({ notes: "trying to edit someone else's mandate" }),
        actorEmail: DEALLEAD_EMAIL,
      }),
    ).rejects.toThrow(/not authorized/i);
  });

  it("RBAC at prepare: dealLead + createPartner is not authorized (R-only per matrix)", async () => {
    await expect(
      prepareAgentWrite({
        operation: "createPartner",
        payloadJson: JSON.stringify({ name: "ZZTest New Partner" }),
        actorEmail: DEALLEAD_EMAIL,
      }),
    ).rejects.toThrow(/not authorized/i);
  });

  it("locked field: updateMandate changing dateOpened on a mandate that has one is rejected", async () => {
    await expect(
      prepareAgentWrite({
        operation: "updateMandate",
        targetId: mandate.id,
        payloadJson: JSON.stringify({ dateOpened: "2021-06-15" }),
        actorEmail: ADMIN_EMAIL,
      }),
    ).rejects.toThrow(/cannot be changed/i);
  });

  it("no-op: update payload equal to current values throws", async () => {
    await expect(
      prepareAgentWrite({
        operation: "updateClient",
        targetId: client.id,
        payloadJson: JSON.stringify({ name: CLIENT_NAME }),
        actorEmail: ADMIN_EMAIL,
      }),
    ).rejects.toThrow(/nothing to change/i);
  });

  it("update on missing record throws not found", async () => {
    await expect(
      prepareAgentWrite({
        operation: "updateClient",
        targetId: "zztest-nonexistent-client-id",
        payloadJson: JSON.stringify({ name: "Whatever" }),
        actorEmail: ADMIN_EMAIL,
      }),
    ).rejects.toThrow(/not found/i);
  });

  // Task 6 review fix: the create-path RBAC check hardcoded perm "C", so a
  // registry entry like logActivity (kind "create", perm "U" on Engagements
  // — it mirrors the UI mutation's assertCan(ctx.actor, "Engagements", "U"))
  // was checked against the wrong permission. TeamMember has ["R","U"] on
  // Engagements per the matrix (src/server/rbac/matrix.ts) — CAN log an
  // activity, still CANNOT create a client (Clients is ["R"] for TeamMember).
  it("RBAC fix: teamMember CAN prepare logActivity (perm mirrors op.perm, not hardcoded C)", async () => {
    const out = await prepareAgentWrite({
      operation: "logActivity",
      payloadJson: JSON.stringify({ type: "Call", subject: "ZZTest ping", clientId: client.id }),
      actorEmail: TEAMMEMBER_EMAIL,
    });
    expect(out.writeToken).toBeTruthy();
    const row = await prisma.agentPendingWrite.findUnique({ where: { id: out.writeToken } });
    expect(row!.status).toBe("Pending");
  });

  it("RBAC fix regression guard: teamMember is still denied createClient", async () => {
    await expect(
      prepareAgentWrite({
        operation: "createClient",
        payloadJson: JSON.stringify({ name: "ZZTest TeamMember Client Attempt" }),
        actorEmail: TEAMMEMBER_EMAIL,
      }),
    ).rejects.toThrow(/not authorized/i);
  });
});

describe("commitAgentWrite", () => {
  it("happy path: prepare updateClient → commit → row updated, ledger Committed, StageChange recorded", async () => {
    const newName = `${COMMIT_CLIENT_NAME} v1`;
    const { writeToken } = await prepareAgentWrite({
      operation: "updateClient",
      targetId: commitClient.id,
      payloadJson: JSON.stringify({ name: newName }),
      actorEmail: ADMIN_EMAIL,
    });

    const result = await commitAgentWrite(writeToken, ADMIN_EMAIL);
    expect(result.ok).toBe(true);
    expect(result.recordId).toBe(commitClient.id);
    expect(result.href).toBe(`/clients/${commitClient.id}`);
    expect(result.summary).toMatch(/updateClient/);

    const updated = await prisma.client.findUnique({ where: { id: commitClient.id } });
    expect(updated!.name).toBe(newName);

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Committed");
    expect(row!.resultId).toBe(commitClient.id);
    expect(row!.committedAt).not.toBeNull();

    const stageChange = await prisma.stageChange.findFirst({
      where: { clientId: commitClient.id, field: "name", toValue: newName },
    });
    expect(stageChange).not.toBeNull();
    expect(stageChange!.changedById).toBe(admin.id);
    expect(stageChange!.createdSource).toBe("AGENT");

    commitClient = { ...commitClient, name: newName };
  });

  it("replay: committing the same token twice rejects and does not double-apply", async () => {
    const newName = `${COMMIT_CLIENT_NAME} v2`;
    const { writeToken } = await prepareAgentWrite({
      operation: "updateClient",
      targetId: commitClient.id,
      payloadJson: JSON.stringify({ name: newName }),
      actorEmail: ADMIN_EMAIL,
    });

    await commitAgentWrite(writeToken, ADMIN_EMAIL);
    await expect(commitAgentWrite(writeToken, ADMIN_EMAIL)).rejects.toThrow(/already processed|expired|cancelled/i);

    const updated = await prisma.client.findUnique({ where: { id: commitClient.id } });
    expect(updated!.name).toBe(newName); // unchanged by the replay attempt

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Committed"); // still the first commit's terminal state

    commitClient = { ...commitClient, name: newName };
  });

  it("expiry: an expired token rejects commit and stays Pending", async () => {
    const { writeToken } = await prepareAgentWrite({
      operation: "updateClient",
      targetId: commitClient.id,
      payloadJson: JSON.stringify({ name: `${COMMIT_CLIENT_NAME} v3 (should not apply)` }),
      actorEmail: ADMIN_EMAIL,
    });
    await prisma.agentPendingWrite.update({ where: { id: writeToken }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(commitAgentWrite(writeToken, ADMIN_EMAIL)).rejects.toThrow(/already processed|expired|cancelled/i);

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Pending");
  });

  it("cross-user: prepared by admin, committed by dealLead is rejected and releases the claim", async () => {
    const { writeToken } = await prepareAgentWrite({
      operation: "updateClient",
      targetId: commitClient.id,
      payloadJson: JSON.stringify({ name: `${COMMIT_CLIENT_NAME} v4 (should not apply)` }),
      actorEmail: ADMIN_EMAIL,
    });

    await expect(commitAgentWrite(writeToken, DEALLEAD_EMAIL)).rejects.toThrow(/this change was prepared by/i);

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Pending"); // claim released back
  });

  it("service failure surfaces: execute throws, ledger marked Failed with error, rejection propagates", async () => {
    const failMandate = await prisma.mandate.create({ data: { name: FAIL_MANDATE_NAME, clientId: client.id, leadId: null } });
    const { writeToken } = await prepareAgentWrite({
      operation: "setMandateStage",
      targetId: failMandate.id,
      payloadJson: JSON.stringify({ stage: "Qualification" }),
      actorEmail: ADMIN_EMAIL,
    });

    await prisma.mandate.delete({ where: { id: failMandate.id } });

    await expect(commitAgentWrite(writeToken, ADMIN_EMAIL)).rejects.toThrow();

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Failed");
    expect(row!.error).toBeTruthy();
  });

  it("TOCTOU guard: mandate reassigned to another lead between prepare and commit is rejected, claim released", async () => {
    const { writeToken } = await prepareAgentWrite({
      operation: "updateMandate",
      targetId: toctouMandate.id,
      payloadJson: JSON.stringify({ notes: "ZZTest TOCTOU note" }),
      actorEmail: DEALLEAD_EMAIL,
    });

    // Simulate the mandate being reassigned to someone else after prepare
    // ran its RBAC gate but before commit executes.
    await prisma.mandate.update({ where: { id: toctouMandate.id }, data: { leadId: admin.id } });

    await expect(commitAgentWrite(writeToken, DEALLEAD_EMAIL)).rejects.toThrow(/not authorized/i);

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Pending"); // claim released back, not stuck in Committing

    const stillUnchanged = await prisma.mandate.findUnique({ where: { id: toctouMandate.id } });
    expect(stillUnchanged!.notes).not.toBe("ZZTest TOCTOU note");
  });

  // Final-review fix: previously, a non-admin's own-scope RBAC check ran
  // `loadCurrent` internally, got null back (record deleted between prepare
  // and commit), and `canUpdateRecord`'s `!record` branch threw a generic
  // "Not authorized" — releasing the claim back to Pending forever instead
  // of landing on a terminal Failed with an actionable error.
  it("record deleted between prepare and commit (non-admin actor): Failed with not-found error, not stuck Pending", async () => {
    const deletedTask = await prisma.task.create({
      data: { title: "ZZTest Agent Write Task (deleted)", clientId: client.id, assigneeId: teamMember.id },
    });
    const { writeToken } = await prepareAgentWrite({
      operation: "updateTask",
      targetId: deletedTask.id,
      payloadJson: JSON.stringify({ title: "ZZTest Agent Write Task (deleted) v2" }),
      actorEmail: TEAMMEMBER_EMAIL,
    });

    await prisma.task.delete({ where: { id: deletedTask.id } });

    await expect(commitAgentWrite(writeToken, TEAMMEMBER_EMAIL)).rejects.toThrow(/not found/i);

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Failed");
    expect(row!.error).toMatch(/not found/i);
  });
});

// Final-review fix: the registry's zod schemas must strip a smuggled
// `actorEmail` inside `fields` (server-side invariant — actor identity comes
// only from the trusted `actorEmail` argument, never from agent-controlled
// payload). Guards against a future `.passthrough()` silently reopening it.
describe("registry schemas strip a smuggled actorEmail", () => {
  it("createTask schema drops an injected actorEmail from parsed data", () => {
    const parsed = AGENT_WRITE_REGISTRY.createTask.schema.safeParse({
      title: "ZZTest strip-invariant task",
      clientId: "zztest-client-id",
      actorEmail: "smuggled@attacker.example",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("actorEmail");
    }
  });
});

describe("cancelAgentWrite", () => {
  it("cancel: Pending → Cancelled, and a subsequent commit rejects", async () => {
    const { writeToken } = await prepareAgentWrite({
      operation: "updateClient",
      targetId: cancelClient.id,
      payloadJson: JSON.stringify({ name: `${CANCEL_CLIENT_NAME} (should not apply)` }),
      actorEmail: ADMIN_EMAIL,
    });

    const result = await cancelAgentWrite(writeToken, ADMIN_EMAIL);
    expect(result.ok).toBe(true);

    const row = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(row!.status).toBe("Cancelled");

    await expect(commitAgentWrite(writeToken, ADMIN_EMAIL)).rejects.toThrow(/already processed|expired|cancelled/i);

    const stillCancelled = await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } });
    expect(stillCancelled!.status).toBe("Cancelled");

    const untouched = await prisma.client.findUnique({ where: { id: cancelClient.id } });
    expect(untouched!.name).toBe(CANCEL_CLIENT_NAME);
  });

  it("cancelling a non-pending (already committed) token throws", async () => {
    const { writeToken } = await prepareAgentWrite({
      operation: "updateClient",
      targetId: cancelClient.id,
      payloadJson: JSON.stringify({ name: `${CANCEL_CLIENT_NAME} v2` }),
      actorEmail: ADMIN_EMAIL,
    });
    await commitAgentWrite(writeToken, ADMIN_EMAIL);

    await expect(cancelAgentWrite(writeToken, ADMIN_EMAIL)).rejects.toThrow(/no pending change/i);
  });
});
