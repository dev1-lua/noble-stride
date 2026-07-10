import { describe, it, expect } from "vitest";
import { applyTableFilters } from "./table-filter";

type Row = { email: string; role: string };
const rows: Row[] = [
  { email: "solomon@noblestride.capital", role: "Admin" },
  { email: "ivy@noblestride.capital", role: "TeamMember" },
  { email: "cmiriti@ifc.org", role: "TeamMember" },
];
const searchText = (r: Row) => [r.email, r.role];
const filters = [{ key: "role", label: "Role", options: [], get: (r: Row) => r.role }];

describe("applyTableFilters", () => {
  it("matches search case-insensitively across fields", () => {
    expect(applyTableFilters(rows, "IVY", {}, searchText, filters).map((r) => r.email)).toEqual(["ivy@noblestride.capital"]);
  });
  it("applies a filter with a single selected value", () => {
    expect(applyTableFilters(rows, "", { role: ["Admin"] }, searchText, filters)).toHaveLength(1);
  });
  it("OR-matches within a filter when multiple values are selected", () => {
    const out = applyTableFilters(rows, "", { role: ["Admin", "TeamMember"] }, searchText, filters);
    expect(out).toHaveLength(3);
  });
  it("an empty selected array imposes no constraint (matches all)", () => {
    expect(applyTableFilters(rows, "", { role: [] }, searchText, filters)).toHaveLength(3);
  });
  it("intersects search + filter", () => {
    expect(applyTableFilters(rows, "ifc", { role: ["TeamMember"] }, searchText, filters)).toHaveLength(1);
  });
  it("AND-matches across multiple filters", () => {
    const multiFilters = [
      { key: "role", label: "Role", options: [], get: (r: Row) => r.role },
      { key: "email", label: "Email", options: [], get: (r: Row) => r.email },
    ];
    // Row must match the role filter AND the email filter.
    const out = applyTableFilters(
      rows,
      "",
      { role: ["TeamMember"], email: ["ivy@noblestride.capital"] },
      searchText,
      multiFilters,
    );
    expect(out).toEqual([{ email: "ivy@noblestride.capital", role: "TeamMember" }]);
  });
  it("empty query + no active filters returns all", () => {
    expect(applyTableFilters(rows, "", {}, searchText, filters)).toHaveLength(3);
  });
});
