// F5.6: partner login. Before this, resolveViewpointFor handled only INVESTOR
// and INTERNAL, so `vp.role === "partner"` was unreachable and every page under
// /portal/partner — which already gates on it — was dead code.

import { describe, it, expect } from "vitest";
import { resolveViewpointFor, type CurrentAuth } from "@/server/auth/current";

const account = (kind: "PARTNER" | "INVESTOR") =>
  ({ id: "a1", email: "p@partner.test", kind }) as CurrentAuth["account"];

const person = (partnerId: string | null) =>
  ({
    id: "p1",
    firstName: "P",
    lastName: null,
    partnerId,
    investorId: null,
    investor: null,
    partner: partnerId ? { id: partnerId } : null,
  }) as unknown as CurrentAuth["person"];

describe("resolveViewpointFor — PARTNER", () => {
  it("yields a partner viewpoint scoped to the partner id", async () => {
    expect(
      await resolveViewpointFor({ account: account("PARTNER"), user: null, person: person("part-1") }),
    ).toEqual({ role: "partner", recordId: "part-1" });
  });

  it("treats an orphaned partner account as signed out", async () => {
    expect(
      await resolveViewpointFor({ account: account("PARTNER"), user: null, person: person(null) }),
    ).toBeNull();
    expect(
      await resolveViewpointFor({ account: account("PARTNER"), user: null, person: null }),
    ).toBeNull();
  });

  it("does not confuse a partner-linked INVESTOR account for a partner", async () => {
    // An INVESTOR account whose Person happens to carry a partnerId must still
    // resolve by its account kind, and with no investorId it is orphaned.
    expect(
      await resolveViewpointFor({ account: account("INVESTOR"), user: null, person: person("part-1") }),
    ).toBeNull();
  });
});
