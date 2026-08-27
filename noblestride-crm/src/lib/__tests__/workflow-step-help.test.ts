import { describe, it, expect } from "vitest";
import { WORKFLOW_STEP_HELP } from "@/lib/glossary";
import { DEFAULT_WORKFLOW_STEPS } from "@/server/domain/workflow-default";

// Guards the Help panel against drifting from the seeded default template:
// WORKFLOW_STEP_HELP is derived from DEFAULT_WORKFLOW_STEPS (the single source
// of truth the seed writes), so titles/order/descriptions always match.

describe("WORKFLOW_STEP_HELP", () => {
  it("has exactly 13 entries, one per default step, in order", () => {
    expect(WORKFLOW_STEP_HELP).toHaveLength(13);
    expect(WORKFLOW_STEP_HELP.map((s) => s.key)).toEqual(DEFAULT_WORKFLOW_STEPS.map((s) => s.key));
    expect(WORKFLOW_STEP_HELP.map((s) => s.title)).toEqual(DEFAULT_WORKFLOW_STEPS.map((s) => s.title));
  });

  it("every step has a phase and a non-empty one-line description", () => {
    for (const step of WORKFLOW_STEP_HELP) {
      expect(["Qualify", "Prepare", "Execute"]).toContain(step.phase);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});
