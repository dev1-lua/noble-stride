import { describe, it, expect } from "vitest";
import { taskCreateSchema, taskUpdateSchema } from "./task";

describe("taskCreateSchema — linked record required (§3.8)", () => {
  it("rejects a task with no linked record", () => {
    const res = taskCreateSchema.safeParse({ title: "Follow up" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/at least one record/i);
      expect(res.error.issues[0].path).toEqual([]); // form-level, no field path
    }
  });

  it("accepts a task linked to an investor", () => {
    expect(taskCreateSchema.safeParse({ title: "Follow up", investorId: "inv-1" }).success).toBe(true);
  });

  it("accepts a task linked to a mandate/transaction/client", () => {
    expect(taskCreateSchema.safeParse({ title: "x", mandateId: "m1" }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ title: "x", transactionId: "t1" }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ title: "x", clientId: "c1" }).success).toBe(true);
  });

  it("accepts a task linked only to a partner (referral review task, no deal yet)", () => {
    expect(taskCreateSchema.safeParse({ title: "Review referral introduction", partnerId: "p1" }).success).toBe(true);
  });

  it("still rejects when partnerId is blank/whitespace", () => {
    expect(taskCreateSchema.safeParse({ title: "x", partnerId: "" }).success).toBe(false);
  });

  it("update schema does NOT require a link (partial edits)", () => {
    expect(taskUpdateSchema.safeParse({ title: "renamed" }).success).toBe(true);
  });
});
