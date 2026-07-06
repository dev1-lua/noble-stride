// prep-milestones.tsx — deal-preparation checklist for the transaction page.
// The five target-company preparation milestones (PREP_MILESTONES) are derived
// from the document register, not stored: a milestone is "done" when the
// transaction has a document of the matching type. Server component.
import { visiblePrepMilestones } from "@/lib/milestones";

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
      <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
        <path
          d="M3.5 8.5l3 3 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function EmptyIcon() {
  return (
    <span
      className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-200 bg-white"
      aria-hidden="true"
    />
  );
}

/** `docTypes` = the DocumentType values of the transaction's linked documents. */
export function PrepMilestones({ docTypes, financingType }: { docTypes: string[]; financingType?: string | null }) {
  const present = new Set(docTypes);

  return (
    <ul className="divide-y divide-zinc-100">
      {visiblePrepMilestones(financingType).map((m) => {
        const done = present.has(m.docType);
        return (
          <li key={m.key} className="flex items-center gap-3 py-2.5">
            {done ? <CheckIcon /> : <EmptyIcon />}
            <span
              className={
                "flex-1 text-sm " + (done ? "font-medium text-zinc-900" : "text-zinc-500")
              }
            >
              {m.label}
            </span>
            <span
              className={
                "text-xs font-medium uppercase tracking-wide " +
                (done ? "text-emerald-600" : "text-zinc-400")
              }
            >
              {done ? "Prepared" : "Pending"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
