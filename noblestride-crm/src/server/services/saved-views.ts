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
  return rows.map((r) => ({ id: r.id, name: r.name, entity: r.entity, config: toConfig(r.config) }));
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
