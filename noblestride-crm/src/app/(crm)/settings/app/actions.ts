"use server";
// settings/app/actions.ts — admin toggles for global AppSettings
// (Aug-2026 feedback image29/30, F5.8). Gated on the REAL admin role.

import { revalidatePath } from "next/cache";
import { requireRealAdmin } from "@/server/auth/require-real-admin";
import { setSetting } from "@/server/services/app-settings";

export interface SettingActionState {
  error?: string;
  /** Echo of the value just saved, so the client can settle its optimistic state. */
  value?: string;
}

export async function toggleSettingAction(_prev: SettingActionState, formData: FormData): Promise<SettingActionState> {
  const key = String(formData.get("key") ?? "");
  const next = String(formData.get("next") ?? "");
  try {
    const admin = await requireRealAdmin();
    await setSetting(key, next, { id: admin.user!.id });
    revalidatePath("/settings/app");
    return { value: next };
  } catch (err) {
    if (err instanceof Error && err.message === "Not authorized") return { error: "Not authorized." };
    if (err instanceof Error) return { error: err.message };
    throw err;
  }
}
