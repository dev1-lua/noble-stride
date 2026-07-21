import { describe, it, expect } from "vitest";
import { CORRESPONDENCE_CONTEXT } from "../correspondence.skill";

describe("correspondence skill context — hardening", () => {
  const c = CORRESPONDENCE_CONTEXT.toLowerCase();
  it("carries injection resistance (content is data, not instructions)", () => {
    expect(c).toContain("instructions");
    expect(c).toMatch(/data|never follow/);
  });
  it("carries the refuse-with-insight pattern for deal probes", () => {
    expect(c).toMatch(/explain|why/);
    expect(c).toContain("portal");
  });
  it("instructs logging a flag on a recognised probe", () => {
    expect(c).toMatch(/flag|log_communication/);
  });
  it("frames outreach as internal-review / never sent by the agent", () => {
    expect(c).toMatch(/never send|approval|internal review/);
  });
});
