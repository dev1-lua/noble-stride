// /apply/status is fully public and anonymous, so nothing it renders may come
// from the URL and nothing may hint at whether an application exists. These
// tests pin both rules.

import { describe, it, expect } from "vitest";
import {
  applyStatusNotice,
  applyStatusError,
  APPLY_STATUS_NOTICES,
  APPLY_STATUS_ERRORS,
} from "../messages";

describe("apply-status copy", () => {
  it("maps every known slug to real copy", () => {
    for (const slug of Object.keys(APPLY_STATUS_NOTICES)) {
      expect(applyStatusNotice(slug)).toBeTruthy();
    }
    for (const slug of Object.keys(APPLY_STATUS_ERRORS)) {
      expect(applyStatusError(slug)).toBeTruthy();
    }
  });

  it("collapses unknown slugs to one generic line instead of reflecting them", () => {
    const injected = "<img src=x onerror=alert(1)>";
    for (const bad of ["nonsense", injected, "code-sent-extra"]) {
      expect(applyStatusNotice(bad)).not.toContain(bad);
      expect(applyStatusError(bad)).not.toContain(bad);
      expect(applyStatusNotice(bad)).toBeTruthy();
      expect(applyStatusError(bad)).toBeTruthy();
    }
    expect(applyStatusNotice(undefined)).toBeNull();
    expect(applyStatusError(undefined)).toBeNull();
    expect(applyStatusNotice("")).toBeNull();
  });

  it("never contains an email address — the copy must not echo who was looked up", () => {
    for (const copy of [...Object.values(APPLY_STATUS_NOTICES), ...Object.values(APPLY_STATUS_ERRORS)]) {
      expect(copy).not.toContain("@");
    }
  });

  it("the code-sent line is deliberately non-committal about whether an application exists", () => {
    expect(APPLY_STATUS_NOTICES["code-sent"]).toMatch(/if /i);
  });
});
