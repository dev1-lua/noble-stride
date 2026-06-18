import { prisma } from "@/lib/db";
import { jwtVerify } from "jose";

export interface Actor {
  type: "HUMAN" | "AGENT" | "API";
  userId?: string;
  label?: string;
}

export interface GraphQLContext {
  prisma: typeof prisma;
  actor: Actor;
}

/**
 * Build the per-request context. External callers (e.g. Lua agents) present an
 * API-key JWT in `Authorization: Bearer <jwt>`; internal UI calls run as HUMAN.
 */
export async function createContext(request: Request): Promise<GraphQLContext> {
  const auth = request.headers.get("authorization");
  let actor: Actor = { type: "HUMAN" };

  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    try {
      const secret = new TextEncoder().encode(process.env.API_JWT_SECRET ?? "");
      const { payload } = await jwtVerify(token, secret);
      actor = {
        type: (payload.actorType as Actor["type"]) ?? "API",
        userId: payload.sub,
        label: payload.label as string | undefined,
      };
    } catch {
      // Invalid token → treat as anonymous API caller (resolvers may restrict).
      actor = { type: "API" };
    }
  }

  return { prisma, actor };
}
