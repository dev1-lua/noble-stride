// portal/investor/nda — the investor's own NDA surface (F3.2 / image7:
// "the investor should be able to open the Noblestride NDA and sign it, or
// upload their own for sign-off").
//
// This is also the answer to the D2 tension: the client expected deal detail to
// unmask on interest, but SOW §06 forbids sharing confidential information
// without an NDA. Rather than weaken the guard, the NDA is one click away.
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePortalMember, capabilitiesOf } from "@/server/auth/portal-authz";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { NdaDocument } from "@/components/portal/nda-document";
import { SignaturePad } from "@/components/portal/signature-pad";
import { NDA_TEMPLATE_VERSION } from "@/lib/nda/standard-nda";
import { signStandardNdaAction } from "./actions";
import { OwnNdaCard } from "./own-nda-card";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, { text: string; tone: "ok" | "bad" }> = {
  signed: { text: "Thank you — your NDA is signed and on file.", tone: "ok" },
  submitted: { text: "Your NDA has been sent to Noblestride for sign-off.", tone: "ok" },
  "signature-missing": { text: "Add your signature before signing.", tone: "bad" },
  "signatory-missing": { text: "Confirm that you are an authorised signatory.", tone: "bad" },
  "name-missing": { text: "Enter the full name of the signatory.", tone: "bad" },
  throttled: { text: "Too many attempts. Please try again shortly.", tone: "bad" },
  failed: { text: "Something went wrong. Please try again.", tone: "bad" },
};

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export default async function InvestorNdaPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; denied?: string; resign?: string }>;
}) {
  const member = await requirePortalMember();
  const { canEdit } = capabilitiesOf(member);
  const { notice, denied, resign } = await searchParams;

  const investor = await prisma.investor.findUnique({
    where: { id: member.investorId },
    select: { id: true, name: true, ndaStatus: true, openNdaSignedAt: true },
  });
  if (!investor) redirect("/login");

  // The signature evidence, newest first: re-signing is additive, so the most
  // recent completed envelope is the one in force.
  const latestEnvelope = await prisma.eSignEnvelope.findFirst({
    where: { investorId: investor.id, kind: "OpenNda", status: "completed" },
    orderBy: { completedAt: "desc" },
    select: { signerName: true, signatureImage: true, completedAt: true, templateVersion: true, provider: true },
  });
  const ndaDocuments = await prisma.document.findMany({
    where: { investorId: investor.id, type: "NDA" },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, name: true, status: true, uploadedAt: true },
  });

  const signed = investor.ndaStatus === "OpenNDA";
  const showForm = !signed || resign === "1";
  const banner = notice ? NOTICES[notice] : undefined;

  return (
    <div className="space-y-6">
      {denied === "edit" && (
        <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          Your access is view-only. A team member with edit access can sign on behalf of the fund.
        </p>
      )}
      {banner && (
        <p
          data-testid="nda-notice"
          className={
            "rounded-md px-4 py-3 text-sm " +
            (banner.tone === "ok"
              ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
              : "bg-[var(--t-tag-bg-rose)] text-[var(--t-tag-text-rose)]")
          }
        >
          {banner.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Sign the Noblestride NDA</h2>
            {signed && (
              <span
                data-testid="nda-signed-chip"
                className="rounded-full bg-[var(--t-tag-bg-emerald)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-emerald)]"
              >
                Signed{investor.openNdaSignedAt ? ` ${fmt(investor.openNdaSignedAt)}` : ""}
              </span>
            )}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            One agreement covers every opportunity Noblestride shares with your fund. Read it, sign it here, and
            detailed deal information can be released to you.
          </p>

          <NdaDocument
            investorName={investor.name}
            signerName={latestEnvelope?.signerName ?? member.label}
            signedAt={signed ? (latestEnvelope?.completedAt ?? investor.openNdaSignedAt ?? null) : null}
            signatureImage={signed ? latestEnvelope?.signatureImage : null}
          />

          {signed && !showForm && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-[var(--text-tertiary)]">
                Signed by {latestEnvelope?.signerName ?? "your fund"}
                {latestEnvelope?.templateVersion ? ` · template ${latestEnvelope.templateVersion}` : ""}
              </span>
              {canEdit && (
                <Link
                  href="/portal/investor/nda?resign=1"
                  data-testid="nda-resign"
                  className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
                >
                  Re-sign
                </Link>
              )}
            </div>
          )}

          {showForm &&
            (canEdit ? (
              <form action={signStandardNdaAction} className="space-y-4" data-testid="nda-sign-form">
                <label className="block max-w-md">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--text-tertiary)]">
                    Full name of the signatory
                  </span>
                  <input
                    type="text"
                    name="signerName"
                    required
                    defaultValue={member.label}
                    data-testid="nda-signer-name"
                    className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </label>

                <SignaturePad defaultName={member.label} />

                <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    name="authorisedSignatory"
                    data-testid="nda-authorised"
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)]"
                  />
                  <span>I am an authorised signatory of {investor.name} and I agree to the terms above.</span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    data-testid="nda-sign-submit"
                    className="rounded bg-[var(--t-tag-bg-emerald)] px-3 py-1.5 text-sm font-medium text-[var(--t-tag-text-emerald)] hover:opacity-80"
                  >
                    Sign NDA
                  </button>
                  <span className="text-[11px] text-[var(--text-tertiary)]">Template {NDA_TEMPLATE_VERSION}</span>
                </div>
              </form>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">
                A team member with edit access can sign on behalf of the fund.
              </p>
            ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Or upload your own NDA</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            If your fund uses its own confidentiality agreement, upload it here. Noblestride will review and
            countersign it, and it then replaces the agreement above.
          </p>

          {ndaDocuments.length > 0 && (
            <ul className="divide-y divide-[var(--border-subtle)]" data-testid="own-nda-list">
              {ndaDocuments.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-sm text-[var(--text-primary)]">{doc.name}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {doc.status === "Executed" ? "Executed" : "Under review"} · {fmt(doc.uploadedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <OwnNdaCard canEdit={canEdit} />
        </CardBody>
      </Card>
    </div>
  );
}
