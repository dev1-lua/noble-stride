import { describe, it, expect } from "vitest";
import { resolveRecord, resolveAnyRecord, type SearchResult } from "../resolve";

const r = (id: string, type: string, title: string): SearchResult => ({ id, type, title, href: `/x/${id}` });

describe("resolveRecord", () => {
  it("matches the single result of the right type", () => {
    const res = resolveRecord([r("1", "Client", "Acme Ltd"), r("2", "Investor", "Acme Fund")], "client", "acme");
    expect(res).toEqual({ kind: "match", result: r("1", "Client", "Acme Ltd") });
  });

  it("prefers an exact case-insensitive title match over ambiguity", () => {
    const res = resolveRecord(
      [r("1", "Investor", "Abraaj Group"), r("2", "Investor", "Abraaj Group II")],
      "investor",
      "abraaj group",
    );
    expect(res).toEqual({ kind: "match", result: r("1", "Investor", "Abraaj Group") });
  });

  it("matches by exact id (agent retry after candidate pick)", () => {
    const res = resolveRecord([r("cm123", "Mandate", "Busoga"), r("cm456", "Mandate", "Busoga II")], "mandate", "cm456");
    expect(res).toEqual({ kind: "match", result: r("cm456", "Mandate", "Busoga II") });
  });

  it("returns up to 5 candidates when ambiguous", () => {
    const many = Array.from({ length: 8 }, (_, i) => r(`${i}`, "Transaction", `Deal ${i}`));
    const res = resolveRecord(many, "transaction", "deal");
    expect(res.kind).toBe("ambiguous");
    if (res.kind === "ambiguous") expect(res.candidates).toHaveLength(5);
  });

  it("returns none when no result matches the type", () => {
    expect(resolveRecord([r("1", "Client", "Acme")], "partner", "acme")).toEqual({ kind: "none" });
  });
});

describe("resolveAnyRecord (type-agnostic — 'check everything on X')", () => {
  it("accepts a single summarizable hit regardless of its type, and reports the type", () => {
    const res = resolveAnyRecord([r("m1", "Mandate", "Sizwe Phamaceuticals Limited")], "Sizwe Pharmaceuticals Limited");
    expect(res).toEqual({ kind: "match", result: r("m1", "Mandate", "Sizwe Phamaceuticals Limited"), recordType: "mandate" });
  });

  it("prefers an exact title match across mixed types", () => {
    const res = resolveAnyRecord(
      [r("c1", "Client", "Acme"), r("t1", "Transaction", "Acme Raise")],
      "acme",
    );
    expect(res).toMatchObject({ kind: "match", recordType: "client" });
    if (res.kind === "match") expect(res.result.id).toBe("c1");
  });

  it("ignores non-summarizable hits (Task/Person/Document/ServiceProvider)", () => {
    const res = resolveAnyRecord(
      [r("tk1", "Task", "Call Acme"), r("p1", "Person", "Acme Person"), r("inv1", "Investor", "Acme Capital")],
      "acme",
    );
    // Only the Investor is summarizable → single match.
    expect(res).toMatchObject({ kind: "match", recordType: "investor" });
    if (res.kind === "match") expect(res.result.id).toBe("inv1");
  });

  it("returns ambiguous when several summarizable records of any type match and none is an exact-title hit", () => {
    const res = resolveAnyRecord(
      [r("1", "Client", "Deal Co"), r("2", "Mandate", "Deal Co Mandate"), r("3", "Transaction", "Deal Co Raise")],
      "deal",
    );
    expect(res.kind).toBe("ambiguous");
  });

  it("returns none when only non-summarizable hits exist", () => {
    expect(resolveAnyRecord([r("tk1", "Task", "Do a thing")], "thing")).toEqual({ kind: "none" });
  });
});
