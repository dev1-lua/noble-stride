import { describe, it, expect } from "vitest";
import * as queries from "../queries";

// The investor agent must NEVER be able to send/approve/reject outreach — those are
// human-only actions on the CRM side (spec §4.10, D7). This guards against a future
// change silently granting the agent send power.
describe("no-send guarantee", () => {
  const allGraphql = Object.values(queries).join("\n").toLowerCase();
  it("only writes outreach via saveOutreachDrafts (drafts), never a send/approve/reject", () => {
    expect(allGraphql).toContain("saveoutreachdrafts");
    expect(allGraphql).not.toMatch(/sendoutreach|approveoutreach|rejectoutreach|updateoutreachdraft/);
  });
});
