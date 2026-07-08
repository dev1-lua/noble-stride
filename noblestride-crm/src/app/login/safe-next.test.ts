import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepts a plain same-origin path", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
  });

  it("accepts a path with query string unchanged", () => {
    expect(safeNext("/deals/123?tab=x")).toBe("/deals/123?tab=x");
  });

  it("rejects protocol-relative paths", () => {
    expect(safeNext("//evil.com")).toBeNull();
  });

  it("rejects the backslash bypass", () => {
    expect(safeNext("/\\evil.com")).toBeNull();
  });

  it("rejects absolute URLs", () => {
    expect(safeNext("https://evil.com")).toBeNull();
  });

  it("rejects non-slash-leading values", () => {
    expect(safeNext("http:/evil")).toBeNull();
    expect(safeNext("evil.com")).toBeNull();
  });

  it("rejects undefined and empty string", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext("")).toBeNull();
  });
});
