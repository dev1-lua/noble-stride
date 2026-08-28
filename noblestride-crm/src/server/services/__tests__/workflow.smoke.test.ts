// DB-backed smoke tests for the deal workflow service (Aug-2026 feedback
// F4.1.x / G2). `zz-` prefixed fixtures, created in beforeAll and removed in
// afterAll. Skipped when DATABASE_URL is not set (vitest does not load .env —
// run with `set -a; source .env; set +a`).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { CrudError } from "@/server/services/crud";
import {
  resolveDealWorkflow,
  setDealStageState,
  moveDealToWorkflowStep,
  getDefaultTemplate,
} from "@/server/services/workflow";
import { DEFAULT_WORKFLOW_TEMPLATE_ID } from "@/server/domain/workflow-default";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("workflow service (smoke)", () => {
  let clientId = "";
  let mandateId = "";
  let leadId = "";
  let actor: { type: "HUMAN"; userId: string };

  beforeAll(async () => {
    const lead = await prisma.user.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
    leadId = lead.id;
    actor = { type: "HUMAN", userId: leadId };
    const client = await prisma.client.create({ data: { name: "zz-Workflow Smoke Client" } });
    clientId = client.id;
    const mandate = await prisma.mandate.create({
      data: { name: "zz-Workflow Smoke Mandate", clientId, leadId, ndaStatus: "Signed", ndaSignedDate: new Date() },
    });
    mandateId = mandate.id;
  });

  afterAll(async () => {
    if (!mandateId) return;
    await prisma.dealStageState.deleteMany({ where: { dealKind: "Mandate", dealId: mandateId } });
    await prisma.stageChange.deleteMany({ where: { mandateId } });
    await prisma.activity.deleteMany({ where: { mandateId } });
    await prisma.mandate.delete({ where: { id: mandateId } });
    await prisma.client.delete({ where: { id: clientId } });
  });

  it("uses the seeded default template", async () => {
    const t = await getDefaultTemplate();
    expect(t.id).toBe(DEFAULT_WORKFLOW_TEMPLATE_ID);
    expect(t.steps).toHaveLength(13);
  });

  it("resolves evidence: NDA signed + lead assigned are done, first open step is current", async () => {
    const wf = await resolveDealWorkflow("Mandate", mandateId);
    expect(wf).not.toBeNull();
    expect(wf!.total).toBe(12);
    const by = new Map(wf!.steps.map((s) => [s.key, s]));
    expect(by.get("newOpportunity")?.status).toBe("done");
    expect(by.get("ndaSigned")?.status).toBe("done");
    expect(by.get("ndaSigned")?.source).toBe("evidence");
    expect(by.get("dealApproved")?.status).toBe("done");
    expect(by.get("initialEvaluation")?.status).toBe("current"); // NewLead, no verdict
    expect(by.get("assignmentScoping")).toBeUndefined();
  });

  it("returns null for an unknown deal", async () => {
    expect(await resolveDealWorkflow("Transaction", "zz-does-not-exist")).toBeNull();
  });

  it("mark done writes one DealStageState, one StageChange(workflowStep) and one Activity; reopen flips it", async () => {
    const wf = await setDealStageState(
      { dealKind: "Mandate", dealId: mandateId, stepKey: "internalReview", done: true, note: "Reviewed by Brian" },
      actor,
    );
    const step = wf.steps.find((s) => s.key === "internalReview")!;
    expect(step.status).toBe("done");
    expect(step.source).toBe("manual");
    expect(step.note).toBe("Reviewed by Brian");
    expect(step.completedById).toBe(leadId);
    expect(step.completedByName).toBeTruthy();

    const rows = await prisma.dealStageState.findMany({ where: { dealKind: "Mandate", dealId: mandateId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].manualStatus).toBe("complete");

    const changes = await prisma.stageChange.findMany({ where: { mandateId, field: "workflowStep" }, orderBy: { changedAt: "asc" } });
    expect(changes).toHaveLength(1);
    expect(changes[0].fromValue).toBeNull();
    expect(changes[0].toValue).toBe("internalReview:complete");

    const acts = await prisma.activity.findMany({ where: { mandateId, type: "Note" } });
    expect(acts.map((a) => a.subject)).toContain("Workflow step completed — Internal Review");

    // Marking done again is idempotent on the row and adds no StageChange (unchanged value).
    await setDealStageState({ dealKind: "Mandate", dealId: mandateId, stepKey: "internalReview", done: true }, actor);
    expect(await prisma.dealStageState.count({ where: { dealKind: "Mandate", dealId: mandateId } })).toBe(1);
    expect(await prisma.stageChange.count({ where: { mandateId, field: "workflowStep" } })).toBe(1);

    // Reopen
    const wf2 = await setDealStageState(
      { dealKind: "Mandate", dealId: mandateId, stepKey: "internalReview", done: false, note: "Needs a second pass" },
      actor,
    );
    const re = wf2.steps.find((s) => s.key === "internalReview")!;
    expect(re.status).not.toBe("done");
    expect(re.manualStatus).toBe("incomplete");
    expect(re.note).toBe("Needs a second pass");
    const changes2 = await prisma.stageChange.findMany({ where: { mandateId, field: "workflowStep" }, orderBy: { changedAt: "asc" } });
    expect(changes2).toHaveLength(2);
    expect(changes2[1].fromValue).toBe("internalReview:complete");
    expect(changes2[1].toValue).toBe("internalReview:incomplete");
    expect(await prisma.dealStageState.count({ where: { dealKind: "Mandate", dealId: mandateId } })).toBe(1);
  });

  it("manual incomplete overrides true evidence (explicit reopen of NDA)", async () => {
    const wf = await setDealStageState({ dealKind: "Mandate", dealId: mandateId, stepKey: "ndaSigned", done: false, note: "Re-sign" }, actor);
    const s = wf.steps.find((x) => x.key === "ndaSigned")!;
    expect(s.status).not.toBe("done");
    expect(s.source).toBe("manual");
    // put it back
    await prisma.dealStageState.delete({ where: { dealKind_dealId_stepKey: { dealKind: "Mandate", dealId: mandateId, stepKey: "ndaSigned" } } });
  });

  it("rejects a step key that is not in the deal's workflow", async () => {
    await expect(
      setDealStageState({ dealKind: "Mandate", dealId: mandateId, stepKey: "assignmentScoping", done: true }, actor),
    ).rejects.toBeInstanceOf(CrudError);
    await expect(
      setDealStageState({ dealKind: "Mandate", dealId: mandateId, stepKey: "bogusKey", done: true }, actor),
    ).rejects.toBeInstanceOf(CrudError);
    await expect(
      setDealStageState({ dealKind: "Advisory", dealId: "zz-nope", stepKey: "ndaSigned", done: true }, actor),
    ).rejects.toBeInstanceOf(CrudError);
  });

  it("moveDealToWorkflowStep marks earlier open steps done and leaves the target current", async () => {
    const before = await resolveDealWorkflow("Mandate", mandateId);
    const openBefore = before!.steps.filter((s) => s.status !== "done" && s.order < 9).map((s) => s.key);
    expect(openBefore.length).toBeGreaterThan(0);

    const acts0 = await prisma.activity.count({ where: { mandateId, type: "Note" } });
    const wf = await moveDealToWorkflowStep({ dealKind: "Mandate", dealId: mandateId, stepKey: "investorOutreach" }, actor);
    expect(wf.current?.key).toBe("investorOutreach");
    for (const s of wf.steps) if (s.order < 9) expect(s.status).toBe("done");
    for (const k of openBefore) {
      const s = wf.steps.find((x) => x.key === k)!;
      expect(s.source).toBe("manual");
      expect(s.note).toBe("Moved to Investor Outreach");
    }
    expect(await prisma.activity.count({ where: { mandateId, type: "Note" } })).toBe(acts0 + 1);
    const moved = await prisma.activity.findFirst({ where: { mandateId, subject: "Workflow moved to Investor Outreach" } });
    expect(moved).not.toBeNull();

    // A second move to the same step is a no-op (nothing left to complete).
    const acts1 = await prisma.activity.count({ where: { mandateId, type: "Note" } });
    await moveDealToWorkflowStep({ dealKind: "Mandate", dealId: mandateId, stepKey: "investorOutreach" }, actor);
    expect(await prisma.activity.count({ where: { mandateId, type: "Note" } })).toBe(acts1);
  });
});
