// mandates/page.tsx — old list route, consolidated into the unified /deals queue.
import { redirect } from "next/navigation";

export default function MandatesRedirect() {
  redirect("/deals?type=mandate");
}
