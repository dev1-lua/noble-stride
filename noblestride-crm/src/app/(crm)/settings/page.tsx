// settings/page.tsx — /settings has no content of its own; land on App settings.
import { redirect } from "next/navigation";

export default function SettingsIndexPage() {
  redirect("/settings/app");
}
