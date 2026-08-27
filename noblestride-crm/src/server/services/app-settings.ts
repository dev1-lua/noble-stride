// app-settings.ts — read/write layer for admin-editable global settings
// (Aug-2026 feedback image29/30: hide portal finance tiles / milestone list by
// default, admin toggle; F5.8: switch the public agent off).
//
// Defs live in `src/lib/app-settings.ts` (pure, client-safe); this module owns
// the `AppSetting` table access and a small module-level cache.
//
// Caching: values are read at most once per SETTINGS_TTL_MS per process. In a
// multi-instance deployment (Vercel), instance B sees instance A's write once
// its own cache entry expires — i.e. all instances converge within the TTL.
// `setSetting` also updates the local cache and revalidates the consuming
// paths so the instance that took the write reflects it immediately.

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { APP_SETTING_DEFS, parseBool, type AppSettingDef } from "@/lib/app-settings";

export const SETTINGS_TTL_MS = 30_000;

type CacheEntry = { value: string; at: number };
const cache = new Map<string, CacheEntry>();

function defFor(key: string): AppSettingDef {
  const def = APP_SETTING_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`Unknown app setting: ${key}`);
  return def;
}

/** Raw string value of a setting; falls back to the def default when no row exists. */
export async function getSetting(key: string): Promise<string> {
  const def = defFor(key);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < SETTINGS_TTL_MS) return hit.value;
  const row = await prisma.appSetting.findUnique({ where: { key } });
  const value = row?.value ?? def.default;
  cache.set(key, { value, at: now });
  return value;
}

/** Boolean view of a setting. `fallback` defaults to the def's default. */
export async function getBoolSetting(key: string, fallback?: boolean): Promise<boolean> {
  const def = defFor(key);
  const fb = fallback ?? parseBool(def.default, false);
  return parseBool(await getSetting(key), fb);
}

export interface AppSettingRow {
  def: AppSettingDef;
  value: string;
  updatedAt: Date | null;
}

/** Every def joined with its stored row (def default + null updatedAt when unset). */
export async function listSettings(): Promise<AppSettingRow[]> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: APP_SETTING_DEFS.map((d) => d.key) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return APP_SETTING_DEFS.map((def) => {
    const row = byKey.get(def.key);
    return { def, value: row?.value ?? def.default, updatedAt: row?.updatedAt ?? null };
  });
}

/**
 * Persist a setting (upsert), refresh the local cache and revalidate the
 * consuming paths listed on the def. Callers gate with requireRealAdmin();
 * `actor` is accepted for symmetry/logging only — AppSetting has no audit
 * columns (dump-parity schema).
 */
export async function setSetting(key: string, value: string, actor: { id: string }): Promise<void> {
  const def = defFor(key);
  if (def.type === "boolean" && value !== "true" && value !== "false") {
    throw new Error(`App setting ${key} is boolean; got "${value}"`);
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  cache.set(key, { value, at: Date.now() });
  console.info(`[app-settings] ${key}=${value} by user ${actor.id}`);
  for (const p of def.revalidate) revalidatePath(p);
}

/** Test hook / explicit reset — drops every cached value. */
export function invalidateSettingsCache(): void {
  cache.clear();
}
