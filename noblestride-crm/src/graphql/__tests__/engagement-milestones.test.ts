import { describe, it, expect } from "vitest";
import type { GraphQLObjectType } from "graphql";
import { schema } from "@/graphql/schema";

describe("Engagement.milestones exposure", () => {
  it("Engagement type exposes a milestones field", () => {
    const engagement = schema.getType("Engagement") as GraphQLObjectType;
    expect(Object.keys(engagement.getFields())).toContain("milestones");
  });
});
