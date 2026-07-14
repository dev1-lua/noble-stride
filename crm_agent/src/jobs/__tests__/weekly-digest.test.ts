import { describe, it, expect, vi } from "vitest";
import { runWeeklyDigest } from "../weekly-digest.job";

const NOW = new Date("2026-07-13T06:00:00Z");

function deps(overrides: Partial<Parameters<typeof runWeeklyDigest>[0]> = {}) {
  return {
    generateDigest: vi.fn(async () => "# digest"),
    data: {
      create: vi.fn(async () => ({}) as never),
      get: vi.fn(
        async () =>
          ({
            data: [{ data: { userId: "u1" } }, { data: { userId: "u2" } }, { data: { userId: "u1" } }],
            pagination: {},
          }) as never,
      ),
    },
    send: vi.fn(async () => ({})),
    now: () => NOW,
    ...overrides,
  };
}

describe("runWeeklyDigest", () => {
  it("stores the digest with weekOf, dedupes staff_users by userId, and delivers to every unique registered staff user", async () => {
    const d = deps();
    const result = await runWeeklyDigest(d);
    expect(d.data.create).toHaveBeenCalledWith(
      "digests",
      expect.objectContaining({ weekOf: "2026-07-13", markdown: "# digest" }),
      expect.any(String),
    );
    expect(d.send).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ stored: true, delivered: 2, failed: 0 });
  });

  it("one failed delivery does not stop the others", async () => {
    const d = deps({
      send: vi.fn(async (userId: string) => {
        if (userId === "u1") throw new Error("channel closed");
        return {};
      }),
    });
    const result = await runWeeklyDigest(d);
    expect(result).toEqual({ stored: true, delivered: 1, failed: 1 });
  });
});
