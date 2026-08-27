// settings/app/page.tsx — Admin-only global toggles (Aug-2026 feedback
// image29/30: portal finance tiles + milestone checklist hidden by default with
// an admin switch; F5.8: public agent on/off). Guarded server-side against the
// REAL role, exactly like settings/users/page.tsx.

import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/server/auth/current";
import { listSettings } from "@/server/services/app-settings";
import { SettingToggle } from "./setting-toggle";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function AppSettingsPage() {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user?.isActive) {
    redirect("/dashboard");
  }

  const rows = await listSettings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">App settings</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Global switches for the investor portal and the public chat agent. Changes apply to every
          instance within about 30 seconds.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Feature switches</h2>
        </div>
        {rows.map((r) => (
          <SettingToggle
            key={r.def.key}
            settingKey={r.def.key}
            label={r.def.label}
            description={r.def.description}
            value={r.value === "true" ? "true" : "false"}
            updatedAt={formatDateTime(r.updatedAt)}
          />
        ))}
      </div>
    </div>
  );
}
