import { describe, it, expect } from "vitest";
import { buildMutationInput } from "@/components/ui/use-entity-form";

describe("buildMutationInput()", () => {
  it("strips the id field", () => {
    expect(buildMutationInput({ id: "abc123", name: "Alice" })).toEqual({
      name: "Alice",
    });
  });

  it("drops empty string values", () => {
    expect(buildMutationInput({ name: "Alice", note: "" })).toEqual({
      name: "Alice",
    });
  });

  it("drops null values", () => {
    expect(buildMutationInput({ name: "Alice", note: null })).toEqual({
      name: "Alice",
    });
  });

  it("drops undefined values", () => {
    expect(buildMutationInput({ name: "Alice", note: undefined })).toEqual({
      name: "Alice",
    });
  });

  it("keeps false booleans", () => {
    expect(buildMutationInput({ active: false })).toEqual({ active: false });
  });

  it("keeps zero", () => {
    expect(buildMutationInput({ amount: 0 })).toEqual({ amount: 0 });
  });

  it("keeps empty arrays", () => {
    expect(buildMutationInput({ tags: [] })).toEqual({ tags: [] });
  });

  it("keeps non-empty strings", () => {
    expect(buildMutationInput({ name: "Alice" })).toEqual({ name: "Alice" });
  });

  it("strips id alongside dropping blanks, keeping everything else", () => {
    expect(
      buildMutationInput({
        id: "rec_1",
        name: "Alice",
        note: "",
        active: false,
        amount: 0,
        tags: [],
        nickname: null,
        title: undefined,
      })
    ).toEqual({
      name: "Alice",
      active: false,
      amount: 0,
      tags: [],
    });
  });
});
