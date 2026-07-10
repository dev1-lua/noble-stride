import { describe, it, expect } from "vitest";
import { buildEnvelopeBody } from "../docusign";

describe("buildEnvelopeBody", () => {
  it("produces a single-document, single-signer, status=sent envelope with an anchor tab", () => {
    const body = buildEnvelopeBody({
      kind: "OpenNda", documentBase64: "QkFTRTY0", documentName: "NDA.pdf",
      signer: { email: "jane@fund.com", name: "Jane Doe" }, subject: "Please sign the NDA", linkRecord: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    expect(body.status).toBe("sent");
    expect(body.emailSubject).toBe("Please sign the NDA");
    expect(body.documents[0]).toMatchObject({ documentBase64: "QkFTRTY0", name: "NDA.pdf", fileExtension: "pdf", documentId: "1" });
    const signer = body.recipients.signers[0];
    expect(signer).toMatchObject({ email: "jane@fund.com", name: "Jane Doe", recipientId: "1" });
    expect(signer.tabs.signHereTabs[0].anchorString).toBe("/sig1/");
  });
});
