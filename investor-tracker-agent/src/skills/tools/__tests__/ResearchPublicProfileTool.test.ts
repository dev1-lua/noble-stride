// A4 / F5.2. The tool owns the boundary, not the search: refuse confidential
// queries before the network call, label everything that comes back, and never
// throw.

import { describe, it, expect, vi } from "vitest";
import { ResearchPublicProfileTool } from "../ResearchPublicProfileTool";
import { PUBLIC_LABEL } from "../../../lib/research";

describe("research_public_profile", () => {
  it("labels a sourced brief as public and passes the configured model through", async () => {
    const generate = vi.fn(async () => ({
      text: "Acme opened a plant.",
      sources: [{ sourceType: "url" as const, id: "1", url: "https://x.test" }],
    }));
    const out = await new ResearchPublicProfileTool({ generate, model: "google/gemini-2.5-flash" }).execute({
      name: "Acme Ltd",
      kind: "company",
      focus: "recent news",
    });
    expect(out.status).toBe("ok");
    expect(out.label).toBe(PUBLIC_LABEL);
    expect(out.sources).toEqual([{ url: "https://x.test", title: null }]);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ model: "google/gemini-2.5-flash" }));
  });

  it("refuses a confidential query before any network call", async () => {
    const generate = vi.fn();
    for (const input of [
      { name: "Project Ivory Oryx", kind: "company" as const },
      { name: "Acme Ltd", kind: "company" as const, focus: "their USD 4,500,000 raise" },
    ]) {
      const out = await new ResearchPublicProfileTool({ generate }).execute(input);
      expect(out.status).toBe("unavailable");
      expect(out.message).toContain("must never leave Noblestride");
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns unavailable, never a throw, when the model call fails", async () => {
    const out = await new ResearchPublicProfileTool({
      generate: async () => {
        throw new Error("boom");
      },
    }).execute({ name: "Acme Ltd", kind: "company" });
    expect(out.status).toBe("unavailable");
    expect(out.message).toContain("not available right now");
  });

  it("returns no_public_info on the marker", async () => {
    const out = await new ResearchPublicProfileTool({
      generate: async () => ({ text: "NO_PUBLIC_INFO" }),
    }).execute({ name: "Nonexistent Holdings", kind: "company" });
    expect(out.status).toBe("no_public_info");
    expect(out.brief).toBeNull();
  });

  it("refuses to pass off unsourced prose as public information", async () => {
    const out = await new ResearchPublicProfileTool({
      generate: async () => ({ text: "They are probably doing well.", sources: [] }),
    }).execute({ name: "Acme Ltd", kind: "company" });
    expect(out.status).toBe("no_public_info");
  });
});
