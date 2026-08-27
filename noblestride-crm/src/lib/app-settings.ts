// app-settings.ts — admin-editable global settings (image29/30 feedback):
// defs only, pure (no `@prisma/client` import). Task 3 builds the
// read/write service on top of `APP_SETTING_DEFS`; `scripts/seed-workflow-defaults.ts`
// create-only-upserts each def's `default` into the `AppSetting` table.

export type AppSettingDef = {
  key: string;
  type: "boolean";
  default: string;
  label: string;
  description: string;
  revalidate: string[];
};

export const APP_SETTING_DEFS: AppSettingDef[] = [
  {
    key: "portal.dashboard.financeTiles",
    type: "boolean",
    default: "false",
    label: "Investor portal: finance KPI tiles",
    description:
      "Show committed / disbursed / IRR tiles and the Disbursements-by-Quarter chart on the investor dashboard. Values come from CRM Engagement records; investors never edit them.",
    revalidate: ["/portal/investor/dashboard"],
  },
  {
    key: "agent.client.enabled",
    type: "boolean",
    default: "true",
    label: "Public client agent",
    description: "Enable the public chat agent on /talk-to-us. When off, the page shows the intake-form fallback.",
    revalidate: ["/talk-to-us"],
  },
  {
    key: "portal.deal.milestones",
    type: "boolean",
    default: "false",
    label: "Investor portal: milestone checklist",
    description:
      "Show the read-only deal-progress checklist on portal deal pages (Success fee paid is never shown).",
    revalidate: ["/portal/investor/pipeline", "/portal/investor/deals/[id]"],
  },
];

/** "true" -> true, "false" -> false, anything else (including null/undefined) -> fallback. */
export function parseBool(v: string | null | undefined, fallback: boolean): boolean {
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}
