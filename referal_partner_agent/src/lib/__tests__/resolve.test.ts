import { describe, it, expect } from "vitest";
import { resolveRecord, type SearchResult } from "../resolve";

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
