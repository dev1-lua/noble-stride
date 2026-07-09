import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { createSavedView, listSavedViews, renameSavedView, deleteSavedView } from "../saved-views";

let dbUp = true;
beforeAll(async () => { try { await prisma.$queryRaw`SELECT 1`; } catch { dbUp = false; } });

describe.skipIf(!dbUp)("saved-views service (DB)", () => {
  it("round-trips create → list → rename → delete", async () => {
    const cfg = { filters: { type: "transaction" }, sort: "ticket", dir: "desc", columns: ["name", "company"], groupBy: "", view: "list" as const };
    const created = await createSavedView({ name: "Test View", config: cfg });
    expect(created.id).toBeTruthy();
    const listed = await listSavedViews("deals");
    expect(listed.find((v) => v.id === created.id)?.config.sort).toBe("ticket");
    await renameSavedView(created.id, "Renamed View");
    const relisted = await listSavedViews("deals");
    expect(relisted.find((v) => v.id === created.id)?.name).toBe("Renamed View");
    await deleteSavedView(created.id);
    const after = await listSavedViews("deals");
    expect(after.find((v) => v.id === created.id)).toBeUndefined();
  });
});
