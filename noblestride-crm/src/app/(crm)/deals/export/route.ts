import { NextRequest } from "next/server";
import { parseDealsQuery } from "@/server/domain/deals-queue";
import { dealsCsvRows } from "@/server/services/deals-queue";

function escape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// CSV export of the current filtered/sorted deals queue — same query params
// as /deals (minus page/cols/view), but exports the whole matching set, not
// just one page.
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const rows = await dealsCsvRows(parseDealsQuery(sp));
  const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deals-${date}.csv"`,
    },
  });
}
