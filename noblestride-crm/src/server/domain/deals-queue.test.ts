import { describe, it, expect } from "vitest";
import { parseDealsQuery, parseColumns, DEAL_COLUMNS, TICKET_BANDS } from "./deals-queue";

describe("parseDealsQuery", () => {
  it("defaults sort/dir/page/pageSize and empty groupBy when params absent", () => {
    const s = parseDealsQuery({});
    expect(s.sort).toBe("dateOnboarded");
    expect(s.dir).toBe("desc");
    expect(s.page).toBe(1);
    expect(s.pageSize).toBe(50);
    expect(s.groupBy).toBe("");
    expect(s.type).toBeUndefined();
    expect(s.view).toBe("list");
  });
  it("parses view=board, and falls back to list for anything else", () => {
    expect(parseDealsQuery({ view: "board" }).view).toBe("board");
    expect(parseDealsQuery({ view: "list" }).view).toBe("list");
    expect(parseDealsQuery({ view: "haxx" }).view).toBe("list");
  });
  it("reads filter params through", () => {
    const s = parseDealsQuery({ type: "transaction", sector: "Healthcare", q: "  amber ", sort: "ticket", dir: "asc", group: "lead", page: "3" });
    expect(s.type).toBe("transaction");
    expect(s.sector).toBe("Healthcare");
    expect(s.search).toBe("amber");
    expect(s.sort).toBe("ticket");
    expect(s.dir).toBe("asc");
    expect(s.groupBy).toBe("lead");
    expect(s.page).toBe(3);
  });
  it("rejects an unknown sort key back to the default", () => {
    expect(parseDealsQuery({ sort: "haxx" }).sort).toBe("dateOnboarded");
  });
  it("clamps page to >= 1", () => {
    expect(parseDealsQuery({ page: "0" }).page).toBe(1);
    expect(parseDealsQuery({ page: "-4" }).page).toBe(1);
    expect(parseDealsQuery({ page: "notanumber" }).page).toBe(1);
  });
});

describe("parseColumns", () => {
  it("returns the default column keys when absent", () => {
    const cols = parseColumns(undefined);
    const defaults = DEAL_COLUMNS.filter((c) => c.default).map((c) => c.key);
    expect(cols).toEqual(defaults);
  });
  it("keeps only known column keys, preserving order", () => {
    expect(parseColumns("company,haxx,ticket")).toEqual(["company", "ticket"]);
  });
});

describe("TICKET_BANDS", () => {
  it("are contiguous ascending with an open top band", () => {
    expect(TICKET_BANDS[0].min).toBe(0);
    expect(TICKET_BANDS[TICKET_BANDS.length - 1].max).toBeNull();
  });
});
