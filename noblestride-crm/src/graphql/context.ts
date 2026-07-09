import { prisma } from "@/lib/db";
import { jwtVerify } from "jose";
import type { OrgRole } from "@prisma/client";
import { validateSessionToken } from "@/server/auth/session";
import { SESSION_COOKIE } from "@/server/auth/session-cookie";
import { IMPERSONATION_COOKIE } from "@/server/auth/impersonation";
import { resolveViewpointFor, type CurrentAuth } from "@/server/auth/current";

export interface Actor {
  type: "HUMAN" | "AGENT" | "API";
  userId?: string;
  label?: string;
  /**
   * True only for a verified session cookie or a valid Bearer JWT.
   * Optional (not required) so the many pre-existing `Actor` literals across
   * service functions/tests (e.g. `{ type: "HUMAN" }`) keep compiling — those
   * call service functions directly and never pass through the RBAC
   * enforcement in `server/rbac/enforce.ts`, which only reads `ctx.actor` as
   * built by `createContext` below (where this field is always set).
   */
  authenticated?: boolean;
  /** Effective in-org role (lens-aware) — internal HUMAN actors only. */
  orgRole?: OrgRole;
  accountKind?: "INTERNAL" | "INVESTOR";
}

export interface GraphQLContext {
  prisma: typeof prisma;
  actor: Actor;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** Cookie-authed browser calls must be same-origin (CSRF; Bearer calls exempt). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit Origin
  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Per-request context. Priority: Bearer JWT (external agents/API — unchanged
 * contract) → session cookie (browser UI) → anonymous (no rights).
 */
export async function createContext(request: Request): Promise<GraphQLContext> {
  const auth = request.headers.get("authorization");
  let actor: Actor = { type: "HUMAN", authenticated: false };

  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    try {
      const secret = new TextEncoder().encode(process.env.API_JWT_SECRET ?? "");
      const { payload } = await jwtVerify(token, secret);
      actor = {
        type: (payload.actorType as Actor["type"]) ?? "API",
        userId: payload.sub,
        label: payload.label as string | undefined,
        authenticated: true,
      };
    } catch {
      // Invalid token → treat as anonymous API caller (resolvers must restrict).
      actor = { type: "API", authenticated: false };
    }
    return { prisma, actor };
  }

  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (sessionToken && sameOrigin(request)) {
    const validated = await validateSessionToken(sessionToken);
    if (validated) {
      const { account } = validated;
      const [user, person] = await Promise.all([
        account.userId ? prisma.user.findUnique({ where: { id: account.userId } }) : null,
        account.personId
          ? prisma.person.findUnique({ where: { id: account.personId }, include: { investor: true } })
          : null,
      ]);
      const current: CurrentAuth = { account, user, person };
      const vp = await resolveViewpointFor(current, readCookie(request, IMPERSONATION_COOKIE));
      if (vp) {
        actor = {
          type: "HUMAN",
          authenticated: true,
          accountKind: account.kind,
          userId: vp.role === "admin" ? (vp.userId ?? user?.id) : undefined,
          orgRole: vp.role === "admin" ? ((vp.orgRole ?? "Admin") as OrgRole) : undefined,
        };
      }
    }
  }
  return { prisma, actor };
}
