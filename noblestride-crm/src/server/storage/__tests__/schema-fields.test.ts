import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

describe("Document storage schema", () => {
  it("exposes the new file + version fields on Document", () => {
    const fields = Prisma.dmmf.datamodel.models.find((m) => m.name === "Document")!.fields.map((f) => f.name);
    for (const f of ["storageProvider", "storageKey", "mimeType", "sizeBytes", "checksum", "originalFilename", "previousVersionId", "isCurrent"]) {
      expect(fields).toContain(f);
    }
  });

  it("defines the DocumentAccessLog model", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "DocumentAccessLog");
    expect(model).toBeDefined();
    expect(model!.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["documentId", "userId", "action", "at"]));
  });
});
