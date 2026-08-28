// The Noblestride NDA, rendered for reading (F3.2 / image7).
//
// A plain server component: the same output serves the pre-signature read and
// the post-signature "View" — the only difference is whether a signature block
// is filled in. Noblestride's countersignature is pre-applied, because
// Noblestride is the party offering these terms; the fund is not left waiting
// on a second signature before it can be granted access.

import { renderStandardNda } from "@/lib/nda/standard-nda";

export function NdaDocument({
  investorName,
  signerName,
  signedAt,
  signatureImage,
}: {
  investorName: string;
  signerName: string;
  signedAt: Date | null;
  signatureImage?: string | null;
}) {
  const doc = renderStandardNda({ investorName, signerName, signedAt });

  return (
    <article
      data-testid="nda-document"
      className="max-h-[28rem] overflow-y-auto rounded-md border border-[var(--border-subtle)] bg-white px-6 py-5 text-[13px] leading-relaxed text-gray-900"
    >
      <header className="border-b border-gray-200 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Noblestride Capital Limited
        </p>
        <h3 className="mt-1 text-base font-semibold text-gray-900">{doc.title}</h3>
        <p className="mt-0.5 text-[11px] text-gray-500">Template {doc.version}</p>
      </header>

      <p className="mt-4">{doc.preamble}</p>

      <ol className="mt-4 space-y-3">
        {doc.clauses.map((clause) => (
          <li key={clause.heading}>
            <p className="font-semibold text-gray-900">{clause.heading}</p>
            <p className="mt-0.5 text-gray-700">{clause.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 border-t border-gray-200 pt-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Noblestride Capital Limited</p>
          <p className="mt-3 font-[cursive] text-lg text-gray-900">Noblestride Capital</p>
          <p className="mt-1 border-t border-gray-300 pt-1 text-[11px] text-gray-600">
            {doc.countersignature.name} {doc.countersignature.title}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{investorName}</p>
          {signatureImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={signatureImage} alt={`Signature of ${signerName}`} className="mt-2 max-h-14" />
          ) : (
            <p className="mt-3 text-lg text-gray-400">—</p>
          )}
          <p className="mt-1 border-t border-gray-300 pt-1 text-[11px] text-gray-600">
            {signerName || "Authorised signatory"}
          </p>
        </div>
      </div>
    </article>
  );
}
