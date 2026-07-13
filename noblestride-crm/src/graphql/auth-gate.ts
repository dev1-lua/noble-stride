// Authentication gate for /api/graphql. Anonymous requests may only run
// pure-introspection queries (schema shape, not data). Everything else
// requires an authenticated actor: session cookie, Bearer JWT, or the
// Lua summary agent's x-agent-key (see context.ts).
import { GraphQLError, Kind, type DocumentNode } from "graphql";
import type { Plugin } from "graphql-yoga";
import type { GraphQLContext } from "./context";

export function isIntrospectionOnly(document: DocumentNode, operationName?: string | null): boolean {
  const ops = document.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  const op = operationName ? ops.find((o) => o.name?.value === operationName) : ops[0];
  if (!op || op.operation !== "query") return false;
  return op.selectionSet.selections.every(
    (sel) => sel.kind === Kind.FIELD && sel.name.value.startsWith("__"),
  );
}

export const UNAUTHENTICATED_CODE = "UNAUTHENTICATED";

export function useAuthGate(): Plugin {
  return {
    onExecute({ args }) {
      const ctx = args.contextValue as GraphQLContext;
      if (ctx.actor?.authenticated) return;
      if (isIntrospectionOnly(args.document, args.operationName)) return;
      throw new GraphQLError("Unauthorized: authentication required", {
        extensions: { code: UNAUTHENTICATED_CODE, http: { status: 401 } },
      });
    },
  };
}
