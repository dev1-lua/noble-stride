import { describe, it, expect } from "vitest";
import type { LuaTool } from "lua-cli";
import { isStaffVerified, withStaffGuard, STAFF_ONLY_REFUSAL } from "../staff-mode";

describe("isStaffVerified", () => {
  it("is true only when data.verified === true", () => {
    expect(isStaffVerified({ verified: true })).toBe(true);
    expect(isStaffVerified({ verified: false })).toBe(false);
    expect(isStaffVerified({ verified: "true" })).toBe(false);
    expect(isStaffVerified(undefined)).toBe(false);
    expect(isStaffVerified({})).toBe(false);
  });
});

describe("withStaffGuard", () => {
  function dummy(onRun: () => void): LuaTool {
    return {
      name: "dummy",
      description: "d",
      inputSchema: {} as never,
      execute: async () => {
        onRun();
        return { status: "ok" as const };
      },
    } as unknown as LuaTool;
  }

  it("returns a NEW delegating object that preserves name/description/inputSchema", () => {
    const tool = dummy(() => {});
    const guarded = withStaffGuard(tool, async () => true);
    // A fresh object (not the mutated instance) so dispatch can't bypass the guard
    // via prototype method capture (review MED-2).
    expect(guarded).not.toBe(tool);
    expect(guarded.name).toBe(tool.name);
    expect(guarded.description).toBe(tool.description);
    expect(guarded.inputSchema).toBe(tool.inputSchema);
  });

  it("refuses (and never runs the tool) for a non-staff caller", async () => {
    let ran = false;
    const guarded = withStaffGuard(dummy(() => (ran = true)), async () => false);
    const res = await guarded.execute({});
    expect(res).toEqual(STAFF_ONLY_REFUSAL);
    expect(ran).toBe(false);
  });

  it("runs the tool for a verified staff caller", async () => {
    let ran = false;
    const guarded = withStaffGuard(dummy(() => (ran = true)), async () => true);
    const res = await guarded.execute({});
    expect(res).toEqual({ status: "ok" });
    expect(ran).toBe(true);
  });
});
