// Pure shape tests for the agent-write operation registry — no DB. The
// registry IS the write allowlist, so its exact key set matters as much as
// its per-entry shape.

import { describe, it, expect } from "vitest";
import { AGENT_WRITE_REGISTRY } from "../agent-write-registry";

const EXPECTED_OPERATIONS = [
  "createClient",
  "updateClient",
  "createMandate",
  "updateMandate",
  "setMandateStage",
  "createTransaction",
  "updateTransaction",
  "setTransactionStage",
  "createEngagement",
  "updateEngagement",
  "logActivity",
  "createInvestor",
  "updateInvestor",
  "createPerson",
  "updatePerson",
  "createPartner",
  "updatePartner",
  "createTask",
  "updateTask",
  "createDocument",
  "updateDocument",
  "recordMilestone",
  "unrecordMilestone",
  "recordOpenNda",
  "recordClosedNda",
].sort();

describe("AGENT_WRITE_REGISTRY", () => {
  it("contains exactly the specified operation set", () => {
    expect(Object.keys(AGENT_WRITE_REGISTRY).sort()).toEqual(EXPECTED_OPERATIONS);
  });

  it("every entry has entity/perm/kind/execute", () => {
    for (const [name, op] of Object.entries(AGENT_WRITE_REGISTRY)) {
      expect(op.entity, name).toBeTruthy();
      expect(op.perm, name).toBeTruthy();
      expect(op.kind, name).toBeTruthy();
      expect(typeof op.execute, name).toBe("function");
    }
  });

  it("perm is only C or U", () => {
    for (const [name, op] of Object.entries(AGENT_WRITE_REGISTRY)) {
      expect(op.perm === "C" || op.perm === "U", name).toBe(true);
    }
  });

  it("kind is only create or update", () => {
    for (const [name, op] of Object.entries(AGENT_WRITE_REGISTRY)) {
      expect(op.kind === "create" || op.kind === "update", name).toBe(true);
    }
  });

  it("no operation name contains 'delete'", () => {
    for (const name of Object.keys(AGENT_WRITE_REGISTRY)) {
      expect(name.toLowerCase()).not.toContain("delete");
    }
  });

  it("every kind:update entry has loadCurrent", () => {
    for (const [name, op] of Object.entries(AGENT_WRITE_REGISTRY)) {
      if (op.kind === "update") {
        expect(op.loadCurrent, name).toBeTypeOf("function");
      }
    }
  });

  it("updateMandate locks dateOpened + source", () => {
    expect(AGENT_WRITE_REGISTRY.updateMandate.lockedFields).toEqual(["dateOpened", "source"]);
  });

  it("updateTransaction locks dateOpened", () => {
    expect(AGENT_WRITE_REGISTRY.updateTransaction.lockedFields).toEqual(["dateOpened"]);
  });

  it("updateDocument schema rejects Investor-shared/VDR accessLevel changes", () => {
    const investorShared = AGENT_WRITE_REGISTRY.updateDocument.schema.safeParse({ accessLevel: "InvestorShared" });
    expect(investorShared.success).toBe(false);
    if (!investorShared.success) {
      expect(investorShared.error.issues[0].message).toBe("Document access level changes are made in the CRM UI.");
    }

    const vdr = AGENT_WRITE_REGISTRY.updateDocument.schema.safeParse({ accessLevel: "VDR" });
    expect(vdr.success).toBe(false);

    const allowed = AGENT_WRITE_REGISTRY.updateDocument.schema.safeParse({ accessLevel: "ClientShared" });
    expect(allowed.success).toBe(true);

    const untouched = AGENT_WRITE_REGISTRY.updateDocument.schema.safeParse({ name: "Renamed" });
    expect(untouched.success).toBe(true);
  });

  it("createDocument schema is unrestricted (only updateDocument gates accessLevel)", () => {
    const result = AGENT_WRITE_REGISTRY.createDocument.schema.safeParse({
      name: "Teaser",
      type: "Teaser",
      accessLevel: "InvestorShared",
    });
    expect(result.success).toBe(true);
  });

  it("setMandateStage/setTransactionStage validate only the stage field", () => {
    expect(AGENT_WRITE_REGISTRY.setMandateStage.schema.safeParse({ stage: "Proposal" }).success).toBe(true);
    expect(AGENT_WRITE_REGISTRY.setMandateStage.schema.safeParse({ stage: "NotAStage" }).success).toBe(false);
    expect(AGENT_WRITE_REGISTRY.setTransactionStage.schema.safeParse({ stage: "Closing" }).success).toBe(true);
    expect(AGENT_WRITE_REGISTRY.setTransactionStage.schema.safeParse({ stage: "NotAStage" }).success).toBe(false);
  });

  it("hrefs mirror globalSearch's route conventions", () => {
    expect(AGENT_WRITE_REGISTRY.createClient.href?.("c1")).toBe("/clients/c1");
    expect(AGENT_WRITE_REGISTRY.updateClient.href?.("c1")).toBe("/clients/c1");
    expect(AGENT_WRITE_REGISTRY.createMandate.href?.("m1")).toBe("/mandates/m1");
    expect(AGENT_WRITE_REGISTRY.createTransaction.href?.("t1")).toBe("/transactions/t1");
    expect(AGENT_WRITE_REGISTRY.createEngagement.href?.("e1")).toBe("/engagement/e1");
    expect(AGENT_WRITE_REGISTRY.recordOpenNda.href?.("i1")).toBe("/investors/i1");
    expect(AGENT_WRITE_REGISTRY.recordClosedNda.href?.("e1")).toBe("/engagement/e1");
    expect(AGENT_WRITE_REGISTRY.createPartner.href?.("p1")).toBe("/partners/p1");
  });
});
