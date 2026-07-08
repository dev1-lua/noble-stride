import { describe, it, expect } from "vitest";
import { JOURNEY_STEP_HELP } from "@/lib/glossary";
import { JOURNEY_TITLES } from "@/server/domain/journey";

// Guards the Task-18 help panel against ever drifting from the Task-15
// journey spine: JOURNEY_STEP_HELP's titles must stay verbatim-identical, in
// order, to journey.ts's JOURNEY_TITLES.

describe("JOURNEY_STEP_HELP", () => {
  it("has exactly 17 entries", () => {
    expect(JOURNEY_STEP_HELP).toHaveLength(17);
    expect(JOURNEY_TITLES).toHaveLength(17);
  });

  it("titles match journey.ts's JOURNEY_TITLES verbatim, in order", () => {
    expect(JOURNEY_STEP_HELP.map((s) => s.title)).toEqual([...JOURNEY_TITLES]);
  });

  it("every step has a non-empty one-line description", () => {
    for (const step of JOURNEY_STEP_HELP) {
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});
