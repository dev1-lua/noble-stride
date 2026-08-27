import { describe, it, expect } from "vitest";
import { checksumOf, planChecksumFixes } from "../lib/migration-checksums";
describe("migration checksums", () => {
  it("sha256-hex of the raw sql", () => {
    expect(checksumOf("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("classifies local vs db rows", () => {
    const plan = planChecksumFixes(
      [{ name: "a", checksum: "1" }, { name: "b", checksum: "2" }, { name: "c", checksum: "3" }],
      [{ migration_name: "a", checksum: "1" }, { migration_name: "b", checksum: "x" }, { migration_name: "d", checksum: "9" }],
    );
    expect(plan.update).toEqual([{ name: "b", from: "x", to: "2" }]);
    expect(plan.missingInDb).toEqual(["c"]);
    expect(plan.missingLocally).toEqual(["d"]);
  });
});
