import { describe, it, expect } from "vitest";
import { CrudError, actorSource } from "@/server/services/crud";

describe("crud helpers", () => {
  it("actorSource maps actor types to provenance", () => {
    expect(actorSource({ type: "HUMAN" })).toBe("HUMAN");
    expect(actorSource({ type: "AGENT" })).toBe("AGENT");
    expect(actorSource({ type: "API" })).toBe("API");
  });

  it("CrudError is an Error with name CrudError", () => {
    const e = new CrudError("blocked");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("CrudError");
    expect(e.message).toBe("blocked");
  });
});
