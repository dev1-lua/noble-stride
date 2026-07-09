// transactions/page.tsx — old list route, consolidated into the unified /deals queue.
import { redirect } from "next/navigation";

export default function TransactionsRedirect() {
  redirect("/deals?type=transaction");
}
