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

describe("applyTableFilters — getAll (multi-valued rows)", () => {
  type Client = { name: string; hqCountry: string | null; countries: string[] };
  const clients: Client[] = [
    { name: "Acme", hqCountry: "Kenya", countries: ["EastAfrica"] },
    { name: "Bolt", hqCountry: "Uganda", countries: [] },
    { name: "Cee", hqCountry: null, countries: ["WestAfrica", "EastAfrica"] },
  ];
  const search = (c: Client) => [c.name];
  const filters = [
    {
      key: "country",
      label: "Country",
      options: [],
      get: (c: Client) => c.hqCountry ?? "",
      getAll: (c: Client) => [c.hqCountry, ...c.countries].filter((v): v is string => Boolean(v)),
    },
  ];

  it("matches when ANY of the row's values is selected", () => {
    const out = applyTableFilters(clients, "", { country: ["EastAfrica"] }, search, filters);
    expect(out.map((c) => c.name)).toEqual(["Acme", "Cee"]);
  });
  it("still matches the primary value", () => {
    expect(applyTableFilters(clients, "", { country: ["Uganda"] }, search, filters).map((c) => c.name)).toEqual(["Bolt"]);
  });
  it("a row with no values matches nothing once the filter is set", () => {
    const noneRow: Client[] = [{ name: "Empty", hqCountry: null, countries: [] }];
    expect(applyTableFilters(noneRow, "", { country: ["Kenya"] }, search, filters)).toHaveLength(0);
    expect(applyTableFilters(noneRow, "", {}, search, filters)).toHaveLength(1);
  });
  it("getAll takes precedence over get", () => {
    const out = applyTableFilters(clients, "", { country: ["WestAfrica"] }, search, filters);
    expect(out.map((c) => c.name)).toEqual(["Cee"]);
  });
});
