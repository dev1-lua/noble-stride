// engagement/page.tsx — the flat all-together board was replaced by the two
// focal views (By Deal / By Investor). Land on the default focal view.
import { redirect } from "next/navigation";

export default function EngagementPage() {
  redirect("/engagement/deals");
}
