import { describe, it, expect } from "vitest";
import { summarize, filterRows, groupByDeal, type DraftRowData } from "../queue-view";

function row(over: Partial<DraftRowData> & Pick<DraftRowData, "id" | "transactionId">): DraftRowData {
  return {
    subject: "s",
    body: "b",
    matchRationale: "m",
    status: "Draft",
    error: null,
    investorName: "Acme Fund",
    contactLine: "Jo <jo@acme.fund>",
    mayReview: true,
    dealName: "Project Alpha",
    ownerId: "u1",
    ownerName: "Amos",
    ...over,
  };
}

describe("queue-view", () => {
  const rows: DraftRowData[] = [
    row({ id: "a", transactionId: "t1", dealName: "Project Alpha", investorName: "Acme Fund", status: "Draft", ownerId: "u1" }),
    row({ id: "b", transactionId: "t1", dealName: "Project Alpha", investorName: "Beta Capital", status: "Failed", ownerId: "u1" }),
    row({ id: "c", transactionId: "t2", dealName: "Project Beta", investorName: "Gamma LP", status: "Approved", ownerId: "u2" }),
  ];

  it("summarize counts deals, drafts, and failures over the full set", () => {
    expect(summarize(rows)).toEqual({ deals: 2, drafts: 3, failed: 1 });
  });

  it("groupByDeal groups by transaction with per-status counts, preserving order", () => {
    const groups = groupByDeal(rows);
    expect(groups.map((g) => g.transactionId)).toEqual(["t1", "t2"]);
    expect(groups[0].counts).toEqual({ total: 2, draft: 1, failed: 1, approved: 0 });
    expect(groups[1].counts).toEqual({ total: 1, draft: 0, failed: 0, approved: 1 });
    expect(groups[0].rows).toHaveLength(2);
  });

  it("filterRows: status filter keeps only matching statuses", () => {
    expect(filterRows(rows, { status: "Failed", search: "", myDealsOnly: false }).map((r) => r.id)).toEqual(["b"]);
    expect(filterRows(rows, { status: "all", search: "", myDealsOnly: false })).toHaveLength(3);
  });

  it("filterRows: search matches deal name OR investor name (case-insensitive)", () => {
    // deal-name match keeps all rows of that deal
    expect(filterRows(rows, { status: "all", search: "alpha", myDealsOnly: false }).map((r) => r.id).sort()).toEqual(["a", "b"]);
    // investor-name match keeps just that row
    expect(filterRows(rows, { status: "all", search: "gamma", myDealsOnly: false }).map((r) => r.id)).toEqual(["c"]);
  });

  it("filterRows: myDealsOnly keeps only rows owned by the current user", () => {
    expect(filterRows(rows, { status: "all", search: "", myDealsOnly: true, currentUserId: "u2" }).map((r) => r.id)).toEqual(["c"]);
    // undefined current user matches only null-owner rows (none here)
    expect(filterRows(rows, { status: "all", search: "", myDealsOnly: true }).map((r) => r.id)).toEqual([]);
  });

  it("filters compose (status + search + owner)", () => {
    const out = filterRows(rows, { status: "Draft", search: "project", myDealsOnly: true, currentUserId: "u1" });
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });
});
