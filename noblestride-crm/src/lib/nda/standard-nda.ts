// The Noblestride open NDA, as a versioned template (F3.2 / image7).
//
// Pure and client-importable: the portal renders it for reading before signing,
// and the same function reproduces the signed document afterwards. That is why
// the version string exists — an ESignEnvelope keeps `templateVersion` and the
// signature image, and the agreement someone actually signed is regenerated
// from those two. Editing the clauses below WITHOUT bumping the version would
// silently rewrite history; bump it and the old envelopes keep pointing at the
// old wording.
//
// The wording is Noblestride's own, following the confidentiality terms of the
// signed SOW §06. Aika's agreement (docs/feedback/aika-reference/) was used as a
// structural reference for what a click-wrap flow needs to show — never as text.

export const NDA_TEMPLATE_VERSION = "NS-OPEN-NDA-2026-08";

export interface NdaRenderInput {
  investorName: string;
  signerName: string;
  signedAt: Date | null;
}

export interface NdaClause {
  heading: string;
  body: string;
}

export const NDA_CLAUSES: readonly NdaClause[] = [
  {
    heading: "1. Confidential Information",
    body:
      "\"Confidential Information\" means any information disclosed by Noblestride Capital Limited " +
      "(\"Noblestride\") to the Recipient in connection with a potential investment opportunity, in any " +
      "form and whether or not marked confidential. It includes the identity of the underlying client, " +
      "teasers, information memoranda, financial models, valuations, forecasts, commercial terms, and " +
      "the existence and status of any transaction or discussion.",
  },
  {
    heading: "2. Permitted Use",
    body:
      "The Recipient may use Confidential Information solely to evaluate whether to pursue the " +
      "opportunity to which it relates. It may not be used to compete with the client, to approach the " +
      "client or its counterparties directly, to solicit its employees or customers, or for any purpose " +
      "outside that evaluation.",
  },
  {
    heading: "3. Non-disclosure and Standard of Care",
    body:
      "The Recipient will keep Confidential Information confidential and will disclose it only to those " +
      "of its directors, officers, employees and professional advisers who need it for the permitted " +
      "use, who are informed of its confidential nature, and who are bound by obligations no less " +
      "protective than these. The Recipient will protect it with at least the care it applies to its own " +
      "confidential information, and remains responsible for any breach by a person to whom it disclosed it.",
  },
  {
    heading: "4. Exclusions",
    body:
      "These obligations do not apply to information that is or becomes public through no breach of " +
      "this agreement, was already lawfully known to the Recipient without a duty of confidence, is " +
      "independently developed without use of Confidential Information, or is received from a third " +
      "party entitled to disclose it. Where disclosure is required by law, regulation or a competent " +
      "authority, the Recipient will, so far as lawfully permitted, notify Noblestride first and " +
      "disclose no more than is required.",
  },
  {
    heading: "5. Term and Survival",
    body:
      "This agreement takes effect on signature and applies to Confidential Information disclosed at " +
      "any time. The confidentiality obligations survive for three (3) years from the date of the last " +
      "disclosure, and indefinitely for information that constitutes a trade secret under applicable law.",
  },
  {
    heading: "6. Return or Destruction",
    body:
      "On Noblestride's written request, the Recipient will return or destroy all Confidential " +
      "Information and any copies, and confirm that it has done so, except for one copy retained solely " +
      "to meet a legal, regulatory or internal record-keeping requirement, which remains subject to " +
      "this agreement.",
  },
  {
    heading: "7. No Licence and No Obligation to Transact",
    body:
      "No licence or other right in Confidential Information is granted. Nothing here obliges either " +
      "party to proceed with, or to continue discussing, any transaction, and neither party makes any " +
      "representation or warranty as to the accuracy or completeness of Confidential Information. " +
      "Noblestride is acting as an advisor and is not providing investment advice to the Recipient.",
  },
  {
    heading: "8. Governing Law and Disputes",
    body:
      "This agreement is governed by the laws of Kenya. The parties will attempt in good faith to " +
      "resolve any dispute by discussion, failing which the courts of Kenya have exclusive jurisdiction.",
  },
];

/** A signature is a small image; the value is stored in a text column. */
export const SIGNATURE_MAX_BYTES = 200 * 1024;

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export function isSignatureDataUrl(v: string): boolean {
  if (!v || v.length > SIGNATURE_MAX_BYTES) return false;
  return PNG_DATA_URL.test(v);
}

export function renderStandardNda(input: NdaRenderInput): {
  version: string;
  title: string;
  preamble: string;
  clauses: readonly NdaClause[];
  countersignature: { name: string; title: string; org: string };
} {
  const signedOn = input.signedAt
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
        input.signedAt,
      )
    : null;

  return {
    version: NDA_TEMPLATE_VERSION,
    title: signedOn
      ? `Non-Disclosure Agreement — signed ${signedOn}`
      : "Non-Disclosure Agreement",
    preamble:
      `This Non-Disclosure Agreement is made between Noblestride Capital Limited, of Nairobi, Kenya, ` +
      `and ${input.investorName} (the "Recipient"), in connection with the Recipient's evaluation of ` +
      `investment opportunities introduced by Noblestride.`,
    clauses: NDA_CLAUSES,
    countersignature: {
      // Countersignature is pre-applied: Noblestride is offering these terms, so
      // the fund is not waiting on a second signature to get access.
      name: "For and on behalf of",
      title: "Noblestride Capital Limited",
      org: "Noblestride Capital Limited",
    },
  };
}
