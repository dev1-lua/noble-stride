import { createYoga } from "graphql-yoga";
import { schema } from "@/graphql/schema";
import { createContext } from "@/graphql/context";
import { maskDomainError } from "@/graphql/mask-error";

export const runtime = "nodejs";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  context: ({ request }) => createContext(request),
  fetchAPI: { Response },
  // Surface expected domain errors (NDA guard, CRUD guards, registration,
  // validation) with their real message; mask everything else as before.
  maskedErrors: { maskError: maskDomainError },
});

export { yoga as GET, yoga as POST };
