import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface SavedViewConfig {
  filters: Record<string, string>;
  sort: string;
  dir: string;
  columns: string[];
  groupBy: string;
  view: "list" | "board";
}

// Built-in starter views. Defined in code (not the DB) so every environment —
// including production, which was never seeded — always shows them. They carry
// synthetic `default:*` ids and are surfaced with `isDefault: true`; the UI
// treats them as read-only presets (no rename/delete). Users' own views are
// still created in the DB via "Save current as…".
const STARTER_VIEWS: Array<{ id: string; name: string; config: SavedViewConfig }> = [
  {
    id: "default:active-mandates",
    name: "Active mandates",
    config: { filters: { type: "mandate" }, sort: "dateOnboarded", dir: "desc", columns: [], groupBy: "stage", view: "list" },
  },
  {
    id: "default:live-transactions",
    name: "Live transactions",
    config: { filters: { type: "transaction" }, sort: "ticket", dir: "desc", columns: [], groupBy: "stage", view: "list" },
  },
  {
    id: "default:closing-this-quarter",
    name: "Closing this quarter",
    config: { filters: { type: "transaction", stage: "Closing" }, sort: "daysInStage", dir: "desc", columns: [], groupBy: "", view: "list" },
  },
];

function toConfig(json: Prisma.JsonValue): SavedViewConfig {
  const c = (json ?? {}) as Partial<SavedViewConfig>;
  return {
    filters: c.filters ?? {},
    sort: c.sort ?? "dateOnboarded",
    dir: c.dir ?? "desc",
    columns: c.columns ?? [],
    groupBy: c.groupBy ?? "",
    view: c.view === "board" ? "board" : "list",
  };
}

export async function listSavedViews(entity = "deals") {
  const rows = await prisma.savedView.findMany({ where: { entity }, orderBy: { createdAt: "asc" } });
  // Built-in presets apply only to the deals queue today. Prepend them, then
  // append DB rows — skipping any DB row that collides by name with a preset
  // (e.g. a DB previously seeded with these same starter views) so the list
  // never shows duplicates.
  const starters = entity === "deals" ? STARTER_VIEWS : [];
  const starterNames = new Set(starters.map((s) => s.name));
  const dbRows = rows
    .filter((r) => !starterNames.has(r.name))
    .map((r) => ({ id: r.id, name: r.name, entity: r.entity, config: toConfig(r.config), isDefault: false }));
  return [...starters.map((s) => ({ ...s, entity, isDefault: true })), ...dbRows];
}

export async function createSavedView(input: { name: string; entity?: string; config: SavedViewConfig }) {
  const row = await prisma.savedView.create({
    data: { name: input.name.trim(), entity: input.entity ?? "deals", config: input.config as unknown as Prisma.InputJsonValue },
  });
  return { id: row.id, name: row.name, entity: row.entity, config: toConfig(row.config) };
}

export async function renameSavedView(id: string, name: string) {
  return prisma.savedView.update({ where: { id }, data: { name: name.trim() } });
}

export async function deleteSavedView(id: string) {
  return prisma.savedView.delete({ where: { id } });
}
