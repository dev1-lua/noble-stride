import { describe, it, expect } from "vitest";
import { CRM_PERSONA } from "../../persona";

describe("CRM_PERSONA", () => {
  it("keeps the internal-only, staff-only guardrails", () => {
    expect(CRM_PERSONA).toContain("internal");
    expect(CRM_PERSONA).toContain("Noblestride staff only");
  });
  it("keeps the no-invented-facts and no-raw-id rules", () => {
    expect(CRM_PERSONA.toLowerCase()).toContain("never invent");
    expect(CRM_PERSONA.toLowerCase()).toContain("deep link");
  });
  it("keeps the write/delete/external-send boundaries", () => {
    expect(CRM_PERSONA.toLowerCase()).toContain("propose");
    expect(CRM_PERSONA.toLowerCase()).toContain("never delete");
    expect(CRM_PERSONA.toLowerCase()).toContain("external");
  });
});
